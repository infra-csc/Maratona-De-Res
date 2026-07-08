import { Router } from "express";
import {
  db, quarterlyResultsTable, employeesTable, absencesTable, eventsTable,
  eventParticipantsTable, platoonRulesTable,
} from "@workspace/db";
import { eq, and, sql, ilike, exists } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { getPlatoonByScore } from "../lib/calculations.js";
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
  const isManager = !!req.user && ["admin", "rh", "diretoria"].includes(req.user.role);
  const employeeId = parseInt(req.query.employeeId as string);
  if (!employeeId) { res.status(400).json({ error: "employeeId obrigatório" }); return; }
  const cycle = await getCurrentCycle();
  if (!cycle) { res.status(404).json({ error: "Nenhum ciclo ativo" }); return; }

  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, employeeId)).limit(1);
  if (!employee) { res.status(404).json({ error: "Colaborador não encontrado" }); return; }

  const [quarterResult] = await db.select().from(quarterlyResultsTable)
    .where(and(
      eq(quarterlyResultsTable.employeeId, employeeId),
      eq(quarterlyResultsTable.cycleId, cycle.id),
    )).limit(1);

  const platoonRules = await db.select().from(platoonRulesTable).where(eq(platoonRulesTable.active, true)).orderBy(platoonRulesTable.displayOrder);
  const platoonRulesMapped = platoonRules.map(r => ({
    name: r.name, color: r.color,
    minScore: parseFloat(r.minScore as unknown as string),
    maxScore: parseFloat(r.maxScore as unknown as string),
    minInclusive: r.minInclusive, maxInclusive: r.maxInclusive,
    bonusValue: parseFloat(r.bonusValue as unknown as string),
  }));

  const participations = await db
    .select({
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
    ));

  const events = [];
  for (const p of participations) {
    if (!p.eventId) continue;
    // Freela/função informativa (ex.: "Sup Ceno *"): participação aparece no
    // histórico do colaborador mas não conta para nota — mesma regra do
    // fechamento (recomputeCycleResults, ver lib/participation.ts).
    const countsForScore = participantCountsForScore({ employmentType: employee.employmentType, functionName: p.functionName });
    const noScoreReason: string | null = countsForScore ? null
      : isInformationalFunction(p.functionName) ? "sup_ceno"
      : employee.employmentType === "freela" ? "freela"
      : "outro";

    // Evento histórico: nota já vem pronta (importedScore) de fora, sem
    // critérios/avaliações — não passar pelo cálculo por quesitos.
    if (p.isHistorical) {
      const historicalScore = p.importedScore != null ? parseFloat(p.importedScore as unknown as string) : 0;
      const platoon = getPlatoonByScore(historicalScore, platoonRulesMapped);
      events.push({
        eventId: p.eventId,
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
      });
      continue;
    }

    // Cálculo CANÔNICO — o mesmo usado pelo fechamento do ciclo
    // (recomputeCycleResults): média por critério com calibração
    // substituindo, completude por área designada e penalidade da Matriz
    // de Conformidade aplicada (conformityScore). Garante que o drawer
    // mostre exatamente os mesmos números do ranking/consolidação.
    const teamResult = await computeEventTeamResult(p.eventId);
    const eventScore = teamResult.conformityScore;
    const platoon = getPlatoonByScore(eventScore, platoonRulesMapped);

    events.push({
      eventId: p.eventId,
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
    });
  }
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
  // só eventos FECHADOS, com nota (> 0) e que contam para nota (não freela
  // nem função informativa tipo "Sup Ceno *") entram na base — igual ao
  // eventsCount/grossAverage da consolidação. Eventos abertos ou que não
  // contam para nota aparecem na lista como histórico, mas não entram na média.
  const scored = events.filter(e => e.status === "closed" && e.eventScore > 0 && e.countsForScore && e.resultsConfirmed);
  const grossAverage = scored.length > 0 ? Math.round((scored.reduce((s, e) => s + e.eventScore, 0) / scored.length) * 100) / 100 : null;

  res.json({
    employee: {
      id: employee.id,
      name: employee.name,
      department: employee.department ?? null,
      functionName: employee.functionName ?? null,
    },
    cycle: { id: cycle.id, name: cycle.name },
    summary: {
      finalResult: quarterResult ? parseFloat(quarterResult.finalResult as unknown as string) : null,
      grossAverage,
      penaltyPoints,
      meritPoints,
      platoon: quarterResult?.platoon ?? null,
      platoonColor: quarterResult?.platoonColor ?? null,
      bonusValue: isManager && quarterResult ? parseFloat(quarterResult.bonusValue as unknown as string) : null,
      eventsCount: events.length,
      isQuarterClosed: !!quarterResult,
    },
    events,
    penalties,
    merits,
  });
});

export default router;
