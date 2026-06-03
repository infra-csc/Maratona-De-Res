import { Router } from "express";
import { db, eventsTable, eventParticipantsTable, evaluationsTable, calibrationsTable, eventCriteriaTable, criteriaTable, absencesTable, quarterlyResultsTable, platoonRulesTable, employeesTable } from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { calculateEventResult, getPlatoonByScore } from "../lib/calculations.js";

const router = Router();
router.use(requireAuth);

/**
 * GET /my-performance
 * Retorna o desempenho do colaborador vinculado ao usuário autenticado.
 * - Nunca expõe o nome do avaliador
 * - Comentários internos ficam ocultos
 */
router.get("/my-performance", async (req, res) => {
  const employeeId = req.user!.employeeId;
  if (!employeeId) {
    res.status(404).json({ error: "Nenhum colaborador vinculado a este usuário. Peça ao administrador para vincular seu perfil." });
    return;
  }

  const { year, quarter } = req.query;
  const currentYear = year ? parseInt(year as string) : new Date().getFullYear();
  const currentQuarter = quarter ? parseInt(quarter as string) : Math.ceil((new Date().getMonth() + 1) / 3);

  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, employeeId)).limit(1);
  if (!employee) {
    res.status(404).json({ error: "Colaborador não encontrado" });
    return;
  }

  // Resultado trimestral consolidado (se fechado)
  const [quarterResult] = await db.select().from(quarterlyResultsTable)
    .where(and(
      eq(quarterlyResultsTable.employeeId, employeeId),
      eq(quarterlyResultsTable.year, currentYear),
      eq(quarterlyResultsTable.quarter, currentQuarter),
    )).limit(1);

  // Eventos que o colaborador participou no trimestre
  const participations = await db
    .select({
      eventId: eventParticipantsTable.eventId,
      eventName: eventsTable.name,
      eventCity: eventsTable.city,
      eventState: eventsTable.state,
      eventStatus: eventsTable.status,
      startDate: eventsTable.startDate,
      endDate: eventsTable.endDate,
    })
    .from(eventParticipantsTable)
    .leftJoin(eventsTable, eq(eventParticipantsTable.eventId, eventsTable.id))
    .where(and(
      eq(eventParticipantsTable.employeeId, employeeId),
      eq(eventsTable.year, currentYear),
      eq(eventsTable.quarter, currentQuarter),
    ));

  const platoonRules = await db.select().from(platoonRulesTable).where(eq(platoonRulesTable.active, true)).orderBy(platoonRulesTable.displayOrder);
  const platoonRulesMapped = platoonRules.map(r => ({
    name: r.name, color: r.color,
    minScore: parseFloat(r.minScore as unknown as string),
    maxScore: parseFloat(r.maxScore as unknown as string),
    minInclusive: r.minInclusive, maxInclusive: r.maxInclusive,
    bonusValue: parseFloat(r.bonusValue as unknown as string),
  }));

  const eventSummaries = [];
  for (const p of participations) {
    if (!p.eventId) continue;

    const eventCriteriaRows = await db
      .select({
        criterionId: eventCriteriaTable.criterionId,
        criterionName: criteriaTable.name,
        criterionDescription: criteriaTable.description,
        active: eventCriteriaTable.active,
        weight: eventCriteriaTable.weightOverride,
        defaultWeight: criteriaTable.defaultWeight,
      })
      .from(eventCriteriaTable)
      .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
      .where(and(eq(eventCriteriaTable.eventId, p.eventId), eq(eventCriteriaTable.active, true)));

    const allEvals = await db.select({
      criterionId: evaluationsTable.criterionId,
      score: evaluationsTable.score,
      comments: evaluationsTable.comments,
      commentVisibility: evaluationsTable.commentVisibility,
      status: evaluationsTable.status,
    }).from(evaluationsTable)
      .where(and(
        eq(evaluationsTable.eventId, p.eventId),
        eq(evaluationsTable.employeeId, employeeId),
      ));

    const allCalibrations = await db.select({
      criterionId: calibrationsTable.criterionId,
      calibratedScore: calibrationsTable.calibratedScore,
    }).from(calibrationsTable)
      .where(and(
        eq(calibrationsTable.eventId, p.eventId),
        eq(calibrationsTable.employeeId, employeeId),
      ));

    const criteriaDetails = eventCriteriaRows.map(c => {
      const weight = parseFloat(c.weight ?? c.defaultWeight ?? "1");
      const evalScores = allEvals
        .filter(e => e.criterionId === c.criterionId && e.status === "submitted")
        .map(e => parseFloat(e.score as unknown as string));
      const averageScore = evalScores.length > 0 ? evalScores.reduce((a, b) => a + b, 0) / evalScores.length : null;
      const calibration = allCalibrations.find(cal => cal.criterionId === c.criterionId);
      const calibratedScore = calibration ? parseFloat(calibration.calibratedScore as unknown as string) : null;
      const scoreUsed = calibratedScore !== null ? calibratedScore : averageScore;
      const criterionTotal = scoreUsed !== null ? scoreUsed * weight : null;

      // Public comments only — never expõe nome do avaliador
      const publicComments = allEvals
        .filter(e => e.criterionId === c.criterionId && e.commentVisibility === "public" && e.comments)
        .map(e => e.comments!);

      return {
        criterionId: c.criterionId,
        criterionName: c.criterionName,
        criterionDescription: c.criterionDescription,
        weight,
        scoreUsed,
        criterionTotal,
        hasCalibration: calibratedScore !== null,
        publicComments,
        evaluated: evalScores.length > 0,
      };
    });

    const criteriaForCalc = criteriaDetails.map(cd => ({
      criterionId: cd.criterionId!,
      weight: cd.weight,
      averageScore: cd.scoreUsed,
      calibratedScore: null,
    }));
    const eventScore = calculateEventResult(criteriaForCalc);
    const platoon = getPlatoonByScore(eventScore, platoonRulesMapped);
    const allSubmitted = allEvals.filter(e => e.status === "submitted").length;
    const totalExpected = eventCriteriaRows.length;

    eventSummaries.push({
      eventId: p.eventId,
      eventName: p.eventName,
      city: p.eventCity,
      state: p.eventState,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.eventStatus,
      eventScore,
      projectedPlatoon: platoon?.name ?? null,
      projectedPlatoonColor: platoon?.color ?? null,
      evaluationsSubmitted: allSubmitted,
      totalCriteria: totalExpected,
      isPending: allSubmitted < totalExpected,
      criteriaDetails,
    });
  }

  const absences = await db.select().from(absencesTable)
    .where(and(
      eq(absencesTable.employeeId, employeeId),
      eq(absencesTable.year, currentYear),
      eq(absencesTable.quarter, currentQuarter),
    ));
  const totalAbsences = absences.reduce((s, a) => s + a.quantity, 0);

  const pendingEvents = eventSummaries.filter(e => e.isPending || e.status === "open").length;
  const evaluatedEvents = eventSummaries.filter(e => !e.isPending && e.status !== "open").length;

  const grossAverage = eventSummaries.length > 0
    ? eventSummaries.filter(e => e.eventScore > 0).reduce((s, e) => s + e.eventScore, 0) / Math.max(1, eventSummaries.filter(e => e.eventScore > 0).length)
    : null;

  let currentPlatoon = null;
  let currentBonus = null;
  if (quarterResult) {
    currentPlatoon = quarterResult.platoon;
    currentBonus = parseFloat(quarterResult.bonusValue as unknown as string);
  } else if (grossAverage !== null) {
    const proj = getPlatoonByScore(grossAverage, platoonRulesMapped);
    currentPlatoon = proj?.name ?? null;
    currentBonus = proj?.bonusValue ?? null;
  }

  res.json({
    employee: {
      id: employee.id,
      name: employee.name,
      department: employee.department,
      functionName: employee.functionName,
    },
    period: { year: currentYear, quarter: currentQuarter },
    summary: {
      grossAverage,
      currentPlatoon,
      projectedBonus: currentBonus,
      evaluatedEvents,
      pendingEvents,
      totalAbsences,
      isQuarterClosed: !!quarterResult,
      finalResult: quarterResult ? parseFloat(quarterResult.finalResult as unknown as string) : null,
      absencePenalty: quarterResult ? parseFloat(quarterResult.absencePenalty as unknown as string) : null,
    },
    events: eventSummaries,
  });
});

export default router;
