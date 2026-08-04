import { Router } from "express";
import {
  db, eventsTable, eventParticipantsTable, evaluationsTable, calibrationsTable,
  eventCriteriaTable, criteriaTable, absencesTable, quarterlyResultsTable,
  platoonRulesTable, employeesTable, areasTable, employeeCycleEligibilityTable,
  eventAreaAssignmentsTable, employeeEventResultsTable, eventConformitiesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
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
      criteriaConfirmed: eventsTable.criteriaConfirmed,
      criteriaConfirmedAt: eventsTable.criteriaConfirmedAt,
      startDate: eventsTable.startDate,
      endDate: eventsTable.endDate,
      functionName: eventParticipantsTable.functionName,
      participantConfirmed: eventParticipantsTable.confirmed,
      resultsConfirmed: eventsTable.resultsConfirmed,
      isHistorical: eventsTable.isHistorical,
      importedScore: eventsTable.importedScore,
    })
    .from(eventParticipantsTable)
    .leftJoin(eventsTable, eq(eventParticipantsTable.eventId, eventsTable.id))
    .where(and(
      eq(eventParticipantsTable.employeeId, employeeId),
      eq(eventsTable.cycleId, cycle.id),
    ));

  // Notas OFICIAIS por evento — mesma fonte usada por Resultados, Ranking e o
  // grid de colaboradores. Recalcular a nota aqui ao vivo divergia do oficial:
  // o snapshot passa por computeEventTeamResult (que aplica a penalidade da
  // Matriz de Conformidade), enquanto calculateEventResult devolve a nota crua.
  // Resultado: o colaborador via uma quantidade de eventos e uma média que não
  // batiam com as outras telas. Só caímos no cálculo ao vivo quando ainda NÃO
  // existe linha oficial (evento não confirmado) — aí é projeção mesmo.
  const officialEventScores = new Map<number, number>();
  // rawTeamScore = eventScore da linha (nota bruta antes da penalidade da Matriz)
  const officialRawEventScores = new Map<number, number>();
  {
    const officialRows = await db
      .select({
        eventId: employeeEventResultsTable.eventId,
        eventScore: employeeEventResultsTable.eventScore,
        finalEventScore: employeeEventResultsTable.finalEventScore,
      })
      .from(employeeEventResultsTable)
      .innerJoin(eventsTable, eq(employeeEventResultsTable.eventId, eventsTable.id))
      .where(and(
        eq(employeeEventResultsTable.employeeId, employeeId),
        eq(eventsTable.cycleId, cycle.id),
      ));
    for (const r of officialRows) {
      if (r.finalEventScore != null) {
        officialEventScores.set(r.eventId, parseFloat(r.finalEventScore as unknown as string));
      }
      if (r.eventScore != null) {
        officialRawEventScores.set(r.eventId, parseFloat(r.eventScore as unknown as string));
      }
    }
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

    // Todos os event_criteria deste evento — SEM filtro active, pois critérios
    // inativos que já foram calibrados ainda devem aparecer para o colaborador.
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
      .where(eq(eventCriteriaTable.eventId, p.eventId));

    // Avaliações do TIME do evento (não por colaborador)
    const [allEvals, allCalibrations, areaAssignmentsRaw, conformityRow] = await Promise.all([
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
        calibrationReason: calibrationsTable.calibrationReason,
      }).from(calibrationsTable).where(eq(calibrationsTable.eventId, p.eventId)),

      db.select({ areaId: eventAreaAssignmentsTable.areaId, evaluatorUserId: eventAreaAssignmentsTable.evaluatorUserId })
        .from(eventAreaAssignmentsTable).where(eq(eventAreaAssignmentsTable.eventId, p.eventId)),

      db.select({
        epi: eventConformitiesTable.epi,
        estaiamentos: eventConformitiesTable.estaiamentos,
        guardaEquipamentos: eventConformitiesTable.guardaEquipamentos,
        conduta: eventConformitiesTable.conduta,
        epiComment: eventConformitiesTable.epiComment,
        estaiamentosComment: eventConformitiesTable.estaiamentosComment,
        guardaEquipamentosComment: eventConformitiesTable.guardaEquipamentosComment,
        condutaComment: eventConformitiesTable.condutaComment,
      }).from(eventConformitiesTable).where(eq(eventConformitiesTable.eventId, p.eventId)).limit(1),
    ]);

    // Itens da Matriz de Conformidade que reprovaram (false = NÃO conforme)
    const conformity = conformityRow[0] ?? null;
    const CONFORMITY_ITEMS = [
      { key: "epi" as const,               label: "EPI",                   commentKey: "epiComment" as const },
      { key: "estaiamentos" as const,       label: "Estaiamentos",          commentKey: "estaiamentosComment" as const },
      { key: "guardaEquipamentos" as const, label: "Guarda de Equipamentos",commentKey: "guardaEquipamentosComment" as const },
      { key: "conduta" as const,            label: "Conduta",               commentKey: "condutaComment" as const },
    ];
    const conformityFailedItems: { label: string; comment: string | null }[] = conformity
      ? CONFORMITY_ITEMS
          .filter(item => conformity[item.key] === false)
          .map(item => ({ label: item.label, comment: conformity[item.commentKey] ?? null }))
      : [];

    const assignedByArea = buildAssignedEvaluatorsByArea(areaAssignmentsRaw);

    // Constrói criteriaDetails diretamente dos critérios do evento (não-eventScoped).
    // Inclui critério se: active=true OU tem calibração (eventos históricos podem ter
    // critérios desativados mas já calibrados que o colaborador deve ver).
    const criteriaDetails = eventCriteriaRows
      .filter(r => !r.eventScoped)
      .filter(r => r.active || allCalibrations.some(cal => cal.criterionId === r.criterionId))
      .map(r => {
        const weight = parseFloat(((r.weight ?? r.defaultWeight) ?? "1") as string);
        const submittedEvals = allEvals.filter(e => e.criterionId === r.criterionId && e.status === "submitted");
        const evalScores = submittedEvals.map(e => parseFloat(e.score as unknown as string));
        const averageScore = evalScores.length > 0 ? evalScores.reduce((a, b) => a + b, 0) / evalScores.length : null;
        const calibration = allCalibrations.find(cal => cal.criterionId === r.criterionId);
        const calibratedScore = calibration ? parseFloat(calibration.calibratedScore as unknown as string) : null;
        const scoreUsed = calibratedScore;
        const completion = getCriterionEvaluationStatus(r.responsibleAreaId, submittedEvals.map(e => e.evaluatorUserId as number), assignedByArea);
        const isEvaluated = calibratedScore !== null || completion.isEvaluated;
        const criterionTotal = scoreUsed !== null ? scoreUsed * weight : null;
        const publicComments = allEvals
          .filter(e => e.criterionId === r.criterionId && e.commentVisibility === "public" && e.comments)
          .map(e => e.comments!);
        // Comentário de calibração: exibido apenas quando a nota já foi publicada
        // (parcial ou final) — antes da publicação o colaborador não deve ver.
        const isPublished = !!(r.partialPublishedAt || r.finalPublishedAt);
        const calibrationReason = isPublished ? (calibration?.calibrationReason ?? null) : null;
        return {
          criterionId: r.criterionId!,
          criterionName: r.criterionName ?? "",
          criterionDescription: r.criterionDescription ?? null,
          responsibleAreaLabel: r.responsibleAreaLabel ?? r.responsibleAreaName ?? null,
          weight,
          scoreUsed,
          criterionTotal,
          publicComments,
          calibrationReason,
          evaluated: isEvaluated,
          status: isEvaluated ? "avaliado" as const : "pendente" as const,
          partialPublishedAt: r.partialPublishedAt ?? null,
          finalPublishedAt: r.finalPublishedAt ?? null,
        };
      });

    // Mescla critérios duplicados (eventScoped) nos seus pais para o cálculo
    // da nota. Usa apenas linhas ATIVAS em event_criteria (inativos são só display).
    const criteriaForCalc = mergeEventScopedCriteria([
      ...criteriaDetails
        .filter(cd => eventCriteriaRows.some(r => r.criterionId === cd.criterionId && r.active))
        .map(cd => {
          const row = eventCriteriaRows.find(r => r.criterionId === cd.criterionId && r.active)!;
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

    const rawEventScore = calculateEventResult(criteriaForCalc);
    // Ordem de autoridade da nota do evento:
    // 1. linha oficial em employee_event_results (já com penalidade de
    //    conformidade) — é o que Resultados/Ranking/grid mostram;
    // 2. importedScore, para eventos históricos ainda sem linha oficial;
    // 3. cálculo ao vivo pelas calibrações — projeção de evento não confirmado.
    const officialScore = officialEventScores.get(p.eventId);
    const eventScore = officialScore != null
      ? officialScore
      : (p.isHistorical && p.importedScore != null)
        ? parseFloat(p.importedScore as unknown as string)
        : rawEventScore;
    // Sem nota (nenhum critério avaliado ainda) não tem pelotão — evita
    // mostrar "Pelotão Branco" para um evento com Quesitos 0/N.
    const platoon = eventScore > 0 ? getPlatoonByScore(eventScore, platoonRulesMapped) : null;
    const evaluatedCriteria = criteriaDetails.filter(c => c.evaluated).length;
    // Total = critérios ativos não-eventScoped do evento
    const totalExpected = eventCriteriaRows.filter(r => r.active && !r.eventScoped).length;
    const isComplete = totalExpected > 0 && evaluatedCriteria >= totalExpected;

    // Rollup do evento = publicação parcial mais recente entre os critérios
    // incluídos em criteriaDetails (exclui inativos sem calibração).
    const criteriaDetailIds = new Set(criteriaDetails.map(cd => cd.criterionId));
    const partialTimestamps = eventCriteriaRows
      .filter(r => criteriaDetailIds.has(r.criterionId))
      .map(c => c.partialPublishedAt)
      .filter((d): d is Date => d != null);
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
      criteriaConfirmed: p.criteriaConfirmed ?? false,
      criteriaConfirmedAt: p.criteriaConfirmedAt ? p.criteriaConfirmedAt.toISOString() : null,
      partialPublishedAt,
      eventScore,
      teamScore: eventScore,
      // Penalidade da Matriz de Performance: diferença entre nota bruta e final
      // do snapshot oficial. Zero quando não há penalidade (ou evento ao vivo).
      rawTeamScore: (() => {
        const raw = officialRawEventScores.get(p.eventId ?? 0);
        return raw ?? null;
      })(),
      conformityPenalty: (() => {
        const raw = officialRawEventScores.get(p.eventId ?? 0);
        const fin = officialEventScores.get(p.eventId ?? 0);
        if (raw == null || fin == null) return 0;
        const diff = Math.round((raw - fin) * 100) / 100;
        return diff > 0 ? diff : 0;
      })(),
      conformityFailedItems,
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
      isHistorical: p.isHistorical ?? false,
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
  // Média bruta ao vivo — usada apenas quando não há snapshot de quarterly_results
  // (ou seja, para a projeção de ciclos ainda sem nenhum resultado calculado).
  const grossAverage = scoredEvents.length > 0
    ? scoredEvents.reduce((s, e) => s + e.eventScore, 0) / scoredEvents.length
    : null;

  const registrationEligible = (employee.eligibleForBonus ?? true) && (employee.eligibilityStatus ?? "eligible") === "eligible";
  const quarterEligible = !quarterElig || quarterElig.eligible;
  // Regra: participação como "Sup Ceno *" em qualquer evento do ciclo
  // desqualifica do ranking/bônus — mesma regra do fechamento (results.ts).
  const hasSupCenoParticipation = participations.some(p => isInformationalFunction(p.functionName));
  const eligible = registrationEligible && quarterEligible && !hasSupCenoParticipation;

  let currentPlatoon: string | null = null;
  let currentPlatoonColor: string | null = null;
  let currentPlatoonMinScore: number | null = null;
  let currentPlatoonMaxScore: number | null = null;
  let currentBonus = null;
  let bonusStatus: string | null = null;
  let finalResult: number | null = null;
  if (quarterResult) {
    currentPlatoon = quarterResult.platoon;
    // Enriquecer com cor/faixas via lookup em platoonRulesMapped, para que a
    // tela do colaborador possa exibir o badge colorido mesmo sem consulta extra.
    const snapRule = currentPlatoon ? platoonRulesMapped.find(r => r.name === currentPlatoon) : null;
    currentPlatoonColor = snapRule?.color ?? (quarterResult.platoonColor as string | null) ?? null;
    currentPlatoonMinScore = snapRule?.minScore ?? null;
    currentPlatoonMaxScore = snapRule?.maxScore ?? null;
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
    currentPlatoonColor = proj?.color ?? null;
    currentPlatoonMinScore = proj?.minScore ?? null;
    currentPlatoonMaxScore = proj?.maxScore ?? null;
    const scoredEventsWithDate = scoredEvents
      .filter(e => !!e.startDate)
      .map(e => ({ score: e.eventScore, date: e.startDate as string }));
    const extraEventScores = eligible ? selectExtraEventScores(scoredEventsWithDate, minEventsForEligibility) : [];
    currentBonus = eligible ? calculateTieredBonus(projectedFinalResult, extraEventScores, platoonRulesMapped) : 0;
    bonusStatus = eligible ? "projected" : "not_eligible";
    finalResult = projectedFinalResult;
  }

  // Quando existe snapshot, a média bruta e a contagem de eventos oficial
  // vêm do quarterly_results (calculados no momento do fechamento do evento),
  // não do recálculo ao vivo — evita discrepância entre "Média do Ciclo" e
  // "Média dos Eventos" na tela do colaborador.
  const responseGrossAverage = quarterResult
    ? parseFloat(quarterResult.grossAverage as unknown as string)
    : grossAverage;
  const responseEventsCount = quarterResult
    ? quarterResult.eventsCount
    : scoredEvents.length;

  // Elegibilidade conta eventos PARTICIPADOS (confirmados), não eventos COM
  // NOTA. Um evento confirmado que ainda não teve a nota calculada já conta
  // para a meta — por isso este número é sempre >= scoredEvents.length.
  // Precisa espelhar exatamente participatedEventsCount de results.ts, senão
  // o colaborador vê "faltam 2 eventos" enquanto o grid de RH o mostra
  // "Elegível / 8 eventos".
  const participatedEventsCount = quarterResult
    ? quarterResult.participatedEventsCount
    : eventSummaries.filter(e => e.resultsConfirmed && e.countsForScore).length;

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
      grossAverage: responseGrossAverage,
      currentPlatoon,
      currentPlatoonColor,
      currentPlatoonMinScore,
      currentPlatoonMaxScore,
      projectedBonus: currentBonus,
      bonusStatus,
      eligible,
      totalEvents,
      closedEvents,
      openEvents,
      confirmedEvents: scoredEvents.length,
      scoredEventsCount: responseEventsCount,
      participatedEventsCount,
      minEventsForEligibility,
      totalAbsences,
      penaltyPoints: Math.round(penaltyPoints * 100) / 100,
      meritPoints: Math.round(meritPoints * 100) / 100,
      isQuarterClosed: cycle.status === "closed" || !!cycle.closedAt,
      finalResult,
      absencePenalty: quarterResult ? parseFloat(quarterResult.absencePenalty as unknown as string) : null,
      paymentMethod: quarterResult ? quarterResult.paymentMethod : "Caju Saldo Livre",
      hasQuarterSnapshot: !!quarterResult,
    },
    adjustments,
    events: eventSummaries,
  });
});

export default router;
