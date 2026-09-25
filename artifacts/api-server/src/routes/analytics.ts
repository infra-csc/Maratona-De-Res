import { Router } from "express";
import {
  db, eventsTable, employeeEventResultsTable, quarterlyResultsTable, employeesTable, platoonRulesTable,
  evaluationsTable, calibrationsTable, eventCriteriaTable, criteriaTable, areasTable, eventConformitiesTable,
  absencesTable, usersTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { getCurrentCycle, getMinEventsForEligibility } from "../lib/cycle.js";
import { computeAnalytics } from "../lib/analytics.js";
import { loadPenaltyLabels } from "./penalty-types.js";
import { rankingScope } from "../lib/ranking-scope.js";
import { buildEventsReport } from "../lib/events-report.js";

const router = Router();
router.use(requireAuth);

const num = (v: unknown) => (v == null ? 0 : Number(v));

/**
 * GET /analytics/overview
 * Indicadores do ciclo atual para a tela de Análises (gestores: tem bônus).
 * Leitura em lote (uma consulta por tabela) e agregação em computeAnalytics.
 */
router.get("/analytics/overview", requireRole("admin", "rh", "diretoria"), async (_req, res) => {
  const cycle = await getCurrentCycle();
  if (!cycle) { res.status(404).json({ error: "Nenhum ciclo ativo" }); return; }

  const events = await db.select({
    id: eventsTable.id, name: eventsTable.name, clientName: eventsTable.clientName,
    startDate: eventsTable.startDate, endDate: eventsTable.endDate,
    resultsConfirmed: eventsTable.resultsConfirmed, isHistorical: eventsTable.isHistorical,
  }).from(eventsTable).where(eq(eventsTable.cycleId, cycle.id));
  const ids = events.map(e => e.id);
  const inCycle = <T>(rows: Promise<T[]>) => (ids.length > 0 ? rows : Promise.resolve([] as T[]));

  const [official, quarterly, rules, minEvents, evals, cals, ecs, confs, absences, labels, catalog] = await Promise.all([
    inCycle(db.select({ eventId: employeeEventResultsTable.eventId, score: employeeEventResultsTable.finalEventScore })
      .from(employeeEventResultsTable).where(inArray(employeeEventResultsTable.eventId, ids))),
    db.select({
      employeeId: quarterlyResultsTable.employeeId, employeeName: employeesTable.name,
      finalResult: quarterlyResultsTable.finalResult, platoon: quarterlyResultsTable.platoon,
      bonusValue: quarterlyResultsTable.bonusValue, eligible: quarterlyResultsTable.eligible,
      eventsCount: quarterlyResultsTable.eventsCount, participatedEventsCount: quarterlyResultsTable.participatedEventsCount,
    }).from(quarterlyResultsTable)
      .innerJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
      // Mesmo recorte do Ranking (casa, fora de Sup Ceno, ativos, com participação que conta).
      .where(and(eq(quarterlyResultsTable.cycleId, cycle.id), rankingScope({ activeOnlyInCycleId: cycle.id }))),
    db.select().from(platoonRulesTable).where(eq(platoonRulesTable.active, true)),
    getMinEventsForEligibility(),
    inCycle(db.select({
      eventId: evaluationsTable.eventId, criterionId: evaluationsTable.criterionId,
      evaluatorUserId: evaluationsTable.evaluatorUserId, evaluatorName: usersTable.name,
      score: evaluationsTable.score, status: evaluationsTable.status, submittedAt: evaluationsTable.submittedAt,
    }).from(evaluationsTable)
      .leftJoin(usersTable, eq(evaluationsTable.evaluatorUserId, usersTable.id))
      .where(inArray(evaluationsTable.eventId, ids))),
    inCycle(db.select({ eventId: calibrationsTable.eventId, criterionId: calibrationsTable.criterionId, calibratedScore: calibrationsTable.calibratedScore })
      .from(calibrationsTable).where(inArray(calibrationsTable.eventId, ids))),
    inCycle(db.select({
      eventId: eventCriteriaTable.eventId, criterionId: eventCriteriaTable.criterionId, active: eventCriteriaTable.active,
      weightOverride: eventCriteriaTable.weightOverride, defaultWeight: criteriaTable.defaultWeight,
      name: criteriaTable.name, areaLabel: criteriaTable.responsibleAreaLabel, areaName: areasTable.name,
    }).from(eventCriteriaTable)
      .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
      .leftJoin(areasTable, eq(criteriaTable.responsibleAreaId, areasTable.id))
      .where(inArray(eventCriteriaTable.eventId, ids))),
    inCycle(db.select({
      eventId: eventConformitiesTable.eventId, epi: eventConformitiesTable.epi, estaiamentos: eventConformitiesTable.estaiamentos,
      conduta: eventConformitiesTable.conduta, guardaEquipamentos: eventConformitiesTable.guardaEquipamentos,
    }).from(eventConformitiesTable).where(inArray(eventConformitiesTable.eventId, ids))),
    db.select({
      employeeId: absencesTable.employeeId, penaltyType: absencesTable.penaltyType, kind: absencesTable.kind,
      points: absencesTable.points, quantity: absencesTable.quantity,
    }).from(absencesTable).where(and(eq(absencesTable.cycleId, cycle.id))),
    loadPenaltyLabels(),
    // Catálogo inteiro (poucas dezenas de linhas): liga cópias por evento à origem.
    db.select({ id: criteriaTable.id, name: criteriaTable.name, eventScoped: criteriaTable.eventScoped, sourceCriterionId: criteriaTable.sourceCriterionId }).from(criteriaTable),
  ]);

  const overview = computeAnalytics({
    events,
    officialScores: official.map(o => ({ eventId: o.eventId, score: num(o.score) })),
    quarterly: quarterly.map(q => ({
      employeeId: q.employeeId, employeeName: q.employeeName ?? `Colaborador #${q.employeeId}`,
      finalResult: num(q.finalResult), platoon: q.platoon, bonusValue: num(q.bonusValue), eligible: q.eligible,
      eventsCount: q.eventsCount, participatedEventsCount: q.participatedEventsCount,
    })),
    rules: rules.map(r => ({
      name: r.name, color: r.color, minScore: num(r.minScore), maxScore: num(r.maxScore),
      minInclusive: r.minInclusive, maxInclusive: r.maxInclusive, bonusValue: num(r.bonusValue), bonusPerExtraEvent: num(r.bonusPerExtraEvent),
    })),
    minEvents,
    evaluations: evals.map(e => ({
      eventId: e.eventId, criterionId: e.criterionId, evaluatorUserId: e.evaluatorUserId,
      evaluatorName: e.evaluatorName ?? `Usuário #${e.evaluatorUserId}`, score: num(e.score), status: e.status, submittedAt: e.submittedAt,
    })),
    calibrations: cals.map(c => ({ eventId: c.eventId, criterionId: c.criterionId, calibratedScore: num(c.calibratedScore) })),
    eventCriteria: ecs.map(c => ({
      eventId: c.eventId, criterionId: c.criterionId, active: c.active,
      name: c.name ?? `Critério #${c.criterionId}`, area: c.areaLabel ?? c.areaName ?? null,
      weight: num(c.weightOverride ?? c.defaultWeight ?? 1),
    })),
    conformities: confs,
    criteriaCatalog: catalog.map(c => ({ id: c.id, name: c.name, eventScoped: c.eventScoped, sourceCriterionId: c.sourceCriterionId ?? null })),
    adjustments: absences.map(a => ({
      employeeId: a.employeeId, label: labels.get(a.penaltyType) ?? a.penaltyType,
      kind: a.kind === "merit" ? "merit" as const : "penalty" as const, points: a.points, quantity: a.quantity,
    })),
  });

  res.json({ cycle: { id: cycle.id, name: cycle.name, startDate: cycle.startDate ?? null, endDate: cycle.endDate ?? null }, ...overview });
});

/**
 * GET /analytics/events-report?cycleId=
 * Relatório por evento: nota final oficial (calibrada), performance, desconto
 * da matriz, cada critério (avaliadores, calibração e justificativa) e a
 * equipe. Ciclo atual por padrão; cycleId permite ciclos anteriores.
 */
router.get("/analytics/events-report", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const raw = req.query.cycleId;
  let cycleId: number | null = null;
  if (raw !== undefined) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) { res.status(400).json({ error: "cycleId inválido" }); return; }
    cycleId = n;
  } else {
    cycleId = (await getCurrentCycle())?.id ?? null;
  }
  if (cycleId == null) { res.status(404).json({ error: "Nenhum ciclo ativo" }); return; }
  const report = await buildEventsReport(cycleId);
  if (!report) { res.status(404).json({ error: "Ciclo não encontrado" }); return; }
  res.json(report);
});

export default router;
