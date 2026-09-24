import { Router } from "express";
import {
  db, quarterlyResultsTable, employeesTable, absencesTable, eventsTable,
  eventParticipantsTable, platoonRulesTable,
} from "@workspace/db";
import { eq, and, sql, exists } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { getPlatoonByScore, calculateQuarterFinalResult } from "../lib/calculations.js";
import { getCurrentCycle, getMinEventsForEligibility } from "../lib/cycle.js";
import { loadPenaltyLabels } from "./penalty-types.js";
import { computeEventTeamResult } from "./results.js";
import { participantCountsForScore, isInformationalFunction } from "../lib/participation.js";

const router = Router();
router.use(requireAuth);

router.get("/ranking", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const { search } = req.query;
  const isManager = !!req.user && ["admin", "rh", "diretoria"].includes(req.user.role);
  const cycle = await getCurrentCycle();
  if (!cycle) { res.json([]); return; }

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
        eq(employeesTable.active, true),
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
    minScore: parseFloat(p.minScore as unknown as string),
    maxScore: parseFloat(p.maxScore as unknown as string),
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
  const cycle = await getCurrentCycle();
  if (!cycle) { res.status(404).json({ error: "Nenhum ciclo ativo" }); return; }

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
      )),
  ]);

  if (!employee) { res.status(404).json({ error: "Colaborador não encontrado" }); return; }

  const platoonRulesMapped = platoonRules.map(r => ({
    name: r.name, color: r.color,
    minScore: parseFloat(r.minScore as unknown as string),
    maxScore: parseFloat(r.maxScore as unknown as string),
    minInclusive: r.minInclusive, maxInclusive: r.maxInclusive,
    bonusValue: parseFloat(r.bonusValue as unknown as string),
    bonusPerExtraEvent: parseFloat((r.bonusPerExtraEvent ?? 0) as unknown as string),
  }));

  const validParticipations = participations.filter(p => p.eventId);

  // Rodar computeEventTeamResult em PARALELO para todos os eventos não-históricos
  // (antes era sequencial — N×5 queries em série travava o pool de conexões).
  const nonHistoricalIds = validParticipations
    .filter(p => !p.isHistorical)
    .map(p => p.eventId!);
  const teamResultsArr = await Promise.all(nonHistoricalIds.map(id => computeEventTeamResult(id)));
  const teamResultMap = new Map(nonHistoricalIds.map((id, i) => [id, teamResultsArr[i]]));

  const events = validParticipations.map(p => {
    const countsForScore = participantCountsForScore({ employmentType: employee.employmentType, functionName: p.functionName, employeeFunction: employee.functionName });
    const noScoreReason: string | null = countsForScore ? null
      : isInformationalFunction(p.functionName) ? "sup_ceno"
      : employee.employmentType === "freela" ? "freela"
      : "outro";

    if (p.isHistorical) {
      const historicalScore = p.importedScore != null ? parseFloat(p.importedScore as unknown as string) : 0;
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
      eventName: eventsTable.name,
    })
    .from(absencesTable)
    .leftJoin(eventsTable, eq(absencesTable.eventId, eventsTable.id))
    .where(and(
      eq(absencesTable.employeeId, employeeId),
      eq(absencesTable.cycleId, cycle.id),
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
  const grossAverage = scored.length > 0 ? Math.round(scoreSum / scored.length * 100) / 100 : null;

  // Nota Final sempre calculada ao vivo (grossAverage live − penaltyPoints live + meritPoints live)
  // para refletir penalidades adicionadas após o último fechamento/recompute.
  // O snapshot (quarterResult.finalResult) pode estar desatualizado se uma penalidade
  // foi lançada depois do fechamento sem um novo recompute.
  const liveFinalResult = grossAverage !== null
    ? calculateQuarterFinalResult(grossAverage, penaltyPoints - meritPoints, scored.length)
    : (quarterResult ? parseFloat(quarterResult.finalResult as unknown as string) : null);

  // Composição do bônus (só gestores — é dado financeiro). Replica a regra de
  // recomputeCycleResults + calculateTieredBonus para mostrar a conta inteira:
  // prêmio base pela faixa da nota final + extra por evento pontuado além do
  // mínimo de elegibilidade (em ordem de data), cada extra pago pelo valor por
  // evento adicional da faixa da NOTA MÉDIA. A base usa a nota final gravada no ciclo (a mesma que
  // gerou o bônus gravado); se o valor ao vivo divergir do gravado, o front
  // avisa para recalcular o ciclo.
  let bonusBreakdown: Record<string, unknown> | undefined;
  if (isManager) {
    const minEvents = await getMinEventsForEligibility();
    const scoredByDate = scored
      .filter(e => !!e.startDate)
      .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
    const baseScore = quarterResult ? parseFloat(quarterResult.finalResult as unknown as string) : liveFinalResult;
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
      storedTotal: quarterResult ? parseFloat(quarterResult.bonusValue as unknown as string) : null,
      storedExtra: quarterResult ? parseFloat(quarterResult.extraBonusValue as unknown as string) : null,
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
      bonusValue: isManager && quarterResult ? parseFloat(quarterResult.bonusValue as unknown as string) : null,
      eventsCount: events.length,
      scoreSum: grossAverage !== null ? scoreSum : null,
      confirmedEventCount: scored.length,
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
