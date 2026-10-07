import { Router } from "express";
import {
  db, eventsTable, employeeEventResultsTable, quarterlyResultsTable, employeesTable, platoonRulesTable,
  evaluationsTable, calibrationsTable, eventCriteriaTable, criteriaTable, areasTable, eventConformitiesTable,
  absencesTable, usersTable, employeeCycleEligibilityTable,
} from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { getMinEventsByCycle, eventWithinItsCycleSql } from "../lib/cycle.js";
import { resolveCycleScope, sendScopeError, scopeCycleIds, scopeCycleInfo } from "../lib/cycle-scope.js";
import { computeAnalytics } from "../lib/analytics.js";
import { loadPenaltyLabels } from "./penalty-types.js";
import { rankingScope } from "../lib/ranking-scope.js";
import { buildEventsReport } from "../lib/events-report.js";
import { effectiveCalibrations, eventsWithoutConduta, withoutConduta } from "../lib/cycle-data.js";
import { areaModeEventIds } from "../lib/area-mode.js";

const router = Router();
router.use(requireAuth);

const num = (v: unknown) => (v == null ? 0 : Number(v));

/**
 * GET /analytics/overview
 * Indicadores para a tela de Análises (gestores: tem bônus). `?cycleId=`
 * vazio = ciclo atual; id = aquele ciclo; `all` = Total geral (todos os
 * eventos e resultados de todos os ciclos; pessoas contadas por ciclo).
 * Leitura em lote (uma consulta por tabela) e agregação em computeAnalytics.
 */
router.get("/analytics/overview", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const scoped = await resolveCycleScope(req.query.cycleId);
  if (sendScopeError(res, scoped)) return;
  const scope = scoped.scope;
  if (!scope) { res.status(404).json({ error: "Nenhum ciclo ativo" }); return; }
  const cycleIds = scopeCycleIds(scope);
  const isAll = scope.kind === "all";
  // Mesmo recorte do Ranking: no ciclo atual só ativos; nos anteriores, o histórico.
  const activeOnlyInCycleId = scope.kind === "cycle" ? (scope.isCurrent ? scope.cycle.id : null) : scope.currentId;

  const events = await db.select({
    id: eventsTable.id, name: eventsTable.name, clientName: eventsTable.clientName,
    startDate: eventsTable.startDate, endDate: eventsTable.endDate,
    resultsConfirmed: eventsTable.resultsConfirmed, isHistorical: eventsTable.isHistorical,
  }).from(eventsTable)
    // Eventos "fora do período" (começam depois do fim do ciclo) não são deste
    // ciclo: vão para o próximo — mesmo critério do recálculo.
    .where(and(inArray(eventsTable.cycleId, cycleIds), eventWithinItsCycleSql()));
  const ids = events.map(e => e.id);
  const inCycle = <T>(rows: Promise<T[]>) => (ids.length > 0 ? rows : Promise.resolve([] as T[]));

  // Mínimo de eventos de CADA ciclo (o do ciclo ou o geral), numa consulta só.
  const minByCycle = await getMinEventsByCycle(cycleIds);
  // O "mínimo" exibido: o do ciclo; no Total geral, o do ciclo mais recente
  // (e a lista por ciclo em ruleSet.minEventsByCycle).
  const minEvents = minByCycle.get(cycleIds[0]) ?? 8;
  const cycleNames = new Map(scope.kind === "all" ? scope.cycles.map(c => [c.id, c.name]) : [[scope.cycle.id, scope.cycle.name]]);
  // Ciclo FECHADO = bônus oficial; aberto = projeção (M3).
  const closedCycleIds = new Set((scope.kind === "all" ? scope.cycles : [scope.cycle]).filter(c => c.status === "closed").map(c => c.id));
  // Ciclos com a Conduta fora da matriz: a resposta não conta (vale "sim").
  const noConduta = await eventsWithoutConduta(ids);

  const [official, quarterly, rules, evals, cals, ecs, confs, absences, labels, catalog] = await Promise.all([
    inCycle(db.select({ eventId: employeeEventResultsTable.eventId, score: employeeEventResultsTable.finalEventScore })
      .from(employeeEventResultsTable).where(inArray(employeeEventResultsTable.eventId, ids))),
    db.select({
      employeeId: quarterlyResultsTable.employeeId, employeeName: employeesTable.name, cycleId: quarterlyResultsTable.cycleId,
      finalResult: quarterlyResultsTable.finalResult, platoon: quarterlyResultsTable.platoon,
      bonusValue: quarterlyResultsTable.bonusValue, eligible: quarterlyResultsTable.eligible,
      eventsCount: quarterlyResultsTable.eventsCount, participatedEventsCount: quarterlyResultsTable.participatedEventsCount,
      eligibilityReason: quarterlyResultsTable.eligibilityReason,
    }).from(quarterlyResultsTable)
      .innerJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
      // Mesmo recorte do Ranking (casa, fora de Sup Ceno, ativos no ciclo atual, com participação que conta).
      .where(and(inArray(quarterlyResultsTable.cycleId, cycleIds), rankingScope({ activeOnlyInCycleId }))),
    db.select().from(platoonRulesTable).where(eq(platoonRulesTable.active, true)),
    inCycle(db.select({
      eventId: evaluationsTable.eventId, criterionId: evaluationsTable.criterionId,
      evaluatorUserId: evaluationsTable.evaluatorUserId, evaluatorName: usersTable.name,
      score: evaluationsTable.score, status: evaluationsTable.status, submittedAt: evaluationsTable.submittedAt,
    }).from(evaluationsTable)
      .leftJoin(usersTable, eq(evaluationsTable.evaluatorUserId, usersTable.id))
      .where(inArray(evaluationsTable.eventId, ids))),
    inCycle(db.select({ eventId: calibrationsTable.eventId, criterionId: calibrationsTable.criterionId, calibratedScore: calibrationsTable.calibratedScore, pendingPublish: calibrationsTable.pendingPublish })
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
      employeeId: absencesTable.employeeId, employeeName: employeesTable.name, penaltyType: absencesTable.penaltyType, kind: absencesTable.kind,
      points: absencesTable.points, quantity: absencesTable.quantity,
    }).from(absencesTable)
      .leftJoin(employeesTable, eq(absencesTable.employeeId, employeesTable.id))
      // Quem o admin tirou do ciclo não entra (nem nos rankings de penalidade/mérito).
      .where(and(inArray(absencesTable.cycleId, cycleIds), sql`NOT EXISTS (SELECT 1 FROM ${employeeCycleEligibilityTable} x WHERE x.employee_id = ${absencesTable.employeeId} AND x.cycle_id = ${absencesTable.cycleId} AND x.excluded)`)),
    loadPenaltyLabels(),
    // Catálogo inteiro (poucas dezenas de linhas): liga cópias por evento à origem.
    db.select({ id: criteriaTable.id, name: criteriaTable.name, eventScoped: criteriaTable.eventScoped, sourceCriterionId: criteriaTable.sourceCriterionId }).from(criteriaTable),
  ]);

  const areaMode = await areaModeEventIds(ids);
  const submittedKeys = new Set(evals.filter(e => e.status === "submitted").map(e => `${e.eventId}:${e.criterionId}`));
  const overview = computeAnalytics({
    events,
    officialScores: official.map(o => ({ eventId: o.eventId, score: num(o.score) })),
    quarterly: quarterly.map(q => ({
      employeeId: q.employeeId, employeeName: q.employeeName ?? `Colaborador #${q.employeeId}`,
      finalResult: num(q.finalResult), platoon: q.platoon, bonusValue: num(q.bonusValue), eligible: q.eligible,
      eventsCount: q.eventsCount, participatedEventsCount: q.participatedEventsCount,
      minEvents: minByCycle.get(q.cycleId) ?? minEvents,
      cycleId: q.cycleId,
      official: closedCycleIds.has(q.cycleId),
      eligibilityReason: q.eligibilityReason,
    })),
    scope: isAll ? "all" : "cycle",
    rules: rules.map(r => ({
      name: r.name, color: r.color, minScore: num(r.minScore), maxScore: num(r.maxScore),
      minInclusive: r.minInclusive, maxInclusive: r.maxInclusive, bonusValue: num(r.bonusValue), bonusPerExtraEvent: num(r.bonusPerExtraEvent),
    })),
    minEvents,
    // Rascunho "órfão" (modo por área: o critério já foi fechado pela resposta
    // de outra pessoa) não é pendência nem conta como rascunho (B2).
    evaluations: evals.filter(e => !(e.status === "draft" && areaMode.has(e.eventId) && submittedKeys.has(`${e.eventId}:${e.criterionId}`))).map(e => ({
      eventId: e.eventId, criterionId: e.criterionId, evaluatorUserId: e.evaluatorUserId,
      evaluatorName: e.evaluatorName ?? `Usuário #${e.evaluatorUserId}`, score: num(e.score), status: e.status, submittedAt: e.submittedAt,
    })),
    // Só a calibração que vale na nota (a salva e não publicada fica de fora).
    calibrations: (await effectiveCalibrations(cals)).map(c => ({ eventId: c.eventId, criterionId: c.criterionId, calibratedScore: num(c.calibratedScore) })),
    eventCriteria: ecs.map(c => ({
      eventId: c.eventId, criterionId: c.criterionId, active: c.active,
      name: c.name ?? `Critério #${c.criterionId}`, area: c.areaLabel ?? c.areaName ?? null,
      weight: num(c.weightOverride ?? c.defaultWeight ?? 1),
    })),
    conformities: confs.map(c => withoutConduta(c, noConduta.has(c.eventId))!),
    condutaInMatrix: ids.length === 0 ? "all" : noConduta.size === 0 ? "all" : noConduta.size >= ids.length ? "none" : "some",
    minEventsByCycle: cycleIds.map(id => ({ cycleId: id, cycleName: cycleNames.get(id) ?? `Ciclo #${id}`, minEvents: minByCycle.get(id) ?? minEvents })),
    criteriaCatalog: catalog.map(c => ({ id: c.id, name: c.name, eventScoped: c.eventScoped, sourceCriterionId: c.sourceCriterionId ?? null })),
    adjustments: absences.map(a => ({
      employeeId: a.employeeId, employeeName: a.employeeName, label: labels.get(a.penaltyType) ?? a.penaltyType,
      kind: a.kind === "merit" ? "merit" as const : "penalty" as const, points: a.points, quantity: a.quantity,
    })),
  });

  res.json({
    cycle: scopeCycleInfo(scope),
    scope: {
      kind: isAll ? "all" : "cycle",
      cyclesCount: cycleIds.length,
      isCurrent: scope.kind === "cycle" ? scope.isCurrent : false,
      status: scope.kind === "cycle" ? scope.cycle.status : null,
    },
    ...overview,
  });
});

/**
 * GET /analytics/events-report?cycleId=
 * Relatório por evento: nota final oficial (calibrada), performance, desconto
 * da matriz, cada critério (avaliadores, calibração e justificativa) e a
 * equipe. Ciclo atual por padrão; cycleId permite ciclos anteriores e `all`
 * junta os eventos de todos os ciclos (cada linha diz de que ciclo é).
 */
router.get("/analytics/events-report", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const scoped = await resolveCycleScope(req.query.cycleId);
  if (sendScopeError(res, scoped)) return;
  const scope = scoped.scope;
  if (!scope) { res.status(404).json({ error: "Nenhum ciclo ativo" }); return; }
  const report = await buildEventsReport(scope.kind === "all" ? "all" : scope.cycle.id);
  if (!report) { res.status(404).json({ error: "Ciclo não encontrado" }); return; }
  res.json(report);
});

export default router;
