import { Router } from "express";
import { db, eventsTable, evaluationsTable, absencesTable, quarterlyResultsTable, employeesTable, platoonRulesTable, eventCriteriaTable, criteriaTable, eventAreaAssignmentsTable, cyclesTable } from "@workspace/db";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { getCurrentCycle } from "../lib/cycle.js";
import { calculateTieredBonus, buildAssignedEvaluatorsByArea, getCriterionEvaluationStatus } from "../lib/calculations.js";

const router = Router();
router.use(requireAuth);

router.get("/dashboard/summary", async (req, res) => {
  const isManager = !!req.user && ["admin", "rh", "diretoria"].includes(req.user.role);
  const cycle = await getCurrentCycle();
  if (!cycle) {
    res.json({
      totalEvents: 0, totalEmployeesEvaluated: 0, pendingEvaluations: 0, submittedEvaluations: 0,
      eventsInCalibration: 0, eventsInCycle: 0, quarterAverage: null, totalBonusPreview: 0, totalAbsences: 0,
      eventsWithPendencies: [], atRiskEmployees: [],
    });
    return;
  }

  const events = await db.select().from(eventsTable).where(eq(eventsTable.cycleId, cycle.id));
  // Fix (1): o KPI de Eventos mostra apenas eventos com resultados confirmados.
  const confirmedEvts = events.filter(e => e.resultsConfirmed);
  const totalEvents = confirmedEvts.length;
  const eventsInCycle = events.length;

  const allEvals = await db.select({
    id: evaluationsTable.id,
    eventId: evaluationsTable.eventId,
    criterionId: evaluationsTable.criterionId,
    evaluatorUserId: evaluationsTable.evaluatorUserId,
    status: evaluationsTable.status,
  }).from(evaluationsTable).where(
    sql`${evaluationsTable.eventId} IN (SELECT id FROM events WHERE cycle_id = ${cycle.id})`
  );

  // Fix (3): Progresso de Avaliações conta EVENTOS com pendências,
  // não linhas individuais de avaliação. Assim 0 rascunhos existentes
  // não infla o percentual para 100% enganosamente.
  const eventsWithDraft = new Set(allEvals.filter(e => e.status === "draft").map(e => e.eventId));
  const eventsWithAnyEval = new Set(allEvals.map(e => e.eventId));
  const pendingEvaluations = eventsWithDraft.size;
  const submittedEvaluations = eventsWithAnyEval.size - eventsWithDraft.size;

  const absences = await db.select().from(absencesTable).where(eq(absencesTable.cycleId, cycle.id));
  const totalAbsences = absences.reduce((s, a) => s + a.quantity, 0);

  const quarterResults = await db.select().from(quarterlyResultsTable).where(eq(quarterlyResultsTable.cycleId, cycle.id));
  const totalEmployeesEvaluated = quarterResults.length;

  // Só entram na média colaboradores com pelo menos 1 evento FECHADO e pontuado
  // (eventsCount > 0) neste ciclo. Quem só participou de eventos ainda abertos
  // tem finalResult=0 "por enquanto" — incluí-los distorceria a média para
  // baixo mesmo quando ninguém de fato tirou nota ruim, então são excluídos
  // até terem alguma nota real registrada.
  const scoredQuarterResults = quarterResults.filter(r => r.eventsCount > 0);
  const quarterAverage = scoredQuarterResults.length > 0
    ? scoredQuarterResults.reduce((s, r) => s + parseFloat(r.finalResult), 0) / scoredQuarterResults.length
    : null;

  // Fix (2): Bônus Projetado — usa o valor do snapshot (bonusValue) quando
  // calculado; para colaboradores ainda inelegíveis (ex.: mínimo de eventos não
  // atingido), calcula uma projeção ao vivo baseada na finalResult atual, sem
  // bônus extra de eventos adicionais. Assim o painel mostra uma estimativa
  // real em vez de R$ 0 durante o ciclo em andamento.
  let totalBonusPreview = 0;
  if (isManager) {
    const platoonRulesRaw = await db.select().from(platoonRulesTable)
      .where(eq(platoonRulesTable.active, true))
      .orderBy(platoonRulesTable.displayOrder);
    const platoonRules = platoonRulesRaw.map(r => ({
      name: r.name, color: r.color,
      minScore: parseFloat(r.minScore as unknown as string),
      maxScore: parseFloat(r.maxScore as unknown as string),
      minInclusive: r.minInclusive, maxInclusive: r.maxInclusive,
      bonusValue: parseFloat(r.bonusValue as unknown as string),
      bonusPerExtraEvent: parseFloat(r.bonusPerExtraEvent as unknown as string),
    }));
    totalBonusPreview = quarterResults.reduce((s, r) => {
      const snapshotBonus = parseFloat(r.bonusValue as unknown as string);
      if (snapshotBonus > 0) return s + snapshotBonus;
      const fr = parseFloat(r.finalResult as unknown as string);
      if (fr > 0) return s + calculateTieredBonus(fr, [], platoonRules);
      return s;
    }, 0);
  }
  const eventsInCalibration = confirmedEvts.length;

  // "Pendente" = critério ativo cujos avaliadores designados para a área
  // ainda não enviaram TODOS a nota (mesma regra de getCriterionEvaluationStatus
  // usada em GET /events) — não o nº de participantes do evento, que não tem
  // relação com quantas avaliações faltam.
  const openEvents = events.filter(e => e.status === "open");
  let eventsWithPendencies: { eventId: number; eventName: string; pendingCount: number }[] = [];
  if (openEvents.length > 0) {
    const openEventIds = openEvents.map(e => e.id);
    const [eventCriteriaRows, areaAssignmentRows] = await Promise.all([
      db.select({ eventId: eventCriteriaTable.eventId, criterionId: eventCriteriaTable.criterionId, active: eventCriteriaTable.active, responsibleAreaId: criteriaTable.responsibleAreaId })
        .from(eventCriteriaTable).leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
        .where(inArray(eventCriteriaTable.eventId, openEventIds)),
      db.select({ eventId: eventAreaAssignmentsTable.eventId, areaId: eventAreaAssignmentsTable.areaId, evaluatorUserId: eventAreaAssignmentsTable.evaluatorUserId })
        .from(eventAreaAssignmentsTable).where(inArray(eventAreaAssignmentsTable.eventId, openEventIds)),
    ]);

    eventsWithPendencies = openEvents.map(ev => {
      const activeCriteria = eventCriteriaRows.filter(c => c.eventId === ev.id && c.active);
      const assignedByArea = buildAssignedEvaluatorsByArea(areaAssignmentRows.filter(a => a.eventId === ev.id));
      const submitted = allEvals.filter(e => e.eventId === ev.id && e.status === "submitted");
      const evaluatedCount = activeCriteria.filter(c => {
        const critEvals = submitted.filter(e => e.criterionId === c.criterionId);
        return getCriterionEvaluationStatus(c.responsibleAreaId, critEvals.map(e => e.evaluatorUserId as number), assignedByArea).isEvaluated;
      }).length;
      return { eventId: ev.id, eventName: ev.name, pendingCount: Math.max(0, activeCriteria.length - evaluatedCount) };
    })
      .filter(e => e.pendingCount > 0)
      .sort((a, b) => b.pendingCount - a.pendingCount)
      .slice(0, 5);
  }

  const atRiskResults = await db
    .select({
      employeeId: quarterlyResultsTable.employeeId,
      employeeName: employeesTable.name,
      finalResult: quarterlyResultsTable.finalResult,
    })
    .from(quarterlyResultsTable)
    .leftJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    .where(and(
      eq(quarterlyResultsTable.cycleId, cycle.id),
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
    totalEvents, totalEmployeesEvaluated, pendingEvaluations, submittedEvaluations,
    eventsInCalibration, eventsInCycle, quarterAverage, totalBonusPreview, totalAbsences,
    eventsWithPendencies, atRiskEmployees,
  });
});

router.get("/dashboard/platoon-distribution", async (_req, res) => {
  const cycle = await getCurrentCycle();
  if (!cycle) { res.json([]); return; }

  const results = await db.select().from(quarterlyResultsTable).where(eq(quarterlyResultsTable.cycleId, cycle.id));
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

router.get("/dashboard/top-employees", async (req, res) => {
  const isManager = !!req.user && ["admin", "rh", "diretoria"].includes(req.user.role);
  const cycle = await getCurrentCycle();
  if (!cycle) { res.json([]); return; }

  const results = await db
    .select({
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
    })
    .from(quarterlyResultsTable)
    .leftJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
    .where(eq(quarterlyResultsTable.cycleId, cycle.id))
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
});

// Evolução real entre ciclos (não só o atual) — mostra até os últimos 8 ciclos
// que já têm algum resultado apurado, do mais antigo para o mais recente.
router.get("/dashboard/quarterly-evolution", async (_req, res) => {
  const cycles = await db.select().from(cyclesTable).orderBy(desc(cyclesTable.id)).limit(8);
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
