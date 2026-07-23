import { Router } from "express";
import { db, eventsTable, eventParticipantsTable, employeesTable, criteriaTable, eventCriteriaTable, evaluationsTable, calibrationsTable, areasTable, eventAreaAssignmentsTable, usersTable, eventConformitiesTable, employeeEventResultsTable, absencesTable, eventCommentsTable, areaConformityRoutingTable } from "@workspace/db";
import { eq, and, sql, inArray, ilike, or, ne, aliasedTable } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { convertScoreToPercentage, calculateEventResult, buildAssignedEvaluatorsByArea, getCriterionEvaluationStatus, mergeEventScopedCriteria } from "../lib/calculations.js";
import { recomputeCycleResults } from "./results.js";
import { generateCriterionAssignments } from "./routing.js";
import { getCurrentCycle } from "../lib/cycle.js";
import { participantCountsForScore } from "../lib/participation.js";

const router = Router();
router.use(requireAuth);

router.get("/events", async (req, res) => {
  const { status } = req.query;
  const cycle = await getCurrentCycle();
  if (!cycle) { res.json([]); return; }
  let query = db.select().from(eventsTable).$dynamic();
  const conditions = [eq(eventsTable.cycleId, cycle.id)];
  if (status) conditions.push(eq(eventsTable.status, status as string));
  query = query.where(and(...conditions));
  const events = await query.orderBy(eventsTable.startDate);

  if (events.length === 0) { res.json([]); return; }
  const eventIds = events.map(e => e.id);

  // Busca em lote para evitar N+1 (uma query por relação, não por evento).
  const [participants, evals, eventCriteriaRows, calibrations, areaAssignmentRows, allAreas, conformityRows, globalCatalog] = await Promise.all([
    db.select({ eventId: eventParticipantsTable.eventId, functionName: eventParticipantsTable.functionName, employmentType: employeesTable.employmentType, employeeFunction: employeesTable.functionName })
      .from(eventParticipantsTable).leftJoin(employeesTable, eq(eventParticipantsTable.employeeId, employeesTable.id)).where(inArray(eventParticipantsTable.eventId, eventIds)),
    db.select({ eventId: evaluationsTable.eventId, criterionId: evaluationsTable.criterionId, score: evaluationsTable.score, status: evaluationsTable.status, evaluatorUserId: evaluationsTable.evaluatorUserId })
      .from(evaluationsTable).where(inArray(evaluationsTable.eventId, eventIds)),
    db.select({ eventId: eventCriteriaTable.eventId, criterionId: eventCriteriaTable.criterionId, active: eventCriteriaTable.active, weightOverride: eventCriteriaTable.weightOverride, defaultWeight: criteriaTable.defaultWeight, responsibleAreaId: criteriaTable.responsibleAreaId, partialPublishedAt: eventCriteriaTable.partialPublishedAt, finalPublishedAt: eventCriteriaTable.finalPublishedAt, criterionActive: criteriaTable.active, criterionEventScoped: criteriaTable.eventScoped, criterionSourceCriterionId: criteriaTable.sourceCriterionId })
      .from(eventCriteriaTable).leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id)).where(inArray(eventCriteriaTable.eventId, eventIds)),
    db.select({ eventId: calibrationsTable.eventId, criterionId: calibrationsTable.criterionId, calibratedScore: calibrationsTable.calibratedScore })
      .from(calibrationsTable).where(inArray(calibrationsTable.eventId, eventIds)),
    db.select({ eventId: eventAreaAssignmentsTable.eventId, areaId: eventAreaAssignmentsTable.areaId, evaluatorUserId: eventAreaAssignmentsTable.evaluatorUserId })
      .from(eventAreaAssignmentsTable).where(inArray(eventAreaAssignmentsTable.eventId, eventIds)),
    db.select({ id: areasTable.id, name: areasTable.name }).from(areasTable),
    db.select({
      eventId: eventConformitiesTable.eventId,
      epi: eventConformitiesTable.epi,
      estaiamentos: eventConformitiesTable.estaiamentos,
      guardaEquipamentos: eventConformitiesTable.guardaEquipamentos,
      conduta: eventConformitiesTable.conduta,
      standoutResponse: eventConformitiesTable.standoutResponse,
      absencesResponse: eventConformitiesTable.absencesResponse,
    }).from(eventConformitiesTable).where(inArray(eventConformitiesTable.eventId, eventIds)),
    // Catálogo global: fonte de verdade para o total de quesitos do ciclo.
    db.select({ id: criteriaTable.id, defaultWeight: criteriaTable.defaultWeight })
      .from(criteriaTable).where(and(eq(criteriaTable.active, true), eq(criteriaTable.eventScoped, false))),
  ]);
  // Quesitos globais ativos com peso > 0 — denominador fixo para todos os eventos.
  const globalScorable = globalCatalog.filter(c => parseFloat((c.defaultWeight ?? "1") as unknown as string) > 0).length || globalCatalog.length;
  const areaNameById = new Map(allAreas.map(a => [a.id, a.name]));

  // Calcula se a Matriz de Conformidade foi preenchida por quem foi atribuído.
  function getConformityStatus(ev: (typeof events)[0]) {
    const cenoAssigned = ev.conformityEvaluatorUserId != null;
    const ferrAssigned = ev.conformityEvaluatorFerramentasUserId != null;
    const conformityNeeded = cenoAssigned || ferrAssigned;
    if (!conformityNeeded) return { conformityNeeded: false, conformityComplete: false };
    const conf = conformityRows.find(c => c.eventId === ev.id);
    const cenoDone = !cenoAssigned || (conf != null &&
      conf.epi != null && conf.estaiamentos != null && conf.conduta != null &&
      conf.standoutResponse != null && conf.absencesResponse != null);
    const ferrDone = !ferrAssigned || (conf != null && conf.guardaEquipamentos != null);
    return { conformityNeeded, conformityComplete: cenoDone && ferrDone };
  }

  // Filtra eventos dentro do período do ciclo atual (se o ciclo tiver datas definidas;
  // um ciclo sem startDate/endDate configurados não filtra, evitando excluir tudo por engano)
  const { startDate: cycleStartDate, endDate: cycleEndDate } = cycle;
  const cycleEvents = cycleStartDate && cycleEndDate
    ? events.filter(ev => ev.endDate >= cycleStartDate && ev.endDate <= cycleEndDate)
    : events;

  const enriched = cycleEvents.map((ev) => {
    const participantCount = participants.filter(p => p.eventId === ev.id && participantCountsForScore(p)).length;

    // Evento histórico importado: nota já vem pronta (calibrada) de fora.
    // Ainda calcula critérios/calibrações caso existam (históricos podem ter
    // calibrações complementares importadas via planilha).
    if (ev.isHistorical) {
      const score = ev.importedScore != null ? parseFloat(ev.importedScore as unknown as string) : null;
      const evCals = calibrations.filter(c => c.eventId === ev.id);
      // Para eventos históricos: inclui critérios ec_active=F se tiverem calibração salva
      // (critérios podem ter sido desativados depois de já serem calibrados no sistema legado).
      const activeCriteria = eventCriteriaRows.filter(c =>
        c.eventId === ev.id &&
        c.criterionActive !== false &&
        !c.criterionEventScoped &&
        (c.active || evCals.some(cal => cal.criterionId === c.criterionId && cal.calibratedScore !== null))
      );
      // Todos os critérios ativos com peso > 0 — denominador correto para o total.
      const allScorableCriteria = activeCriteria.filter(c => {
        const w = parseFloat((c.weightOverride ?? c.defaultWeight ?? "1") as unknown as string);
        return w > 0;
      });
      // Critérios com calibração salva (para contadores de calibração).
      const calibratedCriteriaCount = allScorableCriteria.filter(c =>
        evCals.some(cal => cal.criterionId === c.criterionId && cal.calibratedScore !== null)
      ).length;
      const finalCalibratedCriteria = allScorableCriteria.filter(c => c.finalPublishedAt != null).length;
      const scorableCount = allScorableCriteria.length;
      const fullyCalibrated = scorableCount > 0 && finalCalibratedCriteria === scorableCount;
      const partialTimestamps = activeCriteria.map(c => c.partialPublishedAt).filter((d): d is Date => d != null);
      const partialPublishedAt = partialTimestamps.length > 0
        ? new Date(Math.max(...partialTimestamps.map(d => d.getTime()))) : null;
      const partialPublishedCount = allScorableCriteria.filter(c => c.partialPublishedAt != null).length;
      const { conformityNeeded, conformityComplete } = getConformityStatus(ev);
      return {
        ...ev,
        participantCount,
        evaluationProgress: 1,
        totalCriteria: scorableCount,
        evaluatedCriteria: calibratedCriteriaCount,
        submittedCount: 0,
        averageScore: score,
        teamScore: score,
        hasCalibration: calibratedCriteriaCount > 0,
        fullyCalibrated,
        calibratedCriteriaCount,
        finalCalibratedCriteria,
        partialPublishedCount,
        partialPublishedAt,
        criteriaConfirmed: true,
        unassignedAreaNames: [],
        conformityNeeded,
        conformityComplete,
      };
    }

    const evEvals = evals.filter(e => e.eventId === ev.id);
    const submitted = evEvals.filter(e => e.status === "submitted");
    // Pré-carrega calibrações do evento para usar no filtro de critérios abaixo.
    const evCalsEarly = calibrations.filter(c => c.eventId === ev.id);
    const calibratedCriterionIds = new Set(evCalsEarly.filter(c => c.calibratedScore !== null).map(c => c.criterionId));
    // Critérios pai (não-eventScoped) usados para contadores e filtros.
    // Inclui critérios com ec_active=F se tiverem calibração salva (foram calibrados
    // antes de serem desativados no evento por alguma operação de sync/catalog).
    // Critérios eventScoped (duplicados) são incluídos separadamente só para
    // que seus scores sejam mesclados na nota efetiva do critério pai.
    const allEventCriteria = eventCriteriaRows.filter(c =>
      c.eventId === ev.id &&
      c.criterionActive !== false &&
      (c.active || calibratedCriterionIds.has(c.criterionId as number))
    );
    const activeCriteria = allEventCriteria.filter(c => !c.criterionEventScoped);
    const eventScopedCriteria = allEventCriteria.filter(c => c.criterionEventScoped);
    const assignedByArea = buildAssignedEvaluatorsByArea(areaAssignmentRows.filter(a => a.eventId === ev.id));
    const scored = submitted.filter(e => e.score != null);
    const avgRaw = scored.length > 0
      ? scored.reduce((s, e) => s + parseFloat(e.score as unknown as string), 0) / scored.length
      : null;
    const averageScore = avgRaw != null ? convertScoreToPercentage(avgRaw) : null;

    // Nota do time (mesma lógica de computeEventTeamResult): por critério ativo,
    // média das avaliações submetidas, substituída pela calibração quando existe.
    // Critérios eventScoped (duplicados) são mesclados no pai: a nota efetiva
    // do grupo é a média de todos os scoreUsed (pai + filhos).
    // "Avaliado" exige que TODOS os avaliadores designados para a área do
    // critério tenham enviado (não apenas um, quando há mais de um por área).
    const evCals = evCalsEarly;
    // evaluatedCriteria = critérios onde avaliador SUBMETEU (mostra no bar AVALIAÇÕES).
    // criteriaWithProgress = critérios com avaliação OU calibração (decide se calcula nota).
    let evaluatedCriteria = 0;
    let criteriaWithProgress = 0;
    let hasCalibration = false;
    // Contadores baseados em avaliadores (não critérios):
    // totalEvaluatorSlots = soma de avaliadores designados por critério ativo (pai + filho).
    // submittedEvaluatorCount = soma de avaliadores que já submeteram por critério ativo.
    // Estes são os denominador/numerador corretos para a barra de avaliações.
    let totalEvaluatorSlots = 0;
    let submittedEvaluatorCount = 0;
    // Rastreia IDs de critérios pai já contados em evaluatedCriteria para evitar
    // dupla-contagem quando pai e filho eventScoped ambos forem avaliados.
    const evaluatedParentIds = new Set<number>();
    const criteriaRaw = activeCriteria.map((c) => {
      const weight = parseFloat((c.weightOverride ?? c.defaultWeight ?? "1") as unknown as string);
      const critEvals = submitted.filter(e => e.criterionId === c.criterionId);
      const critScores = critEvals.filter(e => e.score != null).map(e => parseFloat(e.score as unknown as string));
      const avgScore = critScores.length > 0 ? critScores.reduce((a, b) => a + b, 0) / critScores.length : null;
      const cal = evCals.find(x => x.criterionId === c.criterionId);
      const calibratedScore = cal ? parseFloat(cal.calibratedScore as unknown as string) : null;
      if (calibratedScore !== null) hasCalibration = true;
      const status = getCriterionEvaluationStatus(c.responsibleAreaId, critEvals.map(e => e.evaluatorUserId as number), assignedByArea);
      if (weight > 0) {
        // Avaliação real: contabiliza no bar de AVALIAÇÕES (por critério)
        if (status.isEvaluated) {
          evaluatedCriteria++;
          evaluatedParentIds.add(c.criterionId as number);
        }
        // Avaliação OU calibração: determina se a nota pode ser calculada
        if (status.isEvaluated || calibratedScore !== null) criteriaWithProgress++;
        // Soma slots de avaliadores para a barra baseada em avaliadores.
        // Só contabiliza submittedEvaluators quando requiredEvaluators > 0:
        // critérios sem avaliador designado têm submittedEvaluators = nº de
        // submissões avulsas, mas não contribuem ao denominador — somar ao
        // numerador sem somar ao denominador causaria "5/2" nonsense.
        totalEvaluatorSlots += status.requiredEvaluators;
        if (status.requiredEvaluators > 0) {
          submittedEvaluatorCount += status.submittedEvaluators;
        }
      }
      return { criterionId: c.criterionId as number, weight, averageScore: avgScore, calibratedScore, isEventScoped: false, sourceCriterionId: null as number | null };
    });
    // Adiciona critérios duplicados (eventScoped) para que o merge possa
    // calcular a média com o critério pai.
    for (const ch of eventScopedCriteria) {
      const chEvals = submitted.filter(e => e.criterionId === ch.criterionId);
      const chScores = chEvals.filter(e => e.score != null).map(e => parseFloat(e.score as unknown as string));
      const chAvg = chScores.length > 0 ? chScores.reduce((a, b) => a + b, 0) / chScores.length : null;
      const chCal = evCals.find(x => x.criterionId === ch.criterionId);
      const chCalibrated = chCal ? parseFloat(chCal.calibratedScore as unknown as string) : null;
      if (chCalibrated !== null) hasCalibration = true;
      const chStatus = getCriterionEvaluationStatus(ch.responsibleAreaId, chEvals.map(e => e.evaluatorUserId as number), assignedByArea);
      // Critério filho (eventScoped) também contribui para os slots de avaliadores.
      // Mesma regra: só soma ao numerador quando há denominador (requiredEvaluators > 0).
      totalEvaluatorSlots += chStatus.requiredEvaluators;
      if (chStatus.requiredEvaluators > 0) {
        submittedEvaluatorCount += chStatus.submittedEvaluators;
      }
      // Critério eventScoped ÓRFÃO (source_criterion_id=null) não tem pai para ser fundido:
      // usa seu próprio peso e contribui de forma independente (como um critério regular).
      // Critério eventScoped COM pai: usa weight=0 aqui pois o merge absorve o filho no pai.
      const isOrphan = ch.criterionSourceCriterionId == null;
      const chWeight = isOrphan
        ? parseFloat((ch.weightOverride ?? ch.defaultWeight ?? "1") as unknown as string)
        : 0;
      if (isOrphan) {
        if (chWeight > 0 && chStatus.isEvaluated) {
          evaluatedCriteria++;
          evaluatedParentIds.add(ch.criterionId as number);
        }
      } else {
        // Se o critério filho está avaliado e o pai ainda não foi contado,
        // conta o pai em evaluatedCriteria (critério multi-área parcialmente avaliado).
        if (chStatus.isEvaluated) {
          const parentId = ch.criterionSourceCriterionId as number;
          if (!evaluatedParentIds.has(parentId)) {
            evaluatedCriteria++;
            evaluatedParentIds.add(parentId);
          }
        }
      }
      criteriaRaw.push({ criterionId: ch.criterionId as number, weight: chWeight, averageScore: chAvg, calibratedScore: chCalibrated, isEventScoped: true, sourceCriterionId: ch.criterionSourceCriterionId as number | null });
    }
    const criteriaForCalc = mergeEventScopedCriteria(criteriaRaw);
    const teamScore = criteriaWithProgress > 0 ? calculateEventResult(criteriaForCalc) : null;

    // Critérios com peso > 0 são os únicos que entram nos contadores de calibração.
    // Usa scorableCount (por evento, pós-merge) e NÃO globalScorable, para que
    // eventos com critério eventScoped (duplicado) mostrem 5 e não 6 no denominador.
    const scorableCount = criteriaForCalc.filter(c => c.weight > 0).length;
    // Progresso baseado em avaliadores (denominador = slots totais, não critérios).
    const progress = totalEvaluatorSlots > 0 ? submittedEvaluatorCount / totalEvaluatorSlots : 0;

    // Calibrações salvas (score preenchido, independente de publicação de feedback).
    const calibratedCriteriaCount = criteriaForCalc.filter(c => c.weight > 0 && c.calibratedScore !== null).length;

    // Critérios eventScoped órfãos (sem pai) com peso > 0 — contribuem como critérios
    // independentes em contadores de calibração, publicação e áreas sem avaliador.
    const orphanScoped = eventScopedCriteria.filter(ch => ch.criterionSourceCriterionId == null);

    // Totalmente calibrado = todo critério ativo com peso > 0 já teve a calibração
    // publicada como final (não basta ter calibração parcial/rascunho).
    const finalCalibratedCriteria = activeCriteria.filter(c => {
      const w = parseFloat((c.weightOverride ?? c.defaultWeight ?? "1") as unknown as string);
      return w > 0 && c.finalPublishedAt != null;
    }).length + orphanScoped.filter(ch => {
      const w = parseFloat((ch.weightOverride ?? ch.defaultWeight ?? "1") as unknown as string);
      return w > 0 && ch.finalPublishedAt != null;
    }).length;
    const fullyCalibrated = scorableCount > 0 && finalCalibratedCriteria === scorableCount;

    // Rollup do evento = mais recente publicação parcial entre os critérios ativos
    // (inclui órfãos eventScoped; granularidade real em /events/:id/criteria).
    const partialTimestamps = [
      ...activeCriteria.map(c => c.partialPublishedAt),
      ...orphanScoped.map(ch => ch.partialPublishedAt),
    ].filter((d): d is Date => d != null);
    const partialPublishedAt = partialTimestamps.length > 0
      ? new Date(Math.max(...partialTimestamps.map(d => d.getTime())))
      : null;

    // Áreas com critério ativo mas nenhum avaliador atribuído ainda — dá
    // visibilidade na listagem de eventos sem precisar entrar em cada um.
    // Inclui áreas de critérios eventScoped órfãos (contribuem de forma independente).
    const areaIdsWithActiveCriteria = new Set([
      ...activeCriteria.map(c => c.responsibleAreaId).filter((id): id is number => id != null),
      ...orphanScoped.map(ch => ch.responsibleAreaId).filter((id): id is number => id != null),
    ]);
    const unassignedAreaNames = [...areaIdsWithActiveCriteria]
      .filter(areaId => !assignedByArea.has(areaId) || assignedByArea.get(areaId)!.size === 0)
      .map(areaId => areaNameById.get(areaId) ?? `Área ${areaId}`)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    const partialPublishedCount = activeCriteria.filter(c => {
      const w = parseFloat((c.weightOverride ?? c.defaultWeight ?? "1") as unknown as string);
      return w > 0 && c.partialPublishedAt != null;
    }).length + orphanScoped.filter(ch => {
      const w = parseFloat((ch.weightOverride ?? ch.defaultWeight ?? "1") as unknown as string);
      return w > 0 && ch.partialPublishedAt != null;
    }).length;
    const { conformityNeeded, conformityComplete } = getConformityStatus(ev);
    return { ...ev, participantCount, evaluationProgress: progress, totalCriteria: scorableCount, submittedCount: submitted.length, evaluatedCriteria, totalEvaluatorSlots, submittedEvaluatorCount, calibratedCriteriaCount, finalCalibratedCriteria, partialPublishedCount, averageScore, teamScore, hasCalibration, fullyCalibrated, partialPublishedAt, unassignedAreaNames, conformityNeeded, conformityComplete };
  });
  res.json(enriched);
});

async function loadEventDetail(id: number) {
  const [ev] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!ev) return null;

  const participants = await db
    .select({
      id: eventParticipantsTable.id,
      eventId: eventParticipantsTable.eventId,
      employeeId: eventParticipantsTable.employeeId,
      employeeName: employeesTable.name,
      employmentType: employeesTable.employmentType,
      functionName: eventParticipantsTable.functionName,
      employeeFunction: employeesTable.functionName,
      teamName: eventParticipantsTable.teamName,
      confirmed: eventParticipantsTable.confirmed,
      scheduledDiariaCount: eventParticipantsTable.scheduledDiariaCount,
      scheduledDiariaStart: eventParticipantsTable.scheduledDiariaStart,
      scheduledDiariaEnd: eventParticipantsTable.scheduledDiariaEnd,
      actualDiariaDates: eventParticipantsTable.actualDiariaDates,
      actualDiariaCount: eventParticipantsTable.actualDiariaCount,
      comment: eventParticipantsTable.comment,
    })
    .from(eventParticipantsTable)
    .leftJoin(employeesTable, eq(eventParticipantsTable.employeeId, employeesTable.id))
    .where(eq(eventParticipantsTable.eventId, id))
    .then(rows => rows.map(p => ({ ...p, countsForScore: participantCountsForScore(p) })));

  const partialPublisherAlias = aliasedTable(usersTable, "partial_publisher");
  const finalPublisherAlias = aliasedTable(usersTable, "final_publisher");
  const criteria = await db
    .select({
      id: eventCriteriaTable.id,
      eventId: eventCriteriaTable.eventId,
      criterionId: eventCriteriaTable.criterionId,
      criterionName: criteriaTable.name,
      criterionDescription: criteriaTable.description,
      responsibleAreaId: criteriaTable.responsibleAreaId,
      responsibleAreaName: areasTable.name,
      active: eventCriteriaTable.active,
      originalWeight: criteriaTable.defaultWeight,
      weightOverride: eventCriteriaTable.weightOverride,
      eventScoped: criteriaTable.eventScoped,
      partialPublishedAt: eventCriteriaTable.partialPublishedAt,
      finalPublishedAt: eventCriteriaTable.finalPublishedAt,
      partialPublishedByUserName: partialPublisherAlias.name,
      finalPublishedByUserName: finalPublisherAlias.name,
    })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .leftJoin(areasTable, eq(criteriaTable.responsibleAreaId, areasTable.id))
    .leftJoin(partialPublisherAlias, eq(eventCriteriaTable.partialPublishedByUserId, partialPublisherAlias.id))
    .leftJoin(finalPublisherAlias, eq(eventCriteriaTable.finalPublishedByUserId, finalPublisherAlias.id))
    .where(eq(eventCriteriaTable.eventId, id));

  const activeCriteria = criteria.filter(c => c.active);
  const totalWeight = activeCriteria.reduce((s, c) => s + parseFloat(c.weightOverride ?? c.originalWeight ?? "1"), 0);
  const enrichedCriteria = criteria.map(c => {
    const w = parseFloat(c.weightOverride ?? c.originalWeight ?? "1");
    return { ...c, originalWeight: parseFloat(c.originalWeight ?? "1"), weightOverride: c.weightOverride ? parseFloat(c.weightOverride) : null, normalizedWeight: c.active && totalWeight > 0 ? w / totalWeight : 0, weight: c.active ? w : 0 };
  });

  const hasEvaluations = await eventHasEvaluations(id);

  const areaAssignments = await db
    .select({
      id: eventAreaAssignmentsTable.id,
      eventId: eventAreaAssignmentsTable.eventId,
      areaId: eventAreaAssignmentsTable.areaId,
      areaName: areasTable.name,
      evaluatorUserId: eventAreaAssignmentsTable.evaluatorUserId,
      evaluatorName: usersTable.name,
    })
    .from(eventAreaAssignmentsTable)
    .leftJoin(areasTable, eq(eventAreaAssignmentsTable.areaId, areasTable.id))
    .leftJoin(usersTable, eq(eventAreaAssignmentsTable.evaluatorUserId, usersTable.id))
    .where(eq(eventAreaAssignmentsTable.eventId, id));

  // Non-confidential progress: share of ACTIVE CRITERIA fully evaluated for this
  // event. Mirrors the /events list metric so both views agree. A criterion is
  // "fully evaluated" once every evaluator assigned to its area has submitted
  // (falls back to "any submission" for areas without an assignment configured).
  const allEvals = await db.select({ criterionId: evaluationsTable.criterionId, status: evaluationsTable.status, evaluatorUserId: evaluationsTable.evaluatorUserId }).from(evaluationsTable).where(eq(evaluationsTable.eventId, id));
  const submittedEvals = allEvals.filter(e => e.status === "submitted");
  const submittedCount = submittedEvals.length;
  const assignedByArea = buildAssignedEvaluatorsByArea(areaAssignments.map(a => ({ areaId: a.areaId, evaluatorUserId: a.evaluatorUserId })));
  const evaluatedCriteriaCount = activeCriteria.filter(c => {
    const submittedIds = submittedEvals.filter(e => e.criterionId === c.criterionId).map(e => e.evaluatorUserId as number);
    return getCriterionEvaluationStatus(c.responsibleAreaId, submittedIds, assignedByArea).isEvaluated;
  }).length;

  // Evento histórico importado: nota já pronta, sem critérios/avaliações a
  // acompanhar — trata como 100% avaliado (mesma lógica do enriquecimento em GET /events).
  const evaluationProgress = ev.isHistorical ? 1 : (activeCriteria.length > 0 ? evaluatedCriteriaCount / activeCriteria.length : 0);

  const [conformity] = await db.select().from(eventConformitiesTable).where(eq(eventConformitiesTable.eventId, id));

  // Resolve conformity evaluator names if assigned
  let conformityEvaluatorName: string | null = null;
  if (ev.conformityEvaluatorUserId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, ev.conformityEvaluatorUserId)).limit(1);
    conformityEvaluatorName = u?.name ?? null;
  }
  let conformityEvaluatorFerramentasName: string | null = null;
  if (ev.conformityEvaluatorFerramentasUserId) {
    const [u2] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, ev.conformityEvaluatorFerramentasUserId)).limit(1);
    conformityEvaluatorFerramentasName = u2?.name ?? null;
  }

  return { ...ev, participants, criteria: enrichedCriteria, areaAssignments, hasEvaluations: ev.isHistorical ? true : hasEvaluations, evaluationProgress, evaluationMatrix: [], results: [], conformity: conformity ?? null, conformityEvaluatorName, conformityEvaluatorFerramentasName };
}

async function eventHasEvaluations(eventId: number) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(evaluationsTable)
    .where(eq(evaluationsTable.eventId, eventId));
  return Number(count) > 0;
}

class ResyncBlockedError extends Error {
  constructor(public reason: "confirmed" | "has_evaluations") { super(reason); }
}

/**
 * Sincroniza os critérios de um evento com o catálogo global ativo.
 *
 * force=false (padrão): bloqueia se o evento tem avaliações ou critérios confirmados.
 * force=true (aditivo): nunca remove critérios existentes (seguro para eventos com
 * avaliações já lançadas ou históricos). Apenas adiciona critérios novos que ainda
 * não estejam no evento, e reativa critérios inativos que voltaram a ser ativos no
 * catálogo. Ignora os guards de "has_evaluations" e "criteriaConfirmed".
 */
async function resyncEventCriteriaOnce(eventId: number, options: { force?: boolean } = {}) {
  const { force = false } = options;
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event) throw new Error("not_found");

  if (!force) {
    if (event.criteriaConfirmed) throw new ResyncBlockedError("confirmed");
    if (await eventHasEvaluations(eventId)) throw new ResyncBlockedError("has_evaluations");
  }

  const globalActive = await db
    .select({ id: criteriaTable.id })
    .from(criteriaTable)
    .where(and(eq(criteriaTable.active, true), eq(criteriaTable.eventScoped, false)));
  const globalActiveIds = new Set(globalActive.map(c => c.id));

  const existing = await db
    .select({
      id: eventCriteriaTable.id,
      criterionId: eventCriteriaTable.criterionId,
      active: eventCriteriaTable.active,
      criterionActive: criteriaTable.active,
      eventScoped: criteriaTable.eventScoped,
    })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .where(eq(eventCriteriaTable.eventId, eventId));

  const existingCriterionIds = new Set(existing.map(e => e.criterionId));

  // Candidates for deactivation: active event_criteria whose global criterion is now inactive
  const deactivateCandidates = existing.filter(e => e.active && !e.eventScoped && !e.criterionActive);

  let toDeactivate = deactivateCandidates;
  if (force && deactivateCandidates.length > 0) {
    // In force mode: only protect criteria that have real evaluator submissions.
    // Criteria with only calibrations (no evaluations) are still deactivated so
    // the event can be realigned to the current active catalog.
    const candidateIds = deactivateCandidates.map(e => e.criterionId);
    const evalsWithData = await db.select({ criterionId: evaluationsTable.criterionId })
      .from(evaluationsTable)
      .where(and(eq(evaluationsTable.eventId, eventId), inArray(evaluationsTable.criterionId, candidateIds)));
    const protectedIds = new Set(evalsWithData.map(e => e.criterionId));
    toDeactivate = deactivateCandidates.filter(e => !protectedIds.has(e.criterionId));
  }

  const toActivate = existing.filter(e => !e.active && !e.eventScoped && e.criterionActive);
  const toAdd = [...globalActiveIds].filter(cid => !existingCriterionIds.has(cid));

  if (toDeactivate.length === 0 && toActivate.length === 0 && toAdd.length === 0) {
    return { deactivated: 0, added: 0 };
  }

  await db.transaction(async (tx) => {
    for (const row of toDeactivate) {
      await tx.update(eventCriteriaTable).set({ active: false }).where(eq(eventCriteriaTable.id, row.id));
    }
    for (const row of toActivate) {
      await tx.update(eventCriteriaTable).set({ active: true }).where(eq(eventCriteriaTable.id, row.id));
    }
    if (toAdd.length > 0) {
      await tx.insert(eventCriteriaTable).values(toAdd.map(criterionId => ({ eventId, criterionId, active: true })));
    }
  });

  return { deactivated: toDeactivate.length, added: toAdd.length, activated: toActivate.length };
}

router.get("/events/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const detail = await loadEventDetail(id);
  if (!detail) { res.status(404).json({ error: "Não encontrado" }); return; }
  res.json(detail);
});

router.post("/events", requireRole("admin", "rh"), async (req, res) => {
  const { name, clientName, location, city, state, startDate, endDate } = req.body;
  if (!name || !startDate || !endDate) {
    res.status(400).json({ error: "Campos obrigatórios: name, startDate, endDate" });
    return;
  }
  const cycle = await getCurrentCycle();
  if (!cycle) { res.status(400).json({ error: "Nenhum ciclo ativo" }); return; }
  const [ev] = await db.insert(eventsTable).values({
    name, clientName: clientName ?? null, location: location ?? null, city: city ?? null,
    state: state ?? null, startDate, endDate, cycleId: cycle.id,
  }).returning();

  const allCriteria = await db.select().from(criteriaTable).where(and(eq(criteriaTable.active, true), eq(criteriaTable.eventScoped, false)));
  if (allCriteria.length > 0) {
    await db.insert(eventCriteriaTable).values(allCriteria.map(c => ({ eventId: ev.id, criterionId: c.id, active: true })));
  }

  await audit(req.user!.userId, "create", "events", ev.id, null, ev);
  res.status(201).json({ ...ev, participantCount: 0, evaluationProgress: 0, averageScore: null });
});

router.patch("/events/:id", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  // status é gerenciado exclusivamente pelas rotas /close e /reopen, que
  // aplicam a lógica de negócio correta (forcedClosed, recomputeCycleResults).
  // Trocar o status aqui contornaria isso e deixaria o ciclo desatualizado.
  const { name, clientName, location, city, state, startDate, endDate } = req.body;
  const [before] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Não encontrado" }); return; }
  const [ev] = await db.update(eventsTable).set({
    ...(name !== undefined && { name }),
    ...(clientName !== undefined && { clientName }),
    ...(location !== undefined && { location }),
    ...(city !== undefined && { city }),
    ...(state !== undefined && { state }),
    ...(startDate !== undefined && { startDate }),
    ...(endDate !== undefined && { endDate }),
  }).where(eq(eventsTable.id, id)).returning();
  await audit(req.user!.userId, "update", "events", id, before, ev);
  res.json(ev);
});

// Edita diretamente a nota e as observações de um evento histórico (isHistorical=true).
// Eventos históricos não têm avaliação por critério — a nota final vem só de
// importedScore — então correções pós-importação (recalibração de planilha,
// comentários de conformidade/performance) precisam de uma via direta, sem
// reimportar CSV. Sempre recalcula o ciclo, pois a nota afeta o resultado agregado.
router.patch("/events/:id/historical-result", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { importedScore, importedNotes } = req.body ?? {};
  const [before] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Não encontrado" }); return; }
  if (!before.isHistorical) {
    res.status(400).json({ error: "Só é possível editar nota/observações diretamente em eventos históricos." });
    return;
  }
  if (importedScore === undefined && importedNotes === undefined) {
    res.status(400).json({ error: "Informe importedScore e/ou importedNotes" });
    return;
  }
  if (importedScore !== undefined) {
    if (typeof importedScore !== "number" || Number.isNaN(importedScore) || importedScore < 0 || importedScore > 100) {
      res.status(400).json({ error: "importedScore deve ser um número entre 0 e 100" });
      return;
    }
  }
  if (importedNotes !== undefined && importedNotes !== null && typeof importedNotes !== "string") {
    res.status(400).json({ error: "importedNotes deve ser string ou null" });
    return;
  }

  const [ev] = await db.update(eventsTable).set({
    ...(importedScore !== undefined && { importedScore: String(importedScore) }),
    ...(importedNotes !== undefined && { importedNotes: importedNotes === null ? null : (importedNotes.trim() || null) }),
  }).where(eq(eventsTable.id, id)).returning();

  await audit(req.user!.userId, "update-historical-result", "events", id, before, ev);
  const { warnings } = await recomputeCycleResults(ev.cycleId, req.user!.userId);
  res.json({ ...ev, warnings });
});

// Atualiza startDate, endDate e name dos eventos em lote.
// Busca todos os eventos de uma vez e faz matching em JavaScript (sem unaccent).
router.post("/events/bulk-date-sync", requireRole("admin"), async (req, res) => {
  const updates = req.body?.updates as { externalId: string; name: string; date: string }[] | undefined;
  if (!Array.isArray(updates) || updates.length === 0) {
    res.status(400).json({ error: "Campo updates (array {externalId, name, date}) é obrigatório." });
    return;
  }

  // Busca todos os eventos de uma vez — mais eficiente que N*8 queries SQL
  // e não depende de extensão unaccent (não disponível em todos os ambientes).
  const allEvents = await db.select({ id: eventsTable.id, name: eventsTable.name, externalId: eventsTable.externalId })
    .from(eventsTable);

  // Normaliza: remove acentos, lowercase, normaliza hífens e espaços
  function norm(s: string): string {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  }

  // Extrai tokens relevantes de um nome normalizado (sem ano, sem tokens curtos)
  function extractTokens(s: string): string[] {
    return norm(s).split(/\s*-\s*/).map(p => p.trim()).filter(p => p.length >= 3)
      .map(p => p.replace(/\b20\d\d\b/g, "").replace(/[%_]/g, "").trim())
      .filter(p => p.length >= 3);
  }

  // Extrai palavras longas (≥5 chars) para matching por palavra individual
  function extractWords(s: string): string[] {
    const n = norm(s);
    const segs = n.split(/\s*-\s*/).filter(p => p.length >= 3);
    const src = segs.length >= 2 ? segs.slice(1).join(" ") : n;
    return src.split(/[\s&,]+/)
      .map(w => w.replace(/\b20\d\d\b/g, "").replace(/[%_°º]/g, "").trim())
      .filter(w => w.length >= 5 && !/^\d+$/.test(w));
  }

  // Pré-computa nomes normalizados de todos os eventos
  const allEventsNorm = allEvents.map(e => ({ ...e, normName: norm(e.name) }));
  const byExternalId = new Map(allEventsNorm.filter(e => e.externalId).map(e => [e.externalId!, e]));
  const byNormName = new Map(allEventsNorm.map(e => [e.normName, e]));

  function findEvent(externalId: string, name: string) {
    // 1ª: por externalId exato
    if (externalId) {
      const ev = byExternalId.get(externalId);
      if (ev) return ev;
    }
    if (!name) return undefined;
    const n = norm(name);

    // 2ª: nome normalizado exato
    const exact = byNormName.get(n);
    if (exact) return exact;

    // 3ª: substring simples (nome contém padrão ou padrão contém nome)
    for (const ev of allEventsNorm) {
      if (ev.normName.includes(n) || n.includes(ev.normName)) return ev;
    }

    // 4ª: todos os tokens devem estar presentes no nome (ordem qualquer)
    const toks = extractTokens(name);
    if (toks.length >= 2) {
      for (const ev of allEventsNorm) {
        if (toks.every(t => ev.normName.includes(t))) return ev;
      }
      const rev = [...toks].reverse();
      for (const ev of allEventsNorm) {
        if (rev.every(t => ev.normName.includes(t))) return ev;
      }
    }

    // 5ª: sem primeiro token (prefixo de marca, ex.: "Santander")
    if (toks.length >= 2) {
      const withoutFirst = toks.slice(1);
      for (const ev of allEventsNorm) {
        if (withoutFirst.every(t => ev.normName.includes(t))) return ev;
      }
    }

    // 6ª: sem último token (sufixo opcional)
    if (toks.length >= 3) {
      const withoutLast = toks.slice(0, -1);
      for (const ev of allEventsNorm) {
        if (withoutLast.every(t => ev.normName.includes(t))) return ev;
      }
    }

    // 7ª: palavras longas individuais — resolve typos leves e ordens radicalmente diferentes
    const words = extractWords(name);
    if (words.length >= 2) {
      for (const ev of allEventsNorm) {
        if (words.every(w => ev.normName.includes(w))) return ev;
      }
    }

    return undefined;
  }

  const updated: string[] = [];
  const notFound: string[] = [];
  for (const { externalId, name, date } of updates) {
    if (!date) continue;
    const ev = findEvent(externalId, name);
    if (!ev) {
      notFound.push(name || externalId);
    } else {
      const setFields: Record<string, unknown> = { startDate: date, endDate: date };
      if (name) setFields.name = name.trim();
      await db.update(eventsTable).set(setFields).where(eq(eventsTable.id, ev.id));
      updated.push(name || externalId);
    }
  }
  await audit(req.user!.userId, "update", "events", 0, null, { bulkDateSync: updates.length });
  res.json({ updated: updated.length, notFound: notFound.length, notFoundIds: notFound });
});

router.delete("/events/:id", requireRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (Number.isNaN(id)) { res.status(400).json({ error: "ID inválido." }); return; }
  try {
    const [before] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
    if (!before) { res.status(404).json({ error: "Evento não encontrado." }); return; }
    // absences.event_id não tem onDelete cascade — anular antes de deletar
    await db.update(absencesTable).set({ eventId: null }).where(eq(absencesTable.eventId, id));
    await db.delete(eventsTable).where(eq(eventsTable.id, id));
    await audit(req.user!.userId, "delete", "events", id);
    await recomputeCycleResults(before.cycleId, req.user!.userId);
    res.status(204).end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Falha ao excluir evento: ${msg}` });
  }
});

// Mescla dois eventos que representam a mesma corrida (duplicata por nome divergente):
// preenche em `id` (mantido) os campos vazios com dados de `mergeEventId`, migra
// participantes/faltas e remove o evento duplicado. Bloqueia se o duplicado já tiver
// avaliação/calibração/resultado gravado, para nunca descartar dado real em silêncio.
router.post("/events/:id/merge", requireRole("admin"), async (req, res) => {
  const keepId = parseInt(req.params.id as string);
  const mergeEventId = parseInt(req.body?.mergeEventId);
  const force = req.body?.force === true;
  if (!mergeEventId || Number.isNaN(mergeEventId)) {
    res.status(400).json({ error: "mergeEventId obrigatório" });
    return;
  }
  if (mergeEventId === keepId) {
    res.status(400).json({ error: "Não é possível mesclar um evento com ele mesmo" });
    return;
  }

  const [keep] = await db.select().from(eventsTable).where(eq(eventsTable.id, keepId)).limit(1);
  const [merge] = await db.select().from(eventsTable).where(eq(eventsTable.id, mergeEventId)).limit(1);
  if (!keep || !merge) { res.status(404).json({ error: "Evento não encontrado" }); return; }

  // Só conta avaliações SUBMETIDAS como dado real — rascunhos (status="draft",
  // criados automaticamente ao digitar uma nota antes de enviar) não podem
  // travar a mesclagem, pois não representam avaliação de fato registrada.
  const [[evalCount], [calibCount], [confCount], [resultCount]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(evaluationsTable)
      .where(and(eq(evaluationsTable.eventId, mergeEventId), eq(evaluationsTable.status, "submitted"))),
    db.select({ n: sql<number>`count(*)::int` }).from(calibrationsTable).where(eq(calibrationsTable.eventId, mergeEventId)),
    db.select({ n: sql<number>`count(*)::int` }).from(eventConformitiesTable).where(eq(eventConformitiesTable.eventId, mergeEventId)),
    db.select({ n: sql<number>`count(*)::int` }).from(employeeEventResultsTable).where(eq(employeeEventResultsTable.eventId, mergeEventId)),
  ]);
  const hasRealData = evalCount.n > 0 || calibCount.n > 0 || confCount.n > 0 || resultCount.n > 0;

  // Casos legítimos de duplicata (ex.: mesma corrida importada/fechada duas vezes)
  // podem ter avaliação, calibração e resultado gravados NOS DOIS eventos — isso
  // não é dado extra a preservar, é redundância do mesmo evento. Por isso não
  // bloqueamos mais de forma definitiva: na primeira tentativa (sem `force`)
  // avisamos o que será descartado para o admin confirmar conscientemente;
  // com `force=true` o admin já confirmou e a mesclagem segue.
  if (hasRealData && !force) {
    res.status(400).json({
      error: "O evento a ser removido já possui avaliações, calibração ou resultados gravados. Confirme se deseja mesclar mesmo assim — esses dados do duplicado serão descartados (os dados do evento mantido não são afetados).",
      requiresConfirmation: true,
      details: { evaluations: evalCount.n, calibrations: calibCount.n, conformities: confCount.n, results: resultCount.n },
    });
    return;
  }

  // Rascunhos de avaliação (não submetidos), e — quando `force=true` — também
  // avaliações submetidas, calibrações, conformidade e resultados do evento
  // removido são descartados automaticamente pelo ON DELETE CASCADE ao apagar
  // o evento abaixo. Os dados do evento mantido nunca são tocados.
  const before = { keep, merge };
  await db.transaction(async (tx) => {
    const mergeParticipants = await tx.select().from(eventParticipantsTable).where(eq(eventParticipantsTable.eventId, mergeEventId));
    for (const p of mergeParticipants) {
      await tx.insert(eventParticipantsTable).values({
        eventId: keepId,
        employeeId: p.employeeId,
        functionName: p.functionName,
        teamName: p.teamName,
        confirmed: p.confirmed,
      }).onConflictDoNothing({ target: [eventParticipantsTable.eventId, eventParticipantsTable.employeeId] });
    }

    await tx.update(absencesTable).set({ eventId: keepId }).where(eq(absencesTable.eventId, mergeEventId));

    // O duplicado precisa ser removido ANTES de copiar campos para o evento
    // mantido: `external_id` tem índice único (events_external_id_uq), então
    // copiá-lo enquanto o duplicado ainda existe viola a constraint (HTTP 500).
    await tx.delete(eventsTable).where(eq(eventsTable.id, mergeEventId));

    const patch: Record<string, unknown> = {};
    if (!keep.clientName && merge.clientName) patch.clientName = merge.clientName;
    if (!keep.location && merge.location) patch.location = merge.location;
    if (!keep.city && merge.city) patch.city = merge.city;
    if (!keep.state && merge.state) patch.state = merge.state;
    if (!keep.externalId && merge.externalId) patch.externalId = merge.externalId;
    if (Object.keys(patch).length > 0) {
      await tx.update(eventsTable).set(patch).where(eq(eventsTable.id, keepId));
    }
  });

  const affectedCycles = Array.from(new Set([keep.cycleId, merge.cycleId]));
  const warnings: string[] = [];
  if (hasRealData && force) {
    warnings.push(`Descartados dados do evento duplicado: ${evalCount.n} avaliação(ões), ${calibCount.n} calibração(ões), ${confCount.n} conformidade(s) e ${resultCount.n} resultado(s).`);
  }
  for (const cycleId of affectedCycles) {
    const result = await recomputeCycleResults(cycleId, req.user!.userId);
    warnings.push(...result.warnings);
  }

  const [after] = await db.select().from(eventsTable).where(eq(eventsTable.id, keepId)).limit(1);
  await audit(req.user!.userId, "merge", "events", keepId, before, after);
  res.json({ success: true, event: after, warnings });
});

router.post("/events/:id/close", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { forced, reason } = req.body ?? {};
  const [ev] = await db.update(eventsTable).set({
    status: "closed",
    forcedClosed: !!forced,
    forcedCloseReason: reason ?? null,
  }).where(eq(eventsTable.id, id)).returning();
  if (!ev) { res.status(404).json({ error: "Não encontrado" }); return; }
  await audit(req.user!.userId, "close", "events", id);
  await recomputeCycleResults(ev.cycleId, req.user!.userId);
  res.json(ev);
});

router.post("/events/:id/reopen", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [ev] = await db.update(eventsTable).set({ status: "open", forcedClosed: false, forcedCloseReason: null }).where(eq(eventsTable.id, id)).returning();
  if (!ev) { res.status(404).json({ error: "Não encontrado" }); return; }
  await audit(req.user!.userId, "reopen", "events", id);
  await recomputeCycleResults(ev.cycleId, req.user!.userId);
  res.json(ev);
});

// Trava mestra de contagem: o evento só passa a contar para elegibilidade e
// nota dos colaboradores depois de confirmado aqui — independente de status
// (open/closed/calibration). Ver comentário em recomputeCycleResults.
router.post("/events/:id/confirm-results", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [before] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Não encontrado" }); return; }
  const [ev] = await db.update(eventsTable).set({
    resultsConfirmed: true, resultsConfirmedAt: new Date(), resultsConfirmedBy: req.user!.userId,
  }).where(eq(eventsTable.id, id)).returning();
  await audit(req.user!.userId, "confirm-results", "events", id, before, ev);
  const { warnings } = await recomputeCycleResults(ev.cycleId, req.user!.userId);
  res.json({ ...ev, warnings });
});

router.post("/events/:id/unconfirm-results", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [before] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Não encontrado" }); return; }
  const [ev] = await db.update(eventsTable).set({
    resultsConfirmed: false, resultsConfirmedAt: null, resultsConfirmedBy: null,
  }).where(eq(eventsTable.id, id)).returning();
  await audit(req.user!.userId, "unconfirm-results", "events", id, before, ev);
  const { warnings } = await recomputeCycleResults(ev.cycleId, req.user!.userId);
  res.json({ ...ev, warnings });
});

router.get("/events/:id/participants", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const participants = await db
    .select({
      id: eventParticipantsTable.id,
      eventId: eventParticipantsTable.eventId,
      employeeId: eventParticipantsTable.employeeId,
      employeeName: employeesTable.name,
      employmentType: employeesTable.employmentType,
      functionName: eventParticipantsTable.functionName,
      employeeFunction: employeesTable.functionName,
      teamName: eventParticipantsTable.teamName,
      confirmed: eventParticipantsTable.confirmed,
      scheduledDiariaCount: eventParticipantsTable.scheduledDiariaCount,
      scheduledDiariaStart: eventParticipantsTable.scheduledDiariaStart,
      scheduledDiariaEnd: eventParticipantsTable.scheduledDiariaEnd,
      actualDiariaDates: eventParticipantsTable.actualDiariaDates,
      actualDiariaCount: eventParticipantsTable.actualDiariaCount,
      comment: eventParticipantsTable.comment,
    })
    .from(eventParticipantsTable)
    .leftJoin(employeesTable, eq(eventParticipantsTable.employeeId, employeesTable.id))
    .where(eq(eventParticipantsTable.eventId, id));
  res.json(participants.map(p => ({ ...p, countsForScore: participantCountsForScore(p) })));
});

router.post("/events/:id/participants", requireRole("admin", "rh"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const { employeeId, functionName, teamName } = req.body;
  if (!employeeId) { res.status(400).json({ error: "employeeId obrigatório" }); return; }
  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, employeeId)).limit(1);
  const [participant] = await db.insert(eventParticipantsTable).values({
    eventId, employeeId, functionName: functionName ?? emp?.functionName ?? null, teamName: teamName ?? null,
  }).returning();
  const employmentType = emp?.employmentType ?? "casa";
  res.status(201).json({
    ...participant, employeeName: emp?.name ?? "", employmentType,
    countsForScore: participantCountsForScore({ employmentType, functionName: participant.functionName, employeeFunction: emp?.functionName }),
  });
});

router.delete("/events/:id/participants/:participantId", requireRole("admin", "rh"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const participantId = parseInt(req.params.participantId as string);
  const [existing] = await db.select().from(eventParticipantsTable)
    .where(and(eq(eventParticipantsTable.id, participantId), eq(eventParticipantsTable.eventId, eventId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Participante não encontrado neste evento" }); return; }
  await db.delete(eventParticipantsTable).where(eq(eventParticipantsTable.id, participantId));
  const [ev] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (ev?.status === "closed") await recomputeCycleResults(ev.cycleId, req.user!.userId);
  res.status(204).end();
});

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.patch("/events/:id/participants/:participantId", requireRole("admin", "rh"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const participantId = parseInt(req.params.participantId as string);
  const { confirmed, actualDiariaDates, comment, diariaQuickConfirmed, functionName } = req.body;
  if (confirmed === undefined && actualDiariaDates === undefined && comment === undefined && diariaQuickConfirmed === undefined && functionName === undefined) {
    res.status(400).json({ error: "informe confirmed, actualDiariaDates, diariaQuickConfirmed, functionName e/ou comment" });
    return;
  }
  if (confirmed !== undefined && typeof confirmed !== "boolean") { res.status(400).json({ error: "confirmed deve ser boolean" }); return; }
  if (diariaQuickConfirmed !== undefined && typeof diariaQuickConfirmed !== "boolean") { res.status(400).json({ error: "diariaQuickConfirmed deve ser boolean" }); return; }
  if (comment !== undefined && comment !== null && typeof comment !== "string") { res.status(400).json({ error: "comment deve ser string ou null" }); return; }
  if (functionName !== undefined && functionName !== null && typeof functionName !== "string") { res.status(400).json({ error: "functionName deve ser string ou null" }); return; }

  let normalizedDates: string[] | null | undefined = undefined;
  if (actualDiariaDates !== undefined) {
    if (actualDiariaDates !== null) {
      if (!Array.isArray(actualDiariaDates) || actualDiariaDates.some((d: unknown) => typeof d !== "string" || !ISO_DATE_RE.test(d))) {
        res.status(400).json({ error: "actualDiariaDates deve ser uma lista de datas no formato YYYY-MM-DD" });
        return;
      }
      normalizedDates = Array.from(new Set(actualDiariaDates as string[])).sort();
    } else {
      normalizedDates = null;
    }
  }

  const [existing] = await db.select().from(eventParticipantsTable)
    .where(and(eq(eventParticipantsTable.id, participantId), eq(eventParticipantsTable.eventId, eventId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Participante não encontrado neste evento" }); return; }
  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, existing.employeeId)).limit(1);
  const employmentType = emp?.employmentType ?? "casa";

  // Se functionName for alterado, usa o novo valor para calcular countsForScore;
  // caso contrário usa o valor já registrado no evento. O cargo global
  // (emp.functionName) também é considerado — se for "Sup Ceno *", nunca
  // conta para nota, independentemente do valor deste evento específico.
  const effectiveFunctionName = functionName !== undefined ? functionName : existing.functionName;
  const countsForScore = participantCountsForScore({ employmentType, functionName: effectiveFunctionName, employeeFunction: emp?.functionName });

  const changesDiaria = normalizedDates !== undefined;
  if (changesDiaria && !countsForScore) {
    res.status(400).json({ error: "Participação informativa (não conta para nota) não permite registro de diárias." });
    return;
  }

  if (normalizedDates) {
    const [ev] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    if (ev && normalizedDates.some(d => d < ev.startDate || d > ev.endDate)) {
      res.status(400).json({ error: `As datas devem estar dentro do período do evento (${ev.startDate} a ${ev.endDate}).` });
      return;
    }
  }

  const [updated] = await db
    .update(eventParticipantsTable)
    .set({
      ...(functionName !== undefined && { functionName: functionName ?? null }),
      ...(confirmed !== undefined && { confirmed }),
      ...(normalizedDates !== undefined && {
        actualDiariaDates: normalizedDates,
        actualDiariaCount: normalizedDates ? normalizedDates.length : null,
        // Salvar datas específicas cancela o modo rápido — o gestor está sendo
        // detalhado agora; reset garante que os dois modos não coexistam.
        diariaQuickConfirmed: false,
        diariaQuickConfirmedAt: null,
      }),
      ...(comment !== undefined && { comment: comment === null ? null : comment.trim() || null }),
      ...(diariaQuickConfirmed !== undefined && {
        diariaQuickConfirmed,
        diariaQuickConfirmedAt: diariaQuickConfirmed ? new Date() : null,
      }),
    })
    .where(eq(eventParticipantsTable.id, participantId))
    .returning();
  if (!updated) { res.status(404).json({ error: "Participante não encontrado" }); return; }

  if (confirmed !== undefined || functionName !== undefined) {
    const [ev] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    if (ev?.status === "closed") await recomputeCycleResults(ev.cycleId, req.user!.userId);
  }

  // Sincroniza o cargo GLOBAL do colaborador com o cargo deste evento,
  // para que sirva de sugestão pré-preenchida nos próximos eventos.
  // Só atualiza quando functionName é explicitamente fornecido e não nulo —
  // nunca sobrescreve o global com null.
  if (functionName && existing.employeeId) {
    await db.update(employeesTable)
      .set({ functionName: functionName.trim() })
      .where(eq(employeesTable.id, existing.employeeId));
  }

  res.json({
    ...updated, employeeName: emp?.name ?? "", employmentType,
    countsForScore,
  });
});

// Matriz de Conformidade
// POST /events/:id/conformity-evaluator — atribui (ou remove) o avaliador de conformidade
router.post("/events/:id/conformity-evaluator", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { userId } = req.body as { userId: number | null };
  const [before] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Evento não encontrado" }); return; }
  const [updated] = await db.update(eventsTable)
    .set({ conformityEvaluatorUserId: userId ?? null })
    .where(eq(eventsTable.id, id))
    .returning();
  await audit(req.user!.userId, "set_conformity_evaluator", "events", id, { conformityEvaluatorUserId: before.conformityEvaluatorUserId }, { conformityEvaluatorUserId: updated.conformityEvaluatorUserId });
  const detail = await loadEventDetail(id);
  res.json(detail);
});

// Grupo 1 (Ferramentas e Case): assign/unassign the equipment evaluator (admin/RH only)
router.post("/events/:id/conformity-evaluator-ferramentas", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { userId } = req.body as { userId: number | null };
  const [before] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Evento não encontrado" }); return; }
  const [updated] = await db.update(eventsTable)
    .set({ conformityEvaluatorFerramentasUserId: userId ?? null })
    .where(eq(eventsTable.id, id))
    .returning();
  await audit(req.user!.userId, "set_conformity_evaluator_ferramentas", "events", id, { conformityEvaluatorFerramentasUserId: before.conformityEvaluatorFerramentasUserId }, { conformityEvaluatorFerramentasUserId: updated.conformityEvaluatorFerramentasUserId });
  res.json(await loadEventDetail(id));
});

// Redirect: Grupo 2 (Cenografia) evaluator can delegate to another user in area 13
// Admin/RH can also use this to reassign
router.patch("/events/:id/conformity-evaluator", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const requesterId = req.user!.userId;
  const role = req.user!.role;
  const { userId: newUserId } = req.body as { userId: number };
  const [ev] = await db.select({ conformityEvaluatorUserId: eventsTable.conformityEvaluatorUserId }).from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!ev) { res.status(404).json({ error: "Evento não encontrado" }); return; }
  const isAdminRh = ["admin", "rh"].includes(role);
  if (!isAdminRh) {
    if (ev.conformityEvaluatorUserId !== requesterId) { res.status(403).json({ error: "Acesso negado" }); return; }
    const [areaUser] = await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.id, newUserId), eq(usersTable.areaId, 13), eq(usersTable.active, true)));
    if (!areaUser) { res.status(400).json({ error: "Avaliador deve ser da área Cenografia" }); return; }
  }
  await db.update(eventsTable).set({ conformityEvaluatorUserId: newUserId }).where(eq(eventsTable.id, id));
  await audit(requesterId, "redirect_conformity_evaluator", "events", id, { from: ev.conformityEvaluatorUserId }, { to: newUserId });
  res.json(await loadEventDetail(id));
});

// Redirect: Grupo 1 (Ferramentas e Case) evaluator can delegate to another user in area 16
// Admin/RH can also use this to reassign
router.patch("/events/:id/conformity-evaluator-ferramentas", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const requesterId = req.user!.userId;
  const role = req.user!.role;
  const { userId: newUserId } = req.body as { userId: number };
  const [ev] = await db.select({ conformityEvaluatorFerramentasUserId: eventsTable.conformityEvaluatorFerramentasUserId }).from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!ev) { res.status(404).json({ error: "Evento não encontrado" }); return; }
  const isAdminRh = ["admin", "rh"].includes(role);
  if (!isAdminRh) {
    if (ev.conformityEvaluatorFerramentasUserId !== requesterId) { res.status(403).json({ error: "Acesso negado" }); return; }
    const [areaUser] = await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.id, newUserId), eq(usersTable.areaId, 16), eq(usersTable.active, true)));
    if (!areaUser) { res.status(400).json({ error: "Avaliador deve ser da área Ferramentas e Case" }); return; }
  }
  await db.update(eventsTable).set({ conformityEvaluatorFerramentasUserId: newUserId }).where(eq(eventsTable.id, id));
  await audit(requesterId, "redirect_conformity_evaluator_ferramentas", "events", id, { from: ev.conformityEvaluatorFerramentasUserId }, { to: newUserId });
  res.json(await loadEventDetail(id));
});

router.get("/events/:id/conformity", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [conformity] = await db.select().from(eventConformitiesTable).where(eq(eventConformitiesTable.eventId, id));
  if (!conformity) { res.json(null); return; }
  let createdByUserName: string | null = null;
  if (conformity.createdByUserId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, conformity.createdByUserId)).limit(1);
    createdByUserName = u?.name ?? null;
  }
  res.json({ ...conformity, createdByUserName });
});

router.post("/events/:id/conformity", async (req, res) => {
  // Controle de acesso por grupo:
  // - Admin/RH: pode atualizar todos os campos
  // - Grupo 2 (conformityEvaluatorUserId / Cenografia): epi, estaiamentos, conduta + comentários + absences + standout
  // - Grupo 1 (conformityEvaluatorFerramentasUserId / Ferramentas e Case): apenas guardaEquipamentos + comentário
  const eventId = parseInt(req.params.id as string);
  const userId = req.user!.userId;
  const role = req.user!.role;

  const [evRow] = await db.select({
    cycleId: eventsTable.cycleId,
    status: eventsTable.status,
    conformityEvaluatorUserId: eventsTable.conformityEvaluatorUserId,
    conformityEvaluatorFerramentasUserId: eventsTable.conformityEvaluatorFerramentasUserId,
  }).from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!evRow) { res.status(404).json({ error: "Evento não encontrado" }); return; }

  const isAdminRh = ["admin", "rh"].includes(role);
  const isCenografiaEval = evRow.conformityEvaluatorUserId === userId;
  const isFerramentasEval = evRow.conformityEvaluatorFerramentasUserId === userId;

  if (!isAdminRh && !isCenografiaEval && !isFerramentasEval) {
    res.status(403).json({ error: "Acesso negado" }); return;
  }

  const {
    epi, estaiamentos, guardaEquipamentos, conduta,
    epiComment, estaiamentosComment, guardaEquipamentosComment, condutaComment,
    absencesResponse, absencesReport, standoutResponse, standoutJustification,
  } = req.body;

  // Campos permitidos por grupo
  const canCenografia = isAdminRh || isCenografiaEval;
  const canFerramentas = isAdminRh || isFerramentasEval;

  // null = PENDENTE (sem penalidade); usa !== undefined para distinguir "não
  // enviado" (undefined → mantém existente) de "enviado como null" (→ PENDENTE).
  const existing = await db.select().from(eventConformitiesTable).where(eq(eventConformitiesTable.eventId, eventId));
  if (existing.length > 0) {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (canCenografia) {
      if (epi !== undefined) patch.epi = epi;
      if (estaiamentos !== undefined) patch.estaiamentos = estaiamentos;
      if (conduta !== undefined) patch.conduta = conduta;
      if (epiComment !== undefined) patch.epiComment = epiComment || null;
      if (estaiamentosComment !== undefined) patch.estaiamentosComment = estaiamentosComment || null;
      if (condutaComment !== undefined) patch.condutaComment = condutaComment || null;
      if (absencesResponse !== undefined) patch.absencesResponse = absencesResponse;
      if (absencesReport !== undefined) patch.absencesReport = absencesReport || null;
      if (standoutResponse !== undefined) patch.standoutResponse = standoutResponse;
      if (standoutJustification !== undefined) patch.standoutJustification = standoutJustification || null;
    }
    if (canFerramentas) {
      if (guardaEquipamentos !== undefined) patch.guardaEquipamentos = guardaEquipamentos;
      if (guardaEquipamentosComment !== undefined) patch.guardaEquipamentosComment = guardaEquipamentosComment || null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [updated] = await db.update(eventConformitiesTable)
      .set(patch as any)
      .where(eq(eventConformitiesTable.eventId, eventId))
      .returning();
    await audit(userId, "update_conformity", "events", eventId, existing[0], updated);
    if (evRow.status === "closed") await recomputeCycleResults(evRow.cycleId, userId);
    res.json(updated);
  } else {
    const [created] = await db.insert(eventConformitiesTable)
      .values({
        eventId,
        epi: canCenografia && epi !== undefined ? epi : null,
        estaiamentos: canCenografia && estaiamentos !== undefined ? estaiamentos : null,
        guardaEquipamentos: canFerramentas && guardaEquipamentos !== undefined ? guardaEquipamentos : null,
        conduta: canCenografia && conduta !== undefined ? conduta : null,
        epiComment: canCenografia ? (epiComment || null) : null,
        estaiamentosComment: canCenografia ? (estaiamentosComment || null) : null,
        guardaEquipamentosComment: canFerramentas ? (guardaEquipamentosComment || null) : null,
        condutaComment: canCenografia ? (condutaComment || null) : null,
        absencesResponse: canCenografia && absencesResponse !== undefined ? absencesResponse : null,
        absencesReport: canCenografia ? (absencesReport || null) : null,
        standoutResponse: canCenografia && standoutResponse !== undefined ? standoutResponse : null,
        standoutJustification: canCenografia ? (standoutJustification || null) : null,
        createdByUserId: userId,
      })
      .returning();
    await audit(userId, "create_conformity", "events", eventId, null, created);
    if (evRow.status === "closed") await recomputeCycleResults(evRow.cycleId, userId);
    res.status(201).json(created);
  }
});

router.get("/events/:id/criteria", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const partialPubAlias = aliasedTable(usersTable, "partial_pub");
  const finalPubAlias = aliasedTable(usersTable, "final_pub");
  const criteria = await db
    .select({
      id: eventCriteriaTable.id,
      eventId: eventCriteriaTable.eventId,
      criterionId: eventCriteriaTable.criterionId,
      criterionName: criteriaTable.name,
      criterionDescription: criteriaTable.description,
      responsibleAreaId: criteriaTable.responsibleAreaId,
      responsibleAreaName: areasTable.name,
      active: eventCriteriaTable.active,
      originalWeight: criteriaTable.defaultWeight,
      weightOverride: eventCriteriaTable.weightOverride,
      eventScoped: criteriaTable.eventScoped,
      sourceCriterionId: criteriaTable.sourceCriterionId,
      partialPublishedAt: eventCriteriaTable.partialPublishedAt,
      finalPublishedAt: eventCriteriaTable.finalPublishedAt,
      partialPublishedByUserName: partialPubAlias.name,
      finalPublishedByUserName: finalPubAlias.name,
    })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .leftJoin(areasTable, eq(criteriaTable.responsibleAreaId, areasTable.id))
    .leftJoin(partialPubAlias, eq(eventCriteriaTable.partialPublishedByUserId, partialPubAlias.id))
    .leftJoin(finalPubAlias, eq(eventCriteriaTable.finalPublishedByUserId, finalPubAlias.id))
    .where(eq(eventCriteriaTable.eventId, id));
  const activeCriteria = criteria.filter(c => c.active);
  const totalWeight = activeCriteria.reduce((s, c) => s + parseFloat(c.weightOverride ?? c.originalWeight ?? "1"), 0);
  res.json(criteria.map(c => {
    const w = parseFloat(c.weightOverride ?? c.originalWeight ?? "1");
    return { ...c, originalWeight: parseFloat(c.originalWeight ?? "1"), weightOverride: c.weightOverride ? parseFloat(c.weightOverride) : null, normalizedWeight: c.active && totalWeight > 0 ? w / totalWeight : 0, weight: c.active ? w : 0 };
  }));
});


type CriterionConfigItem = { criterionId: number; active: boolean; weight: number };

router.put("/events/:id/criteria", requireRole("admin", "rh"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const items = (req.body?.criteria ?? []) as CriterionConfigItem[];
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Envie a lista de critérios (criteria) do evento" });
    return;
  }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event) { res.status(404).json({ error: "Não encontrado" }); return; }

  const hasEvaluations = await eventHasEvaluations(eventId);

  const existing = await db
    .select({
      id: eventCriteriaTable.id,
      criterionId: eventCriteriaTable.criterionId,
      active: eventCriteriaTable.active,
      weightOverride: eventCriteriaTable.weightOverride,
      originalWeight: criteriaTable.defaultWeight,
    })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .where(eq(eventCriteriaTable.eventId, eventId));

  // Os pesos podem sempre ser editados. A estrutura (ativar/desativar) fica
  // parcialmente travada: ativar um critério inativo após avaliações cria
  // dados inconsistentes; reativar é sempre bloqueado. Desativar, porém, é
  // permitido quando o critério ainda não tem nenhuma avaliação submetida —
  // isso corrige critérios "órfãos" que ficaram ativos sem nunca serem avaliados.
  if (hasEvaluations) {
    // Critérios com ao menos uma avaliação submetida
    const evaldRows = await db
      .select({ criterionId: evaluationsTable.criterionId })
      .from(evaluationsTable)
      .where(and(eq(evaluationsTable.eventId, eventId), eq(evaluationsTable.status, "submitted")));
    const evaldCriterionIds = new Set(evaldRows.map(e => e.criterionId));

    const illegalChange = existing.some(ec => {
      const item = items.find(i => i.criterionId === ec.criterionId);
      if (!item || item.active === ec.active) return false;
      // Ativar (false→true) sempre bloqueado quando há avaliações no evento
      if (item.active && !ec.active) return true;
      // Desativar (true→false): bloqueado só se o critério já tem avaliações
      return evaldCriterionIds.has(ec.criterionId);
    });
    if (illegalChange) {
      res.status(409).json({ error: "Este evento já possui avaliações. Só é possível desativar critérios que ainda não foram avaliados." });
      return;
    }
  }

  // Validate the resulting persisted active-weight sum (merging unchanged rows
  // with the incoming payload), not just the payload itself.
  const resultingActiveSum = existing.reduce((s, ec) => {
    const item = items.find(i => i.criterionId === ec.criterionId);
    const active = item ? item.active : ec.active;
    if (!active) return s;
    const weight = item
      ? (Number(item.weight) || 0)
      : parseFloat(ec.weightOverride ?? ec.originalWeight ?? "0");
    return s + weight;
  }, 0);
  // Pesos livres (temporário): basta haver peso positivo. A nota do evento usa
  // média ponderada, então a soma dos pesos não precisa ser fixa.
  if (resultingActiveSum <= 0) {
    res.status(400).json({ error: "Defina pesos positivos para os critérios ativos." });
    return;
  }

  for (const ec of existing) {
    const item = items.find(i => i.criterionId === ec.criterionId);
    if (!item) continue;
    await db.update(eventCriteriaTable).set({
      active: item.active,
      weightOverride: item.active ? String(Number(item.weight) || 0) : null,
    }).where(eq(eventCriteriaTable.id, ec.id));
  }

  // Alterar pesos depois que o evento já foi fechado muda o resultado do
  // ciclo (dashboard/ranking/pagamentos), que foi calculado com os pesos
  // anteriores — recalcula na hora para refletir o ajuste imediatamente.
  let warnings: string[] = [];
  if (event.status === "closed") {
    await audit(req.user!.userId, "update_weights_after_evaluations", "events", eventId);
    const recompute = await recomputeCycleResults(event.cycleId, req.user!.userId);
    warnings = recompute.warnings;
  }

  const updatedCriteria = await db
    .select({
      id: eventCriteriaTable.id,
      eventId: eventCriteriaTable.eventId,
      criterionId: eventCriteriaTable.criterionId,
      criterionName: criteriaTable.name,
      active: eventCriteriaTable.active,
      originalWeight: criteriaTable.defaultWeight,
      weightOverride: eventCriteriaTable.weightOverride,
    })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .where(eq(eventCriteriaTable.eventId, eventId));

  const activeCriteria = updatedCriteria.filter(c => c.active);
  const totalWeight = activeCriteria.reduce((s, c) => s + parseFloat(c.weightOverride ?? c.originalWeight ?? "1"), 0);
  res.json({
    criteria: updatedCriteria.map(c => {
      const w = parseFloat(c.weightOverride ?? c.originalWeight ?? "1");
      return {
        ...c,
        originalWeight: parseFloat(c.originalWeight ?? "1"),
        weightOverride: c.weightOverride ? parseFloat(c.weightOverride) : null,
        normalizedWeight: c.active && totalWeight > 0 ? w / totalWeight : 0,
        weight: c.active ? parseFloat(c.weightOverride ?? c.originalWeight ?? "1") : 0,
      };
    }),
    warnings: warnings.length > 0 ? warnings : undefined,
  });
});

/**
 * POST /events/:id/criteria/duplicate
 * RH duplica um quesito (critério) DENTRO de um evento, dando um nome próprio à
 * cópia. A cópia é um critério com escopo de evento (eventScoped): não aparece na
 * lista global de critérios nem é anexado a outros eventos na sincronização.
 * Tem seu próprio criterionId, então é avaliada e pontuada de forma independente.
 * Body: { sourceCriterionId, name }
 */
router.post("/events/:id/criteria/duplicate", requireRole("admin", "rh"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const [ev] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!ev) { res.status(404).json({ error: "Não encontrado" }); return; }
  if (await eventHasEvaluations(eventId)) {
    res.status(409).json({ error: "Este evento já possui avaliações. Os critérios não podem mais ser alterados." });
    return;
  }

  const sourceCriterionId = Number(req.body?.sourceCriterionId);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const areaIdOverride = req.body?.responsibleAreaId != null ? Number(req.body.responsibleAreaId) : null;
  const areaLabelOverride = typeof req.body?.responsibleAreaLabel === "string" ? req.body.responsibleAreaLabel.trim() : null;
  if (!sourceCriterionId) { res.status(400).json({ error: "Informe o critério de origem (sourceCriterionId)" }); return; }

  const [link] = await db.select().from(eventCriteriaTable)
    .where(and(eq(eventCriteriaTable.eventId, eventId), eq(eventCriteriaTable.criterionId, sourceCriterionId)))
    .limit(1);
  if (!link) { res.status(404).json({ error: "Critério de origem não está vinculado a este evento" }); return; }

  const [source] = await db.select().from(criteriaTable).where(eq(criteriaTable.id, sourceCriterionId)).limit(1);
  if (!source) { res.status(404).json({ error: "Critério de origem não encontrado" }); return; }

  const [copy] = await db.insert(criteriaTable).values({
    name: name || `${source.name} (2)`,
    description: source.description,
    responsibleAreaId: areaIdOverride ?? source.responsibleAreaId,
    responsibleAreaLabel: areaLabelOverride ?? source.responsibleAreaLabel,
    defaultWeight: source.defaultWeight,
    active: true,
    displayOrder: source.displayOrder,
    eventScoped: true,
    sourceCriterionId: sourceCriterionId,
  }).returning();

  // Começa com peso 0 para não quebrar a soma de 20; o RH redistribui depois.
  await db.insert(eventCriteriaTable).values({ eventId, criterionId: copy.id, active: true, weightOverride: "0" });

  await audit(req.user!.userId, "duplicate", "criteria", copy.id, null, { eventId, sourceCriterionId, name: copy.name });
  res.status(201).json(await loadEventDetail(eventId));
});

/**
 * DELETE /events/:id/criteria/:eventCriterionId
 * Exclui um quesito DUPLICADO (eventScoped) de um evento. Critérios padrão não
 * podem ser excluídos — apenas desativados pela tela de configuração.
 */
router.delete("/events/:id/criteria/:eventCriterionId", requireRole("admin", "rh"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const ecId = parseInt(req.params.eventCriterionId as string);
  if (await eventHasEvaluations(eventId)) {
    res.status(409).json({ error: "Este evento já possui avaliações. Os critérios não podem mais ser alterados." });
    return;
  }

  const [link] = await db.select().from(eventCriteriaTable)
    .where(and(eq(eventCriteriaTable.id, ecId), eq(eventCriteriaTable.eventId, eventId)))
    .limit(1);
  if (!link) { res.status(404).json({ error: "Critério do evento não encontrado" }); return; }

  const [crit] = await db.select().from(criteriaTable).where(eq(criteriaTable.id, link.criterionId)).limit(1);
  if (!crit?.eventScoped) {
    res.status(400).json({ error: "Apenas quesitos duplicados podem ser excluídos. Desative o critério padrão." });
    return;
  }

  await db.delete(eventCriteriaTable).where(eq(eventCriteriaTable.id, ecId));
  await db.delete(criteriaTable).where(eq(criteriaTable.id, link.criterionId));
  await audit(req.user!.userId, "delete", "criteria", link.criterionId, crit, null);
  res.json(await loadEventDetail(eventId));
});

/**
 * PATCH /events/:id/criteria/:ecId/swap-source
 * Admin corrige a origem de um quesito DUPLICADO (eventScoped) mesmo quando o
 * evento já possui avaliações: altera name + source_criterion_id sem tocar nas
 * avaliações existentes — elas permanecem vinculadas ao mesmo criterionId.
 * Body: { sourceCriterionId: number }
 */
router.patch("/events/:id/criteria/:ecId/swap-source", requireRole("admin"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const ecId = parseInt(req.params.ecId as string);

  const [link] = await db.select().from(eventCriteriaTable)
    .where(and(eq(eventCriteriaTable.id, ecId), eq(eventCriteriaTable.eventId, eventId)))
    .limit(1);
  if (!link) { res.status(404).json({ error: "Critério do evento não encontrado" }); return; }

  const [crit] = await db.select().from(criteriaTable).where(eq(criteriaTable.id, link.criterionId)).limit(1);
  if (!crit?.eventScoped) {
    res.status(400).json({ error: "Apenas quesitos duplicados podem ter a origem trocada." });
    return;
  }

  const newSourceId = Number(req.body?.sourceCriterionId);
  if (!newSourceId) { res.status(400).json({ error: "Informe o novo critério de origem (sourceCriterionId)" }); return; }

  const [newSource] = await db.select().from(criteriaTable).where(eq(criteriaTable.id, newSourceId)).limit(1);
  if (!newSource || newSource.eventScoped) {
    res.status(400).json({ error: "Critério de origem inválido" }); return;
  }

  const [srcLink] = await db.select().from(eventCriteriaTable)
    .where(and(eq(eventCriteriaTable.eventId, eventId), eq(eventCriteriaTable.criterionId, newSourceId)))
    .limit(1);
  if (!srcLink) { res.status(404).json({ error: "Critério de origem não está vinculado a este evento" }); return; }

  // Deriva nome sequencial baseado no novo source
  const allNames = await db.select({ name: criteriaTable.name })
    .from(criteriaTable)
    .innerJoin(eventCriteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .where(and(eq(eventCriteriaTable.eventId, eventId), ne(criteriaTable.id, link.criterionId)));
  const baseName = newSource.name;
  const nums = allNames.map(c => {
    const m = c.name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\((\\d+)\\)$`));
    return m ? parseInt(m[1]) : null;
  }).filter((n): n is number => n !== null);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 2;
  const newName = `${baseName} (${next})`;

  await db.update(criteriaTable)
    .set({
      name: newName,
      sourceCriterionId: newSourceId,
      responsibleAreaId: newSource.responsibleAreaId,
      responsibleAreaLabel: newSource.responsibleAreaLabel,
    })
    .where(eq(criteriaTable.id, link.criterionId));

  await audit(req.user!.userId, "swap-source", "criteria", link.criterionId,
    { oldSource: crit.sourceCriterionId, oldName: crit.name },
    { newSource: newSourceId, newName });
  res.json(await loadEventDetail(eventId));
});

/**
 * PUT /events/:id/assignments
 * RH define, por área, quais avaliadores darão a nota daquela área NESTE evento.
 * Body: { assignments: [{ areaId, evaluatorUserIds: number[] }] }
 * Substitui por completo a lista de avaliadores de cada área informada.
 * evaluatorUserIds vazio remove todas as atribuições da área.
 * Quando há mais de um avaliador por área, a nota final do critério é a média
 * das avaliações submetidas por todos eles.
 */
router.put("/events/:id/assignments", requireRole("admin", "rh"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const [ev] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!ev) { res.status(404).json({ error: "Não encontrado" }); return; }
  if (await eventHasEvaluations(eventId)) {
    res.status(409).json({ error: "Este evento já possui avaliações. As atribuições não podem mais ser alteradas." });
    return;
  }

  const items = (req.body?.assignments ?? []) as { areaId: number; evaluatorUserIds: (number | null)[] }[];
  if (!Array.isArray(items)) {
    res.status(400).json({ error: "Envie a lista de atribuições (assignments)" });
    return;
  }

  const parsedItems: { areaId: number; evaluatorUserIds: number[] }[] = [];
  for (const item of items) {
    const areaId = Number(item.areaId);
    if (!areaId) continue;
    const evaluatorUserIds = Array.from(new Set(
      (Array.isArray(item.evaluatorUserIds) ? item.evaluatorUserIds : [])
        .filter((v): v is number => v != null)
        .map(Number)
        .filter(v => v > 0),
    ));
    parsedItems.push({ areaId, evaluatorUserIds });
  }

  const allUserIds = Array.from(new Set(parsedItems.flatMap(i => i.evaluatorUserIds)));
  if (allUserIds.length > 0) {
    const evaluatorUsers = await db.select().from(usersTable).where(inArray(usersTable.id, allUserIds));
    const invalid = allUserIds.filter(id => {
      const u = evaluatorUsers.find(u => u.id === id);
      return !u || u.role !== "avaliador";
    });
    if (invalid.length > 0) {
      res.status(400).json({ error: "O avaliador atribuído deve ser um usuário com papel de avaliador" });
      return;
    }
  }

  await db.transaction(async (tx) => {
    for (const item of parsedItems) {
      await tx.delete(eventAreaAssignmentsTable)
        .where(and(eq(eventAreaAssignmentsTable.eventId, eventId), eq(eventAreaAssignmentsTable.areaId, item.areaId)));
      if (item.evaluatorUserIds.length > 0) {
        await tx.insert(eventAreaAssignmentsTable).values(
          item.evaluatorUserIds.map(userId => ({ eventId, areaId: item.areaId, evaluatorUserId: userId })),
        );
      }
    }
  });

  await audit(req.user!.userId, "set_assignments", "events", eventId, null, { assignments: parsedItems });
  res.json(await loadEventDetail(eventId));
});

/**
 * POST /events/:id/criteria/resync
 * Corrige eventos "presos" no catálogo antigo de critérios: se um critério
 * global foi desativado depois que o evento foi criado, ele fica orfão no
 * evento (event_criteria.active continua true mesmo sem existir mais no
 * catálogo ativo). Isso pode deixar o evento sem NENHUM critério realmente
 * ativo. Este endpoint, disponível apenas enquanto o evento não travou os
 * critérios (criteriaConfirmed=false), sincroniza o evento com o catálogo
 * global atual: desativa vínculos para critérios hoje inativos e cria
 * vínculos para critérios ativos que ainda não estão no evento. Critérios
 * criados sob medida para o evento (eventScoped) nunca são tocados.
 */
router.post("/events/:id/criteria/resync", requireRole("admin", "rh"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  // Default force=true: sync is always additive (never removes criteria with evaluations).
  // Explicit force=false opt-out is available for strict mode.
  const force = req.body?.force !== false;
  try {
    const { deactivated, added, activated } = await resyncEventCriteriaOnce(eventId, { force });
    await audit(req.user!.userId, "resync_criteria", "events", eventId, { deactivated, added, activated, force }, null);
    res.json({ ...(await loadEventDetail(eventId)), removedStale: deactivated, addedNew: added, reactivated: activated });
  } catch (err) {
    if (err instanceof ResyncBlockedError) {
      const message = err.reason === "confirmed"
        ? "Este evento já confirmou os critérios. Reabra a confirmação antes de sincronizar."
        : "Este evento já possui avaliações. Os critérios não podem ser sincronizados automaticamente.";
      res.status(409).json({ error: message });
      return;
    }
    console.error(`Erro ao sincronizar critérios do evento ${eventId}:`, err);
    res.status(500).json({ error: "Erro ao sincronizar critérios" });
  }
});

/**
 * POST /events/criteria/resync-all
 * Versão em massa do resync acima: percorre todos os eventos do ciclo atual
 * ainda não travados (criteriaConfirmed=false, sem avaliações) e sincroniza
 * cada um individualmente com o catálogo global de critérios ativos. Eventos
 * já confirmados ou com avaliações são pulados (não é erro, só ficam fora do
 * resumo de "processados").
 */
router.post("/events/criteria/resync-all", requireRole("admin", "rh"), async (req, res) => {
  // Default force=true: additive-only sync works on events with evaluations or confirmed criteria.
  const force = req.body?.force !== false;
  const cycle = await getCurrentCycle();
  if (!cycle) { res.json({ processed: 0, skipped: 0, totalAdded: 0, totalDeactivated: 0, events: [] }); return; }

  const events = await db
    .select({ id: eventsTable.id, name: eventsTable.name })
    .from(eventsTable)
    .where(eq(eventsTable.cycleId, cycle.id));

  let processed = 0, skipped = 0, failed = 0, totalAdded = 0, totalDeactivated = 0, totalActivated = 0;
  const details: { id: number; name: string; added: number; deactivated: number; activated: number }[] = [];
  const failures: { id: number; name: string; error: string }[] = [];

  for (const ev of events) {
    try {
      const { added, deactivated, activated: activatedRaw } = await resyncEventCriteriaOnce(ev.id, { force });
      const activated = activatedRaw ?? 0;
      if (added > 0 || deactivated > 0 || activated > 0) {
        processed += 1;
        totalAdded += added;
        totalDeactivated += deactivated;
        totalActivated += activated;
        details.push({ id: ev.id, name: ev.name, added, deactivated, activated });
        await audit(req.user!.userId, "resync_criteria", "events", ev.id, { deactivated, added, activated, bulk: true, force }, null);
      }
    } catch (err) {
      if (err instanceof ResyncBlockedError) { skipped += 1; continue; }
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ id: ev.id, name: ev.name, error: message });
      console.error(`Erro ao sincronizar critérios do evento ${ev.id} (resync-all):`, err);
    }
  }

  res.json({ processed, skipped, failed, totalAdded, totalDeactivated, totalActivated, events: details, failures });
});

router.post("/events/:id/criteria/confirm", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const confirmed = req.body?.confirmed !== false;
  const [before] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Não encontrado" }); return; }

  if (!confirmed && await eventHasEvaluations(id)) {
    res.status(409).json({ error: "Este evento já possui avaliações. Os critérios não podem ser reabertos para edição." });
    return;
  }

  if (confirmed) {
    const rows = await db
      .select({ id: eventCriteriaTable.id, active: eventCriteriaTable.active, originalWeight: criteriaTable.defaultWeight, weightOverride: eventCriteriaTable.weightOverride })
      .from(eventCriteriaTable)
      .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
      .where(eq(eventCriteriaTable.eventId, id));
    const sum = rows.filter(r => r.active).reduce((s, r) => s + parseFloat(r.weightOverride ?? r.originalWeight ?? "1"), 0);
    if (sum <= 0) {
      res.status(400).json({ error: "Defina pesos positivos para os critérios ativos antes de confirmar." });
      return;
    }

    // Nem toda área precisa ter avaliador definido no momento da liberação —
    // essa atribuição pode chegar depois (ex.: freelancer ainda não confirmado).
    // Libera parcialmente; áreas sem avaliador continuam visíveis como alerta
    // em outras telas (unassignedAreaNames), mas não bloqueiam o fluxo.

    // Freeze each active criterion's effective weight so that later edits to the
    // global default weight can never alter an event locked for evaluation.
    for (const r of rows) {
      if (r.active && r.weightOverride == null) {
        await db.update(eventCriteriaTable)
          .set({ weightOverride: String(parseFloat(r.originalWeight ?? "0")) })
          .where(eq(eventCriteriaTable.id, r.id));
      }
    }
  }

  const [ev] = await db.update(eventsTable).set({
    criteriaConfirmed: confirmed,
    criteriaConfirmedAt: confirmed ? new Date() : null,
  }).where(eq(eventsTable.id, id)).returning();
  await audit(req.user!.userId, confirmed ? "confirm_criteria" : "reopen_criteria", "events", id, before, ev);

  // O avaliador padrão de cada critério já vem pré-determinado pelo roteamento
  // global — não faz sentido depender de um clique manual em "Gerar Sugestões"
  // pra isso existir. Gera automaticamente ao liberar as avaliações (idempotente:
  // pula critérios que já têm atribuição, então não sobrescreve nada).
  if (confirmed) {
    await generateCriterionAssignments(id);

    // Matriz de Conformidade: espelha o Forms oficial — 3 perguntas para o
    // avaliador de Cenografia (EPI, Estaiamentos, Conduta) e 1 para o de
    // Ferramentas e Case (Guarda de Equipamentos). Pré-preenche os dois a
    // partir dos padrões configurados em Critérios, sem sobrescrever uma
    // escolha manual já feita neste evento. Recurso opcional: se falhar
    // (ex.: tabela area_conformity_routing ainda não migrada no banco),
    // loga e segue — não pode derrubar a liberação das avaliações.
    if (ev.conformityEvaluatorUserId == null || ev.conformityEvaluatorFerramentasUserId == null) {
      try {
        const conformityDefaults = await db.select({
          areaName: areasTable.name,
          defaultEvaluatorId: areaConformityRoutingTable.defaultEvaluatorId,
        })
          .from(areaConformityRoutingTable)
          .leftJoin(areasTable, eq(areaConformityRoutingTable.areaId, areasTable.id));
        const byName = (needle: string) => conformityDefaults.find(
          d => (d.areaName ?? "").trim().toLowerCase().includes(needle),
        )?.defaultEvaluatorId ?? null;
        const patch: Partial<typeof eventsTable.$inferInsert> = {};
        if (ev.conformityEvaluatorUserId == null) {
          const cenografiaDefault = byName("cenografia");
          if (cenografiaDefault != null) patch.conformityEvaluatorUserId = cenografiaDefault;
        }
        if (ev.conformityEvaluatorFerramentasUserId == null) {
          const ferramentasDefault = byName("ferramentas");
          if (ferramentasDefault != null) patch.conformityEvaluatorFerramentasUserId = ferramentasDefault;
        }
        if (Object.keys(patch).length > 0) {
          await db.update(eventsTable).set(patch).where(eq(eventsTable.id, id));
        }
      } catch (err) {
        console.error(`[events] Falha ao pré-preencher avaliadores da matriz no evento ${id} (rodou o db push da tabela area_conformity_routing?):`, err);
      }
    }
  }

  res.json(await loadEventDetail(id));
});

// Mural de comentários — chat geral do evento, aberto a qualquer usuário
// autenticado (não é gated por role nem por confidencialidade).
router.get("/events/:id/comments", async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const comments = await db
    .select({
      id: eventCommentsTable.id,
      eventId: eventCommentsTable.eventId,
      userId: eventCommentsTable.userId,
      userName: usersTable.name,
      userRole: usersTable.role,
      message: eventCommentsTable.message,
      createdAt: eventCommentsTable.createdAt,
    })
    .from(eventCommentsTable)
    .leftJoin(usersTable, eq(eventCommentsTable.userId, usersTable.id))
    .where(eq(eventCommentsTable.eventId, eventId))
    .orderBy(eventCommentsTable.createdAt);
  res.json(comments);
});

router.post("/events/:id/comments", async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const { message } = req.body;
  if (typeof message !== "string" || !message.trim()) { res.status(400).json({ error: "message obrigatório" }); return; }
  if (message.trim().length > 2000) { res.status(400).json({ error: "message deve ter no máximo 2000 caracteres" }); return; }
  const [ev] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!ev) { res.status(404).json({ error: "evento não encontrado" }); return; }
  const [comment] = await db.insert(eventCommentsTable).values({
    eventId, userId: req.user!.userId, message: message.trim(),
  }).returning();
  const [author] = await db.select({ name: usersTable.name, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  res.status(201).json({ ...comment, userName: author?.name ?? "", userRole: author?.role ?? "" });
});

router.delete("/events/:id/comments/:commentId", async (req, res) => {
  const commentId = parseInt(req.params.commentId as string);
  const [comment] = await db.select().from(eventCommentsTable).where(eq(eventCommentsTable.id, commentId)).limit(1);
  if (!comment) { res.status(404).json({ error: "comentário não encontrado" }); return; }
  const isOwner = comment.userId === req.user!.userId;
  const isModerator = ["admin", "rh"].includes(req.user!.role);
  if (!isOwner && !isModerator) { res.status(403).json({ error: "sem permissão para excluir este comentário" }); return; }
  await db.delete(eventCommentsTable).where(eq(eventCommentsTable.id, commentId));
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// One-time admin: migra calibrações de critérios de nomes longos (errados)
// para seus equivalentes de nomes curtos (corretos/ativos).
// Seguro rodar múltiplas vezes (idempotente — só atualiza se o critério
// de origem ainda existe nas calibrações).
// ---------------------------------------------------------------------------
router.post("/events/admin/normalize-dates", requireRole("admin"), async (req, res) => {
  // 1. Corrige os 4 eventos com datas erradas (confirmadas pelo usuário)
  const fixes: { id: number; date: string }[] = [
    { id: 127, date: "2026-07-26" }, // Bravus Speed RJ – datas invertidas
    { id: 95,  date: "2026-06-27" }, // Night Run Joinville
    { id: 96,  date: "2026-06-27" }, // Night Run Manaus
    { id: 873, date: "2026-08-23" }, // Netshoes Run SP
  ];
  let fixedCount = 0;
  for (const fix of fixes) {
    await db.update(eventsTable)
      .set({ startDate: fix.date, endDate: fix.date })
      .where(eq(eventsTable.id, fix.id));
    fixedCount++;
  }
  const fixedIds = fixes.map(f => f.id);

  // 2. Para todos os demais eventos multi-dia: startDate = endDate (data única)
  const multiDay = await db.select({ id: eventsTable.id, endDate: eventsTable.endDate })
    .from(eventsTable)
    .where(sql`start_date <> end_date AND id NOT IN (${sql.join(fixedIds.map(id => sql`${id}`), sql`, `)})`);

  let normalizedCount = 0;
  for (const ev of multiDay) {
    await db.update(eventsTable)
      .set({ startDate: ev.endDate })
      .where(eq(eventsTable.id, ev.id));
    normalizedCount++;
  }

  await audit(req.user!.userId, "normalize_event_dates", "events", undefined,
    { fixedCount, normalizedCount, fixedIds, normalizedIds: multiDay.map(e => e.id) }, undefined);

  res.json({ ok: true, fixedCount, normalizedCount });
});

router.post("/events/admin/fix-calibration-criteria", requireRole("admin"), async (req, res) => {
  const nameMap: Record<string, string> = {
    "Qualidade e Acabamento da Montagem": "Qualidade da Entrega",
    "Logística Reversa/Carga da Desmontagem": "Logística Reversa",
    "Prazo de Entrega/Arena Pronta no Horário": "Prazo de Entrega",
    "Retorno de Material/Perdas ou Avarias": "Perda de Material/Estrutura",
  };

  const results: { from: string; to: string; fromId: number; toId: number; updated: number }[] = [];
  let totalUpdated = 0;

  for (const [fromName, toName] of Object.entries(nameMap)) {
    const [fromCrit] = await db.select({ id: criteriaTable.id }).from(criteriaTable).where(eq(criteriaTable.name, fromName)).limit(1);
    const [toCrit] = await db.select({ id: criteriaTable.id }).from(criteriaTable).where(eq(criteriaTable.name, toName)).limit(1);
    if (!fromCrit || !toCrit) continue;

    const updated = await db.execute(
      sql`UPDATE calibrations SET criterion_id = ${toCrit.id} WHERE criterion_id = ${fromCrit.id}`
    );
    const count = (updated as unknown as { rowCount: number }).rowCount ?? 0;
    totalUpdated += count;
    results.push({ from: fromName, to: toName, fromId: fromCrit.id, toId: toCrit.id, updated: count });
  }

  await audit(req.user!.userId, "fix_calibration_criteria", "calibrations", undefined, { results, totalUpdated }, undefined);
  res.json({ totalUpdated, results });
});

export default router;
