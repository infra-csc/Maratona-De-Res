import { Router } from "express";
import { db, eventsTable, evaluationsTable, absencesTable, quarterlyResultsTable, employeesTable, platoonRulesTable, eventParticipantsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { getCurrentCycle } from "../lib/cycle.js";

const router = Router();
router.use(requireAuth);

router.get("/dashboard/summary", async (_req, res) => {
  const cycle = await getCurrentCycle();
  if (!cycle) {
    res.json({
      totalEvents: 0, totalEmployeesEvaluated: 0, pendingEvaluations: 0, submittedEvaluations: 0,
      eventsInCalibration: 0, quarterAverage: null, totalBonusPreview: 0, totalAbsences: 0,
      eventsWithPendencies: [], atRiskEmployees: [],
    });
    return;
  }

  const events = await db.select().from(eventsTable).where(eq(eventsTable.cycleId, cycle.id));
  const totalEvents = events.length;

  const allEvals = await db.select({
    id: evaluationsTable.id,
    eventId: evaluationsTable.eventId,
    status: evaluationsTable.status,
  }).from(evaluationsTable).where(
    sql`${evaluationsTable.eventId} IN (SELECT id FROM events WHERE cycle_id = ${cycle.id})`
  );
  const pendingEvaluations = allEvals.filter(e => e.status === "draft").length;
  const submittedEvaluations = allEvals.filter(e => e.status === "submitted").length;

  const absences = await db.select().from(absencesTable).where(eq(absencesTable.cycleId, cycle.id));
  const totalAbsences = absences.reduce((s, a) => s + a.quantity, 0);

  const quarterResults = await db.select().from(quarterlyResultsTable).where(eq(quarterlyResultsTable.cycleId, cycle.id));
  const totalEmployeesEvaluated = quarterResults.length;

  // Só entram na média colaboradores com pelo menos 1 evento FECHADO e pontuado
  // (eventsCount > 0) neste ciclo. Quem só participou de eventos ainda abertos
  // tem finalResult=0 "por enquanto" — incluí-los distorceria a média para
  // baixo mesmo quando ninguém de fato tirou nota ruim, então são excluídos
  // até terem alguma nota real registrada.
  const scoredQuarterResults = quarterResults.filter(r => r.eventsCount > 0);
  const quarterAverage = scoredQuarterResults.length > 0
    ? scoredQuarterResults.reduce((s, r) => s + parseFloat(r.finalResult), 0) / scoredQuarterResults.length
    : null;

  const totalBonusPreview = quarterResults.reduce((s, r) => s + parseFloat(r.bonusValue), 0);
  const eventsInCalibration = events.filter(e => e.status === "calibration").length;

  const openEvents = events.filter(e => e.status === "open");
  const eventsWithPendencies: { eventId: number; eventName: string; pendingCount: number }[] = [];
  for (const ev of openEvents.slice(0, 5)) {
    const evEvals = allEvals.filter(e => e.eventId === ev.id);
    const pending = evEvals.filter(e => e.status === "draft").length;
    const participantCount = await db.select({ count: sql<number>`count(*)` })
      .from(eventParticipantsTable)
      .where(eq(eventParticipantsTable.eventId, ev.id));
    const pCount = Number(participantCount[0]?.count ?? 0);
    const totalExpected = pCount;
    const pendingFinal = totalExpected > 0 ? totalExpected - evEvals.filter(e => e.status === "submitted").length : pending;
    eventsWithPendencies.push({ eventId: ev.id, eventName: ev.name, pendingCount: Math.max(0, pendingFinal) });
  }

  const atRiskResults = await db
    .select({
      employeeId: quarterlyResultsTable.employeeId,
      employeeName: employeesTable.name,
      finalResult: quarterlyResultsTable.finalResult,
    })
    .from(quarterlyResultsTable)
    .leftJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    .where(and(
      eq(quarterlyResultsTable.cycleId, cycle.id),
      sql`${quarterlyResultsTable.finalResult}::numeric < 50`
    ))
    .orderBy(sql`${quarterlyResultsTable.finalResult}::numeric ASC`)
    .limit(5);

  const atRiskEmployees = atRiskResults.map(r => ({
    employeeId: r.employeeId,
    employeeName: r.employeeName ?? "",
    currentScore: parseFloat(r.finalResult),
  }));

  res.json({
    totalEvents, totalEmployeesEvaluated, pendingEvaluations, submittedEvaluations,
    eventsInCalibration, quarterAverage, totalBonusPreview, totalAbsences,
    eventsWithPendencies, atRiskEmployees,
  });
});

router.get("/dashboard/platoon-distribution", async (_req, res) => {
  const cycle = await getCurrentCycle();
  if (!cycle) { res.json([]); return; }

  const results = await db.select().from(quarterlyResultsTable).where(eq(quarterlyResultsTable.cycleId, cycle.id));
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

router.get("/dashboard/top-employees", async (_req, res) => {
  const cycle = await getCurrentCycle();
  if (!cycle) { res.json([]); return; }

  const results = await db
    .select({
      employeeId: quarterlyResultsTable.employeeId,
      employeeName: employeesTable.name,
      cycleId: quarterlyResultsTable.cycleId,
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
    .where(eq(quarterlyResultsTable.cycleId, cycle.id))
    .orderBy(sql`${quarterlyResultsTable.finalResult}::numeric DESC`)
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

router.get("/dashboard/quarterly-evolution", async (_req, res) => {
  const cycle = await getCurrentCycle();
  if (!cycle) { res.json([]); return; }

  const results = await db.select({ finalResult: quarterlyResultsTable.finalResult })
    .from(quarterlyResultsTable)
    .where(eq(quarterlyResultsTable.cycleId, cycle.id));
  const average = results.length > 0
    ? results.reduce((s, r) => s + parseFloat(r.finalResult), 0) / results.length
    : null;
  res.json([{ cycleId: cycle.id, label: cycle.name, average }]);
});

export default router;
