import { Router } from "express";
import {
  db, quarterlyResultsTable, employeesTable, absencesTable, eventsTable,
  eventParticipantsTable, platoonRulesTable,
} from "@workspace/db";
import { eq, and, sql, ilike, exists } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { getPlatoonByScore, calculateQuarterFinalResult } from "../lib/calculations.js";
import { getCurrentCycle } from "../lib/cycle.js";
import { loadPenaltyLabels } from "./penalty-types.js";
import { computeEventTeamResult } from "./results.js";
import { participantCountsForScore, isInformationalFunction } from "../lib/participation.js";

const router = Router();
router.use(requireAuth);

router.get("/ranking", async (req, res) => {
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
              ilike(eventParticipantsTable.functionName, "cenotecnic%"),
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
      };
    }

    const teamResult = teamResultMap.get(p.eventId!)!;
    const eventScore = teamResult.conformityScore;
    const platoon = getPlatoonByScore(eventScore, platoonRulesMapped);
    return {
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
  const scored = events.filter(e => e.eventScore > 0 && e.countsForScore && e.resultsConfirmed);
  const scoreSum = Math.round(scored.reduce((s, e) => s + e.eventScore, 0) * 100) / 100;
  const grossAverage = scored.length > 0 ? Math.round(scoreSum / scored.length * 100) / 100 : null;

  // Nota Final sempre calculada ao vivo (grossAverage live − penaltyPoints live + meritPoints live)
  // para refletir penalidades adicionadas após o último fechamento/recompute.
  // O snapshot (quarterResult.finalResult) pode estar desatualizado se uma penalidade
  // foi lançada depois do fechamento sem um novo recompute.
  const liveFinalResult = grossAverage !== null
    ? calculateQuarterFinalResult(grossAverage, penaltyPoints - meritPoints, scored.length)
    : (quarterResult ? parseFloat(quarterResult.finalResult as unknown as string) : null);

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
      bonusValue: isManager && quarterResult ? parseFloat(quarterResult.bonusValue as unknown as string) : null,
      eventsCount: events.length,
      scoreSum: grossAverage !== null ? scoreSum : null,
      confirmedEventCount: scored.length,
      isQuarterClosed: !!quarterResult,
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
