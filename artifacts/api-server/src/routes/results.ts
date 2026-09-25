import { Router } from "express";
import {
  db, eventsTable, eventParticipantsTable, calibrationsTable,
  eventCriteriaTable, criteriaTable, quarterlyResultsTable,
  platoonRulesTable, employeesTable, employeeEventResultsTable,
  cyclesTable, type EventConformity,
} from "@workspace/db";
import { eq, and, inArray, exists, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { getPlatoonByScore, validateCalculationExample, validateConformityCalculationExample } from "../lib/calculations.js";
import { getCurrentCycle } from "../lib/cycle.js";
import { audit } from "../lib/audit.js";
import { participantCountsForScore } from "../lib/participation.js";
import { buildCycleResults, computeEventTeamResultFromData, emptyEventTeamData } from "../lib/cycle-compute.js";
import { loadCycleRecomputeInput, loadEventTeamData, loadPlatoonRules } from "../lib/cycle-data.js";
import { pgNum } from "../lib/pg-num.js";

const router = Router();
router.use(requireAuth);

// Log validation on startup
if (!validateCalculationExample()) {
  console.error("❌ ERRO DE CÁLCULO: pesos=[3,3,2,3,3,3,3], notas=[4,4,4,3,2,3,5] deveria retornar 71");
}
if (!validateConformityCalculationExample()) {
  console.error("❌ ERRO DE CÁLCULO: exemplo de conformidade+performance da especificação deveria retornar 60");
}

/**
 * Calcula o resultado do TIME de um evento (uma única nota por evento).
 * A nota é por critério do evento (média das avaliações), com calibração no
 * nível do critério substituindo a média. O resultado é o mesmo para todos.
 *
 * Carrega os dados do evento (5 consultas) e delega para o cálculo puro em
 * lib/cycle-compute.ts. Para VÁRIOS eventos use computeEventTeamResultsBatch
 * (as mesmas 5 consultas para todos, em vez de 5 por evento).
 */
export async function computeEventTeamResult(eventId: number) {
  const data = await loadEventTeamData([eventId]);
  return computeEventTeamResultFromData(data.get(eventId) ?? emptyEventTeamData<EventConformity>());
}

/**
 * Variante em lote de computeEventTeamResult: mesma saída por evento, com um
 * número fixo de consultas. Todo id pedido aparece no Map.
 */
export async function computeEventTeamResultsBatch(eventIds: number[]) {
  const data = await loadEventTeamData(eventIds);
  const out = new Map<number, ReturnType<typeof computeEventTeamResultFromData<EventConformity>>>();
  for (const id of eventIds) {
    out.set(id, computeEventTeamResultFromData(data.get(id) ?? emptyEventTeamData<EventConformity>()));
  }
  return out;
}

/**
 * Recalcula e regrava os resultados do ciclo (quarterly_results) e os resultados
 * por evento (employee_event_results) de um CICLO, a partir dos eventos com
 * resultsConfirmed=true naquele ciclo (independente de status).
 *
 * É idempotente: limpa o ciclo e reconstrói. Preserva o estado de pagamento
 * já acionado manualmente (aprovado/agendado/pago/bloqueado ou já pago) para não
 * descartar decisões de bônus ao reprocessar quando um novo evento é fechado.
 *
 * Consolida TODOS os colaboradores que participaram de qualquer evento
 * confirmado do ciclo (mesmo sem nota), registrando separadamente:
 *  - eventsCount = eventos COM NOTA (nota 0 legítima conta) — base de Soma/Média;
 *  - participatedEventsCount = eventos PARTICIPADOS no ciclo — base de elegibilidade.
 *
 * Leitura em lote (lib/cycle-data.ts, nº fixo de consultas) + cálculo puro em
 * memória (lib/cycle-compute.ts). Antes eram ~5 consultas por evento + 3 por
 * colaborador (~800 num ciclo de 96 eventos).
 *
 * Usado tanto pelo fechamento manual do ciclo quanto automaticamente quando
 * um evento é fechado/reaberto/liberado, mantendo dashboard, resultados e
 * ranking sempre atualizados.
 */
export async function recomputeCycleResults(cycleId: number, userId: number) {
  // FASE DE LEITURA — tudo antes de escrever, para gravar dentro de uma única
  // transação (rebuild atômico: nunca deixa o ciclo vazio em caso de erro).
  const input = await loadCycleRecomputeInput(cycleId, userId);
  const { eventResultInserts, quarterlyInserts, warnings } = buildCycleResults(input);
  // Todos os IDs do ciclo (confirmados ou não) — limpa employee_event_results
  // por completo no rebuild, senão eventos que ficaram desconfirmados deixariam
  // linhas antigas "fantasma" para trás.
  const allCycleEventIdsUnfiltered = input.allCycleEventIds;

  // FASE DE ESCRITA — rebuild atômico de todo o ciclo. A trava por ciclo
  // serializa recálculos concorrentes (confirmação em lote × calibração):
  // sem ela os dois delete+insert se entrelaçavam.
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${cycleId})`);
    if (allCycleEventIdsUnfiltered.length > 0) {
      await tx.delete(employeeEventResultsTable)
        .where(inArray(employeeEventResultsTable.eventId, allCycleEventIdsUnfiltered));
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

  const allParticipants = await db
    .select({
      employeeId: eventParticipantsTable.employeeId,
      employeeName: employeesTable.name,
      functionName: eventParticipantsTable.functionName,
      confirmed: eventParticipantsTable.confirmed,
      employeeFunction: employeesTable.functionName,
      employmentType: employeesTable.employmentType,
      eligibleForBonus: employeesTable.eligibleForBonus,
      eligibilityStatus: employeesTable.eligibilityStatus,
    })
    .from(eventParticipantsTable)
    .innerJoin(employeesTable, and(eq(eventParticipantsTable.employeeId, employeesTable.id), eq(employeesTable.active, true)))
    .where(eq(eventParticipantsTable.eventId, eventId));
  // Freelancers e funções informativas ("Sup Ceno *") participam do evento mas
  // NUNCA contam para nota (ver lib/participation.ts) — não entram nesta lista
  // de resultado por participante, senão herdariam a nota do time e um badge
  // "Elegível" que não correspondem à realidade (não geram employee_event_results).
  // Participante marcado como INATIVO no evento (confirmed === false) idem —
  // "não participou de fato", não herda nota nem aparece no ranking da prova.
  const participants = allParticipants.filter(p => p.confirmed !== false && participantCountsForScore(p));

  // Evento histórico: não há avaliações reais — a nota final já vem pronta
  // como importedScore. Porém, se o evento tem event_criteria configurados,
  // retornamos a lista de critérios (com scores nulos) para que o frontend
  // possa exibir a tabela e popular "Nota Avaliador" a partir do importedNotes.
  if (event.isHistorical) {
    const score = pgNum(event.importedScore);
    const platoon = getPlatoonByScore(score, platoonRules);

    const [historicalCriteriaRows, historicalCalibrations] = await Promise.all([
      db
        .select({
          criterionId: eventCriteriaTable.criterionId,
          criterionName: criteriaTable.name,
          responsibleAreaLabel: criteriaTable.responsibleAreaLabel,
          originalWeight: criteriaTable.defaultWeight,
          weightOverride: eventCriteriaTable.weightOverride,
          displayOrder: criteriaTable.displayOrder,
          active: eventCriteriaTable.active,
        })
        .from(eventCriteriaTable)
        .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
        .where(eq(eventCriteriaTable.eventId, eventId)),
      db
        .select({
          criterionId: calibrationsTable.criterionId,
          calibratedScore: calibrationsTable.calibratedScore,
          calibrationReason: calibrationsTable.calibrationReason,
        })
        .from(calibrationsTable)
        .where(eq(calibrationsTable.eventId, eventId)),
    ]);

    const calMap = new Map(historicalCalibrations.map(c => [c.criterionId, c]));

    // Mostra TODOS os critérios ativos do evento (mais os já calibrados, mesmo
    // que tenham sido desativados depois). Antes, ao existir qualquer calibração,
    // a lista era reduzida só aos critérios calibrados — o que fazia sumir do
    // detalhe os critérios ainda não calibrados, apesar de terem nota importada.
    const historicalCriteriaDetails = historicalCriteriaRows
      .filter(c => c.active || calMap.has(c.criterionId!))
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map(c => {
        const cal = calMap.get(c.criterionId!);
        const calibratedScore = cal ? pgNum(cal.calibratedScore) : null;
        return {
          criterionId: c.criterionId!,
          criterionName: c.criterionName ?? "",
          responsibleAreaLabel: c.responsibleAreaLabel ?? null,
          weight: parseFloat(c.weightOverride ?? c.originalWeight ?? "1"),
          averageScore: null,
          calibratedScore,
          calibrationReason: cal?.calibrationReason ?? null,
          scoreUsed: calibratedScore,
          criterionTotal: calibratedScore != null
            ? calibratedScore * parseFloat(c.weightOverride ?? c.originalWeight ?? "1")
            : null,
          status: "avaliado" as const,
        };
      });

    res.json({
      eventId,
      eventName: event.name,
      eventStatus: event.status,
      feedbackReleased: event.feedbackReleased,
      isHistorical: true,
      eventScore: score,
      conformity: null,
      conformityPenalty: 0,
      conformityScore: score,
      projectedPlatoon: platoon?.name ?? null,
      projectedPlatoonColor: platoon?.color ?? null,
      projectedBonus: platoon?.bonusValue ?? 0,
      totalCriteria: historicalCriteriaDetails.length,
      evaluatedCriteria: historicalCriteriaDetails.length,
      pendingCriteria: 0,
      isComplete: true,
      hasCalibration: true,
      criteriaDetails: historicalCriteriaDetails,
      participants: participants.map(p => ({
        employeeId: p.employeeId!,
        employeeName: p.employeeName ?? "",
        functionName: p.functionName ?? p.employeeFunction ?? "",
        eligible: (p.eligibleForBonus ?? true) && (p.eligibilityStatus ?? "eligible") === "eligible",
        eventScore: score,
      })),
    });
    return;
  }

  const team = await computeEventTeamResult(eventId);
  const platoon = getPlatoonByScore(team.conformityScore, platoonRules);

  res.json({
    eventId,
    eventName: event.name,
    eventStatus: event.status,
    feedbackReleased: event.feedbackReleased,
    isHistorical: false,
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
  try {
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
        extraBonusValue: quarterlyResultsTable.extraBonusValue,
        eligible: quarterlyResultsTable.eligible,
        eligibilityReason: quarterlyResultsTable.eligibilityReason,
        bonusStatus: quarterlyResultsTable.bonusStatus,
        paymentMethod: quarterlyResultsTable.paymentMethod,
        paymentDueDate: quarterlyResultsTable.paymentDueDate,
        paidAt: quarterlyResultsTable.paidAt,
        paymentNotes: quarterlyResultsTable.paymentNotes,
      })
      .from(quarterlyResultsTable)
      .innerJoin(employeesTable, and(eq(quarterlyResultsTable.employeeId, employeesTable.id), eq(employeesTable.active, true)))
      .where(and(
        eq(quarterlyResultsTable.cycleId, cycle.id),
        eq(employeesTable.employmentType, "casa"),
        exists(
          db.select({ one: sql`1` })
            .from(eventParticipantsTable)
            .innerJoin(eventsTable, eq(eventParticipantsTable.eventId, eventsTable.id))
            .where(and(
              eq(eventParticipantsTable.employeeId, employeesTable.id),
              eq(eventsTable.cycleId, cycle.id),
              // Mesma regra de participantCountsForScore (participation.ts): não
              // exigir "Cenotécnica" como lista-branca — basta a participação não
              // ser informativa ("Sup Ceno *"); freela já foi barrado acima.
              sql`(${eventParticipantsTable.functionName} IS NULL OR ${eventParticipantsTable.functionName} NOT ILIKE 'sup ceno%')`,
            )),
        ),
      ));

    const [results, platoonRuleRows] = await Promise.all([
      query,
      db.select().from(platoonRulesTable),
    ]);

    const platoonByName = new Map(platoonRuleRows.map(p => [p.name, {
      minScore: pgNum(p.minScore),
      maxScore: pgNum(p.maxScore),
    }]));

    const filtered = results
      .filter(r => !employeeId || r.employeeId === parseInt(employeeId as string))
      .filter(r => !platoon || r.platoon === platoon);

    res.json(filtered.map(r => {
      const pRule = r.platoon ? platoonByName.get(r.platoon) : undefined;
      return {
        ...r,
        scoreSum: parseFloat(r.scoreSum),
        grossAverage: parseFloat(r.grossAverage),
        absencePenalty: parseFloat(r.absencePenalty),
        meritPoints: parseFloat(r.meritPoints),
        finalResult: parseFloat(r.finalResult),
        platoonMinScore: pRule?.minScore ?? null,
        platoonMaxScore: pRule?.maxScore ?? null,
        bonusValue: isManager ? parseFloat(r.bonusValue) : 0,
        extraBonusValue: isManager ? parseFloat(r.extraBonusValue) : 0,
        bonusStatus: isManager ? r.bonusStatus : null,
        paymentMethod: isManager ? r.paymentMethod : null,
        paymentDueDate: isManager ? r.paymentDueDate : null,
        paidAt: isManager ? r.paidAt : null,
        paymentNotes: isManager ? r.paymentNotes : null,
        eventBreakdown: [],
      };
    }));
  } catch (err) {
    console.error("[results/quarterly]", err);
    res.status(500).json({ error: "Erro ao carregar resultados consolidados" });
  }
});

router.post("/results/quarterly/close", requireRole("admin", "rh", "diretoria"), async (req, res) => {
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
 * POST /results/quarterly/recompute
 * Recalcula o ciclo atual (mesma lógica de recomputeCycleResults usada no
 * fechamento/reabertura de eventos) SEM fechar o ciclo. Serve como um botão
 * manual de "atualizar agora" para casos em que um dado que afeta o cálculo
 * (ex.: cargo global de um colaborador) mudou fora do fluxo normal de evento
 * e o usuário não quer esperar o próximo fechamento.
 */
router.post("/results/quarterly/recompute", requireRole("admin", "rh"), async (req, res) => {
  const cycle = await getCurrentCycle();
  if (!cycle) { res.status(400).json({ error: "Nenhum ciclo ativo" }); return; }
  const { processed, warnings } = await recomputeCycleResults(cycle.id, req.user!.userId);
  await audit(req.user!.userId, "recompute_cycle", "cycles", cycle.id, null, { totalProcessed: processed });
  res.json({ success: true, cycleId: cycle.id, totalProcessed: processed, warnings, forced: false });
});

/**
 * PATCH /results/quarterly/:id/payment
 * Atualiza status/pagamento do bônus (Caju Saldo Livre).
 */
router.patch("/results/quarterly/:id/payment", requireRole("admin", "rh", "diretoria"), async (req, res) => {
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
    extraBonusValue: parseFloat(updated.extraBonusValue),
  });
});

export default router;
