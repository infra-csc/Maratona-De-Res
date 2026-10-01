import { Router } from "express";
import {
  db, employeesTable, cyclesTable, eventsTable, employeeEventResultsTable, absencesTable, auditLogsTable,
  usersTable, criteriaTable, quarterlyResultsTable, scoreChangesTable,
} from "@workspace/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { getCurrentCycle } from "../lib/cycle.js";
import { loadPlatoonRules } from "../lib/cycle-data.js";
import { loadPenaltyLabels } from "./penalty-types.js";
import { pgNum } from "../lib/pg-num.js";
import { reconstructSteps, type TimelineEntry } from "../lib/score-timeline.js";

const router = Router();
router.use(requireAuth);

const iso = (d: Date | string | null | undefined) => (d == null ? null : new Date(d).toISOString());
const numOrNull = (v: string | number | null | undefined) => (v == null ? null : Number(v));
const parse = (s: string | null): Record<string, unknown> | null => {
  if (!s) return null;
  try { const v = JSON.parse(s); return v && typeof v === "object" ? v as Record<string, unknown> : null; } catch { return null; }
};

const AUDIT_ACTIONS = [
  "calibrate", "recalibrate_released", "publish_partial_feedback", "publish_final_feedback",
  "publish_partial_all_feedback", "publish_final_all_feedback", "release_feedback", "confirm-results", "unconfirm-results",
];

/**
 * GET /results/timeline?cycleId=&employeeId=
 * Linha do tempo das notas do ciclo (só admin e RH): o que mudou em cada dia,
 * para quem e por quê. Sem employeeId = todos os colaboradores do ranking;
 * com employeeId = só ele. Ver lib/score-timeline.ts.
 */
router.get("/results/timeline", requireRole("admin", "rh"), async (req, res) => {
  const employeeParam = req.query.employeeId != null && req.query.employeeId !== "" ? Number(req.query.employeeId) : null;
  if (employeeParam != null && (!Number.isInteger(employeeParam) || employeeParam <= 0)) { res.status(400).json({ error: "employeeId inválido" }); return; }
  const cycleIdParam = req.query.cycleId != null && req.query.cycleId !== "" ? Number(req.query.cycleId) : null;
  const cycle = cycleIdParam
    ? (await db.select().from(cyclesTable).where(eq(cyclesTable.id, cycleIdParam)).limit(1))[0]
    : await getCurrentCycle();
  if (!cycle) { res.status(404).json({ error: "Ciclo não encontrado" }); return; }
  if (employeeParam != null) {
    const [exists] = await db.select({ id: employeesTable.id }).from(employeesTable).where(eq(employeesTable.id, employeeParam)).limit(1);
    if (!exists) { res.status(404).json({ error: "Colaborador não encontrado" }); return; }
  }
  const onlyEmp = <T>(col: T) => (employeeParam != null ? [eq(col as never, employeeParam)] : []);

  const [rules, labels, quarterly, recorded, eventRows, adjustmentRows, cycleEvents] = await Promise.all([
    loadPlatoonRules(),
    loadPenaltyLabels(),
    db.select({ q: quarterlyResultsTable, name: employeesTable.name, functionName: employeesTable.functionName })
      .from(quarterlyResultsTable).innerJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
      .where(eq(quarterlyResultsTable.cycleId, cycle.id)),
    db.select({ c: scoreChangesTable, by: usersTable.name, employeeName: employeesTable.name }).from(scoreChangesTable)
      .leftJoin(usersTable, eq(scoreChangesTable.userId, usersTable.id))
      // Nome mesmo de quem saiu do ciclo (não está mais em quarterly_results).
      .leftJoin(employeesTable, eq(scoreChangesTable.employeeId, employeesTable.id))
      .where(and(eq(scoreChangesTable.cycleId, cycle.id), ...onlyEmp(scoreChangesTable.employeeId)))
      .orderBy(asc(scoreChangesTable.changedAt), asc(scoreChangesTable.id)),
    // Eventos que entram na nota de cada um hoje, com a data em que passaram a contar.
    db.select({ employeeId: employeeEventResultsTable.employeeId, eventId: eventsTable.id, name: eventsTable.name, confirmedAt: eventsTable.resultsConfirmedAt, startDate: eventsTable.startDate, score: employeeEventResultsTable.finalEventScore })
      .from(employeeEventResultsTable)
      .innerJoin(eventsTable, eq(employeeEventResultsTable.eventId, eventsTable.id))
      .where(and(eq(eventsTable.cycleId, cycle.id), eq(eventsTable.resultsConfirmed, true), ...onlyEmp(employeeEventResultsTable.employeeId))),
    db.select({ a: absencesTable, eventName: eventsTable.name, by: usersTable.name }).from(absencesTable)
      .leftJoin(eventsTable, eq(absencesTable.eventId, eventsTable.id))
      .leftJoin(usersTable, eq(absencesTable.registeredByUserId, usersTable.id))
      .where(and(eq(absencesTable.cycleId, cycle.id), ...onlyEmp(absencesTable.employeeId))),
    db.select({ id: eventsTable.id, name: eventsTable.name }).from(eventsTable).where(eq(eventsTable.cycleId, cycle.id)),
  ]);

  const eventNames = new Map(cycleEvents.map(e => [e.id, e.name]));
  const people = quarterly.map(({ q, name, functionName }) => ({
    employeeId: q.employeeId, name, functionName: functionName ?? null,
    finalResult: pgNum(q.finalResult), platoon: q.platoon ?? null, platoonColor: q.platoonColor ?? null,
    bonusValue: pgNum(q.bonusValue), eventsCount: q.eventsCount, eligible: q.eligible,
  })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const nameOf = new Map(people.map(p => [p.employeeId, p.name]));
  // Registro exato começou no primeiro recálculo gravado do CICLO (vale para
  // todos: cada recálculo compara todo mundo). Antes disso, remontado.
  const [firstRecorded] = employeeParam == null ? recorded : await db.select({ at: scoreChangesTable.changedAt }).from(scoreChangesTable)
    .where(eq(scoreChangesTable.cycleId, cycle.id)).orderBy(asc(scoreChangesTable.changedAt)).limit(1).then(r => r.map(x => ({ c: { changedAt: x.at } })));
  const recordedSince = firstRecorded ? iso((firstRecorded as { c: { changedAt: Date } }).c.changedAt) : null;
  const platoonRules = rules.map(r => ({ name: r.name, color: r.color ?? null, minScore: r.minScore }));

  // 1. Passado remontado, por colaborador.
  const reconstructed: TimelineEntry[] = [];
  const employeeIds = employeeParam != null ? [employeeParam] : people.map(p => p.employeeId);
  for (const empId of employeeIds) {
    const steps = reconstructSteps(
      eventRows.filter(e => e.employeeId === empId && e.score != null).map(e => ({
        eventId: e.eventId, name: e.name, at: iso(e.confirmedAt) ?? `${e.startDate}T12:00:00.000Z`, score: Number(e.score),
      })),
      adjustmentRows.filter(({ a }) => a.employeeId === empId).map(({ a, eventName, by }) => ({
        id: a.id, at: iso(a.createdAt)!, kind: a.kind === "merit" ? "merit" as const : "penalty" as const,
        label: labels.get(a.penaltyType) ?? a.penaltyType, points: a.points, quantity: a.quantity,
        reason: a.reason ?? null, eventName: eventName ?? null, by: by ?? null,
      })),
      platoonRules,
      recordedSince,
    );
    for (const s of steps) reconstructed.push({ ...s, id: `${s.id}-e${empId}`, employeeId: empId, employeeName: nameOf.get(empId) ?? null });
  }

  // 2. Calibrações e publicações nos eventos do ciclo (auditoria) — por evento,
  // não por pessoa (com filtro de colaborador, só os eventos dele).
  const relevantEvents = employeeParam != null
    ? new Set(eventRows.map(e => e.eventId))
    : new Set(cycleEvents.map(e => e.id));
  const info: TimelineEntry[] = [];
  if (relevantEvents.size > 0) {
    const logs = await db.select({ l: auditLogsTable, by: usersTable.name }).from(auditLogsTable)
      .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
      .where(inArray(auditLogsTable.action, AUDIT_ACTIONS))
      .orderBy(asc(auditLogsTable.createdAt));
    const critIds = new Set<number>();
    const rows = logs.map(({ l, by }) => {
      const after = parse(l.afterJson), before = parse(l.beforeJson);
      const eventId = Number(after?.eventId ?? (l.entity === "events" ? l.entityId : NaN));
      const criterionId = Number(after?.criterionId ?? NaN);
      return { l, by, after, before, eventId, criterionId };
    }).filter(r => relevantEvents.has(r.eventId));
    for (const r of rows) if (Number.isInteger(r.criterionId)) critIds.add(r.criterionId);
    const critNames = critIds.size > 0
      ? new Map((await db.select({ id: criteriaTable.id, name: criteriaTable.name }).from(criteriaTable).where(inArray(criteriaTable.id, [...critIds]))).map(c => [c.id, c.name]))
      : new Map<number, string>();
    for (const r of rows) {
      info.push({
        id: `log-${r.l.id}`, at: iso(r.l.createdAt)!, kind: "info", type: r.l.action,
        employeeId: null, employeeName: null,
        eventId: r.eventId, eventName: eventNames.get(r.eventId) ?? null,
        criterionName: Number.isInteger(r.criterionId) ? critNames.get(r.criterionId) ?? null : null,
        by: r.by ?? null,
        scoreBefore: numOrNull((r.before?.score as number | undefined) ?? null),
        scoreAfter: numOrNull((r.after?.score as number | undefined) ?? null),
        reason: (r.after?.reason as string | undefined) ?? null,
      });
    }
  }

  // 3. Registro exato (daqui pra frente).
  const recordedEntries: TimelineEntry[] = recorded.map(({ c, by, employeeName }) => {
    const d = parse(c.causeDetail);
    const eventId = Number(d?.eventId ?? (c.causeEntity === "events" ? c.causeEntityId : NaN));
    // Falta/mérito: o "porquê" vem do próprio lançamento gravado no motivo.
    const isAdj = c.causeEntity === "absences" && d != null;
    const adjKind = isAdj ? (d!.kind === "merit" ? "merit" : "penalty") : null;
    const adjType = isAdj ? (c.causeAction === "delete" ? `${adjKind}_removed` : adjKind) : null;
    // Admin tirou/devolveu a pessoa ao ciclo (Colaboradores).
    const exclusion = c.causeAction === "set_cycle_exclusion" && d != null && d.employeeId === c.employeeId;
    const exclusionType = exclusion ? (d!.excluded ? "cycle_excluded" : "cycle_included") : null;
    return {
      id: `rec-${c.id}`, at: iso(c.changedAt)!, kind: "recorded", type: adjType ?? exclusionType ?? c.causeAction ?? "recompute",
      employeeId: c.employeeId, employeeName: nameOf.get(c.employeeId) ?? employeeName ?? null,
      label: isAdj ? labels.get(String(d!.penaltyType)) ?? String(d!.penaltyType ?? "") : null,
      points: isAdj ? Number(d!.points ?? 0) * Number(d!.quantity ?? 1) : null,
      reason: isAdj || exclusion ? (d!.reason as string | null) ?? null : null,
      eventId: Number.isInteger(eventId) ? eventId : null,
      eventName: Number.isInteger(eventId) ? eventNames.get(eventId) ?? null : null,
      by: by ?? null,
      finalBefore: numOrNull(c.finalBefore), finalAfter: numOrNull(c.finalAfter),
      platoonBefore: c.platoonBefore, platoonAfter: c.platoonAfter,
      bonusBefore: numOrNull(c.bonusBefore), bonusAfter: numOrNull(c.bonusAfter),
      eventsBefore: c.eventsBefore, eventsAfter: c.eventsAfter,
      eligibleBefore: c.eligibleBefore, eligibleAfter: c.eligibleAfter,
    };
  });

  const entries = [...reconstructed, ...info, ...recordedEntries].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  res.json({
    cycle: { id: cycle.id, name: cycle.name, startDate: cycle.startDate ?? null, endDate: cycle.endDate ?? null },
    employeeId: employeeParam,
    people,
    recordedSince,
    platoons: platoonRules,
    entries,
  });
});

export default router;
