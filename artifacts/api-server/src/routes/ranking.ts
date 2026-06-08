import { Router } from "express";
import {
  db, quarterlyResultsTable, employeesTable, absencesTable, eventsTable,
  eventParticipantsTable, evaluationsTable, calibrationsTable,
  eventCriteriaTable, criteriaTable, platoonRulesTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { calculateEventResult, getPlatoonByScore } from "../lib/calculations.js";
import { PENALTY_CATALOG, MERIT_CATALOG } from "./absences.js";

const router = Router();
router.use(requireAuth);

router.get("/ranking", async (req, res) => {
  const { year, quarter, search } = req.query;
  if (!year || !quarter) { res.status(400).json({ error: "year e quarter obrigatórios" }); return; }

  const results = await db
    .select({
      employeeId: quarterlyResultsTable.employeeId,
      employeeName: employeesTable.name,
      finalResult: quarterlyResultsTable.finalResult,
      platoon: quarterlyResultsTable.platoon,
      platoonColor: quarterlyResultsTable.platoonColor,
      bonusValue: quarterlyResultsTable.bonusValue,
      eventsCount: quarterlyResultsTable.eventsCount,
      totalAbsences: quarterlyResultsTable.totalAbsences,
    })
    .from(quarterlyResultsTable)
    .leftJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    .where(and(
      eq(quarterlyResultsTable.year, parseInt(year as string)),
      eq(quarterlyResultsTable.quarter, parseInt(quarter as string)),
    ))
    .orderBy(sql`${quarterlyResultsTable.finalResult} DESC`);

  let filtered = results;
  if (search) {
    const s = (search as string).toLowerCase();
    filtered = results.filter(r => (r.employeeName ?? "").toLowerCase().includes(s));
  }

  res.json(filtered.map((r, i) => ({
    position: i + 1,
    employeeId: r.employeeId,
    employeeName: r.employeeName ?? "",
    finalResult: parseFloat(r.finalResult),
    platoon: r.platoon,
    platoonColor: r.platoonColor,
    bonusValue: parseFloat(r.bonusValue),
    eventsCount: r.eventsCount,
    absences: r.totalAbsences,
  })));
});

/**
 * Detalhe do colaborador no ranking (drill-down).
 * Mostra como foi nas provas (nota do time por evento) + penalidades + méritos.
 * Restrito aos gestores.
 */
router.get("/ranking-detail", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const employeeId = parseInt(req.query.employeeId as string);
  if (!employeeId) { res.status(400).json({ error: "employeeId obrigatório" }); return; }
  const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
  const quarter = req.query.quarter ? parseInt(req.query.quarter as string) : Math.ceil((new Date().getMonth() + 1) / 3);

  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, employeeId)).limit(1);
  if (!employee) { res.status(404).json({ error: "Colaborador não encontrado" }); return; }

  const [quarterResult] = await db.select().from(quarterlyResultsTable)
    .where(and(
      eq(quarterlyResultsTable.employeeId, employeeId),
      eq(quarterlyResultsTable.year, year),
      eq(quarterlyResultsTable.quarter, quarter),
    )).limit(1);

  const platoonRules = await db.select().from(platoonRulesTable).where(eq(platoonRulesTable.active, true)).orderBy(platoonRulesTable.displayOrder);
  const platoonRulesMapped = platoonRules.map(r => ({
    name: r.name, color: r.color,
    minScore: parseFloat(r.minScore as unknown as string),
    maxScore: parseFloat(r.maxScore as unknown as string),
    minInclusive: r.minInclusive, maxInclusive: r.maxInclusive,
    bonusValue: parseFloat(r.bonusValue as unknown as string),
  }));

  const participations = await db
    .select({
      eventId: eventParticipantsTable.eventId,
      eventName: eventsTable.name,
      eventCity: eventsTable.city,
      eventState: eventsTable.state,
      eventStatus: eventsTable.status,
      startDate: eventsTable.startDate,
    })
    .from(eventParticipantsTable)
    .leftJoin(eventsTable, eq(eventParticipantsTable.eventId, eventsTable.id))
    .where(and(
      eq(eventParticipantsTable.employeeId, employeeId),
      eq(eventsTable.year, year),
      eq(eventsTable.quarter, quarter),
    ));

  const events = [];
  for (const p of participations) {
    if (!p.eventId) continue;

    const eventCriteriaRows = await db
      .select({
        criterionId: eventCriteriaTable.criterionId,
        weight: eventCriteriaTable.weightOverride,
        defaultWeight: criteriaTable.defaultWeight,
      })
      .from(eventCriteriaTable)
      .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
      .where(and(eq(eventCriteriaTable.eventId, p.eventId), eq(eventCriteriaTable.active, true)));

    const allEvals = await db.select({
      criterionId: evaluationsTable.criterionId,
      score: evaluationsTable.score,
      status: evaluationsTable.status,
    }).from(evaluationsTable).where(eq(evaluationsTable.eventId, p.eventId));

    const allCalibrations = await db.select({
      criterionId: calibrationsTable.criterionId,
      calibratedScore: calibrationsTable.calibratedScore,
    }).from(calibrationsTable).where(eq(calibrationsTable.eventId, p.eventId));

    let evaluatedCriteria = 0;
    const criteriaForCalc = eventCriteriaRows.map(c => {
      const weight = parseFloat(c.weight ?? c.defaultWeight ?? "1");
      const evalScores = allEvals
        .filter(e => e.criterionId === c.criterionId && e.status === "submitted")
        .map(e => parseFloat(e.score as unknown as string));
      const averageScore = evalScores.length > 0 ? evalScores.reduce((a, b) => a + b, 0) / evalScores.length : null;
      const calibration = allCalibrations.find(cal => cal.criterionId === c.criterionId);
      const calibratedScore = calibration ? parseFloat(calibration.calibratedScore as unknown as string) : null;
      const scoreUsed = calibratedScore !== null ? calibratedScore : averageScore;
      if (scoreUsed !== null) evaluatedCriteria++;
      return { criterionId: c.criterionId!, weight, averageScore: scoreUsed, calibratedScore: null };
    });

    const eventScore = calculateEventResult(criteriaForCalc);
    const platoon = getPlatoonByScore(eventScore, platoonRulesMapped);

    events.push({
      eventId: p.eventId,
      eventName: p.eventName ?? "",
      city: p.eventCity ?? null,
      state: p.eventState ?? null,
      startDate: p.startDate ?? null,
      status: p.eventStatus ?? null,
      eventScore,
      platoon: platoon?.name ?? null,
      platoonColor: platoon?.color ?? null,
      evaluatedCriteria,
      totalCriteria: eventCriteriaRows.length,
    });
  }
  events.sort((a, b) => b.eventScore - a.eventScore);

  const absenceRows = await db
    .select({
      id: absencesTable.id,
      penaltyType: absencesTable.penaltyType,
      kind: absencesTable.kind,
      points: absencesTable.points,
      quantity: absencesTable.quantity,
      date: absencesTable.date,
      reason: absencesTable.reason,
      eventName: eventsTable.name,
    })
    .from(absencesTable)
    .leftJoin(eventsTable, eq(absencesTable.eventId, eventsTable.id))
    .where(and(
      eq(absencesTable.employeeId, employeeId),
      eq(absencesTable.year, year),
      eq(absencesTable.quarter, quarter),
    ));

  const label = (t: string) => MERIT_CATALOG[t]?.label ?? PENALTY_CATALOG[t]?.label ?? t;
  const mapRow = (a: typeof absenceRows[number]) => ({
    id: a.id,
    type: a.penaltyType,
    label: label(a.penaltyType),
    points: a.points,
    quantity: a.quantity,
    total: a.points * a.quantity,
    date: a.date,
    reason: a.reason ?? null,
    eventName: a.eventName ?? null,
  });

  const penalties = absenceRows.filter(a => a.kind !== "merit").map(mapRow);
  const merits = absenceRows.filter(a => a.kind === "merit").map(mapRow);
  const penaltyPoints = penalties.reduce((s, p) => s + p.total, 0);
  const meritPoints = merits.reduce((s, m) => s + m.total, 0);
  const scored = events.filter(e => e.eventScore > 0);
  const grossAverage = scored.length > 0 ? Math.round((scored.reduce((s, e) => s + e.eventScore, 0) / scored.length) * 100) / 100 : null;

  res.json({
    employee: {
      id: employee.id,
      name: employee.name,
      department: employee.department ?? null,
      functionName: employee.functionName ?? null,
    },
    period: { year, quarter },
    summary: {
      finalResult: quarterResult ? parseFloat(quarterResult.finalResult as unknown as string) : null,
      grossAverage,
      penaltyPoints,
      meritPoints,
      platoon: quarterResult?.platoon ?? null,
      platoonColor: quarterResult?.platoonColor ?? null,
      bonusValue: quarterResult ? parseFloat(quarterResult.bonusValue as unknown as string) : null,
      eventsCount: events.length,
      isQuarterClosed: !!quarterResult,
    },
    events,
    penalties,
    merits,
  });
});

export default router;
