import { Router } from "express";
import { db, quarterlyResultsTable, employeesTable, eventsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { computeEventTeamResult } from "./results.js";

const router = Router();
router.use(requireAuth);

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))];
  return lines.join("\n");
}

router.get("/exports/quarterly-results", async (req, res) => {
  const { year, quarter } = req.query;
  if (!year || !quarter) { res.status(400).json({ error: "year e quarter obrigatórios" }); return; }

  const results = await db
    .select({
      "Nome": employeesTable.name,
      "Ano": quarterlyResultsTable.year,
      "Trimestre": quarterlyResultsTable.quarter,
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
    .where(and(eq(quarterlyResultsTable.year, parseInt(year as string)), eq(quarterlyResultsTable.quarter, parseInt(quarter as string))))
    .orderBy(quarterlyResultsTable.finalResult);

  res.json({ filename: `resultados-Q${quarter}-${year}.csv`, data: toCsv(results as never) });
});

router.get("/exports/ranking", async (req, res) => {
  const { year, quarter } = req.query;
  if (!year || !quarter) { res.status(400).json({ error: "year e quarter obrigatórios" }); return; }

  const results = await db
    .select({
      employeeName: employeesTable.name,
      finalResult: quarterlyResultsTable.finalResult,
      platoon: quarterlyResultsTable.platoon,
      bonusValue: quarterlyResultsTable.bonusValue,
    })
    .from(quarterlyResultsTable)
    .leftJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    .where(and(eq(quarterlyResultsTable.year, parseInt(year as string)), eq(quarterlyResultsTable.quarter, parseInt(quarter as string))));

  const sorted = results.sort((a, b) => parseFloat(b.finalResult) - parseFloat(a.finalResult));
  const rows = sorted.map((r, i) => ({
    "Posição": i + 1,
    "Nome": r.employeeName,
    "Resultado Final": r.finalResult,
    "Pelotão": r.platoon ?? "",
    "Bônus Caju (R$)": r.bonusValue,
  }));

  res.json({ filename: `ranking-Q${quarter}-${year}.csv`, data: toCsv(rows) });
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

router.get("/exports/caju-bonuses", async (req, res) => {
  const { year, quarter } = req.query;
  if (!year || !quarter) { res.status(400).json({ error: "year e quarter obrigatórios" }); return; }

  const results = await db
    .select({
      "Nome": employeesTable.name,
      "Pelotão": quarterlyResultsTable.platoon,
      "Resultado Final": quarterlyResultsTable.finalResult,
      "Bônus Caju (R$)": quarterlyResultsTable.bonusValue,
    })
    .from(quarterlyResultsTable)
    .leftJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    .where(and(eq(quarterlyResultsTable.year, parseInt(year as string)), eq(quarterlyResultsTable.quarter, parseInt(quarter as string))))
    .orderBy(quarterlyResultsTable.bonusValue);

  res.json({ filename: `bonus-caju-Q${quarter}-${year}.csv`, data: toCsv(results as never) });
});

export default router;
