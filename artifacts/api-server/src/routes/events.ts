import { Router } from "express";
import { db, eventsTable, eventParticipantsTable, employeesTable, criteriaTable, eventCriteriaTable, evaluationsTable, calibrationsTable, areasTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { convertScoreToPercentage } from "../lib/calculations.js";

const router = Router();
router.use(requireAuth);

router.get("/events", async (req, res) => {
  const { year, quarter, status } = req.query;
  let query = db.select().from(eventsTable).$dynamic();
  const conditions = [];
  if (year) conditions.push(eq(eventsTable.year, parseInt(year as string)));
  if (quarter) conditions.push(eq(eventsTable.quarter, parseInt(quarter as string)));
  if (status) conditions.push(eq(eventsTable.status, status as string));
  if (conditions.length) query = query.where(and(...conditions));
  const events = await query.orderBy(eventsTable.startDate);

  const enriched = await Promise.all(events.map(async (ev) => {
    const participants = await db.select().from(eventParticipantsTable).where(eq(eventParticipantsTable.eventId, ev.id));
    const submittedEvals = await db.select().from(evaluationsTable)
      .where(and(eq(evaluationsTable.eventId, ev.id), eq(evaluationsTable.status, "submitted")));
    const totalEvals = await db.select().from(evaluationsTable).where(eq(evaluationsTable.eventId, ev.id));
    const progress = totalEvals.length > 0 ? submittedEvals.length / totalEvals.length : 0;
    const scored = submittedEvals.filter(e => e.score != null);
    const avgRaw = scored.length > 0
      ? scored.reduce((s, e) => s + parseFloat(e.score as unknown as string), 0) / scored.length
      : null;
    const averageScore = avgRaw != null ? convertScoreToPercentage(avgRaw) : null;
    return { ...ev, participantCount: participants.length, evaluationProgress: progress, averageScore };
  }));
  res.json(enriched);
});

async function loadEventDetail(id: number) {
  const [ev] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!ev) return null;

  const participants = await db
    .select({
      id: eventParticipantsTable.id,
      eventId: eventParticipantsTable.eventId,
      employeeId: eventParticipantsTable.employeeId,
      employeeName: employeesTable.name,
      functionName: eventParticipantsTable.functionName,
      teamName: eventParticipantsTable.teamName,
      confirmed: eventParticipantsTable.confirmed,
    })
    .from(eventParticipantsTable)
    .leftJoin(employeesTable, eq(eventParticipantsTable.employeeId, employeesTable.id))
    .where(eq(eventParticipantsTable.eventId, id));

  const criteria = await db
    .select({
      id: eventCriteriaTable.id,
      eventId: eventCriteriaTable.eventId,
      criterionId: eventCriteriaTable.criterionId,
      criterionName: criteriaTable.name,
      responsibleAreaId: criteriaTable.responsibleAreaId,
      responsibleAreaName: areasTable.name,
      active: eventCriteriaTable.active,
      originalWeight: criteriaTable.defaultWeight,
      weightOverride: eventCriteriaTable.weightOverride,
    })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .leftJoin(areasTable, eq(criteriaTable.responsibleAreaId, areasTable.id))
    .where(eq(eventCriteriaTable.eventId, id));

  const activeCriteria = criteria.filter(c => c.active);
  const totalWeight = activeCriteria.reduce((s, c) => s + parseFloat(c.weightOverride ?? c.originalWeight ?? "1"), 0);
  const enrichedCriteria = criteria.map(c => {
    const w = parseFloat(c.weightOverride ?? c.originalWeight ?? "1");
    return { ...c, originalWeight: parseFloat(c.originalWeight ?? "1"), weightOverride: c.weightOverride ? parseFloat(c.weightOverride) : null, normalizedWeight: c.active && totalWeight > 0 ? w / totalWeight : 0, weight: c.active ? w : 0 };
  });

  const hasEvaluations = await eventHasEvaluations(id);

  return { ...ev, participants, criteria: enrichedCriteria, hasEvaluations, evaluationMatrix: [], results: [] };
}

async function eventHasEvaluations(eventId: number) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(evaluationsTable)
    .where(eq(evaluationsTable.eventId, eventId));
  return Number(count) > 0;
}

router.get("/events/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const detail = await loadEventDetail(id);
  if (!detail) { res.status(404).json({ error: "Não encontrado" }); return; }
  res.json(detail);
});

router.post("/events", requireRole("admin", "rh"), async (req, res) => {
  const { name, clientName, location, city, state, startDate, endDate, year, quarter } = req.body;
  if (!name || !startDate || !endDate || !year || !quarter) {
    res.status(400).json({ error: "Campos obrigatórios: name, startDate, endDate, year, quarter" });
    return;
  }
  const [ev] = await db.insert(eventsTable).values({
    name, clientName: clientName ?? null, location: location ?? null, city: city ?? null,
    state: state ?? null, startDate, endDate, year, quarter,
  }).returning();

  const allCriteria = await db.select().from(criteriaTable).where(eq(criteriaTable.active, true));
  if (allCriteria.length > 0) {
    await db.insert(eventCriteriaTable).values(allCriteria.map(c => ({ eventId: ev.id, criterionId: c.id, active: true })));
  }

  await audit(req.user!.userId, "create", "events", ev.id, null, ev);
  res.status(201).json({ ...ev, participantCount: 0, evaluationProgress: 0, averageScore: null });
});

router.patch("/events/:id", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, clientName, location, city, state, startDate, endDate, status } = req.body;
  const [before] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Não encontrado" }); return; }
  const [ev] = await db.update(eventsTable).set({
    ...(name !== undefined && { name }),
    ...(clientName !== undefined && { clientName }),
    ...(location !== undefined && { location }),
    ...(city !== undefined && { city }),
    ...(state !== undefined && { state }),
    ...(startDate !== undefined && { startDate }),
    ...(endDate !== undefined && { endDate }),
    ...(status !== undefined && { status }),
  }).where(eq(eventsTable.id, id)).returning();
  await audit(req.user!.userId, "update", "events", id, before, ev);
  res.json(ev);
});

router.delete("/events/:id", requireRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(eventsTable).where(eq(eventsTable.id, id));
  await audit(req.user!.userId, "delete", "events", id);
  res.status(204).end();
});

router.post("/events/:id/close", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { forced, reason } = req.body ?? {};
  const [ev] = await db.update(eventsTable).set({
    status: "closed",
    forcedClosed: !!forced,
    forcedCloseReason: reason ?? null,
  }).where(eq(eventsTable.id, id)).returning();
  if (!ev) { res.status(404).json({ error: "Não encontrado" }); return; }
  await audit(req.user!.userId, "close", "events", id);
  res.json(ev);
});

router.post("/events/:id/reopen", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [ev] = await db.update(eventsTable).set({ status: "open", forcedClosed: false, forcedCloseReason: null }).where(eq(eventsTable.id, id)).returning();
  if (!ev) { res.status(404).json({ error: "Não encontrado" }); return; }
  await audit(req.user!.userId, "reopen", "events", id);
  res.json(ev);
});

router.get("/events/:id/participants", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const participants = await db
    .select({
      id: eventParticipantsTable.id,
      eventId: eventParticipantsTable.eventId,
      employeeId: eventParticipantsTable.employeeId,
      employeeName: employeesTable.name,
      functionName: eventParticipantsTable.functionName,
      teamName: eventParticipantsTable.teamName,
      confirmed: eventParticipantsTable.confirmed,
    })
    .from(eventParticipantsTable)
    .leftJoin(employeesTable, eq(eventParticipantsTable.employeeId, employeesTable.id))
    .where(eq(eventParticipantsTable.eventId, id));
  res.json(participants);
});

router.post("/events/:id/participants", requireRole("admin", "rh"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const { employeeId, functionName, teamName } = req.body;
  if (!employeeId) { res.status(400).json({ error: "employeeId obrigatório" }); return; }
  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, employeeId)).limit(1);
  const [participant] = await db.insert(eventParticipantsTable).values({
    eventId, employeeId, functionName: functionName ?? emp?.functionName ?? null, teamName: teamName ?? null,
  }).returning();
  res.status(201).json({ ...participant, employeeName: emp?.name ?? "" });
});

router.delete("/events/:id/participants/:participantId", requireRole("admin", "rh"), async (req, res) => {
  const participantId = parseInt(req.params.participantId as string);
  await db.delete(eventParticipantsTable).where(eq(eventParticipantsTable.id, participantId));
  res.status(204).end();
});

router.get("/events/:id/criteria", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const criteria = await db
    .select({
      id: eventCriteriaTable.id,
      eventId: eventCriteriaTable.eventId,
      criterionId: eventCriteriaTable.criterionId,
      criterionName: criteriaTable.name,
      responsibleAreaId: criteriaTable.responsibleAreaId,
      responsibleAreaName: areasTable.name,
      active: eventCriteriaTable.active,
      originalWeight: criteriaTable.defaultWeight,
      weightOverride: eventCriteriaTable.weightOverride,
    })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .leftJoin(areasTable, eq(criteriaTable.responsibleAreaId, areasTable.id))
    .where(eq(eventCriteriaTable.eventId, id));
  const activeCriteria = criteria.filter(c => c.active);
  const totalWeight = activeCriteria.reduce((s, c) => s + parseFloat(c.weightOverride ?? c.originalWeight ?? "1"), 0);
  res.json(criteria.map(c => {
    const w = parseFloat(c.weightOverride ?? c.originalWeight ?? "1");
    return { ...c, originalWeight: parseFloat(c.originalWeight ?? "1"), weightOverride: c.weightOverride ? parseFloat(c.weightOverride) : null, normalizedWeight: c.active && totalWeight > 0 ? w / totalWeight : 0, weight: c.active ? w : 0 };
  }));
});

const TARGET_WEIGHT = 20;

type CriterionConfigItem = { criterionId: number; active: boolean; weight: number };

router.put("/events/:id/criteria", requireRole("admin", "rh"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const items = (req.body?.criteria ?? []) as CriterionConfigItem[];
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Envie a lista de critérios (criteria) do evento" });
    return;
  }

  if (await eventHasEvaluations(eventId)) {
    res.status(409).json({ error: "Este evento já possui avaliações. Os critérios não podem mais ser alterados." });
    return;
  }

  const existing = await db
    .select({
      id: eventCriteriaTable.id,
      criterionId: eventCriteriaTable.criterionId,
      active: eventCriteriaTable.active,
      weightOverride: eventCriteriaTable.weightOverride,
      originalWeight: criteriaTable.defaultWeight,
    })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .where(eq(eventCriteriaTable.eventId, eventId));

  // Validate the resulting persisted active-weight sum (merging unchanged rows
  // with the incoming payload), not just the payload itself.
  const resultingActiveSum = existing.reduce((s, ec) => {
    const item = items.find(i => i.criterionId === ec.criterionId);
    const active = item ? item.active : ec.active;
    if (!active) return s;
    const weight = item
      ? (Number(item.weight) || 0)
      : parseFloat(ec.weightOverride ?? ec.originalWeight ?? "0");
    return s + weight;
  }, 0);
  if (Math.abs(resultingActiveSum - TARGET_WEIGHT) > 0.01) {
    res.status(400).json({ error: `A soma dos pesos dos critérios ativos deve ser ${TARGET_WEIGHT} (atual: ${Math.round(resultingActiveSum * 100) / 100})` });
    return;
  }

  for (const ec of existing) {
    const item = items.find(i => i.criterionId === ec.criterionId);
    if (!item) continue;
    await db.update(eventCriteriaTable).set({
      active: item.active,
      weightOverride: item.active ? String(Number(item.weight) || 0) : null,
    }).where(eq(eventCriteriaTable.id, ec.id));
  }

  const updatedCriteria = await db
    .select({
      id: eventCriteriaTable.id,
      eventId: eventCriteriaTable.eventId,
      criterionId: eventCriteriaTable.criterionId,
      criterionName: criteriaTable.name,
      active: eventCriteriaTable.active,
      originalWeight: criteriaTable.defaultWeight,
      weightOverride: eventCriteriaTable.weightOverride,
    })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .where(eq(eventCriteriaTable.eventId, eventId));

  const activeCriteria = updatedCriteria.filter(c => c.active);
  const totalWeight = activeCriteria.reduce((s, c) => s + parseFloat(c.weightOverride ?? c.originalWeight ?? "1"), 0);
  res.json(updatedCriteria.map(c => {
    const w = parseFloat(c.weightOverride ?? c.originalWeight ?? "1");
    return {
      ...c,
      originalWeight: parseFloat(c.originalWeight ?? "1"),
      weightOverride: c.weightOverride ? parseFloat(c.weightOverride) : null,
      normalizedWeight: c.active && totalWeight > 0 ? w / totalWeight : 0,
      weight: c.active ? parseFloat(c.weightOverride ?? c.originalWeight ?? "1") : 0,
    };
  }));
});

router.post("/events/:id/criteria/confirm", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const confirmed = req.body?.confirmed !== false;
  const [before] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Não encontrado" }); return; }

  if (!confirmed && await eventHasEvaluations(id)) {
    res.status(409).json({ error: "Este evento já possui avaliações. Os critérios não podem ser reabertos para edição." });
    return;
  }

  if (confirmed) {
    const rows = await db
      .select({ id: eventCriteriaTable.id, active: eventCriteriaTable.active, originalWeight: criteriaTable.defaultWeight, weightOverride: eventCriteriaTable.weightOverride })
      .from(eventCriteriaTable)
      .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
      .where(eq(eventCriteriaTable.eventId, id));
    const sum = rows.filter(r => r.active).reduce((s, r) => s + parseFloat(r.weightOverride ?? r.originalWeight ?? "1"), 0);
    if (Math.abs(sum - TARGET_WEIGHT) > 0.01) {
      res.status(400).json({ error: `Ajuste os pesos para somar ${TARGET_WEIGHT} antes de confirmar (atual: ${Math.round(sum * 100) / 100})` });
      return;
    }
    // Freeze each active criterion's effective weight so that later edits to the
    // global default weight can never alter an event locked for evaluation.
    for (const r of rows) {
      if (r.active && r.weightOverride == null) {
        await db.update(eventCriteriaTable)
          .set({ weightOverride: String(parseFloat(r.originalWeight ?? "0")) })
          .where(eq(eventCriteriaTable.id, r.id));
      }
    }
  }

  const [ev] = await db.update(eventsTable).set({
    criteriaConfirmed: confirmed,
    criteriaConfirmedAt: confirmed ? new Date() : null,
  }).where(eq(eventsTable.id, id)).returning();
  await audit(req.user!.userId, confirmed ? "confirm_criteria" : "reopen_criteria", "events", id, before, ev);
  res.json(await loadEventDetail(id));
});

export default router;
