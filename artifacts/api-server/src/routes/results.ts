import { Router } from "express";
import { db, eventsTable, eventParticipantsTable, evaluationsTable, calibrationsTable, eventCriteriaTable, criteriaTable, absencesTable, quarterlyResultsTable, platoonRulesTable, employeesTable, rulesTable } from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { calculateEventResult, calculateQuarterGrossAverage, calculateAbsencePenalty, calculateQuarterFinalResult, getPlatoonByScore } from "../lib/calculations.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

router.get("/events/:id/result", async (req, res) => {
  const eventId = parseInt(req.params.id);

  const participants = await db
    .select({ employeeId: eventParticipantsTable.employeeId, employeeName: employeesTable.name })
    .from(eventParticipantsTable)
    .leftJoin(employeesTable, eq(eventParticipantsTable.employeeId, employeesTable.id))
    .where(eq(eventParticipantsTable.eventId, eventId));

  const eventCriteriaRows = await db
    .select({
      criterionId: eventCriteriaTable.criterionId,
      criterionName: criteriaTable.name,
      active: eventCriteriaTable.active,
      originalWeight: criteriaTable.defaultWeight,
      weightOverride: eventCriteriaTable.weightOverride,
    })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .where(eq(eventCriteriaTable.eventId, eventId));

  const activeCriteria = eventCriteriaRows.filter(c => c.active);
  const totalWeight = activeCriteria.reduce((s, c) => s + parseFloat(c.weightOverride ?? c.originalWeight ?? "1"), 0);
  const normalizedCriteria = activeCriteria.map(c => {
    const w = parseFloat(c.weightOverride ?? c.originalWeight ?? "1");
    return { ...c, normalizedWeight: totalWeight > 0 ? w / totalWeight : 0 };
  });

  const allEvals = await db.select().from(evaluationsTable).where(eq(evaluationsTable.eventId, eventId));
  const allCalibrations = await db.select().from(calibrationsTable).where(eq(calibrationsTable.eventId, eventId));
  const platoonRules = await db.select().from(platoonRulesTable).where(eq(platoonRulesTable.active, true)).orderBy(platoonRulesTable.displayOrder);

  const results = participants.map(p => {
    const criteriaDetails = normalizedCriteria.map(c => {
      const evalScores = allEvals
        .filter(e => e.employeeId === p.employeeId && e.criterionId === c.criterionId && e.status === "submitted")
        .map(e => parseFloat(e.score as unknown as string));

      const averageScore = evalScores.length > 0 ? evalScores.reduce((a, b) => a + b, 0) / evalScores.length : null;

      const calibration = allCalibrations.find(cal => cal.employeeId === p.employeeId && cal.criterionId === c.criterionId);
      const calibratedScore = calibration ? parseFloat(calibration.calibratedScore as unknown as string) : null;
      const scoreUsed = calibratedScore !== null ? calibratedScore : averageScore;
      const scorePercentual = scoreUsed !== null ? scoreUsed / 5 : null;
      const weightedContribution = scorePercentual !== null ? scorePercentual * c.normalizedWeight : null;

      return {
        criterionId: c.criterionId!,
        criterionName: c.criterionName ?? "",
        averageScore,
        calibratedScore,
        scoreUsed,
        scorePercentual,
        normalizedWeight: c.normalizedWeight,
        weightedContribution,
      };
    });

    const criteriaForCalc = criteriaDetails.map(cd => ({
      criterionId: cd.criterionId,
      weight: cd.normalizedWeight,
      averageScore: cd.averageScore,
      calibratedScore: cd.calibratedScore,
    }));

    const eventScore = calculateEventResult(criteriaForCalc);

    const platoon = getPlatoonByScore(eventScore, platoonRules.map(r => ({
      name: r.name,
      color: r.color,
      minScore: parseFloat(r.minScore as unknown as string),
      maxScore: parseFloat(r.maxScore as unknown as string),
      minInclusive: r.minInclusive,
      maxInclusive: r.maxInclusive,
      bonusValue: parseFloat(r.bonusValue as unknown as string),
    })));

    return {
      employeeId: p.employeeId!,
      employeeName: p.employeeName ?? "",
      eventId,
      eventScore,
      projectedPlatoon: platoon?.name ?? null,
      criteriaDetails,
    };
  });

  res.json(results);
});

router.get("/results/quarterly", async (req, res) => {
  const { year, quarter, employeeId, platoon } = req.query;
  if (!year || !quarter) { res.status(400).json({ error: "year e quarter obrigatórios" }); return; }

  let query = db
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
    .where(and(
      eq(quarterlyResultsTable.year, parseInt(year as string)),
      eq(quarterlyResultsTable.quarter, parseInt(quarter as string)),
    ))
    .$dynamic();

  const results = await query;
  const filtered = results
    .filter(r => !employeeId || r.employeeId === parseInt(employeeId as string))
    .filter(r => !platoon || r.platoon === platoon);

  res.json(filtered.map(r => ({
    ...r,
    grossAverage: parseFloat(r.grossAverage),
    absencePenalty: parseFloat(r.absencePenalty),
    finalResult: parseFloat(r.finalResult),
    bonusValue: parseFloat(r.bonusValue),
    eventBreakdown: [],
  })));
});

router.post("/results/quarterly/close", requireRole("admin", "rh"), async (req, res) => {
  const { year, quarter } = req.body;
  if (!year || !quarter) { res.status(400).json({ error: "year e quarter obrigatórios" }); return; }

  const closedEvents = await db.select().from(eventsTable)
    .where(and(eq(eventsTable.year, year), eq(eventsTable.quarter, quarter), eq(eventsTable.status, "closed")));

  if (closedEvents.length === 0) {
    res.status(400).json({ error: "Nenhum evento fechado neste trimestre" });
    return;
  }

  const closedEventIds = closedEvents.map(e => e.id);

  const participants = await db
    .selectDistinct({ employeeId: eventParticipantsTable.employeeId })
    .from(eventParticipantsTable)
    .where(inArray(eventParticipantsTable.eventId, closedEventIds));

  const allPlatoonRules = await db.select().from(platoonRulesTable).where(eq(platoonRulesTable.active, true));
  const platoonRulesMapped = allPlatoonRules.map(r => ({
    name: r.name, color: r.color,
    minScore: parseFloat(r.minScore as unknown as string),
    maxScore: parseFloat(r.maxScore as unknown as string),
    minInclusive: r.minInclusive, maxInclusive: r.maxInclusive,
    bonusValue: parseFloat(r.bonusValue as unknown as string),
  }));

  const penaltyRuleRow = await db.select().from(rulesTable).where(eq(rulesTable.key, "absence_penalty_per_absence")).limit(1);
  const penaltyPerAbsence = penaltyRuleRow[0] ? parseFloat(penaltyRuleRow[0].value) : 0.01;

  let processed = 0;
  const warnings: string[] = [];

  for (const { employeeId } of participants) {
    if (!employeeId) continue;

    const eventCriteriaRows = await db
      .select({
        eventId: eventCriteriaTable.eventId,
        criterionId: eventCriteriaTable.criterionId,
        active: eventCriteriaTable.active,
        originalWeight: criteriaTable.defaultWeight,
        weightOverride: eventCriteriaTable.weightOverride,
      })
      .from(eventCriteriaTable)
      .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
      .where(inArray(eventCriteriaTable.eventId, closedEventIds));

    const allEvals = await db.select().from(evaluationsTable)
      .where(and(inArray(evaluationsTable.eventId, closedEventIds), eq(evaluationsTable.employeeId, employeeId)));
    const allCalibrations = await db.select().from(calibrationsTable)
      .where(and(inArray(calibrationsTable.eventId, closedEventIds), eq(calibrationsTable.employeeId, employeeId)));

    const eventScores: number[] = [];

    for (const eventId of closedEventIds) {
      const isParticipant = await db.select().from(eventParticipantsTable)
        .where(and(eq(eventParticipantsTable.eventId, eventId), eq(eventParticipantsTable.employeeId, employeeId)))
        .limit(1);
      if (isParticipant.length === 0) continue;

      const criteria = eventCriteriaRows.filter(c => c.eventId === eventId && c.active);
      const totalWeight = criteria.reduce((s, c) => s + parseFloat(c.weightOverride ?? c.originalWeight ?? "1"), 0);

      const criteriaForCalc = criteria.map(c => {
        const w = parseFloat(c.weightOverride ?? c.originalWeight ?? "1");
        const evalScores = allEvals
          .filter(e => e.eventId === eventId && e.criterionId === c.criterionId && e.status === "submitted")
          .map(e => parseFloat(e.score as unknown as string));
        const averageScore = evalScores.length > 0 ? evalScores.reduce((a, b) => a + b, 0) / evalScores.length : null;
        const calibration = allCalibrations.find(cal => cal.eventId === eventId && cal.criterionId === c.criterionId);
        const calibratedScore = calibration ? parseFloat(calibration.calibratedScore as unknown as string) : null;
        return { criterionId: c.criterionId!, weight: totalWeight > 0 ? w / totalWeight : 0, averageScore, calibratedScore };
      });

      const eventScore = calculateEventResult(criteriaForCalc);
      eventScores.push(eventScore);
    }

    const absenceRows = await db.select().from(absencesTable)
      .where(and(eq(absencesTable.employeeId, employeeId), eq(absencesTable.year, year), eq(absencesTable.quarter, quarter)));
    const totalAbsences = absenceRows.reduce((s, a) => s + a.quantity, 0);

    const grossAverage = calculateQuarterGrossAverage(eventScores);
    const absencePenalty = calculateAbsencePenalty(totalAbsences, penaltyPerAbsence);
    const finalResult = calculateQuarterFinalResult(grossAverage, absencePenalty);
    const platoon = getPlatoonByScore(finalResult, platoonRulesMapped);

    await db.delete(quarterlyResultsTable)
      .where(and(eq(quarterlyResultsTable.employeeId, employeeId), eq(quarterlyResultsTable.year, year), eq(quarterlyResultsTable.quarter, quarter)));

    await db.insert(quarterlyResultsTable).values({
      employeeId,
      year,
      quarter,
      eventsCount: eventScores.length,
      grossAverage: String(grossAverage),
      totalAbsences,
      absencePenalty: String(absencePenalty),
      finalResult: String(finalResult),
      platoon: platoon?.name ?? null,
      platoonColor: platoon?.color ?? null,
      bonusValue: String(platoon?.bonusValue ?? 0),
      closedAt: new Date(),
      closedByUserId: req.user!.userId,
    });

    processed++;
  }

  await audit(req.user!.userId, "close_quarter", "quarterly_results", `${year}-Q${quarter}`);
  res.json({ success: true, year, quarter, totalProcessed: processed, warnings });
});

export default router;
