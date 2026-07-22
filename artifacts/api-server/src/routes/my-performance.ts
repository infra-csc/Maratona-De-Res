import { Router } from "express";
import {
  db, eventsTable, eventParticipantsTable, evaluationsTable, calibrationsTable,
  eventCriteriaTable, criteriaTable, absencesTable, quarterlyResultsTable,
  platoonRulesTable, employeesTable, areasTable, employeeCycleEligibilityTable,
  eventAreaAssignmentsTable, eventReviewRequestsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { calculateEventResult, getPlatoonByScore, calculateTieredBonus, calculateQuarterFinalResult, selectExtraEventScores, buildAssignedEvaluatorsByArea, getCriterionEvaluationStatus, mergeEventScopedCriteria } from "../lib/calculations.js";
import { getCurrentCycle, getMinEventsForEligibility } from "../lib/cycle.js";
import { loadPenaltyLabels } from "./penalty-types.js";
import { participantCountsForScore, isInformationalFunction } from "../lib/participation.js";

const router = Router();
router.use(requireAuth);

/**
 * GET /my-performance
 * Desempenho do colaborador. A nota é do TIME do evento (mesma para todos).
 * - Nunca expõe o nome do avaliador
 * - Comentários internos ficam ocultos (apenas comentários públicos do time)
 */
router.get("/my-performance", async (req, res) => {
  const employeeId = req.user!.employeeId;
  if (!employeeId) {
    res.status(404).json({ error: "Nenhum colaborador vinculado a este usuário. Peça ao administrador para vincular seu perfil." });
    return;
  }

  const cycle = await getCurrentCycle();
  if (!cycle) {
    res.status(404).json({ error: "Nenhum ciclo ativo" });
    return;
  }

  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, employeeId)).limit(1);
  if (!employee) {
    res.status(404).json({ error: "Colaborador não encontrado" });
    return;
  }

  const [quarterResult] = await db.select().from(quarterlyResultsTable)
    .where(and(
      eq(quarterlyResultsTable.employeeId, employeeId),
      eq(quarterlyResultsTable.cycleId, cycle.id),
    )).limit(1);

  const [quarterElig] = await db.select().from(employeeCycleEligibilityTable)
    .where(and(
      eq(employeeCycleEligibilityTable.employeeId, employeeId),
      eq(employeeCycleEligibilityTable.cycleId, cycle.id),
    )).limit(1);

  const participations = await db
    .select({
      eventId: eventParticipantsTable.eventId,
      eventName: eventsTable.name,
      eventCity: eventsTable.city,
      eventState: eventsTable.state,
      eventLocation: eventsTable.location,
      eventStatus: eventsTable.status,
      feedbackReleased: eventsTable.feedbackReleased,
      feedbackReleasedAt: eventsTable.feedbackReleasedAt,
      startDate: eventsTable.startDate,
      endDate: eventsTable.endDate,
      functionName: eventParticipantsTable.functionName,
      participantConfirmed: eventParticipantsTable.confirmed,
      resultsConfirmed: eventsTable.resultsConfirmed,
    })
    .from(eventParticipantsTable)
    .leftJoin(eventsTable, eq(eventParticipantsTable.eventId, eventsTable.id))
    .where(and(
      eq(eventParticipantsTable.employeeId, employeeId),
      eq(eventsTable.cycleId, cycle.id),
    ));

  // Histórico completo fica no log (tela de Revisões Sinalizadas); para o
  // colaborador só interessa o pedido MAIS RECENTE de cada evento.
  const reviewRequests = await db.select().from(eventReviewRequestsTable)
    .where(eq(eventReviewRequestsTable.employeeId, employeeId))
    .orderBy(desc(eventReviewRequestsTable.createdAt));
  const reviewRequestByEvent = new Map<number, typeof reviewRequests[number]>();
  for (const rr of reviewRequests) {
    if (!reviewRequestByEvent.has(rr.eventId)) reviewRequestByEvent.set(rr.eventId, rr);
  }

  const platoonRules = await db.select().from(platoonRulesTable).where(eq(platoonRulesTable.active, true)).orderBy(platoonRulesTable.displayOrder);
  const platoonRulesMapped = platoonRules.map(r => ({
    name: r.name, color: r.color,
    minScore: parseFloat(r.minScore as unknown as string),
    maxScore: parseFloat(r.maxScore as unknown as string),
    minInclusive: r.minInclusive, maxInclusive: r.maxInclusive,
    bonusValue: parseFloat(r.bonusValue as unknown as string),
    bonusPerExtraEvent: parseFloat(r.bonusPerExtraEvent as unknown as string),
  }));

  const eventSummaries = [];
  for (const p of participations) {
    if (!p.eventId) continue;
    // Marcado como inativo no evento ("não participou de fato"): o evento não
    // conta para o colaborador — mesma regra do fechamento e do ranking da prova.
    if (p.participantConfirmed === false) continue;

    // event_criteria deste evento (inclui eventScoped para cálculo de nota)
    const eventCriteriaRows = await db
      .select({
        criterionId: eventCriteriaTable.criterionId,
        criterionName: criteriaTable.name,
        criterionDescription: criteriaTable.description,
        responsibleAreaId: criteriaTable.responsibleAreaId,
        responsibleAreaLabel: criteriaTable.responsibleAreaLabel,
        responsibleAreaName: areasTable.name,
        active: eventCriteriaTable.active,
        weight: eventCriteriaTable.weightOverride,
        defaultWeight: criteriaTable.defaultWeight,
        partialPublishedAt: eventCriteriaTable.partialPublishedAt,
        finalPublishedAt: eventCriteriaTable.finalPublishedAt,
        eventScoped: criteriaTable.eventScoped,
        sourceCriterionId: criteriaTable.sourceCriterionId,
      })
      .from(eventCriteriaTable)
      .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
      .leftJoin(areasTable, eq(criteriaTable.responsibleAreaId, areasTable.id))
      .where(and(eq(eventCriteriaTable.eventId, p.eventId), eq(eventCriteriaTable.active, true)));

    // Catálogo global de critérios ativos (não-eventScoped) — fonte da verdade
    // para o total. Eventos antigos podem ter menos linhas em event_criteria,
    // mas o colaborador sempre vê todos os 5 quesitos do ciclo.
    const globalCriteria = await db
      .select({
        id: criteriaTable.id,
        name: criteriaTable.name,
        description: criteriaTable.description,
        responsibleAreaId: criteriaTable.responsibleAreaId,
        responsibleAreaLabel: criteriaTable.responsibleAreaLabel,
        defaultWeight: criteriaTable.defaultWeight,
      })
      .from(criteriaTable)
      .where(and(eq(criteriaTable.active, true), eq(criteriaTable.eventScoped, false)));

    // Avaliações do TIME do evento (não por colaborador)
    const [allEvals, allCalibrations, areaAssignmentsRaw] = await Promise.all([
      db.select({
        criterionId: evaluationsTable.criterionId,
        score: evaluationsTable.score,
        comments: evaluationsTable.comments,
        commentVisibility: evaluationsTable.commentVisibility,
        status: evaluationsTable.status,
        evaluatorUserId: evaluationsTable.evaluatorUserId,
      }).from(evaluationsTable).where(eq(evaluationsTable.eventId, p.eventId)),

      db.select({
        criterionId: calibrationsTable.criterionId,
        calibratedScore: calibrationsTable.calibratedScore,
      }).from(calibrationsTable).where(eq(calibrationsTable.eventId, p.eventId)),

      db.select({ areaId: eventAreaAssignmentsTable.areaId, evaluatorUserId: eventAreaAssignmentsTable.evaluatorUserId })
        .from(eventAreaAssignmentsTable).where(eq(eventAreaAssignmentsTable.eventId, p.eventId)),
    ]);

    const assignedByArea = buildAssignedEvaluatorsByArea(areaAssignmentsRaw);

    // Constrói criteriaDetails com base no catálogo global — garante que todos
    // os quesitos aparecem mesmo que o evento não tenha linha em event_criteria.
    const criteriaDetails = globalCriteria.map(g => {
      const eventRow = eventCriteriaRows.find(r => r.criterionId === g.id);
      const weight = parseFloat(((eventRow?.weight ?? g.defaultWeight) ?? "1") as string);

      if (!eventRow) {
        // Critério existe no catálogo mas não neste evento — sem nota.
        return {
          criterionId: g.id,
          criterionName: g.name,
          criterionDescription: g.description,
          responsibleAreaLabel: g.responsibleAreaLabel ?? null,
          weight,
          scoreUsed: null as number | null,
          criterionTotal: null as number | null,
          publicComments: [] as string[],
          evaluated: false,
          status: "pendente" as const,
          partialPublishedAt: null as Date | null,
          finalPublishedAt: null as Date | null,
        };
      }

      // Tem linha no event_criteria — calcula normalmente.
      const submittedEvals = allEvals.filter(e => e.criterionId === g.id && e.status === "submitted");
      const evalScores = submittedEvals.map(e => parseFloat(e.score as unknown as string));
      const averageScore = evalScores.length > 0 ? evalScores.reduce((a, b) => a + b, 0) / evalScores.length : null;
      const calibration = allCalibrations.find(cal => cal.criterionId === g.id);
      const calibratedScore = calibration ? parseFloat(calibration.calibratedScore as unknown as string) : null;
      const scoreUsed = calibratedScore !== null ? calibratedScore : averageScore;
      const completion = getCriterionEvaluationStatus(eventRow.responsibleAreaId, submittedEvals.map(e => e.evaluatorUserId as number), assignedByArea);
      const isEvaluated = calibratedScore !== null || completion.isEvaluated;
      const criterionTotal = scoreUsed !== null ? scoreUsed * weight : null;
      const publicComments = allEvals
        .filter(e => e.criterionId === g.id && e.commentVisibility === "public" && e.comments)
        .map(e => e.comments!);

      return {
        criterionId: g.id,
        criterionName: g.name,
        criterionDescription: g.description,
        responsibleAreaLabel: eventRow.responsibleAreaLabel ?? eventRow.responsibleAreaName ?? null,
        weight,
        scoreUsed,
        criterionTotal,
        publicComments,
        evaluated: isEvaluated,
        status: isEvaluated ? "avaliado" as const : "pendente" as const,
        partialPublishedAt: eventRow.partialPublishedAt ?? null,
        finalPublishedAt: eventRow.finalPublishedAt ?? null,
      };
    });

    // Mescla critérios duplicados (eventScoped) nos seus pais para o cálculo
    // da nota. Usa apenas linhas com event_criteria (não os "vazios" do catálogo).
    const criteriaForCalc = mergeEventScopedCriteria([
      ...criteriaDetails
        .filter(cd => eventCriteriaRows.some(r => r.criterionId === cd.criterionId))
        .map(cd => {
          const row = eventCriteriaRows.find(r => r.criterionId === cd.criterionId)!;
          return {
            criterionId: cd.criterionId!,
            weight: cd.weight,
            averageScore: cd.scoreUsed,
            calibratedScore: null,
            isEventScoped: row.eventScoped ?? false,
            sourceCriterionId: row.sourceCriterionId ?? null,
          };
        }),
      // Inclui eventScoped duplicates que não estão no catálogo global
      ...eventCriteriaRows
        .filter(r => r.eventScoped)
        .map(r => ({
          criterionId: r.criterionId!,
          weight: parseFloat(r.weight ?? r.defaultWeight ?? "1"),
          averageScore: (() => {
            const subs = allEvals.filter(e => e.criterionId === r.criterionId && e.status === "submitted");
            if (subs.length === 0) return null;
            return subs.reduce((s, e) => s + parseFloat(e.score as unknown as string), 0) / subs.length;
          })(),
          calibratedScore: (() => {
            const cal = allCalibrations.find(c => c.criterionId === r.criterionId);
            return cal ? parseFloat(cal.calibratedScore as unknown as string) : null;
          })(),
          isEventScoped: true,
          sourceCriterionId: r.sourceCriterionId ?? null,
        })),
    ]);

    const eventScore = calculateEventResult(criteriaForCalc);
    // Sem nota (nenhum critério avaliado ainda) não tem pelotão — evita
    // mostrar "Pelotão Branco" para um evento com Quesitos 0/N.
    const platoon = eventScore > 0 ? getPlatoonByScore(eventScore, platoonRulesMapped) : null;
    const evaluatedCriteria = criteriaDetails.filter(c => c.evaluated).length;
    // Total sempre baseado no catálogo global — não no que está em event_criteria.
    const totalExpected = globalCriteria.length;
    const isComplete = totalExpected > 0 && evaluatedCriteria === totalExpected;

    // Rollup do evento = publicação parcial mais recente entre os critérios
    // (a fonte real agora é por critério, ver criteriaDetails[].partialPublishedAt).
    const partialTimestamps = eventCriteriaRows.map(c => c.partialPublishedAt).filter((d): d is Date => d != null);
    const partialPublishedAt = partialTimestamps.length > 0
      ? new Date(Math.max(...partialTimestamps.map(d => d.getTime())))
      : null;

    eventSummaries.push({
      eventId: p.eventId,
      eventName: p.eventName,
      city: p.eventCity,
      state: p.eventState,
      location: p.eventLocation,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.eventStatus,
      feedbackReleased: p.feedbackReleased ?? false,
      feedbackReleasedAt: p.feedbackReleasedAt ?? null,
      partialPublishedAt,
      eventScore,
      teamScore: eventScore,
      projectedPlatoon: platoon?.name ?? null,
      projectedPlatoonColor: platoon?.color ?? null,
      evaluatedCriteria,
      totalCriteria: totalExpected,
      // isPending removed — not shown to collaborators
      criteriaDetails,
      // Freela/função informativa (ex.: "Sup Ceno *"): participação aparece
      // no histórico mas não conta para a média/bônus — mesma regra do
      // fechamento (recomputeCycleResults, ver lib/participation.ts).
      countsForScore: participantCountsForScore({ employmentType: employee.employmentType, functionName: p.functionName, employeeFunction: employee.functionName }),
      // Trava mestra: evento só conta para média/elegibilidade depois de
      // confirmado por admin/RH (mesma regra de recomputeCycleResults).
      resultsConfirmed: p.resultsConfirmed ?? false,
      reviewRequest: (() => {
        const rr = reviewRequestByEvent.get(p.eventId);
        if (!rr) return null;
        return {
          id: rr.id,
          comment: rr.comment,
          status: rr.status,
          createdAt: rr.createdAt,
          resolvedAt: rr.resolvedAt,
          resolutionNotes: rr.resolutionNotes,
        };
      })(),
    });
  }

  const absences = await db.select({
    id: absencesTable.id,
    kind: absencesTable.kind,
    penaltyType: absencesTable.penaltyType,
    points: absencesTable.points,
    quantity: absencesTable.quantity,
    date: absencesTable.date,
    reason: absencesTable.reason,
    eventId: absencesTable.eventId,
    eventName: eventsTable.name,
  }).from(absencesTable)
    .leftJoin(eventsTable, eq(absencesTable.eventId, eventsTable.id))
    .where(and(
      eq(absencesTable.employeeId, employeeId),
      eq(absencesTable.cycleId, cycle.id),
    ));
  // Mesma regra do fechamento (results.ts): méritos NÃO contam como falta.
  const penaltyRows = absences.filter(a => a.kind !== "merit");
  const meritRows = absences.filter(a => a.kind === "merit");
  const totalAbsences = penaltyRows.reduce((s, a) => s + a.quantity, 0);
  const penaltyPoints = penaltyRows.reduce((s, a) => s + a.points * a.quantity, 0);
  const meritPoints = meritRows.reduce((s, a) => s + a.points * a.quantity, 0);
  const penaltyLabels = await loadPenaltyLabels();
  const adjustments = absences
    .map(a => ({
      id: a.id,
      kind: a.kind === "merit" ? "merit" : "penalty",
      penaltyType: penaltyLabels.get(a.penaltyType) ?? a.penaltyType,
      points: a.points,
      quantity: a.quantity,
      totalPoints: Math.round(a.points * a.quantity * 100) / 100,
      date: a.date,
      reason: a.reason,
      eventName: a.eventName,
    }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const totalEvents = eventSummaries.length;
  const openEvents = eventSummaries.filter(e => e.status === "open").length;
  const closedEvents = eventSummaries.filter(e => e.status === "closed").length;

  const minEventsForEligibility = await getMinEventsForEligibility();
  const scoredEvents = eventSummaries.filter(e => e.eventScore > 0 && e.countsForScore && e.resultsConfirmed);
  const grossAverage = scoredEvents.length > 0
    ? scoredEvents.reduce((s, e) => s + e.eventScore, 0) / scoredEvents.length
    : null;

  const registrationEligible = (employee.eligibleForBonus ?? true) && (employee.eligibilityStatus ?? "eligible") === "eligible";
  const quarterEligible = !quarterElig || quarterElig.eligible;
  // Regra: participação como "Sup Ceno *" em qualquer evento do ciclo
  // desqualifica do ranking/bônus — mesma regra do fechamento (results.ts).
  const hasSupCenoParticipation = participations.some(p => isInformationalFunction(p.functionName));
  const eligible = registrationEligible && quarterEligible && !hasSupCenoParticipation;

  let currentPlatoon = null;
  let currentBonus = null;
  let bonusStatus: string | null = null;
  let finalResult: number | null = null;
  if (quarterResult) {
    currentPlatoon = quarterResult.platoon;
    currentBonus = parseFloat(quarterResult.bonusValue as unknown as string);
    bonusStatus = quarterResult.bonusStatus;
    finalResult = parseFloat(quarterResult.finalResult as unknown as string);
  } else if (grossAverage !== null) {
    // Espelha a regra de fechamento (results.ts): méritos somam, penalidades
    // subtraem, resultado travado entre 0 e 100 — projeção precisa refletir
    // os ajustes ao vivo, senão o colaborador vê uma nota/pelotão/bônus que
    // não bate com o que será oficializado no fechamento.
    const projectedFinalResult = calculateQuarterFinalResult(grossAverage, penaltyPoints - meritPoints, scoredEvents.length);
    const proj = getPlatoonByScore(projectedFinalResult, platoonRulesMapped);
    currentPlatoon = proj?.name ?? null;
    const scoredEventsWithDate = scoredEvents
      .filter(e => !!e.startDate)
      .map(e => ({ score: e.eventScore, date: e.startDate as string }));
    const extraEventScores = eligible ? selectExtraEventScores(scoredEventsWithDate, minEventsForEligibility) : [];
    currentBonus = eligible ? calculateTieredBonus(projectedFinalResult, extraEventScores, platoonRulesMapped) : 0;
    bonusStatus = eligible ? "projected" : "not_eligible";
    finalResult = projectedFinalResult;
  }

  res.json({
    employee: {
      id: employee.id,
      name: employee.name,
      department: employee.department,
      functionName: employee.functionName,
      eligible,
      eligibilityStatus: employee.eligibilityStatus,
    },
    cycle: { id: cycle.id, name: cycle.name },
    summary: {
      grossAverage,
      currentPlatoon,
      projectedBonus: currentBonus,
      bonusStatus,
      eligible,
      totalEvents,
      closedEvents,
      openEvents,
      confirmedEvents: scoredEvents.length,
      minEventsForEligibility,
      totalAbsences,
      penaltyPoints: Math.round(penaltyPoints * 100) / 100,
      meritPoints: Math.round(meritPoints * 100) / 100,
      isQuarterClosed: cycle.status === "closed" || !!cycle.closedAt,
      finalResult,
      absencePenalty: quarterResult ? parseFloat(quarterResult.absencePenalty as unknown as string) : null,
      paymentMethod: quarterResult ? quarterResult.paymentMethod : "Caju Saldo Livre",
    },
    adjustments,
    events: eventSummaries,
  });
});

/**
 * POST /my-performance/events/:eventId/review-request
 * Colaborador sinaliza um evento para revisão (ex.: nota/critério que discorda),
 * com um comentário obrigatório. Cria um pedido "pending"; se já existir um
 * pedido pendente para este evento, apenas atualiza o comentário (evita
 * duplicar pedidos em aberto). Um pedido já resolvido pode ser reaberto com
 * um novo comentário (vira pending de novo).
 */
router.post("/my-performance/events/:eventId/review-request", async (req, res) => {
  const employeeId = req.user!.employeeId;
  if (!employeeId) {
    res.status(404).json({ error: "Nenhum colaborador vinculado a este usuário." });
    return;
  }
  const eventId = parseInt(req.params.eventId as string);
  if (isNaN(eventId)) {
    res.status(400).json({ error: "Evento inválido." });
    return;
  }
  const comment = (req.body?.comment ?? "").trim();
  if (!comment) {
    res.status(400).json({ error: "Comentário obrigatório para sinalizar revisão." });
    return;
  }

  const [participation] = await db.select().from(eventParticipantsTable)
    .where(and(eq(eventParticipantsTable.eventId, eventId), eq(eventParticipantsTable.employeeId, employeeId)))
    .limit(1);
  if (!participation) {
    res.status(404).json({ error: "Você não participou deste evento." });
    return;
  }

  // Log de pedidos: cada sinalização preserva o histórico. Um pedido ainda
  // PENDENTE é atualizado (não duplica pendências em aberto); depois de
  // resolvido (aprovado/negado), sinalizar de novo cria um REGISTRO NOVO —
  // o desfecho anterior fica guardado no log de Revisões Sinalizadas.
  const [existingPending] = await db.select().from(eventReviewRequestsTable)
    .where(and(
      eq(eventReviewRequestsTable.eventId, eventId),
      eq(eventReviewRequestsTable.employeeId, employeeId),
      eq(eventReviewRequestsTable.status, "pending"),
    ))
    .limit(1);

  let reviewRequest;
  if (existingPending) {
    [reviewRequest] = await db.update(eventReviewRequestsTable).set({
      comment,
    }).where(eq(eventReviewRequestsTable.id, existingPending.id)).returning();
  } else {
    [reviewRequest] = await db.insert(eventReviewRequestsTable).values({
      eventId,
      employeeId,
      comment,
      status: "pending",
    }).returning();
  }

  res.status(existingPending ? 200 : 201).json(reviewRequest);
});

export default router;
