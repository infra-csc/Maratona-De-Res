import { Router } from "express";
import { db, quarterlyResultsTable, employeesTable, eventsTable, absencesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { computeEventTeamResult } from "./results.js";
import { getCurrentCycle } from "../lib/cycle.js";

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

router.get("/exports/quarterly-results", requireRole("admin", "rh", "diretoria"), async (_req, res) => {
  const cycle = await getCurrentCycle();
  if (!cycle) { res.json({ filename: `resultados.csv`, data: "" }); return; }

  const results = await db
    .select({
      "Nome": employeesTable.name,
      "Nº Eventos": quarterlyResultsTable.eventsCount,
      "Média Bruta": quarterlyResultsTable.grossAverage,
      "Total Faltas": quarterlyResultsTable.totalAbsences,
      "Penalidade Faltas": quarterlyResultsTable.absencePenalty,
      "Resultado Final": quarterlyResultsTable.finalResult,
      "Pelotão": quarterlyResultsTable.platoon,
      "Bônus Caju (R$)": quarterlyResultsTable.bonusValue,
    })
    .from(quarterlyResultsTable)
    .leftJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    .where(eq(quarterlyResultsTable.cycleId, cycle.id))
    .orderBy(quarterlyResultsTable.finalResult);

  const rows = results.map(r => ({ "Ciclo": cycle.name, ...r }));
  res.json({ filename: `resultados-${cycleSlug(cycle.name)}.csv`, data: toCsv(rows as never) });
});

router.get("/exports/ranking", async (_req, res) => {
  const cycle = await getCurrentCycle();
  if (!cycle) { res.json({ filename: `ranking.csv`, data: "" }); return; }

  const results = await db
    .select({
      employeeName: employeesTable.name,
      finalResult: quarterlyResultsTable.finalResult,
      platoon: quarterlyResultsTable.platoon,
      bonusValue: quarterlyResultsTable.bonusValue,
    })
    .from(quarterlyResultsTable)
    .leftJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    .where(eq(quarterlyResultsTable.cycleId, cycle.id));

  const sorted = results.sort((a, b) => parseFloat(b.finalResult) - parseFloat(a.finalResult));
  const rows = sorted.map((r, i) => ({
    "Posição": i + 1,
    "Ciclo": cycle.name,
    "Nome": r.employeeName,
    "Resultado Final": r.finalResult,
    "Pelotão": r.platoon ?? "",
    "Bônus Caju (R$)": r.bonusValue,
  }));

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
    "Nota da Equipe (1-5)": cd.scoreUsed != null ? cd.scoreUsed.toFixed(2) : "",
    "Peso": cd.weight,
    "Total Ponderado": cd.criterionTotal != null ? cd.criterionTotal.toFixed(2) : "",
    "Status": cd.status,
  }));
  rows.push({
    "Critério": "RESULTADO DO EVENTO",
    "Área Responsável": "",
    "Nota da Equipe (1-5)": "",
    "Peso": "",
    "Total Ponderado": team.eventScore.toFixed(2),
    "Status": team.isComplete ? "completo" : "pendente",
  });

  res.json({ filename: `evento-${ev.name}.csv`, data: toCsv(rows) });
});

router.get("/exports/caju-bonuses", requireRole("admin", "rh", "diretoria"), async (_req, res) => {
  const cycle = await getCurrentCycle();
  if (!cycle) { res.json({ filename: `bonus-caju.csv`, data: "" }); return; }

  const results = await db
    .select({
      "Nome": employeesTable.name,
      "Pelotão": quarterlyResultsTable.platoon,
      "Resultado Final": quarterlyResultsTable.finalResult,
      "Bônus Caju (R$)": quarterlyResultsTable.bonusValue,
    })
    .from(quarterlyResultsTable)
    .leftJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    .where(eq(quarterlyResultsTable.cycleId, cycle.id))
    .orderBy(quarterlyResultsTable.bonusValue);

  const rows = results.map(r => ({ "Ciclo": cycle.name, ...r }));
  res.json({ filename: `bonus-caju-${cycleSlug(cycle.name)}.csv`, data: toCsv(rows as never) });
});

router.get("/exports/absences", async (_req, res) => {
  const cycle = await getCurrentCycle();
  if (!cycle) { res.json({ filename: `penalidades.csv`, data: "" }); return; }

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
    .where(eq(absencesTable.cycleId, cycle.id))
    .orderBy(absencesTable.date);

  const rows = results.map(r => ({ ...r, "Ciclo": cycle.name }));
  res.json({ filename: `penalidades-${cycleSlug(cycle.name)}.csv`, data: toCsv(rows as never) });
});

router.get("/exports/pending-evaluations", requireRole("admin", "rh", "diretoria"), async (_req, res) => {
  const openEvents = await db.select().from(eventsTable).where(eq(eventsTable.status, "open"));
  const rows: Record<string, unknown>[] = [];
  for (const ev of openEvents) {
    const team = await computeEventTeamResult(ev.id);
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
