import { Router } from "express";
import {
  db, eventsTable, eventParticipantsTable, evaluationsTable, calibrationsTable,
  eventCriteriaTable, criteriaTable, absencesTable, quarterlyResultsTable,
  platoonRulesTable, employeesTable, employeeEventResultsTable,
  employeeCycleEligibilityTable, areasTable, cyclesTable, eventConformitiesTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import {
  calculateEventResult, calculateQuarterGrossAverage, calculateQuarterFinalResult, getPlatoonByScore,
  calculateTieredBonus, validateCalculationExample, calculateConformitySubtotal, calculateConformityPenalty,
  calculateFinalEventScore, validateConformityCalculationExample,
} from "../lib/calculations.js";
import { getCurrentCycle, getMinEventsForEligibility } from "../lib/cycle.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

// Log validation on startup
if (!validateCalculationExample()) {
  console.error("❌ ERRO DE CÁLCULO: pesos=[3,3,2,3,3,3,3], notas=[4,4,4,3,2,3,5] deveria retornar 71");
}
if (!validateConformityCalculationExample()) {
  console.error("❌ ERRO DE CÁLCULO: exemplo de conformidade+performance da especificação deveria retornar 60");
}

type PlatoonRuleMapped = {
  name: string; color: string; minScore: number; maxScore: number;
  minInclusive: boolean; maxInclusive: boolean; bonusValue: number; bonusPerExtraEvent: number;
};

async function loadPlatoonRules(): Promise<PlatoonRuleMapped[]> {
  const rows = await db.select().from(platoonRulesTable).where(eq(platoonRulesTable.active, true)).orderBy(platoonRulesTable.displayOrder);
  return rows.map(r => ({
    name: r.name, color: r.color,
    minScore: parseFloat(r.minScore as unknown as string),
    maxScore: parseFloat(r.maxScore as unknown as string),
    minInclusive: r.minInclusive, maxInclusive: r.maxInclusive,
    bonusValue: parseFloat(r.bonusValue as unknown as string),
    bonusPerExtraEvent: parseFloat(r.bonusPerExtraEvent as unknown as string),
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

  let eventScore = calculateEventResult(criteriaForCalc);

  // Matriz de Conformidade: SIM=25/NÃO=0 por item (0-100), penalidade =
  // (100 - Subtotal Conformidade) × 0,40, aplicada sobre o Subtotal Performance.
  const [conformity] = await db
    .select()
    .from(eventConformitiesTable)
    .where(eq(eventConformitiesTable.eventId, eventId));
  const conformitySubtotal = conformity
    ? calculateConformitySubtotal([conformity.epi, conformity.estaiamentos, conformity.guardaEquipamentos, conformity.conduta])
    : 100;
  const conformityPenalty = calculateConformityPenalty(conformitySubtotal);
  const conformityScore = calculateFinalEventScore(eventScore, conformitySubtotal);

  const hasCalibration = criteriaDetails.some(cd => cd.calibratedScore !== null);
  const pendingCriteria = criteriaDetails.filter(cd => cd.status === "pendente").length;
  const evaluatedCriteria = criteriaDetails.length - pendingCriteria;
  const isComplete = criteriaDetails.length > 0 && pendingCriteria === 0;

  return { criteriaDetails, eventScore, conformity, conformityPenalty, conformityScore, hasCalibration, pendingCriteria, evaluatedCriteria, totalCriteria: criteriaDetails.length, isComplete };
}

/**
 * Recalcula e regrava os resultados do ciclo (quarterly_results) e os resultados
 * por evento (employee_event_results) de um CICLO, a partir de TODOS os eventos
 * atualmente fechados (status="closed") naquele ciclo.
 *
 * É idempotente: limpa o ciclo e reconstrói. Preserva o estado de pagamento
 * já acionado manualmente (aprovado/agendado/pago/bloqueado ou já pago) para não
 * descartar decisões de bônus ao reprocessar quando um novo evento é fechado.
 *
 * Consolida TODOS os colaboradores que participaram de qualquer evento do ciclo
 * (mesmo sem nota), registrando separadamente:
 *  - eventsCount = eventos COM NOTA (score > 0) — base de Soma/Média;
 *  - participatedEventsCount = eventos PARTICIPADOS no ciclo — base de elegibilidade.
 *
 * Usado tanto pelo fechamento manual do ciclo quanto automaticamente quando
 * um evento é fechado/reaberto/liberado, mantendo dashboard, resultados e
 * ranking sempre atualizados.
 */
export async function recomputeCycleResults(cycleId: number, userId: number) {
  const cycleEvents = await db.select().from(eventsTable).where(eq(eventsTable.cycleId, cycleId));
  const allCycleEventIds = cycleEvents.map(e => e.id);
  const closedEvents = cycleEvents.filter(e => e.status === "closed");
  const closedEventIds = new Set(closedEvents.map(e => e.id));
  const platoonRules = await loadPlatoonRules();
  const minEvents = await getMinEventsForEligibility();
  const warnings: string[] = [];

  // Snapshot do estado de pagamento atual para preservar decisões manuais.
  const existingRows = await db.select().from(quarterlyResultsTable)
    .where(eq(quarterlyResultsTable.cycleId, cycleId));
  const PRESERVE_STATUSES = ["approved", "scheduled", "paid", "blocked"];
  const paymentByEmployee = new Map<number, typeof existingRows[number]>();
  for (const r of existingRows) paymentByEmployee.set(r.employeeId, r);

  // FASE DE LEITURA — calcula tudo antes de escrever, para gravar dentro de uma
  // única transação (rebuild atômico: nunca deixa o ciclo vazio em caso de erro).

  // 1. Nota do TIME de cada evento fechado + linhas por evento.
  const eventScoreById = new Map<number, number>();
  const eventResultInserts: (typeof employeeEventResultsTable.$inferInsert)[] = [];
  for (const ev of closedEvents) {
    const team = await computeEventTeamResult(ev.id);
    eventScoreById.set(ev.id, team.conformityScore);
    const platoonProj = getPlatoonByScore(team.conformityScore, platoonRules);

    const eventParticipants = await db.select({ employeeId: eventParticipantsTable.employeeId })
      .from(eventParticipantsTable).where(eq(eventParticipantsTable.eventId, ev.id));

    for (const p of eventParticipants) {
      eventResultInserts.push({
        eventId: ev.id,
        employeeId: p.employeeId,
        eventScore: String(team.eventScore),
        calibratedEventScore: team.hasCalibration ? String(team.eventScore) : null,
        finalEventScore: String(team.conformityScore),
        platoonProjected: platoonProj?.name ?? null,
        updatedAt: new Date(),
      });
    }
  }

  // 2. Participação por colaborador em TODOS os eventos do ciclo (qualquer status).
  const participationRows = allCycleEventIds.length > 0
    ? await db.select({ employeeId: eventParticipantsTable.employeeId, eventId: eventParticipantsTable.eventId })
        .from(eventParticipantsTable)
        .where(inArray(eventParticipantsTable.eventId, allCycleEventIds))
    : [];
  const participatedByEmployee = new Map<number, Set<number>>();
  for (const r of participationRows) {
    if (!r.employeeId) continue;
    if (!participatedByEmployee.has(r.employeeId)) participatedByEmployee.set(r.employeeId, new Set());
    participatedByEmployee.get(r.employeeId)!.add(r.eventId);
  }

  // 3. Consolida o resultado do ciclo por colaborador.
  const quarterlyInserts: (typeof quarterlyResultsTable.$inferInsert)[] = [];
  for (const [employeeId, eventSet] of participatedByEmployee) {
    const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, employeeId)).limit(1);
    if (!employee) continue;

    const participatedCount = eventSet.size;

    // Eventos COM NOTA (score > 0) dentre os fechados que o colaborador participou.
    const eventScores: number[] = [];
    for (const eventId of eventSet) {
      if (!closedEventIds.has(eventId)) continue;
      const s = eventScoreById.get(eventId);
      if (s !== undefined && s > 0) eventScores.push(s);
    }
    const scoredCount = eventScores.length;
    const scoreSum = Math.round(eventScores.reduce((a, b) => a + b, 0) * 100) / 100;

    const absenceRows = await db.select().from(absencesTable)
      .where(and(eq(absencesTable.employeeId, employeeId), eq(absencesTable.cycleId, cycleId)));
    const penaltyRows = absenceRows.filter(a => a.kind !== "merit");
    const meritRows = absenceRows.filter(a => a.kind === "merit");
    const totalAbsences = penaltyRows.reduce((s, a) => s + a.quantity, 0);

    const grossAverage = calculateQuarterGrossAverage(eventScores);
    const penaltyPoints = penaltyRows.reduce((s, a) => s + a.points * a.quantity, 0);
    const meritPoints = meritRows.reduce((s, a) => s + a.points * a.quantity, 0);
    const absencePenalty = penaltyPoints;
    // Méritos somam, penalidades subtraem; resultado final fica travado entre 0 e 100.
    const finalResult = calculateQuarterFinalResult(grossAverage, penaltyPoints - meritPoints);
    const platoon = getPlatoonByScore(finalResult, platoonRules);

    const [cycleElig] = await db.select().from(employeeCycleEligibilityTable)
      .where(and(
        eq(employeeCycleEligibilityTable.employeeId, employeeId),
        eq(employeeCycleEligibilityTable.cycleId, cycleId),
      )).limit(1);

    let eligible = (employee.eligibleForBonus ?? true) && (employee.eligibilityStatus ?? "eligible") === "eligible";
    let eligibilityReason: string | null = null;
    if (!eligible) {
      eligibilityReason = employee.eligibilityReason ?? `Colaborador inelegível (${employee.eligibilityStatus})`;
    }
    if (cycleElig && !cycleElig.eligible) {
      eligible = false;
      eligibilityReason = cycleElig.reason ?? "Inelegível neste ciclo";
    }
    // Regra de participação: precisa ter participado de no mínimo N eventos no ciclo.
    if (eligible && participatedCount < minEvents) {
      eligible = false;
      eligibilityReason = `Participou de ${participatedCount} de ${minEvents} eventos exigidos no ciclo`;
    }

    const bonusValue = eligible ? calculateTieredBonus(finalResult, participatedCount, minEvents, platoonRules) : 0;
    const autoStatus = eligible ? "projected" : "not_eligible";

    // Preserva decisões de pagamento já acionadas manualmente.
    const prev = paymentByEmployee.get(employeeId);
    const keepPayment = !!prev && (!!prev.paidAt || PRESERVE_STATUSES.includes(prev.bonusStatus));

    quarterlyInserts.push({
      employeeId,
      cycleId,
      eventsCount: scoredCount,
      participatedEventsCount: participatedCount,
      scoreSum: String(scoreSum),
      grossAverage: String(grossAverage),
      totalAbsences,
      absencePenalty: String(absencePenalty),
      meritPoints: String(meritPoints),
      finalResult: String(finalResult),
      platoon: platoon?.name ?? null,
      platoonColor: platoon?.color ?? null,
      bonusValue: String(bonusValue),
      eligible,
      eligibilityReason,
      bonusStatus: keepPayment ? prev!.bonusStatus : autoStatus,
      paymentMethod: prev?.paymentMethod ?? "Caju Saldo Livre",
      paymentDueDate: keepPayment ? prev!.paymentDueDate : null,
      paidAt: keepPayment ? prev!.paidAt : null,
      paymentNotes: keepPayment ? prev!.paymentNotes : null,
      closedAt: new Date(),
      closedByUserId: userId,
    });
  }

  // FASE DE ESCRITA — rebuild atômico de todo o ciclo.
  await db.transaction(async (tx) => {
    if (allCycleEventIds.length > 0) {
      await tx.delete(employeeEventResultsTable)
        .where(inArray(employeeEventResultsTable.eventId, allCycleEventIds));
    }
    if (eventResultInserts.length > 0) {
      await tx.insert(employeeEventResultsTable).values(eventResultInserts);
    }
    await tx.delete(quarterlyResultsTable)
      .where(eq(quarterlyResultsTable.cycleId, cycleId));
    if (quarterlyInserts.length > 0) {
      await tx.insert(quarterlyResultsTable).values(quarterlyInserts);
    }
  });

  return { processed: quarterlyInserts.length, warnings };
}

/**
 * GET /events/:id/result
 * Resultado do TIME do evento + lista de participantes (todos recebem a mesma nota).
 */
router.get("/events/:id/result", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event) { res.status(404).json({ error: "Evento não encontrado" }); return; }

  const platoonRules = await loadPlatoonRules();
  const team = await computeEventTeamResult(eventId);
  const platoon = getPlatoonByScore(team.conformityScore, platoonRules);

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
    conformity: team.conformity ?? null,
    conformityPenalty: team.conformityPenalty,
    conformityScore: team.conformityScore,
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
      eventScore: team.conformityScore,
    })),
  });
});

router.get("/results/quarterly", async (req, res) => {
  const isManager = !!req.user && ["admin", "rh", "diretoria"].includes(req.user.role);
  const { employeeId, platoon } = req.query;
  const cycle = await getCurrentCycle();
  if (!cycle) { res.json([]); return; }

  const query = db
    .select({
      id: quarterlyResultsTable.id,
      employeeId: quarterlyResultsTable.employeeId,
      employeeName: employeesTable.name,
      cycleId: quarterlyResultsTable.cycleId,
      eventsCount: quarterlyResultsTable.eventsCount,
      participatedEventsCount: quarterlyResultsTable.participatedEventsCount,
      scoreSum: quarterlyResultsTable.scoreSum,
      grossAverage: quarterlyResultsTable.grossAverage,
      totalAbsences: quarterlyResultsTable.totalAbsences,
      absencePenalty: quarterlyResultsTable.absencePenalty,
      meritPoints: quarterlyResultsTable.meritPoints,
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
    .where(eq(quarterlyResultsTable.cycleId, cycle.id));

  const results = await query;
  const filtered = results
    .filter(r => !employeeId || r.employeeId === parseInt(employeeId as string))
    .filter(r => !platoon || r.platoon === platoon);

  res.json(filtered.map(r => ({
    ...r,
    scoreSum: parseFloat(r.scoreSum),
    grossAverage: parseFloat(r.grossAverage),
    absencePenalty: parseFloat(r.absencePenalty),
    meritPoints: parseFloat(r.meritPoints),
    finalResult: parseFloat(r.finalResult),
    bonusValue: isManager ? parseFloat(r.bonusValue) : 0,
    bonusStatus: isManager ? r.bonusStatus : null,
    paymentMethod: isManager ? r.paymentMethod : null,
    paymentDueDate: isManager ? r.paymentDueDate : null,
    paidAt: isManager ? r.paidAt : null,
    paymentNotes: isManager ? r.paymentNotes : null,
    eventBreakdown: [],
  })));
});

router.post("/results/quarterly/close", requireRole("admin", "rh"), async (req, res) => {
  const { forced, reason } = req.body;
  const cycle = await getCurrentCycle();
  if (!cycle) { res.status(400).json({ error: "Nenhum ciclo ativo" }); return; }

  const closedEvents = await db.select().from(eventsTable)
    .where(and(eq(eventsTable.cycleId, cycle.id), eq(eventsTable.status, "closed")));

  if (closedEvents.length === 0) {
    res.status(400).json({ error: "Nenhum evento fechado neste ciclo" });
    return;
  }

  // Fechamento forçado: se ainda há eventos abertos no ciclo, exige confirmação
  // explícita (forced=true) com justificativa obrigatória.
  const openEvents = await db.select({ id: eventsTable.id }).from(eventsTable)
    .where(and(eq(eventsTable.cycleId, cycle.id), eq(eventsTable.status, "open")));

  if (openEvents.length > 0) {
    if (!forced) {
      res.status(409).json({
        error: `Há ${openEvents.length} evento(s) ainda aberto(s) neste ciclo. Para fechar mesmo assim, confirme o fechamento forçado com justificativa.`,
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

  const { processed, warnings } = await recomputeCycleResults(cycle.id, req.user!.userId);

  await db.update(cyclesTable)
    .set({ status: "closed", closedAt: new Date() })
    .where(eq(cyclesTable.id, cycle.id));

  await audit(
    req.user!.userId,
    isForced ? "force_close_cycle" : "close_cycle",
    "cycles",
    cycle.id,
    null,
    isForced
      ? { forced: true, reason: String(reason).trim(), openEventsCount: openEvents.length }
      : { forced: false },
  );
  res.json({ success: true, cycleId: cycle.id, totalProcessed: processed, warnings, forced: isForced });
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
