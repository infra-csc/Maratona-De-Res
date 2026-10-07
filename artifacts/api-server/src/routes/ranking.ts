import { Router } from "express";
import {
  db, quarterlyResultsTable, employeesTable, absencesTable, eventsTable,
  eventParticipantsTable, platoonRulesTable, employeeCycleEligibilityTable, cyclesTable,
} from "@workspace/db";
import { eq, and, sql, exists, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { getPlatoonByScore, calculateQuarterFinalResult, roundFinalResult } from "../lib/calculations.js";
import { getCurrentCycleId, getMinEventsForEligibility, getMinEventsByCycle, eventWithinItsCycleSql } from "../lib/cycle.js";
import { resolveCycleScope, sendScopeError } from "../lib/cycle-scope.js";
import { rankingScope } from "../lib/ranking-scope.js";
import { loadPenaltyLabels } from "./penalty-types.js";
import { computeEventTeamResultsBatch } from "./results.js";
import { participantCountsForScore, isInformationalFunction } from "../lib/participation.js";
import { pgNum } from "../lib/pg-num.js";
import { totalGeralByPerson, totalGeralSummary } from "../lib/total-geral.js";

const router = Router();
router.use(requireAuth);

router.get("/ranking", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const { search } = req.query;
  const isManager = !!req.user && ["admin", "rh", "diretoria"].includes(req.user.role);
  // ?cycleId= vazio = ciclo atual; id = aquele ciclo (anterior: só consulta).
  const scoped = await resolveCycleScope(req.query.cycleId, { allowAll: false });
  if (sendScopeError(res, scoped)) return;
  if (!scoped.scope || scoped.scope.kind !== "cycle") { res.json([]); return; }
  const { cycle, isCurrent } = scoped.scope;

  const [results, platoonRuleRows] = await Promise.all([
    db
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
      .where(and(
        eq(quarterlyResultsTable.cycleId, cycle.id),
        eq(employeesTable.employmentType, "casa"),
        // Ciclo atual: só ativos. Anterior: o histórico mantém quem saiu depois.
        isCurrent ? eq(employeesTable.active, true) : undefined,
        // O cargo GLOBAL cadastrado é a fonte da verdade (mesma regra de
        // participantCountsForScore): se o colaborador está hoje classificado
        // como "Sup Ceno *" (participação informativa), ele nunca deve
        // aparecer no ranking, mesmo que algum evento antigo tenha ficado
        // com functionName "Cenotécnica" gravado antes da mudança de cargo.
        sql`(${employeesTable.functionName} IS NULL OR ${employeesTable.functionName} NOT ILIKE 'sup ceno%')`,
        exists(
          db.select({ one: sql`1` })
            .from(eventParticipantsTable)
            .innerJoin(eventsTable, eq(eventParticipantsTable.eventId, eventsTable.id))
            .where(and(
              eq(eventParticipantsTable.employeeId, employeesTable.id),
              eq(eventsTable.cycleId, cycle.id),
              // Qualquer participação que conta para nota (mesma regra de
              // participantCountsForScore/participation.ts): freela já foi barrado
              // pelo employmentType e "Sup Ceno *" pelo cargo global; aqui basta
              // que a participação não seja informativa. NÃO exigir "Cenotécnica"
              // como lista-branca — Montador, Motorista, Assistente etc. também
              // contam para nota e devem entrar no ranking.
              sql`(${eventParticipantsTable.functionName} IS NULL OR ${eventParticipantsTable.functionName} NOT ILIKE 'sup ceno%')`,
            )),
        ),
      ))
      .orderBy(sql`${quarterlyResultsTable.finalResult} DESC`),
    db.select().from(platoonRulesTable),
  ]);

  const platoonByName = new Map(platoonRuleRows.map(p => [p.name, {
    minScore: pgNum(p.minScore),
    maxScore: pgNum(p.maxScore),
  }]));

  let filtered = results;
  if (search) {
    const s = (search as string).toLowerCase();
    filtered = results.filter(r => (r.employeeName ?? "").toLowerCase().includes(s));
  }

  res.json(filtered.map((r, i) => {
    const pRule = r.platoon ? platoonByName.get(r.platoon) : undefined;
    return {
      position: i + 1,
      employeeId: r.employeeId,
      employeeName: r.employeeName ?? "",
      finalResult: parseFloat(r.finalResult),
      platoon: r.platoon,
      platoonColor: r.platoonColor,
      platoonMinScore: pRule?.minScore ?? null,
      platoonMaxScore: pRule?.maxScore ?? null,
      bonusValue: isManager ? parseFloat(r.bonusValue) : 0,
      eligible: r.eligible,
      eventsCount: r.eventsCount,
      participatedEventsCount: r.participatedEventsCount,
      absences: r.totalAbsences,
    };
  }));
});

/**
 * GET /ranking/total — "Total geral" de Resultados & Ranking: uma linha por
 * pessoa somando TODOS os ciclos (snapshot de quarterly_results de cada um).
 *  - cyclesWithScore = ciclos em que teve evento com nota;
 *  - avgFinalResult  = MÉDIA PONDERADA PELOS EVENTOS (regra do dono, 06/10):
 *                      Σ(nota final do ciclo × eventos com nota) ÷ Σ eventos
 *                      com nota — um ciclo com 12 eventos pesa mais que um de 3;
 *  - eventsCount     = soma dos eventos com nota; participatedEventsCount idem;
 *  - bonusOfficial   = bônus dos ciclos FECHADOS em que foi elegível (oficial);
 *  - bonusProjected  = bônus do ciclo ATUAL ainda aberto (projeção, muda até
 *                      o fechamento);
 *  - bonusTotal      = bonusOfficial + bonusProjected (compatibilidade);
 *  - bonusPaid       = soma do bônus marcado como pago;
 *  - minEvents (por ciclo, em cycles[]) = o mínimo que vale em cada ciclo;
 *  - latest          = faixa/nota do ciclo MAIS RECENTE dele (não existe faixa
 *                      "do total": cada ciclo tem a sua).
 * Mesmo recorte do Ranking em cada ciclo (rankingScope): no atual só ativos;
 * nos anteriores o histórico mantém quem saiu depois. Somente leitura.
 */
router.get("/ranking/total", requireRole("admin", "rh", "diretoria"), async (_req, res) => {
  const [cycles, currentId] = await Promise.all([
    db.select().from(cyclesTable).orderBy(desc(cyclesTable.isCurrent), sql`${cyclesTable.startDate} DESC NULLS LAST`, desc(cyclesTable.id)),
    getCurrentCycleId(),
  ]);
  if (cycles.length === 0) { res.json({ cycles: [], rows: [], summary: totalGeralSummary([], () => false) }); return; }
  const order = new Map(cycles.map((c, i) => [c.id, i])); // 0 = mais recente
  const cycleById = new Map(cycles.map(c => [c.id, c]));

  const minByCycle = await getMinEventsByCycle(cycles.map(c => c.id));
  // Bônus oficial = ciclo fechado. O ciclo aberto (o atual, ou um anterior que
  // ficou aberto) é projeção.
  const isOfficial = (cycleId: number) => cycleById.get(cycleId)?.status === "closed";

  const results = await db.select({
    employeeId: quarterlyResultsTable.employeeId,
    employeeName: employeesTable.name,
    employeeActive: employeesTable.active,
    cycleId: quarterlyResultsTable.cycleId,
    finalResult: quarterlyResultsTable.finalResult,
    platoon: quarterlyResultsTable.platoon,
    platoonColor: quarterlyResultsTable.platoonColor,
    bonusValue: quarterlyResultsTable.bonusValue,
    eligible: quarterlyResultsTable.eligible,
    bonusStatus: quarterlyResultsTable.bonusStatus,
    eventsCount: quarterlyResultsTable.eventsCount,
    participatedEventsCount: quarterlyResultsTable.participatedEventsCount,
    totalAbsences: quarterlyResultsTable.totalAbsences,
  }).from(quarterlyResultsTable)
    .innerJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    .where(rankingScope({ activeOnlyInCycleId: currentId }));

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const byPerson = new Map<number, typeof results>();
  for (const r of results) {
    if (!cycleById.has(r.cycleId)) continue;
    const list = byPerson.get(r.employeeId) ?? [];
    list.push(r);
    byPerson.set(r.employeeId, list);
  }

  // Média ponderada e bônus oficial × projetado: a MESMA função do Dashboard
  // e de Análises (lib/total-geral.ts).
  const totalRows = [...byPerson.values()].flat().map(r => ({ employeeId: r.employeeId, cycleId: r.cycleId, finalResult: pgNum(r.finalResult), eventsCount: r.eventsCount, eligible: r.eligible, bonusValue: pgNum(r.bonusValue) }));
  const totals = totalGeralByPerson(totalRows, isOfficial);
  const rows = [...byPerson.entries()].map(([employeeId, list]) => {
    const sorted = [...list].sort((a, b) => (order.get(a.cycleId) ?? 0) - (order.get(b.cycleId) ?? 0));
    const scored = sorted.filter(r => r.eventsCount > 0);
    const latest = sorted[0];
    const { avgFinalResult, bonusOfficial, bonusProjected } = totals.get(employeeId)!;
    return {
      employeeId,
      employeeName: latest.employeeName ?? `Colaborador #${employeeId}`,
      employeeActive: latest.employeeActive,
      cyclesCount: sorted.length,
      cyclesWithScore: scored.length,
      avgFinalResult,
      eventsCount: sorted.reduce((s, r) => s + r.eventsCount, 0),
      participatedEventsCount: sorted.reduce((s, r) => s + r.participatedEventsCount, 0),
      totalAbsences: sorted.reduce((s, r) => s + r.totalAbsences, 0),
      eligibleCycles: sorted.filter(r => r.eligible).length,
      bonusOfficial,
      bonusProjected,
      bonusTotal: r2(bonusOfficial + bonusProjected),
      bonusPaid: r2(sorted.reduce((s, r) => s + (r.bonusStatus === "paid" ? pgNum(r.bonusValue) : 0), 0)),
      latest: {
        cycleId: latest.cycleId,
        cycleName: cycleById.get(latest.cycleId)!.name,
        finalResult: pgNum(latest.finalResult),
        platoon: latest.platoon,
        platoonColor: latest.platoonColor,
      },
      cycles: sorted.map(r => {
        const c = cycleById.get(r.cycleId)!;
        return {
          cycleId: r.cycleId,
          cycleName: c.name,
          cycleStatus: c.status,
          isCurrent: r.cycleId === currentId,
          finalResult: pgNum(r.finalResult),
          platoon: r.platoon,
          platoonColor: r.platoonColor,
          eventsCount: r.eventsCount,
          participatedEventsCount: r.participatedEventsCount,
          eligible: r.eligible,
          bonusValue: r.eligible ? pgNum(r.bonusValue) : 0,
          bonusStatus: r.bonusStatus,
          official: isOfficial(r.cycleId),
        };
      }),
    };
  }).sort((a, b) =>
    (b.avgFinalResult ?? -1) - (a.avgFinalResult ?? -1)
    || b.cyclesWithScore - a.cyclesWithScore
    || a.employeeName.localeCompare(b.employeeName, "pt-BR"),
  ).map((r, i) => ({ position: i + 1, ...r }));

  res.json({
    cycles: cycles.map(c => ({ id: c.id, name: c.name, status: c.status, isCurrent: c.id === currentId, minEvents: minByCycle.get(c.id) ?? null })),
    rows,
    // KPI do Total geral: o MESMO número de Dashboard e Análises (D4).
    summary: totalGeralSummary(totalRows, isOfficial),
  });
});

/**
 * Detalhe do colaborador no ranking (drill-down).
 * Mostra como foi nas provas (nota do time por evento) + penalidades + méritos.
 * Disponível para todos os papéis autenticados; o valor do bônus (dado financeiro)
 * só é retornado para gestores (admin/rh/diretoria).
 */
router.get("/ranking-detail", async (req, res) => {
  try {
  const isManager = !!req.user && ["admin", "rh", "diretoria"].includes(req.user.role);
  const employeeId = parseInt(req.query.employeeId as string);
  if (!employeeId) { res.status(400).json({ error: "employeeId obrigatório" }); return; }
  // Não gestor só pode abrir o próprio detalhamento (IDOR).
  if (!isManager && req.user?.employeeId !== employeeId) {
    res.status(403).json({ error: "Acesso negado" }); return;
  }
  // ?cycleId= vazio = ciclo atual; id = o detalhe daquele ciclo (só consulta).
  const scoped = await resolveCycleScope(req.query.cycleId, { allowAll: false });
  if (sendScopeError(res, scoped)) return;
  if (!scoped.scope || scoped.scope.kind !== "cycle") { res.status(404).json({ error: "Nenhum ciclo ativo" }); return; }
  const { cycle } = scoped.scope;

  const [[employee], [quarterResult], platoonRules, participations] = await Promise.all([
    db.select().from(employeesTable).where(eq(employeesTable.id, employeeId)).limit(1),
    db.select().from(quarterlyResultsTable)
      .where(and(
        eq(quarterlyResultsTable.employeeId, employeeId),
        eq(quarterlyResultsTable.cycleId, cycle.id),
      )).limit(1),
    db.select().from(platoonRulesTable).where(eq(platoonRulesTable.active, true)).orderBy(platoonRulesTable.displayOrder),
    db.select({
        eventId: eventParticipantsTable.eventId,
        eventName: eventsTable.name,
        eventCity: eventsTable.city,
        eventState: eventsTable.state,
        eventStatus: eventsTable.status,
        startDate: eventsTable.startDate,
        isHistorical: eventsTable.isHistorical,
        importedScore: eventsTable.importedScore,
        functionName: eventParticipantsTable.functionName,
        resultsConfirmed: eventsTable.resultsConfirmed,
        participationConfirmed: eventParticipantsTable.confirmed,
      })
      .from(eventParticipantsTable)
      .leftJoin(eventsTable, eq(eventParticipantsTable.eventId, eventsTable.id))
      .where(and(
        eq(eventParticipantsTable.employeeId, employeeId),
        eq(eventsTable.cycleId, cycle.id),
        // "Fora do período" (começa depois do fim do ciclo) não é deste ciclo.
        eventWithinItsCycleSql(),
      )),
  ]);

  if (!employee) { res.status(404).json({ error: "Colaborador não encontrado" }); return; }
  // Fora do ciclo (o admin tirou): não tem análise neste ciclo.
  const [cycleSituation] = await db.select({ excluded: employeeCycleEligibilityTable.excluded }).from(employeeCycleEligibilityTable)
    .where(and(eq(employeeCycleEligibilityTable.employeeId, employeeId), eq(employeeCycleEligibilityTable.cycleId, cycle.id))).limit(1);
  if (cycleSituation?.excluded) { res.status(404).json({ error: "Colaborador fora deste ciclo" }); return; }

  const platoonRulesMapped = platoonRules.map(r => ({
    name: r.name, color: r.color,
    minScore: pgNum(r.minScore),
    maxScore: pgNum(r.maxScore),
    minInclusive: r.minInclusive, maxInclusive: r.maxInclusive,
    bonusValue: pgNum(r.bonusValue),
    bonusPerExtraEvent: pgNum((r.bonusPerExtraEvent ?? 0)),
  }));

  const validParticipations = participations.filter(p => p.eventId);

  // Nota do time de todos os eventos não-históricos EM LOTE: 5 consultas no
  // total (antes eram 5 por evento, disparadas em paralelo — um colaborador com
  // ~30 eventos ocupava o pool inteiro). Mesma saída de computeEventTeamResult.
  const nonHistoricalIds = validParticipations
    .filter(p => !p.isHistorical)
    .map(p => p.eventId!);
  const teamResultMap = await computeEventTeamResultsBatch(nonHistoricalIds);

  const events = validParticipations.map(p => {
    const countsForScore = participantCountsForScore({ employmentType: employee.employmentType, functionName: p.functionName, employeeFunction: employee.functionName });
    const noScoreReason: string | null = countsForScore ? null
      : isInformationalFunction(p.functionName) ? "sup_ceno"
      : employee.employmentType === "freela" ? "freela"
      : "outro";

    if (p.isHistorical) {
      const historicalScore = p.importedScore != null ? pgNum(p.importedScore) : 0;
      const platoon = getPlatoonByScore(historicalScore, platoonRulesMapped);
      return {
        hasScore: p.importedScore != null,
        eventId: p.eventId!,
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
        countsForScore,
        noScoreReason,
        participationFunction: p.functionName ?? null,
        resultsConfirmed: p.resultsConfirmed ?? false,
        participationConfirmed: p.participationConfirmed,
      };
    }

    const teamResult = teamResultMap.get(p.eventId!)!;
    const eventScore = teamResult.conformityScore;
    const hasScore = teamResult.criteriaDetails.some(cd => cd.scoreUsed != null);
    const platoon = hasScore ? getPlatoonByScore(eventScore, platoonRulesMapped) : null;
    return {
      hasScore,
      eventId: p.eventId!,
      eventName: p.eventName ?? "",
      city: p.eventCity ?? null,
      state: p.eventState ?? null,
      startDate: p.startDate ?? null,
      status: p.eventStatus ?? null,
      eventScore,
      platoon: platoon?.name ?? null,
      platoonColor: platoon?.color ?? null,
      evaluatedCriteria: teamResult.evaluatedCriteria,
      totalCriteria: teamResult.totalCriteria,
      isHistorical: false,
      countsForScore,
      noScoreReason,
      participationFunction: p.functionName ?? null,
      resultsConfirmed: p.resultsConfirmed ?? false,
      participationConfirmed: p.participationConfirmed,
    };
  });
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
      eventId: absencesTable.eventId,
      eventName: eventsTable.name,
    })
    .from(absencesTable)
    .leftJoin(eventsTable, eq(absencesTable.eventId, eventsTable.id))
    .where(and(
      eq(absencesTable.employeeId, employeeId),
      eq(absencesTable.cycleId, cycle.id),
      // Falta de evento "fora do período" vai com o evento para o ciclo novo.
      eventWithinItsCycleSql(),
    ));

  const penaltyLabels = await loadPenaltyLabels();
  const label = (t: string) => penaltyLabels.get(t) ?? t;
  const mapRow = (a: typeof absenceRows[number]) => ({
    id: a.id,
    type: a.penaltyType,
    label: label(a.penaltyType),
    points: a.points,
    quantity: a.quantity,
    total: a.points * a.quantity,
    date: a.date,
    reason: a.reason ?? null,
    eventId: a.eventId ?? null,
    eventName: a.eventName ?? null,
  });

  const penalties = absenceRows.filter(a => a.kind !== "merit").map(mapRow);
  const merits = absenceRows.filter(a => a.kind === "merit").map(mapRow);
  const penaltyPoints = penalties.reduce((s, p) => s + p.total, 0);
  const meritPoints = merits.reduce((s, m) => s + m.total, 0);
  // Média bruta ALINHADA ao snapshot oficial (recomputeCycleResults):
  // eventos confirmados (resultsConfirmed=true) com nota > 0 que contam para
  // nota (não freela nem "Sup Ceno *") entram na base — independente de status.
  // Alguns eventos ficam "open" mas são confirmados pelo responsável antes do
  // fechamento formal; o flag resultsConfirmed é o gate definitivo.
  // Alinhado ao recomputeCycleResults: participante marcado como ausente
  // (confirmed === false) não conta para nota — mesma regra dos dois lados.
  const scored = events.filter(e => e.hasScore && e.countsForScore && e.resultsConfirmed && e.participationConfirmed !== false);
  const scoreSum = Math.round(scored.reduce((s, e) => s + e.eventScore, 0) * 100) / 100;
  // Média real (para a nota final) e média exibida (1 casa, arredondada uma vez).
  const rawAverage = scored.length > 0 ? scored.reduce((s, e) => s + e.eventScore, 0) / scored.length : null;
  const grossAverage = rawAverage !== null ? roundFinalResult(rawAverage) : null;

  // Nota Final sempre calculada ao vivo (grossAverage live − penaltyPoints live + meritPoints live)
  // para refletir penalidades adicionadas após o último fechamento/recompute.
  // O snapshot (quarterResult.finalResult) pode estar desatualizado se uma penalidade
  // foi lançada depois do fechamento sem um novo recompute.
  // Ciclo FECHADO: vale o resultado oficial gravado no fechamento (só consulta).
  const liveFinalResult = cycle.status === "closed" && quarterResult
    ? pgNum(quarterResult.finalResult)
    : rawAverage !== null
      ? calculateQuarterFinalResult(rawAverage, penaltyPoints - meritPoints, scored.length)
      : (quarterResult ? pgNum(quarterResult.finalResult) : null);

  // Composição do bônus (só gestores — é dado financeiro). Replica a regra de
  // recomputeCycleResults + calculateTieredBonus para mostrar a conta inteira:
  // prêmio base pela faixa da nota final + extra por evento pontuado além do
  // mínimo de elegibilidade (em ordem de data), cada extra pago pelo valor por
  // evento adicional da faixa da NOTA MÉDIA. A base usa a nota final gravada no ciclo (a mesma que
  // gerou o bônus gravado); se o valor ao vivo divergir do gravado, o front
  // avisa para recalcular o ciclo.
  let bonusBreakdown: Record<string, unknown> | undefined;
  if (isManager) {
    const minEvents = await getMinEventsForEligibility(cycle.id);
    const scoredByDate = scored
      .filter(e => !!e.startDate)
      .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
    const baseScore = quarterResult ? pgNum(quarterResult.finalResult) : liveFinalResult;
    const basePlatoon = baseScore != null ? getPlatoonByScore(baseScore, platoonRulesMapped) : null;
    const perExtraValue = basePlatoon?.bonusPerExtraEvent ?? 0;
    const extraEvents = scoredByDate.slice(minEvents).map((e, i) => {
      const p = getPlatoonByScore(e.eventScore, platoonRulesMapped);
      return {
        position: minEvents + i + 1,
        eventId: e.eventId,
        eventName: e.eventName,
        startDate: e.startDate ?? null,
        eventScore: e.eventScore,
        platoon: p?.name ?? null,
        platoonColor: p?.color ?? null,
        value: perExtraValue,
      };
    });
    const baseValue = basePlatoon?.bonusValue ?? 0;
    const extraValue = Math.round(extraEvents.reduce((s, e) => s + e.value, 0) * 100) / 100;
    const zeroReason = !quarterResult ? "no_result"
      : !quarterResult.eligible ? "not_eligible"
      : !basePlatoon || basePlatoon.bonusValue <= 0 ? "no_bonus_platoon"
      : null;
    const applied = zeroReason === null;
    bonusBreakdown = {
      minEvents,
      scoredEventsCount: scoredByDate.length,
      baseScore,
      basePlatoon: basePlatoon?.name ?? null,
      basePlatoonColor: basePlatoon?.color ?? null,
      basePlatoonMinScore: basePlatoon?.minScore ?? null,
      basePlatoonMaxScore: basePlatoon?.maxScore ?? null,
      baseValue,
      extraValue,
      totalValue: applied ? Math.round((baseValue + extraValue) * 100) / 100 : 0,
      applied,
      zeroReason,
      eligible: quarterResult ? quarterResult.eligible : null,
      eligibilityReason: quarterResult?.eligibilityReason ?? null,
      storedTotal: quarterResult ? pgNum(quarterResult.bonusValue) : null,
      storedExtra: quarterResult ? pgNum(quarterResult.extraBonusValue) : null,
      bonusStatus: quarterResult?.bonusStatus ?? null,
      paymentMethod: quarterResult?.paymentMethod ?? null,
      paymentDueDate: quarterResult?.paymentDueDate ? String(quarterResult.paymentDueDate) : null,
      paidAt: quarterResult?.paidAt ? new Date(quarterResult.paidAt).toISOString() : null,
      extraEvents,
    };
  }

  res.json({
    employee: {
      id: employee.id,
      name: employee.name,
      department: employee.department ?? null,
      functionName: employee.functionName ?? null,
    },
    cycle: { id: cycle.id, name: cycle.name },
    summary: {
      finalResult: liveFinalResult,
      grossAverage,
      penaltyPoints,
      meritPoints,
      platoon: quarterResult?.platoon ?? null,
      platoonColor: quarterResult?.platoonColor ?? null,
      platoonMinScore: quarterResult?.platoon ? (platoonRulesMapped.find(r => r.name === quarterResult.platoon)?.minScore ?? null) : null,
      platoonMaxScore: quarterResult?.platoon ? (platoonRulesMapped.find(r => r.name === quarterResult.platoon)?.maxScore ?? null) : null,
      bonusValue: isManager && quarterResult ? pgNum(quarterResult.bonusValue) : null,
      eventsCount: events.length,
      scoreSum: grossAverage !== null ? scoreSum : null,
      confirmedEventCount: scored.length,
      // Base da elegibilidade (eventos confirmados de que participou, com ou sem nota).
      participatedEventsCount: quarterResult?.participatedEventsCount ?? null,
      isQuarterClosed: !!quarterResult,
      ...(bonusBreakdown ? { bonusBreakdown } : {}),
    },
    events,
    penalties,
    merits,
  });
  } catch (err) {
    console.error("[ranking-detail] erro:", err);
    res.status(500).json({ error: "Erro ao carregar detalhamento" });
  }
});

export default router;
