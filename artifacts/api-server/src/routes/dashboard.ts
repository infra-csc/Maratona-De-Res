import { Router } from "express";
import { db, eventsTable, evaluationsTable, absencesTable, quarterlyResultsTable, employeesTable, platoonRulesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/dashboard/summary", async (req, res) => {
  const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
  const quarter = req.query.quarter ? parseInt(req.query.quarter as string) : Math.ceil((new Date().getMonth() + 1) / 3);

  const events = await db.select().from(eventsTable).where(and(eq(eventsTable.year, year), eq(eventsTable.quarter, quarter)));
  const totalEvents = events.length;

  const allEvals = await db.select().from(evaluationsTable).where(
    sql`${evaluationsTable.eventId} IN (SELECT id FROM events WHERE year = ${year} AND quarter = ${quarter})`
  );
  const pendingEvaluations = allEvals.filter(e => e.status === "draft").length;
  const submittedEvaluations = allEvals.filter(e => e.status === "submitted").length;

  const absences = await db.select().from(absencesTable).where(and(eq(absencesTable.year, year), eq(absencesTable.quarter, quarter)));
  const totalAbsences = absences.reduce((s, a) => s + a.quantity, 0);

  const quarterResults = await db.select().from(quarterlyResultsTable).where(and(eq(quarterlyResultsTable.year, year), eq(quarterlyResultsTable.quarter, quarter)));
  const totalEmployeesEvaluated = quarterResults.length;

  const quarterAverage = quarterResults.length > 0
    ? quarterResults.reduce((s, r) => s + parseFloat(r.finalResult), 0) / quarterResults.length
    : null;

  const totalBonusPreview = quarterResults.reduce((s, r) => s + parseFloat(r.bonusValue), 0);

  const eventsInCalibration = events.filter(e => e.status === "calibration").length;

  const eventsWithPendencies = events
    .filter(e => e.status === "open")
    .slice(0, 5)
    .map(e => ({ eventId: e.id, eventName: e.name, pendingCount: 0 }));

  const atRiskEmployees = quarterResults
    .filter(r => parseFloat(r.finalResult) < 0.5)
    .slice(0, 5)
    .map(r => ({ employeeId: r.employeeId, employeeName: "", currentScore: parseFloat(r.finalResult) }));

  res.json({
    year, quarter, totalEvents, totalEmployeesEvaluated, pendingEvaluations, submittedEvaluations,
    eventsInCalibration, quarterAverage, totalBonusPreview, totalAbsences,
    eventsWithPendencies, atRiskEmployees,
  });
});

router.get("/dashboard/platoon-distribution", async (req, res) => {
  const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
  const quarter = req.query.quarter ? parseInt(req.query.quarter as string) : Math.ceil((new Date().getMonth() + 1) / 3);

  const results = await db.select().from(quarterlyResultsTable).where(and(eq(quarterlyResultsTable.year, year), eq(quarterlyResultsTable.quarter, quarter)));
  const total = results.length;

  const platoonMap = new Map<string, { name: string; color: string; count: number }>();
  for (const r of results) {
    const key = r.platoon ?? "Sem Pelotão";
    if (!platoonMap.has(key)) {
      platoonMap.set(key, { name: key, color: r.platoonColor ?? "#94a3b8", count: 0 });
    }
    platoonMap.get(key)!.count++;
  }

  res.json([...platoonMap.values()].map(p => ({
    platoonName: p.name,
    color: p.color,
    count: p.count,
    percentage: total > 0 ? (p.count / total) * 100 : 0,
  })));
});

router.get("/dashboard/top-employees", async (req, res) => {
  const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
  const quarter = req.query.quarter ? parseInt(req.query.quarter as string) : Math.ceil((new Date().getMonth() + 1) / 3);

  const results = await db
    .select({
      employeeId: quarterlyResultsTable.employeeId,
      employeeName: employeesTable.name,
      year: quarterlyResultsTable.year,
      quarter: quarterlyResultsTable.quarter,
      eventsCount: quarterlyResultsTable.eventsCount,
      grossAverage: quarterlyResultsTable.grossAverage,
      totalAbsences: quarterlyResultsTable.totalAbsences,
      absencePenalty: quarterlyResultsTable.absencePenalty,
      finalResult: quarterlyResultsTable.finalResult,
      platoon: quarterlyResultsTable.platoon,
      platoonColor: quarterlyResultsTable.platoonColor,
      bonusValue: quarterlyResultsTable.bonusValue,
    })
    .from(quarterlyResultsTable)
    .leftJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    .where(and(eq(quarterlyResultsTable.year, year), eq(quarterlyResultsTable.quarter, quarter)))
    .orderBy(sql`${quarterlyResultsTable.finalResult} DESC`)
    .limit(10);

  res.json(results.map(r => ({
    ...r,
    grossAverage: parseFloat(r.grossAverage),
    absencePenalty: parseFloat(r.absencePenalty),
    finalResult: parseFloat(r.finalResult),
    bonusValue: parseFloat(r.bonusValue),
    eventBreakdown: [],
  })));
});

router.get("/dashboard/quarterly-evolution", async (req, res) => {
  const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

  const quarterLabels = ["Q1", "Q2", "Q3", "Q4"];
  const evolution = [];
  for (let q = 1; q <= 4; q++) {
    const results = await db.select({ finalResult: quarterlyResultsTable.finalResult })
      .from(quarterlyResultsTable)
      .where(and(eq(quarterlyResultsTable.year, year), eq(quarterlyResultsTable.quarter, q)));
    const avg = results.length > 0 ? results.reduce((s, r) => s + parseFloat(r.finalResult), 0) / results.length : 0;
    evolution.push({ year, quarter: q, label: `${quarterLabels[q - 1]}/${year}`, average: avg });
  }
  res.json(evolution);
});

export default router;
