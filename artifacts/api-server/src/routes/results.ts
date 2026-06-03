import { Router } from "express";
import {
  db, eventsTable, eventParticipantsTable, evaluationsTable, calibrationsTable,
  eventCriteriaTable, criteriaTable, absencesTable, quarterlyResultsTable,
  platoonRulesTable, employeesTable, rulesTable, employeeEventResultsTable,
  employeeQuarterEligibilityTable, areasTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { calculateEventResult, calculateQuarterGrossAverage, calculateAbsencePenalty, calculateQuarterFinalResult, getPlatoonByScore, validateCalculationExample } from "../lib/calculations.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

// Log validation on startup
if (!validateCalculationExample()) {
  console.error("❌ ERRO DE CÁLCULO: pesos=[3,3,2,3,3,3,3], notas=[4,4,4,3,2,3,5] deveria retornar 71");
}

type PlatoonRuleMapped = {
  name: string; color: string; minScore: number; maxScore: number;
  minInclusive: boolean; maxInclusive: boolean; bonusValue: number;
};

async function loadPlatoonRules(): Promise<PlatoonRuleMapped[]> {
  const rows = await db.select().from(platoonRulesTable).where(eq(platoonRulesTable.active, true)).orderBy(platoonRulesTable.displayOrder);
  return rows.map(r => ({
    name: r.name, color: r.color,
    minScore: parseFloat(r.minScore as unknown as string),
    maxScore: parseFloat(r.maxScore as unknown as string),
    minInclusive: r.minInclusive, maxInclusive: r.maxInclusive,
    bonusValue: parseFloat(r.bonusValue as unknown as string),
  }));
}

/**
 * Calcula o resultado do TIME de um evento (uma única nota por evento).
 * A nota é por critério do evento (média das avaliações), com calibração no
 * nível do critério substituindo a média. O resultado é o mesmo para todos.
 */
export async function computeEventTeamResult(eventId: number) {
  const eventCriteriaRows = await db
    .select({
      criterionId: eventCriteriaTable.criterionId,
      criterionName: criteriaTable.name,
      criterionDescription: criteriaTable.description,
      responsibleAreaLabel: criteriaTable.responsibleAreaLabel,
      responsibleAreaName: areasTable.name,
      active: eventCriteriaTable.active,
      originalWeight: criteriaTable.defaultWeight,
      weightOverride: eventCriteriaTable.weightOverride,
      displayOrder: criteriaTable.displayOrder,
    })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .leftJoin(areasTable, eq(criteriaTable.responsibleAreaId, areasTable.id))
    .where(eq(eventCriteriaTable.eventId, eventId));

  const activeCriteria = eventCriteriaRows.filter(c => c.active).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const allEvals = await db.select().from(evaluationsTable).where(eq(evaluationsTable.eventId, eventId));
  const allCalibrations = await db.select().from(calibrationsTable).where(eq(calibrationsTable.eventId, eventId));

  const criteriaDetails = activeCriteria.map(c => {
    const weight = parseFloat(c.weightOverride ?? c.originalWeight ?? "1");
    const evalScores = allEvals
      .filter(e => e.criterionId === c.criterionId && e.status === "submitted")
      .map(e => parseFloat(e.score as unknown as string));
    const averageScore = evalScores.length > 0 ? evalScores.reduce((a, b) => a + b, 0) / evalScores.length : null;
    const calibration = allCalibrations.find(cal => cal.criterionId === c.criterionId);
    const calibratedScore = calibration ? parseFloat(calibration.calibratedScore as unknown as string) : null;
    const scoreUsed = calibratedScore !== null ? calibratedScore : averageScore;
    const criterionTotal = scoreUsed !== null ? scoreUsed * weight : null;
    return {
      criterionId: c.criterionId!,
      criterionName: c.criterionName ?? "",
      criterionDescription: c.criterionDescription ?? null,
      responsibleAreaLabel: c.responsibleAreaLabel ?? c.responsibleAreaName ?? null,
      weight,
      averageScore,
      calibratedScore,
      scoreUsed,
      criterionTotal,
      status: scoreUsed !== null ? "avaliado" : "pendente",
    };
  });

  const criteriaForCalc = criteriaDetails.map(cd => ({
    criterionId: cd.criterionId,
    weight: cd.weight,
    averageScore: cd.averageScore,
    calibratedScore: cd.calibratedScore,
  }));

  const eventScore = calculateEventResult(criteriaForCalc);
  const hasCalibration = criteriaDetails.some(cd => cd.calibratedScore !== null);
  const pendingCriteria = criteriaDetails.filter(cd => cd.status === "pendente").length;
  const evaluatedCriteria = criteriaDetails.length - pendingCriteria;
  const isComplete = criteriaDetails.length > 0 && pendingCriteria === 0;

  return { criteriaDetails, eventScore, hasCalibration, pendingCriteria, evaluatedCriteria, totalCriteria: criteriaDetails.length, isComplete };
}

/**
 * GET /events/:id/result
 * Resultado do TIME do evento + lista de participantes (todos recebem a mesma nota).
 */
router.get("/events/:id/result", async (req, res) => {
  const eventId = parseInt(req.params.id as string);

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event) { res.status(404).json({ error: "Evento não encontrado" }); return; }

  const platoonRules = await loadPlatoonRules();
  const team = await computeEventTeamResult(eventId);
  const platoon = getPlatoonByScore(team.eventScore, platoonRules);

  const participants = await db
    .select({
      employeeId: eventParticipantsTable.employeeId,
      employeeName: employeesTable.name,
      functionName: eventParticipantsTable.functionName,
      employeeFunction: employeesTable.functionName,
      eligibleForBonus: employeesTable.eligibleForBonus,
      eligibilityStatus: employeesTable.eligibilityStatus,
    })
    .from(eventParticipantsTable)
    .leftJoin(employeesTable, eq(eventParticipantsTable.employeeId, employeesTable.id))
    .where(eq(eventParticipantsTable.eventId, eventId));

  res.json({
    eventId,
    eventName: event.name,
    eventStatus: event.status,
    feedbackReleased: event.feedbackReleased,
    eventScore: team.eventScore,
    projectedPlatoon: platoon?.name ?? null,
    projectedPlatoonColor: platoon?.color ?? null,
    projectedBonus: platoon?.bonusValue ?? 0,
    totalCriteria: team.totalCriteria,
    evaluatedCriteria: team.evaluatedCriteria,
    pendingCriteria: team.pendingCriteria,
    isComplete: team.isComplete,
    hasCalibration: team.hasCalibration,
    criteriaDetails: team.criteriaDetails,
    participants: participants.map(p => ({
      employeeId: p.employeeId!,
      employeeName: p.employeeName ?? "",
      functionName: p.functionName ?? p.employeeFunction ?? "",
      eligible: (p.eligibleForBonus ?? true) && (p.eligibilityStatus ?? "eligible") === "eligible",
      eventScore: team.eventScore,
    })),
  });
});

router.get("/results/quarterly", async (req, res) => {
  const { year, quarter, employeeId, platoon } = req.query;
  if (!year || !quarter) { res.status(400).json({ error: "year e quarter obrigatórios" }); return; }

  const query = db
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
      eligible: quarterlyResultsTable.eligible,
      eligibilityReason: quarterlyResultsTable.eligibilityReason,
      bonusStatus: quarterlyResultsTable.bonusStatus,
      paymentMethod: quarterlyResultsTable.paymentMethod,
      paymentDueDate: quarterlyResultsTable.paymentDueDate,
      paidAt: quarterlyResultsTable.paidAt,
      paymentNotes: quarterlyResultsTable.paymentNotes,
    })
    .from(quarterlyResultsTable)
    .leftJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    .where(and(
      eq(quarterlyResultsTable.year, parseInt(year as string)),
      eq(quarterlyResultsTable.quarter, parseInt(quarter as string)),
    ));

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
  const { year, quarter, forced, reason } = req.body;
  if (!year || !quarter) { res.status(400).json({ error: "year e quarter obrigatórios" }); return; }

  const closedEvents = await db.select().from(eventsTable)
    .where(and(eq(eventsTable.year, year), eq(eventsTable.quarter, quarter), eq(eventsTable.status, "closed")));

  if (closedEvents.length === 0) {
    res.status(400).json({ error: "Nenhum evento fechado neste trimestre" });
    return;
  }

  // Fechamento forçado: se ainda há eventos abertos no trimestre, exige confirmação
  // explícita (forced=true) com justificativa obrigatória.
  const openEvents = await db.select({ id: eventsTable.id }).from(eventsTable)
    .where(and(eq(eventsTable.year, year), eq(eventsTable.quarter, quarter), eq(eventsTable.status, "open")));

  if (openEvents.length > 0) {
    if (!forced) {
      res.status(409).json({
        error: `Há ${openEvents.length} evento(s) ainda aberto(s) neste trimestre. Para fechar mesmo assim, confirme o fechamento forçado com justificativa.`,
        requiresForce: true,
        openEventsCount: openEvents.length,
      });
      return;
    }
    if (!reason || !String(reason).trim()) {
      res.status(400).json({ error: "Justificativa obrigatória para fechamento forçado." });
      return;
    }
  }
  const isForced = openEvents.length > 0 && !!forced;

  const closedEventIds = closedEvents.map(e => e.id);
  const platoonRules = await loadPlatoonRules();

  const penaltyRuleRow = await db.select().from(rulesTable).where(eq(rulesTable.key, "absence_penalty_per_absence")).limit(1);
  const penaltyPerAbsence = penaltyRuleRow[0] ? parseFloat(penaltyRuleRow[0].value) : 50;

  // 1. Calcula a nota do TIME de cada evento (uma vez por evento) e grava o
  //    resultado por colaborador participante (mesma nota para todos do time).
  const eventScoreById = new Map<number, number>();
  for (const ev of closedEvents) {
    const team = await computeEventTeamResult(ev.id);
    eventScoreById.set(ev.id, team.eventScore);
    const platoonProj = getPlatoonByScore(team.eventScore, platoonRules);

    const eventParticipants = await db.select({ employeeId: eventParticipantsTable.employeeId })
      .from(eventParticipantsTable).where(eq(eventParticipantsTable.eventId, ev.id));

    await db.delete(employeeEventResultsTable).where(eq(employeeEventResultsTable.eventId, ev.id));
    if (eventParticipants.length > 0) {
      await db.insert(employeeEventResultsTable).values(eventParticipants.map(p => ({
        eventId: ev.id,
        employeeId: p.employeeId,
        eventScore: String(team.eventScore),
        calibratedEventScore: team.hasCalibration ? String(team.eventScore) : null,
        finalEventScore: String(team.eventScore),
        platoonProjected: platoonProj?.name ?? null,
        updatedAt: new Date(),
      })));
    }
  }

  // 2. Consolida resultado trimestral por colaborador
  const participants = await db
    .selectDistinct({ employeeId: eventParticipantsTable.employeeId })
    .from(eventParticipantsTable)
    .where(inArray(eventParticipantsTable.eventId, closedEventIds));

  let processed = 0;
  const warnings: string[] = [];

  for (const { employeeId } of participants) {
    if (!employeeId) continue;

    const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, employeeId)).limit(1);
    if (!employee) continue;

    const participantEvents = await db.select({ eventId: eventParticipantsTable.eventId })
      .from(eventParticipantsTable)
      .where(and(eq(eventParticipantsTable.employeeId, employeeId), inArray(eventParticipantsTable.eventId, closedEventIds)));

    const eventScores: number[] = [];
    for (const { eventId } of participantEvents) {
      const s = eventScoreById.get(eventId);
      if (s !== undefined && s > 0) eventScores.push(s);
    }

    if (eventScores.length === 0) {
      warnings.push(`Colaborador ID ${employeeId}: sem eventos com avaliações`);
      continue;
    }

    const absenceRows = await db.select().from(absencesTable)
      .where(and(eq(absencesTable.employeeId, employeeId), eq(absencesTable.year, year), eq(absencesTable.quarter, quarter)));
    const totalAbsences = absenceRows.reduce((s, a) => s + a.quantity, 0);

    const grossAverage = calculateQuarterGrossAverage(eventScores);
    const absencePenalty = calculateAbsencePenalty(totalAbsences, penaltyPerAbsence);
    const finalResult = calculateQuarterFinalResult(grossAverage, absencePenalty);
    const platoon = getPlatoonByScore(finalResult, platoonRules);

    // Elegibilidade: cadastro + inelegibilidade trimestral
    const [quarterElig] = await db.select().from(employeeQuarterEligibilityTable)
      .where(and(
        eq(employeeQuarterEligibilityTable.employeeId, employeeId),
        eq(employeeQuarterEligibilityTable.year, year),
        eq(employeeQuarterEligibilityTable.quarter, quarter),
      )).limit(1);

    let eligible = (employee.eligibleForBonus ?? true) && (employee.eligibilityStatus ?? "eligible") === "eligible";
    let eligibilityReason: string | null = null;
    if (!eligible) {
      eligibilityReason = employee.eligibilityReason ?? `Colaborador inelegível (${employee.eligibilityStatus})`;
    }
    if (quarterElig && !quarterElig.eligible) {
      eligible = false;
      eligibilityReason = quarterElig.reason ?? "Inelegível neste trimestre";
    }

    // Bônus só é gerado se elegível; resultado é mantido para histórico.
    const bonusValue = eligible ? (platoon?.bonusValue ?? 0) : 0;
    const bonusStatus = eligible ? "projected" : "not_eligible";

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
      bonusValue: String(bonusValue),
      eligible,
      eligibilityReason,
      bonusStatus,
      paymentMethod: "Caju Saldo Livre",
      closedAt: new Date(),
      closedByUserId: req.user!.userId,
    });

    processed++;
  }

  await audit(
    req.user!.userId,
    isForced ? "force_close_quarter" : "close_quarter",
    "quarterly_results",
    `${year}-Q${quarter}`,
    null,
    isForced
      ? { forced: true, reason: String(reason).trim(), openEventsCount: openEvents.length }
      : { forced: false },
  );
  res.json({ success: true, year, quarter, totalProcessed: processed, warnings, forced: isForced });
});

/**
 * PATCH /results/quarterly/:id/payment
 * Atualiza status/pagamento do bônus (Caju Saldo Livre).
 */
router.patch("/results/quarterly/:id/payment", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { bonusStatus, paymentMethod, paymentDueDate, paidAt, paymentNotes } = req.body;

  const [existing] = await db.select().from(quarterlyResultsTable).where(eq(quarterlyResultsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Resultado não encontrado" }); return; }

  const validStatuses = ["projected", "approved", "scheduled", "paid", "blocked", "not_eligible"];
  if (bonusStatus !== undefined && !validStatuses.includes(bonusStatus)) {
    res.status(400).json({ error: "Status de bônus inválido" });
    return;
  }

  const [updated] = await db.update(quarterlyResultsTable).set({
    ...(bonusStatus !== undefined && { bonusStatus }),
    ...(paymentMethod !== undefined && { paymentMethod }),
    ...(paymentDueDate !== undefined && { paymentDueDate }),
    ...(paidAt !== undefined && { paidAt: paidAt ? new Date(paidAt) : null }),
    ...(paymentNotes !== undefined && { paymentNotes }),
  }).where(eq(quarterlyResultsTable.id, id)).returning();

  await audit(req.user!.userId, "update_bonus_payment", "quarterly_results", id, existing, updated);
  res.json({
    ...updated,
    grossAverage: parseFloat(updated.grossAverage),
    absencePenalty: parseFloat(updated.absencePenalty),
    finalResult: parseFloat(updated.finalResult),
    bonusValue: parseFloat(updated.bonusValue),
  });
});

export default router;
