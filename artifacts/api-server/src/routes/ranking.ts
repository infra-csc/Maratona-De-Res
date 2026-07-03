import { Router } from "express";
import {
  db, quarterlyResultsTable, employeesTable, absencesTable, eventsTable,
  eventParticipantsTable, evaluationsTable, calibrationsTable,
  eventCriteriaTable, criteriaTable, platoonRulesTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { calculateEventResult, getPlatoonByScore } from "../lib/calculations.js";
import { getCurrentCycle } from "../lib/cycle.js";
import { PENALTY_CATALOG, MERIT_CATALOG } from "./absences.js";

const router = Router();
router.use(requireAuth);

router.get("/ranking", async (req, res) => {
  const { search } = req.query;
  const isManager = !!req.user && ["admin", "rh", "diretoria"].includes(req.user.role);
  const cycle = await getCurrentCycle();
  if (!cycle) { res.json([]); return; }

  const results = await db
    .select({
      employeeId: quarterlyResultsTable.employeeId,
      employeeName: employeesTable.name,
      finalResult: quarterlyResultsTable.finalResult,
      platoon: quarterlyResultsTable.platoon,
      platoonColor: quarterlyResultsTable.platoonColor,
      bonusValue: quarterlyResultsTable.bonusValue,
      eligible: quarterlyResultsTable.eligible,
      eventsCount: quarterlyResultsTable.eventsCount,
      participatedEventsCount: quarterlyResultsTable.participatedEventsCount,
      totalAbsences: quarterlyResultsTable.totalAbsences,
    })
    .from(quarterlyResultsTable)
    .leftJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    .where(eq(quarterlyResultsTable.cycleId, cycle.id))
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
    bonusValue: isManager ? parseFloat(r.bonusValue) : 0,
    eligible: r.eligible,
    eventsCount: r.eventsCount,
    participatedEventsCount: r.participatedEventsCount,
    absences: r.totalAbsences,
  })));
});

/**
 * Detalhe do colaborador no ranking (drill-down).
 * Mostra como foi nas provas (nota do time por evento) + penalidades + méritos.
 * Disponível para todos os papéis autenticados; o valor do bônus (dado financeiro)
 * só é retornado para gestores (admin/rh/diretoria).
 */
router.get("/ranking-detail", async (req, res) => {
  const isManager = !!req.user && ["admin", "rh", "diretoria"].includes(req.user.role);
  const employeeId = parseInt(req.query.employeeId as string);
  if (!employeeId) { res.status(400).json({ error: "employeeId obrigatório" }); return; }
  const cycle = await getCurrentCycle();
  if (!cycle) { res.status(404).json({ error: "Nenhum ciclo ativo" }); return; }

  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, employeeId)).limit(1);
  if (!employee) { res.status(404).json({ error: "Colaborador não encontrado" }); return; }

  const [quarterResult] = await db.select().from(quarterlyResultsTable)
    .where(and(
      eq(quarterlyResultsTable.employeeId, employeeId),
      eq(quarterlyResultsTable.cycleId, cycle.id),
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
      isHistorical: eventsTable.isHistorical,
      importedScore: eventsTable.importedScore,
    })
    .from(eventParticipantsTable)
    .leftJoin(eventsTable, eq(eventParticipantsTable.eventId, eventsTable.id))
    .where(and(
      eq(eventParticipantsTable.employeeId, employeeId),
      eq(eventsTable.cycleId, cycle.id),
    ));

  const events = [];
  for (const p of participations) {
    if (!p.eventId) continue;

    // Evento histórico: nota já vem pronta (importedScore) de fora, sem
    // critérios/avaliações — não passar pelo cálculo por quesitos.
    if (p.isHistorical) {
      const historicalScore = p.importedScore != null ? parseFloat(p.importedScore as unknown as string) : 0;
      const platoon = getPlatoonByScore(historicalScore, platoonRulesMapped);
      events.push({
        eventId: p.eventId,
        eventName: p.eventName ?? "",
        city: p.eventCity ?? null,
        state: p.eventState ?? null,
        startDate: p.startDate ?? null,
        status: p.eventStatus ?? null,
        eventScore: historicalScore,
        platoon: platoon?.name ?? null,
        platoonColor: platoon?.color ?? null,
        evaluatedCriteria: 0,
        totalCriteria: 0,
        isHistorical: true,
      });
      continue;
    }

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
      isHistorical: false,
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
      eq(absencesTable.cycleId, cycle.id),
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
    cycle: { id: cycle.id, name: cycle.name },
    summary: {
      finalResult: quarterResult ? parseFloat(quarterResult.finalResult as unknown as string) : null,
      grossAverage,
      penaltyPoints,
      meritPoints,
      platoon: quarterResult?.platoon ?? null,
      platoonColor: quarterResult?.platoonColor ?? null,
      bonusValue: isManager && quarterResult ? parseFloat(quarterResult.bonusValue as unknown as string) : null,
      eventsCount: events.length,
      isQuarterClosed: !!quarterResult,
    },
    events,
    penalties,
    merits,
  });
});

export default router;
