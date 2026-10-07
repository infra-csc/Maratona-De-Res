import { Router } from "express";
import { db, quarterlyResultsTable, employeesTable, eventsTable, absencesTable, eventParticipantsTable, employeeCycleEligibilityTable, type Cycle } from "@workspace/db";
import { and, eq, exists, sql, type SQL } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { computeEventTeamResult, computeEventTeamResultsBatch } from "./results.js";
import { resolveCycleScope, sendScopeError } from "../lib/cycle-scope.js";
import { rankingScope } from "../lib/ranking-scope.js";

const router = Router();
router.use(requireAuth);

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))];
  return lines.join("\n");
}

function cycleSlug(name: string): string {
  return name.trim().replace(/\s+/g, "-");
}

/**
 * Os CSVs saem com o MESMO recorte da tela de onde são baixados:
 * ?cycleId= vazio = ciclo atual; id = aquele ciclo (anterior: só consulta).
 */
async function cycleFromQuery(req: import("express").Request, res: import("express").Response): Promise<{ cycle: Cycle; isCurrent: boolean } | null | "error"> {
  const scoped = await resolveCycleScope(req.query.cycleId, { allowAll: false });
  if (sendScopeError(res, scoped)) return "error";
  return scoped.scope?.kind === "cycle" ? { cycle: scoped.scope.cycle, isCurrent: scoped.scope.isCurrent } : null;
}

/**
 * Recorte da tela Resultados (GET /results/quarterly): colaborador da casa,
 * com participação que conta no ciclo; no ciclo atual só ativos.
 */
function resultsScreenScope(cycle: Cycle, isCurrent: boolean): SQL {
  return and(
    eq(quarterlyResultsTable.cycleId, cycle.id),
    eq(employeesTable.employmentType, "casa"),
    isCurrent ? eq(employeesTable.active, true) : undefined,
    exists(
      db.select({ one: sql`1` })
        .from(eventParticipantsTable)
        .innerJoin(eventsTable, eq(eventParticipantsTable.eventId, eventsTable.id))
        .where(and(
          eq(eventParticipantsTable.employeeId, employeesTable.id),
          eq(eventsTable.cycleId, cycle.id),
          sql`(${eventParticipantsTable.functionName} IS NULL OR ${eventParticipantsTable.functionName} NOT ILIKE 'sup ceno%')`,
        )),
    ),
  )!;
}

router.get("/exports/quarterly-results", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const r = await cycleFromQuery(req, res);
  if (r === "error") return;
  if (!r) { res.json({ filename: `resultados.csv`, data: "" }); return; }
  const { cycle, isCurrent } = r;

  const results = await db
    .select({
      "Nome": employeesTable.name,
      "Nº Eventos": quarterlyResultsTable.eventsCount,
      "Média Bruta": quarterlyResultsTable.grossAverage,
      "Total Faltas": quarterlyResultsTable.totalAbsences,
      "Penalidade Faltas": quarterlyResultsTable.absencePenalty,
      "Resultado Final": quarterlyResultsTable.finalResult,
      "Faixa": quarterlyResultsTable.platoon,
      "Bônus Caju (R$)": quarterlyResultsTable.bonusValue,
    })
    .from(quarterlyResultsTable)
    .innerJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    .where(resultsScreenScope(cycle, isCurrent))
    .orderBy(sql`${quarterlyResultsTable.finalResult} DESC`, employeesTable.name);

  const rows = results.map(r => ({ "Ciclo": cycle.name, ...r }));
  res.json({ filename: `resultados-${cycleSlug(cycle.name)}.csv`, data: toCsv(rows as never) });
});

router.get("/exports/ranking", async (req, res) => {
  const isManager = !!req.user && ["admin", "rh", "diretoria"].includes(req.user.role);
  const r = await cycleFromQuery(req, res);
  if (r === "error") return;
  if (!r) { res.json({ filename: `ranking.csv`, data: "" }); return; }
  const { cycle, isCurrent } = r;

  const results = await db
    .select({
      employeeName: employeesTable.name,
      finalResult: quarterlyResultsTable.finalResult,
      platoon: quarterlyResultsTable.platoon,
      bonusValue: quarterlyResultsTable.bonusValue,
    })
    .from(quarterlyResultsTable)
    .innerJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    // Mesmo recorte do Ranking da tela (lib/ranking-scope.ts).
    .where(and(eq(quarterlyResultsTable.cycleId, cycle.id), rankingScope({ activeOnlyInCycleId: isCurrent ? cycle.id : null })));

  const sorted = results.sort((a, b) => parseFloat(b.finalResult) - parseFloat(a.finalResult));
  const rows = sorted.map((r, i) => {
    const row: Record<string, unknown> = {
      "Posição": i + 1,
      "Ciclo": cycle.name,
      "Nome": r.employeeName,
      "Resultado Final": r.finalResult,
      "Faixa": r.platoon ?? "",
    };
    if (isManager) row["Bônus Caju (R$)"] = r.bonusValue;
    return row;
  });

  res.json({ filename: `ranking-${cycleSlug(cycle.name)}.csv`, data: toCsv(rows) });
});

router.get("/exports/event-results", async (req, res) => {
  const { eventId } = req.query;
  if (!eventId) { res.status(400).json({ error: "eventId obrigatório" }); return; }
  const id = parseInt(eventId as string);
  const [ev] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!ev) { res.status(404).json({ error: "Evento não encontrado" }); return; }

  const team = await computeEventTeamResult(id);
  const rows: Record<string, unknown>[] = team.criteriaDetails.map(cd => ({
    "Critério": cd.criterionName,
    "Área Responsável": cd.responsibleAreaLabel ?? "",
    "Nota da Equipe": cd.scoreUsed != null ? cd.scoreUsed.toFixed(2) : "",
    "Peso": cd.weight,
    "Total Ponderado": cd.criterionTotal != null ? cd.criterionTotal.toFixed(2) : "",
    "Status": cd.status,
  }));
  rows.push({
    "Critério": "RESULTADO DO EVENTO",
    "Área Responsável": "",
    "Nota da Equipe": "",
    "Peso": "",
    "Total Ponderado": team.eventScore.toFixed(2),
    "Status": team.isComplete ? "completo" : "pendente",
  });

  res.json({ filename: `evento-${ev.name}.csv`, data: toCsv(rows) });
});

router.get("/exports/caju-bonuses", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const r = await cycleFromQuery(req, res);
  if (r === "error") return;
  if (!r) { res.json({ filename: `bonus-caju.csv`, data: "" }); return; }
  const { cycle, isCurrent } = r;

  const results = await db
    .select({
      "Nome": employeesTable.name,
      "Faixa": quarterlyResultsTable.platoon,
      "Resultado Final": quarterlyResultsTable.finalResult,
      "Bônus Caju (R$)": quarterlyResultsTable.bonusValue,
    })
    .from(quarterlyResultsTable)
    .innerJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    // Recorte da aba Pagamentos (o mesmo de Resultados), só quem é elegível.
    .where(and(resultsScreenScope(cycle, isCurrent), eq(quarterlyResultsTable.eligible, true)))
    .orderBy(sql`${quarterlyResultsTable.bonusValue} DESC`, employeesTable.name);

  const rows = results.map(r => ({ "Ciclo": cycle.name, ...r }));
  res.json({ filename: `bonus-caju-${cycleSlug(cycle.name)}.csv`, data: toCsv(rows as never) });
});

router.get("/exports/absences", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const r = await cycleFromQuery(req, res);
  if (r === "error") return;
  if (!r) { res.json({ filename: `penalidades.csv`, data: "" }); return; }
  const { cycle } = r;

  const results = await db
    .select({
      "Nome": employeesTable.name,
      "Penalidade": absencesTable.penaltyType,
      "Evento": eventsTable.name,
      "Pontos": absencesTable.points,
      "Data": absencesTable.date,
      "Quantidade": absencesTable.quantity,
      "Motivo": absencesTable.reason,
    })
    .from(absencesTable)
    .leftJoin(employeesTable, eq(absencesTable.employeeId, employeesTable.id))
    .leftJoin(eventsTable, eq(absencesTable.eventId, eventsTable.id))
    // Quem o admin tirou do ciclo não entra (mesmo recorte de Análises/Dashboard).
    .where(and(eq(absencesTable.cycleId, cycle.id),
      sql`NOT EXISTS (SELECT 1 FROM ${employeeCycleEligibilityTable} x WHERE x.employee_id = ${absencesTable.employeeId} AND x.cycle_id = ${absencesTable.cycleId} AND x.excluded)`))
    .orderBy(absencesTable.date);

  const rows = results.map(r => ({ ...r, "Ciclo": cycle.name }));
  res.json({ filename: `penalidades-${cycleSlug(cycle.name)}.csv`, data: toCsv(rows as never) });
});

router.get("/exports/pending-evaluations", requireRole("admin", "rh", "diretoria"), async (_req, res) => {
  const openEvents = await db.select().from(eventsTable).where(eq(eventsTable.status, "open"));
  const rows: Record<string, unknown>[] = [];
  // Um carregamento em lote para todos os eventos abertos (antes: N consultas por evento).
  const teams = await computeEventTeamResultsBatch(openEvents.map(ev => ev.id));
  for (const ev of openEvents) {
    const team = teams.get(ev.id)!;
    for (const cd of team.criteriaDetails) {
      if (cd.status !== "avaliado") {
        rows.push({
          "Evento": ev.name,
          "Critério": cd.criterionName,
          "Área Responsável": cd.responsibleAreaLabel ?? "",
          "Status": cd.status,
        });
      }
    }
  }
  res.json({ filename: `avaliacoes-pendentes.csv`, data: toCsv(rows) });
});

export default router;
