import { Router } from "express";
import { db, eventsTable, evaluationsTable, absencesTable, employeeCycleEligibilityTable, quarterlyResultsTable, employeesTable, platoonRulesTable, eventCriteriaTable, criteriaTable, eventAreaAssignmentsTable, cyclesTable } from "@workspace/db";
import { eq, and, sql, inArray, asc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { calculateTieredBonus, buildAssignedEvaluatorsByArea, getCriterionEvaluationStatus } from "../lib/calculations.js";
import { pgNum } from "../lib/pg-num.js";
import { resolveCycleScope, sendScopeError, scopeCycleIds, scopeCycleInfo } from "../lib/cycle-scope.js";
import { isAfterCycleEnd } from "../lib/cycle-rules.js";
import { rankingScope } from "../lib/ranking-scope.js";
import { areaModeEventIds, requiredAssignmentsFor } from "../lib/area-mode.js";
import { isOpenForEvaluation } from "../lib/evaluation-dates.js";
import { totalGeralSummary } from "../lib/total-geral.js";
import { isEventOpenForEvaluation } from "../lib/next-cycle.js";

const router = Router();
router.use(requireAuth);

/**
 * GET /dashboard/summary?cycleId=
 * Vazio = ciclo atual (como sempre); id = aquele ciclo; `all` = Total geral:
 * eventos, média, bônus e penalidades somados de TODOS os ciclos. As
 * pendências operacionais (progresso de avaliações, eventos com pendência e
 * zona de risco) são sempre de UM ciclo: o escolhido ou, no Total geral, o atual.
 */
router.get("/dashboard/summary", async (req, res) => {
  const isManager = !!req.user && ["admin", "rh", "diretoria"].includes(req.user.role);
  const scoped = await resolveCycleScope(req.query.cycleId);
  if (sendScopeError(res, scoped)) return;
  const scope = scoped.scope;
  if (!scope) {
    res.json({
      totalEvents: 0, totalEmployeesEvaluated: 0, pendingEvaluations: 0, submittedEvaluations: 0,
      eventsInCalibration: 0, eventsInCycle: 0, quarterAverage: null, totalBonusPreview: 0, bonusOfficial: 0, bonusProjected: 0, totalAbsences: 0,
      eventsWithPendencies: [], atRiskEmployees: [],
    });
    return;
  }
  const cycleIds = scopeCycleIds(scope);
  const info = scopeCycleInfo(scope);
  // Ciclo das pendências operacionais: o escolhido; no Total geral, o atual.
  const opCycle = scope.kind === "cycle" ? scope.cycle : (scope.cycles.find(c => c.id === scope.currentId) ?? null);
  const opCycleId = opCycle?.id ?? null;

  const storedEvents = await db.select().from(eventsTable).where(inArray(eventsTable.cycleId, cycleIds));
  // Os KPIs contam só os eventos DO PERÍODO de cada ciclo (critério único:
  // data de início; os que começam depois do fim vão para o próximo ciclo).
  const cycleRows = scope.kind === "all" ? scope.cycles : [scope.cycle];
  const cycleOf = new Map(cycleRows.map(c => [c.id, c]));
  const events = storedEvents.filter(e => !isAfterCycleEnd(e, cycleOf.get(e.cycleId)));
  // Fix (1): o KPI de Eventos mostra apenas eventos com resultados confirmados.
  const confirmedEvts = events.filter(e => e.resultsConfirmed);
  const totalEvents = confirmedEvts.length;
  const eventsInCycle = events.length;
  // Pendências operacionais: os eventos guardados no ciclo; os "fora do
  // período" (do próximo ciclo) não aceitam avaliação e ficam de fora abaixo.
  const opEvents = storedEvents.filter(e => e.cycleId === opCycleId);

  const allEvals = opCycleId == null ? [] : await db.select({
    id: evaluationsTable.id,
    eventId: evaluationsTable.eventId,
    criterionId: evaluationsTable.criterionId,
    evaluatorUserId: evaluationsTable.evaluatorUserId,
    status: evaluationsTable.status,
  }).from(evaluationsTable).where(
    sql`${evaluationsTable.eventId} IN (SELECT id FROM events WHERE cycle_id = ${opCycleId})`
  );

  // Critérios ativos e designações por área dos eventos do ciclo operacional:
  // base do "Progresso de avaliações" e de "Eventos com pendência".
  const opEventIds = opEvents.map(e => e.id);
  const [opCriteriaRows, opAreaAssignmentRows, opAreaMode] = opEventIds.length === 0
    ? [[], [], new Set<number>()] as const
    : await Promise.all([
      db.select({ eventId: eventCriteriaTable.eventId, criterionId: eventCriteriaTable.criterionId, active: eventCriteriaTable.active, responsibleAreaId: criteriaTable.responsibleAreaId })
        .from(eventCriteriaTable).leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
        .where(inArray(eventCriteriaTable.eventId, opEventIds)),
      db.select({ eventId: eventAreaAssignmentsTable.eventId, areaId: eventAreaAssignmentsTable.areaId, evaluatorUserId: eventAreaAssignmentsTable.evaluatorUserId })
        .from(eventAreaAssignmentsTable).where(inArray(eventAreaAssignmentsTable.eventId, opEventIds)),
      areaModeEventIds(opEventIds),
    ]);
  /** Critérios ativos do evento e quantos já estão avaliados (mesma regra de GET /events). */
  const criteriaProgress = (ev: { id: number }) => {
    const activeCriteria = opCriteriaRows.filter(c => c.eventId === ev.id && c.active);
    // Avaliação por área (ciclo novo): 1 resposta enviada = critério avaliado;
    // rascunho (inclusive o "órfão" de quem perdeu a vez) nunca conta (B2).
    const assignedByArea = buildAssignedEvaluatorsByArea(requiredAssignmentsFor(opAreaAssignmentRows.filter(a => a.eventId === ev.id), opAreaMode.has(ev.id)));
    const submitted = allEvals.filter(e => e.eventId === ev.id && e.status === "submitted");
    const evaluated = activeCriteria.filter(c => {
      const critEvals = submitted.filter(e => e.criterionId === c.criterionId);
      return getCriterionEvaluationStatus(c.responsibleAreaId, critEvals.map(e => e.evaluatorUserId as number), assignedByArea).isEvaluated;
    }).length;
    return { active: activeCriteria.length, evaluated };
  };

  // Progresso de avaliações, em EVENTOS: entram os eventos ABERTOS PARA
  // AVALIAÇÃO (não históricos, abertos/encerrados, já no dia seguinte ao fim
  // — a liberação é automática) que têm critério a avaliar.
  //  - avaliado = resultado confirmado ou todos os critérios ativos com nota;
  //  - pendente = o resto — inclusive evento SEM NENHUMA nota (antes só
  //    contava quem tinha rascunho: "100% · 0 pendentes" com eventos vazios).
  // Rascunho não define nada: rascunho esquecido em evento confirmado ou
  // órfão (critério já fechado por outra pessoa da área) não é pendência.
  let pendingEvaluations = 0;
  let submittedEvaluations = 0;
  for (const ev of opEvents) {
    if (ev.isHistorical || (ev.status !== "open" && ev.status !== "closed") || !isOpenForEvaluation(ev)) continue;
    // Evento do PRÓXIMO ciclo (fora do período) não está aberto para avaliação
    // e não é pendência deste ciclo (lib/next-cycle.ts).
    if (isAfterCycleEnd(ev, opCycle)) continue;
    if (ev.resultsConfirmed) { submittedEvaluations++; continue; }
    const p = criteriaProgress(ev);
    if (p.active === 0) continue;
    if (p.evaluated >= p.active) submittedEvaluations++;
    // M3 (4ª revisão): pendente só o que está ABERTO pela regra única
    // (isEventOpenForEvaluation) — ciclo fechado não tem nada pendente e
    // evento encerrado (status closed) não conta como pendente.
    else if (isEventOpenForEvaluation(ev, opCycle)) pendingEvaluations++;
  }

  // Quem o admin tirou do ciclo não entra (mesmo recorte de Análises).
  const absences = await db.select().from(absencesTable).where(and(inArray(absencesTable.cycleId, cycleIds),
    sql`NOT EXISTS (SELECT 1 FROM ${employeeCycleEligibilityTable} x WHERE x.employee_id = ${absencesTable.employeeId} AND x.cycle_id = ${absencesTable.cycleId} AND x.excluded)`));
  const totalAbsences = absences.reduce((s, a) => s + a.quantity, 0);

  // M4: o recorte de UM ciclo é o mesmo de Análises e do Ranking
  // (rankingScope: casa, fora de "Sup Ceno", com participação que conta; no
  // ciclo atual só ativos) — média, bônus e pessoas batem com Análises.
  const activeOnlyInCycleId = scope.kind === "cycle" ? (scope.isCurrent ? scope.cycle.id : null) : scope.currentId;
  const quarterResults = (await db.select({ qr: quarterlyResultsTable }).from(quarterlyResultsTable)
    .innerJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    .where(and(inArray(quarterlyResultsTable.cycleId, cycleIds), rankingScope({ activeOnlyInCycleId }))))
    .map(r => r.qr);
  const totalEmployeesEvaluated = quarterResults.length;

  // Só entram na média colaboradores com pelo menos 1 evento FECHADO e pontuado
  // (eventsCount > 0) neste ciclo. Quem só participou de eventos ainda abertos
  // tem finalResult=0 "por enquanto" — incluí-los distorceria a média para
  // baixo mesmo quando ninguém de fato tirou nota ruim, então são excluídos
  // até terem alguma nota real registrada. No Total geral: média de todas as
  // notas finais (uma por pessoa e por ciclo).
  // No Total geral (M3): a MESMA conta de GET /ranking/total — média
  // ponderada pelos eventos com nota de cada pessoa, e bônus oficial (ciclos
  // fechados) × projetado (abertos) separados (lib/total-geral.ts).
  const totalGeral = scope.kind === "all"
    ? totalGeralSummary(
      (await db.select({
        employeeId: quarterlyResultsTable.employeeId, cycleId: quarterlyResultsTable.cycleId, finalResult: quarterlyResultsTable.finalResult,
        eventsCount: quarterlyResultsTable.eventsCount, eligible: quarterlyResultsTable.eligible, bonusValue: quarterlyResultsTable.bonusValue,
      }).from(quarterlyResultsTable)
        .innerJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
        .where(and(inArray(quarterlyResultsTable.cycleId, cycleIds), rankingScope({ activeOnlyInCycleId }))))
        .map(r => ({ ...r, finalResult: pgNum(r.finalResult), bonusValue: pgNum(r.bonusValue) })),
      id => scope.cycles.find(c => c.id === id)?.status === "closed",
    )
    : null;
  const scoredQuarterResults = quarterResults.filter(r => r.eventsCount > 0);
  const quarterAverage = totalGeral
    ? totalGeral.avgFinalResult
    : scoredQuarterResults.length > 0
      ? Math.round(scoredQuarterResults.reduce((s, r) => s + parseFloat(r.finalResult), 0) / scoredQuarterResults.length * 10) / 10
      : null;

  // Fix (2): Bônus Projetado — usa o valor do snapshot (bonusValue) quando
  // calculado; para colaboradores ainda inelegíveis (ex.: mínimo de eventos não
  // atingido), calcula uma projeção ao vivo baseada na finalResult atual, sem
  // bônus extra de eventos adicionais. Assim o painel mostra uma estimativa
  // real em vez de R$ 0 durante o ciclo em andamento. A projeção só vale no
  // ciclo ATUAL; ciclos anteriores somam o bônus gravado.
  let totalBonusPreview = 0;
  let bonusOfficial = 0;
  let bonusProjected = 0;
  if (isManager && totalGeral) {
    bonusOfficial = totalGeral.bonusOfficial;
    bonusProjected = totalGeral.bonusProjected;
    totalBonusPreview = totalGeral.bonusTotal;
  } else if (isManager && scope.kind === "cycle") {
    const platoonRulesRaw = await db.select().from(platoonRulesTable)
      .where(eq(platoonRulesTable.active, true))
      .orderBy(platoonRulesTable.displayOrder);
    const platoonRules = platoonRulesRaw.map(r => ({
      name: r.name, color: r.color,
      minScore: pgNum(r.minScore),
      maxScore: pgNum(r.maxScore),
      minInclusive: r.minInclusive, maxInclusive: r.maxInclusive,
      bonusValue: pgNum(r.bonusValue),
      bonusPerExtraEvent: pgNum(r.bonusPerExtraEvent),
    }));
    totalBonusPreview = quarterResults.reduce((s, r) => {
      if (r.eligible === false) return s;
      const snapshotBonus = pgNum(r.bonusValue);
      if (snapshotBonus > 0) return s + snapshotBonus;
      if (r.cycleId !== scope.currentId) return s;
      const fr = pgNum(r.finalResult);
      if (fr > 0) return s + calculateTieredBonus(fr, [], platoonRules);
      return s;
    }, 0);
    // Um ciclo: fechado = oficial; aberto = projeção.
    if (scope.cycle.status === "closed") bonusOfficial = totalBonusPreview;
    else bonusProjected = totalBonusPreview;
  }
  const eventsInCalibration = confirmedEvts.length;

  // "Pendente" = critério ativo cujos avaliadores designados para a área
  // ainda não enviaram TODOS a nota (mesma regra de getCriterionEvaluationStatus
  // usada em GET /events) — não o nº de participantes do evento, que não tem
  // relação com quantas avaliações faltam.
  // Só os ABERTOS PARA AVALIAÇÃO (regra única, lib/next-cycle.ts): nem evento
  // futuro, nem do próximo ciclo, nem de ciclo fechado.
  const openEvents = opEvents.filter(e => isEventOpenForEvaluation(e, opCycle));
  const eventsWithPendencies = openEvents.map(ev => {
    const p = criteriaProgress(ev);
    return { eventId: ev.id, eventName: ev.name, pendingCount: Math.max(0, p.active - p.evaluated) };
  })
    .filter(e => e.pendingCount > 0)
    .sort((a, b) => b.pendingCount - a.pendingCount)
    .slice(0, 5);

  const atRiskResults = opCycleId == null ? [] : await db
    .select({
      employeeId: quarterlyResultsTable.employeeId,
      employeeName: employeesTable.name,
      finalResult: quarterlyResultsTable.finalResult,
    })
    .from(quarterlyResultsTable)
    .leftJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    .where(and(
      eq(quarterlyResultsTable.cycleId, opCycleId),
      sql`${quarterlyResultsTable.finalResult}::numeric < 50`
    ))
    .orderBy(sql`${quarterlyResultsTable.finalResult}::numeric ASC`)
    .limit(5);

  const atRiskEmployees = atRiskResults.map(r => ({
    employeeId: r.employeeId,
    employeeName: r.employeeName ?? "",
    currentScore: parseFloat(r.finalResult),
  }));

  res.json({
    cycleId: info.id, cycleName: info.name, scope: scope.kind,
    operationalCycleId: opCycleId, operationalCycleName: opCycle?.name ?? null,
    totalEvents, totalEmployeesEvaluated, pendingEvaluations, submittedEvaluations,
    eventsInCalibration, eventsInCycle, quarterAverage, totalBonusPreview, bonusOfficial, bonusProjected, totalAbsences,
    eventsWithPendencies, atRiskEmployees,
  });
});

/** ?cycleId= vazio = atual; id = aquele ciclo; `all` = resultados de todos os ciclos (pessoa × ciclo). */
router.get("/dashboard/platoon-distribution", async (req, res) => {
  const scoped = await resolveCycleScope(req.query.cycleId);
  if (sendScopeError(res, scoped)) return;
  if (!scoped.scope) { res.json([]); return; }

  const results = await db.select().from(quarterlyResultsTable).where(inArray(quarterlyResultsTable.cycleId, scopeCycleIds(scoped.scope)));
  const total = results.length;

  const platoonMap = new Map<string, { name: string; color: string; count: number }>();
  for (const r of results) {
    const key = r.platoon ?? "Sem Faixa";
    if (!platoonMap.has(key)) {
      platoonMap.set(key, { name: key, color: r.platoonColor ?? "#94a3b8", count: 0 });
    }
    platoonMap.get(key)!.count++;
  }

  res.json([...platoonMap.values()].map(p => ({
    platoonName: p.name,
    color: p.color,
    count: p.count,
    percentage: total > 0 ? (p.count / total) * 100 : 0,
  })));
});

/**
 * ?cycleId= vazio = atual; id = aquele ciclo. `all` = uma linha por pessoa:
 * finalResult = média PONDERADA pelos eventos com nota (Σ nota × eventos ÷ Σ eventos),
 * eventsCount = soma, bonusValue = soma do bônus dos ciclos elegíveis e a faixa
 * do ciclo mais recente dela.
 */
router.get("/dashboard/top-employees", async (req, res) => {
  const isManager = !!req.user && ["admin", "rh", "diretoria"].includes(req.user.role);
  const scoped = await resolveCycleScope(req.query.cycleId);
  if (sendScopeError(res, scoped)) return;
  const scope = scoped.scope;
  if (!scope) { res.json([]); return; }

  const select = {
    employeeId: quarterlyResultsTable.employeeId,
    employeeName: employeesTable.name,
    cycleId: quarterlyResultsTable.cycleId,
    eventsCount: quarterlyResultsTable.eventsCount,
    grossAverage: quarterlyResultsTable.grossAverage,
    totalAbsences: quarterlyResultsTable.totalAbsences,
    absencePenalty: quarterlyResultsTable.absencePenalty,
    finalResult: quarterlyResultsTable.finalResult,
    platoon: quarterlyResultsTable.platoon,
    platoonColor: quarterlyResultsTable.platoonColor,
    bonusValue: quarterlyResultsTable.bonusValue,
  };

  // Mesmo recorte do Ranking (rankingScope: casa, fora de "Sup Ceno", com
  // participação que conta; no ciclo atual só ativos) — o pódio do Dashboard
  // não pode mostrar quem o Ranking não mostra.
  if (scope.kind === "cycle") {
    const results = await db
      .select(select)
      .from(quarterlyResultsTable)
      .innerJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
      .where(and(eq(quarterlyResultsTable.cycleId, scope.cycle.id), rankingScope({ activeOnlyInCycleId: scope.isCurrent ? scope.cycle.id : null })))
      .orderBy(sql`${quarterlyResultsTable.finalResult}::numeric DESC`)
      .limit(10);

    res.json(results.map(r => ({
      ...r,
      grossAverage: parseFloat(r.grossAverage),
      absencePenalty: parseFloat(r.absencePenalty),
      finalResult: parseFloat(r.finalResult),
      bonusValue: isManager ? parseFloat(r.bonusValue) : 0,
      eventBreakdown: [],
    })));
    return;
  }

  // Total geral: agrega por pessoa (mais recente primeiro para a faixa).
  const order = new Map(scope.cycles.map((c, i) => [c.id, i]));
  const rows = await db
    .select({ ...select, eligible: quarterlyResultsTable.eligible })
    .from(quarterlyResultsTable)
    .innerJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    .where(and(inArray(quarterlyResultsTable.cycleId, scopeCycleIds(scope)), rankingScope({ activeOnlyInCycleId: scope.currentId })));
  const byPerson = new Map<number, typeof rows>();
  for (const r of rows) {
    const list = byPerson.get(r.employeeId) ?? [];
    list.push(r);
    byPerson.set(r.employeeId, list);
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const people = [...byPerson.entries()].map(([employeeId, list]) => {
    const sorted = [...list].sort((a, b) => (order.get(a.cycleId) ?? 0) - (order.get(b.cycleId) ?? 0));
    const scored = sorted.filter(r => r.eventsCount > 0);
    if (scored.length === 0) return null;
    // Média PONDERADA pelos eventos com nota (mesma conta do Total geral de
    // Resultados): Σ(nota × eventos) ÷ Σ eventos.
    const weightedOf = (pick: (r: (typeof scored)[number]) => number) => {
      const w = scored.reduce((s, r) => s + r.eventsCount, 0);
      return scored.reduce((s, r) => s + pick(r) * r.eventsCount, 0) / w;
    };
    return {
      employeeId,
      employeeName: sorted[0].employeeName ?? "",
      cycleId: sorted[0].cycleId,
      eventsCount: sorted.reduce((s, r) => s + r.eventsCount, 0),
      grossAverage: r2(weightedOf(r => pgNum(r.grossAverage))),
      totalAbsences: sorted.reduce((s, r) => s + r.totalAbsences, 0),
      absencePenalty: r2(sorted.reduce((s, r) => s + pgNum(r.absencePenalty), 0)),
      finalResult: Math.round(weightedOf(r => pgNum(r.finalResult)) * 10) / 10,
      platoon: sorted[0].platoon,
      platoonColor: sorted[0].platoonColor,
      bonusValue: isManager ? r2(sorted.reduce((s, r) => s + (r.eligible ? pgNum(r.bonusValue) : 0), 0)) : 0,
      eventBreakdown: [],
    };
  }).filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => b.finalResult - a.finalResult || a.employeeName.localeCompare(b.employeeName, "pt-BR"))
    .slice(0, 10);
  res.json(people);
});

// Evolução real entre ciclos (não só o atual) — mostra até os últimos 8 ciclos
// que já têm algum resultado apurado, do mais antigo para o mais recente.
// Ordem pela DATA DE INÍCIO do ciclo (não pelo id: ciclo cadastrado depois
// para um período anterior aparecia no fim do gráfico).
router.get("/dashboard/quarterly-evolution", async (_req, res) => {
  const all = await db.select().from(cyclesTable).orderBy(sql`${cyclesTable.startDate} ASC NULLS FIRST`, asc(cyclesTable.id));
  const cycles = all.slice(-8).reverse(); // os 8 mais recentes, do mais novo ao mais antigo
  if (cycles.length === 0) { res.json([]); return; }

  const cycleIds = cycles.map(c => c.id);
  const allResults = await db.select({ cycleId: quarterlyResultsTable.cycleId, finalResult: quarterlyResultsTable.finalResult })
    .from(quarterlyResultsTable)
    .where(inArray(quarterlyResultsTable.cycleId, cycleIds));

  const points = cycles
    .map(c => {
      const results = allResults.filter(r => r.cycleId === c.id);
      if (results.length === 0) return null;
      const average = results.reduce((s, r) => s + parseFloat(r.finalResult), 0) / results.length;
      return { cycleId: c.id, label: c.name, average };
    })
    .filter((p): p is { cycleId: number; label: string; average: number } => p !== null)
    .reverse(); // mais antigo primeiro

  res.json(points);
});

export default router;
