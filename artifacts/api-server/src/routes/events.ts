import { Router } from "express";
import { db, eventsTable, eventParticipantsTable, employeesTable, criteriaTable, eventCriteriaTable, evaluationsTable, calibrationsTable, areasTable, eventAreaAssignmentsTable, usersTable, eventConformitiesTable } from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { convertScoreToPercentage, calculateEventResult } from "../lib/calculations.js";
import { recomputeCycleResults } from "./results.js";
import { getCurrentCycle } from "../lib/cycle.js";

const router = Router();
router.use(requireAuth);

router.get("/events", async (req, res) => {
  const { status } = req.query;
  const cycle = await getCurrentCycle();
  if (!cycle) { res.json([]); return; }
  let query = db.select().from(eventsTable).$dynamic();
  const conditions = [eq(eventsTable.cycleId, cycle.id)];
  if (status) conditions.push(eq(eventsTable.status, status as string));
  query = query.where(and(...conditions));
  const events = await query.orderBy(eventsTable.startDate);

  if (events.length === 0) { res.json([]); return; }
  const eventIds = events.map(e => e.id);

  // Busca em lote para evitar N+1 (uma query por relação, não por evento).
  const [participants, evals, eventCriteriaRows, calibrations] = await Promise.all([
    db.select({ eventId: eventParticipantsTable.eventId })
      .from(eventParticipantsTable).where(inArray(eventParticipantsTable.eventId, eventIds)),
    db.select({ eventId: evaluationsTable.eventId, criterionId: evaluationsTable.criterionId, score: evaluationsTable.score, status: evaluationsTable.status })
      .from(evaluationsTable).where(inArray(evaluationsTable.eventId, eventIds)),
    db.select({ eventId: eventCriteriaTable.eventId, criterionId: eventCriteriaTable.criterionId, active: eventCriteriaTable.active, weightOverride: eventCriteriaTable.weightOverride, defaultWeight: criteriaTable.defaultWeight })
      .from(eventCriteriaTable).leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id)).where(inArray(eventCriteriaTable.eventId, eventIds)),
    db.select({ eventId: calibrationsTable.eventId, criterionId: calibrationsTable.criterionId, calibratedScore: calibrationsTable.calibratedScore })
      .from(calibrationsTable).where(inArray(calibrationsTable.eventId, eventIds)),
  ]);

  // Filtra eventos dentro do período do ciclo atual (se o ciclo tiver datas definidas;
  // um ciclo sem startDate/endDate configurados não filtra, evitando excluir tudo por engano)
  const { startDate: cycleStartDate, endDate: cycleEndDate } = cycle;
  const cycleEvents = cycleStartDate && cycleEndDate
    ? events.filter(ev => ev.endDate >= cycleStartDate && ev.endDate <= cycleEndDate)
    : events;

  const enriched = cycleEvents.map((ev) => {
    const participantCount = participants.filter(p => p.eventId === ev.id).length;
    const evEvals = evals.filter(e => e.eventId === ev.id);
    const submitted = evEvals.filter(e => e.status === "submitted");
    const activeCriteria = eventCriteriaRows.filter(c => c.eventId === ev.id && c.active);
    const progress = activeCriteria.length > 0 ? submitted.length / activeCriteria.length : 0;
    const scored = submitted.filter(e => e.score != null);
    const avgRaw = scored.length > 0
      ? scored.reduce((s, e) => s + parseFloat(e.score as unknown as string), 0) / scored.length
      : null;
    const averageScore = avgRaw != null ? convertScoreToPercentage(avgRaw) : null;

    // Nota do time (mesma lógica de computeEventTeamResult): por critério ativo,
    // média das avaliações submetidas, substituída pela calibração quando existe.
    const evCals = calibrations.filter(c => c.eventId === ev.id);
    let evaluatedCriteria = 0;
    let hasCalibration = false;
    const criteriaForCalc = activeCriteria.map((c) => {
      const weight = parseFloat((c.weightOverride ?? c.defaultWeight ?? "1") as unknown as string);
      const critScores = submitted
        .filter(e => e.criterionId === c.criterionId && e.score != null)
        .map(e => parseFloat(e.score as unknown as string));
      const avgScore = critScores.length > 0 ? critScores.reduce((a, b) => a + b, 0) / critScores.length : null;
      const cal = evCals.find(x => x.criterionId === c.criterionId);
      const calibratedScore = cal ? parseFloat(cal.calibratedScore as unknown as string) : null;
      if (calibratedScore !== null) hasCalibration = true;
      if (calibratedScore !== null || avgScore !== null) evaluatedCriteria++;
      return { criterionId: c.criterionId as number, weight, averageScore: avgScore, calibratedScore };
    });
    const teamScore = evaluatedCriteria > 0 ? calculateEventResult(criteriaForCalc) : null;

    return { ...ev, participantCount, evaluationProgress: progress, totalCriteria: activeCriteria.length, submittedCount: submitted.length, averageScore, teamScore, hasCalibration };
  });
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
      criterionDescription: criteriaTable.description,
      responsibleAreaId: criteriaTable.responsibleAreaId,
      responsibleAreaName: areasTable.name,
      active: eventCriteriaTable.active,
      originalWeight: criteriaTable.defaultWeight,
      weightOverride: eventCriteriaTable.weightOverride,
      eventScoped: criteriaTable.eventScoped,
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

  // Non-confidential progress: share of evaluations already submitted for this
  // event. Mirrors the /events list metric so both views agree.
  // Denominator = total active criteria (not evaluations created in DB), because
  // criteria may exist without any evaluation record yet (submitted=0).
  const allEvals = await db.select({ status: evaluationsTable.status }).from(evaluationsTable).where(eq(evaluationsTable.eventId, id));
  const submittedCount = allEvals.filter(e => e.status === "submitted").length;
  const evaluationProgress = activeCriteria.length > 0 ? submittedCount / activeCriteria.length : 0;

  const areaAssignments = await db
    .select({
      id: eventAreaAssignmentsTable.id,
      eventId: eventAreaAssignmentsTable.eventId,
      areaId: eventAreaAssignmentsTable.areaId,
      areaName: areasTable.name,
      evaluatorUserId: eventAreaAssignmentsTable.evaluatorUserId,
      evaluatorName: usersTable.name,
    })
    .from(eventAreaAssignmentsTable)
    .leftJoin(areasTable, eq(eventAreaAssignmentsTable.areaId, areasTable.id))
    .leftJoin(usersTable, eq(eventAreaAssignmentsTable.evaluatorUserId, usersTable.id))
    .where(eq(eventAreaAssignmentsTable.eventId, id));

  const [conformity] = await db.select().from(eventConformitiesTable).where(eq(eventConformitiesTable.eventId, id));

  return { ...ev, participants, criteria: enrichedCriteria, areaAssignments, hasEvaluations, evaluationProgress, evaluationMatrix: [], results: [], conformity: conformity ?? null };
}

/**
 * Distinct areas that have at least one ACTIVE criterion for this event.
 * These are the areas that MUST have an evaluator assigned before release.
 */
async function areasNeedingAssignment(eventId: number): Promise<{ areaId: number; areaName: string | null }[]> {
  const rows = await db
    .select({ areaId: criteriaTable.responsibleAreaId, areaName: areasTable.name })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .leftJoin(areasTable, eq(criteriaTable.responsibleAreaId, areasTable.id))
    .where(and(eq(eventCriteriaTable.eventId, eventId), eq(eventCriteriaTable.active, true)));
  const seen = new Map<number, string | null>();
  for (const r of rows) {
    if (r.areaId != null && !seen.has(r.areaId)) seen.set(r.areaId, r.areaName);
  }
  return Array.from(seen.entries()).map(([areaId, areaName]) => ({ areaId, areaName }));
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
  const { name, clientName, location, city, state, startDate, endDate } = req.body;
  if (!name || !startDate || !endDate) {
    res.status(400).json({ error: "Campos obrigatórios: name, startDate, endDate" });
    return;
  }
  const cycle = await getCurrentCycle();
  if (!cycle) { res.status(400).json({ error: "Nenhum ciclo ativo" }); return; }
  const [ev] = await db.insert(eventsTable).values({
    name, clientName: clientName ?? null, location: location ?? null, city: city ?? null,
    state: state ?? null, startDate, endDate, cycleId: cycle.id,
  }).returning();

  const allCriteria = await db.select().from(criteriaTable).where(and(eq(criteriaTable.active, true), eq(criteriaTable.eventScoped, false)));
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

router.post("/events/:id/close", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { forced, reason } = req.body ?? {};
  const [ev] = await db.update(eventsTable).set({
    status: "closed",
    forcedClosed: !!forced,
    forcedCloseReason: reason ?? null,
  }).where(eq(eventsTable.id, id)).returning();
  if (!ev) { res.status(404).json({ error: "Não encontrado" }); return; }
  await audit(req.user!.userId, "close", "events", id);
  await recomputeCycleResults(ev.cycleId, req.user!.userId);
  res.json(ev);
});

router.post("/events/:id/reopen", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [ev] = await db.update(eventsTable).set({ status: "open", forcedClosed: false, forcedCloseReason: null }).where(eq(eventsTable.id, id)).returning();
  if (!ev) { res.status(404).json({ error: "Não encontrado" }); return; }
  await audit(req.user!.userId, "reopen", "events", id);
  await recomputeCycleResults(ev.cycleId, req.user!.userId);
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

// Matriz de Conformidade
router.get("/events/:id/conformity", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [conformity] = await db.select().from(eventConformitiesTable).where(eq(eventConformitiesTable.eventId, id));
  res.json(conformity ?? null);
});

router.post("/events/:id/conformity", requireRole("admin", "rh"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const { epi, estaiamentos, guardaEquipamentos, conduta } = req.body;
  const userId = req.user!.userId;

  const existing = await db.select().from(eventConformitiesTable).where(eq(eventConformitiesTable.eventId, eventId));
  if (existing.length > 0) {
    const [updated] = await db.update(eventConformitiesTable)
      .set({
        epi: epi ?? existing[0].epi,
        estaiamentos: estaiamentos ?? existing[0].estaiamentos,
        guardaEquipamentos: guardaEquipamentos ?? existing[0].guardaEquipamentos,
        conduta: conduta ?? existing[0].conduta,
        updatedAt: new Date(),
      })
      .where(eq(eventConformitiesTable.eventId, eventId))
      .returning();
    await audit(userId, "update_conformity", "events", eventId, existing[0], updated);
    res.json(updated);
  } else {
    const [created] = await db.insert(eventConformitiesTable)
      .values({ eventId, epi: epi ?? true, estaiamentos: estaiamentos ?? true, guardaEquipamentos: guardaEquipamentos ?? true, conduta: conduta ?? true, createdByUserId: userId })
      .returning();
    await audit(userId, "create_conformity", "events", eventId, null, created);
    res.status(201).json(created);
  }
});

router.get("/events/:id/criteria", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const criteria = await db
    .select({
      id: eventCriteriaTable.id,
      eventId: eventCriteriaTable.eventId,
      criterionId: eventCriteriaTable.criterionId,
      criterionName: criteriaTable.name,
      criterionDescription: criteriaTable.description,
      responsibleAreaId: criteriaTable.responsibleAreaId,
      responsibleAreaName: areasTable.name,
      active: eventCriteriaTable.active,
      originalWeight: criteriaTable.defaultWeight,
      weightOverride: eventCriteriaTable.weightOverride,
      eventScoped: criteriaTable.eventScoped,
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
  // Pesos livres (temporário): basta haver peso positivo. A nota do evento usa
  // média ponderada, então a soma dos pesos não precisa ser fixa.
  if (resultingActiveSum <= 0) {
    res.status(400).json({ error: "Defina pesos positivos para os critérios ativos." });
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

/**
 * POST /events/:id/criteria/duplicate
 * RH duplica um quesito (critério) DENTRO de um evento, dando um nome próprio à
 * cópia. A cópia é um critério com escopo de evento (eventScoped): não aparece na
 * lista global de critérios nem é anexado a outros eventos na sincronização.
 * Tem seu próprio criterionId, então é avaliada e pontuada de forma independente.
 * Body: { sourceCriterionId, name }
 */
router.post("/events/:id/criteria/duplicate", requireRole("admin", "rh"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const [ev] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!ev) { res.status(404).json({ error: "Não encontrado" }); return; }
  if (await eventHasEvaluations(eventId)) {
    res.status(409).json({ error: "Este evento já possui avaliações. Os critérios não podem mais ser alterados." });
    return;
  }

  const sourceCriterionId = Number(req.body?.sourceCriterionId);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!sourceCriterionId) { res.status(400).json({ error: "Informe o critério de origem (sourceCriterionId)" }); return; }

  const [link] = await db.select().from(eventCriteriaTable)
    .where(and(eq(eventCriteriaTable.eventId, eventId), eq(eventCriteriaTable.criterionId, sourceCriterionId)))
    .limit(1);
  if (!link) { res.status(404).json({ error: "Critério de origem não está vinculado a este evento" }); return; }

  const [source] = await db.select().from(criteriaTable).where(eq(criteriaTable.id, sourceCriterionId)).limit(1);
  if (!source) { res.status(404).json({ error: "Critério de origem não encontrado" }); return; }

  const [copy] = await db.insert(criteriaTable).values({
    name: name || `${source.name} (cópia)`,
    description: source.description,
    responsibleAreaId: source.responsibleAreaId,
    responsibleAreaLabel: source.responsibleAreaLabel,
    defaultWeight: source.defaultWeight,
    active: true,
    displayOrder: source.displayOrder,
    eventScoped: true,
  }).returning();

  // Começa com peso 0 para não quebrar a soma de 20; o RH redistribui depois.
  await db.insert(eventCriteriaTable).values({ eventId, criterionId: copy.id, active: true, weightOverride: "0" });

  await audit(req.user!.userId, "duplicate", "criteria", copy.id, null, { eventId, sourceCriterionId, name: copy.name });
  res.status(201).json(await loadEventDetail(eventId));
});

/**
 * DELETE /events/:id/criteria/:eventCriterionId
 * Exclui um quesito DUPLICADO (eventScoped) de um evento. Critérios padrão não
 * podem ser excluídos — apenas desativados pela tela de configuração.
 */
router.delete("/events/:id/criteria/:eventCriterionId", requireRole("admin", "rh"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const ecId = parseInt(req.params.eventCriterionId as string);
  if (await eventHasEvaluations(eventId)) {
    res.status(409).json({ error: "Este evento já possui avaliações. Os critérios não podem mais ser alterados." });
    return;
  }

  const [link] = await db.select().from(eventCriteriaTable)
    .where(and(eq(eventCriteriaTable.id, ecId), eq(eventCriteriaTable.eventId, eventId)))
    .limit(1);
  if (!link) { res.status(404).json({ error: "Critério do evento não encontrado" }); return; }

  const [crit] = await db.select().from(criteriaTable).where(eq(criteriaTable.id, link.criterionId)).limit(1);
  if (!crit?.eventScoped) {
    res.status(400).json({ error: "Apenas quesitos duplicados podem ser excluídos. Desative o critério padrão." });
    return;
  }

  await db.delete(eventCriteriaTable).where(eq(eventCriteriaTable.id, ecId));
  await db.delete(criteriaTable).where(eq(criteriaTable.id, link.criterionId));
  await audit(req.user!.userId, "delete", "criteria", link.criterionId, crit, null);
  res.json(await loadEventDetail(eventId));
});

/**
 * PUT /events/:id/assignments
 * RH define, por área, qual avaliador dará a nota daquela área NESTE evento.
 * Body: { assignments: [{ areaId, evaluatorUserId }] }
 * Upsert por (eventId, areaId). evaluatorUserId null/0 remove a atribuição da área.
 */
router.put("/events/:id/assignments", requireRole("admin", "rh"), async (req, res) => {
  const eventId = parseInt(req.params.id as string);
  const [ev] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!ev) { res.status(404).json({ error: "Não encontrado" }); return; }
  if (await eventHasEvaluations(eventId)) {
    res.status(409).json({ error: "Este evento já possui avaliações. As atribuições não podem mais ser alteradas." });
    return;
  }

  const items = (req.body?.assignments ?? []) as { areaId: number; evaluatorUserId: number | null }[];
  if (!Array.isArray(items)) {
    res.status(400).json({ error: "Envie a lista de atribuições (assignments)" });
    return;
  }

  for (const item of items) {
    const areaId = Number(item.areaId);
    if (!areaId) continue;
    const userId = item.evaluatorUserId ? Number(item.evaluatorUserId) : null;

    if (userId == null) {
      await db.delete(eventAreaAssignmentsTable)
        .where(and(eq(eventAreaAssignmentsTable.eventId, eventId), eq(eventAreaAssignmentsTable.areaId, areaId)));
      continue;
    }

    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!target || target.role !== "avaliador") {
      res.status(400).json({ error: "O avaliador atribuído deve ser um usuário com papel de avaliador" });
      return;
    }

    await db.insert(eventAreaAssignmentsTable)
      .values({ eventId, areaId, evaluatorUserId: userId })
      .onConflictDoUpdate({
        target: [eventAreaAssignmentsTable.eventId, eventAreaAssignmentsTable.areaId],
        set: { evaluatorUserId: userId },
      });
  }

  await audit(req.user!.userId, "set_assignments", "events", eventId, null, { assignments: items });
  res.json(await loadEventDetail(eventId));
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
    if (sum <= 0) {
      res.status(400).json({ error: "Defina pesos positivos para os critérios ativos antes de confirmar." });
      return;
    }

    // Atribuição obrigatória: toda área com critério ativo precisa ter um avaliador
    // definido pelo RH antes de liberar a avaliação do evento.
    const needAssign = await areasNeedingAssignment(id);
    const assigned = await db
      .select({ areaId: eventAreaAssignmentsTable.areaId })
      .from(eventAreaAssignmentsTable)
      .where(eq(eventAreaAssignmentsTable.eventId, id));
    const assignedAreaIds = new Set(assigned.map(a => a.areaId));
    const missing = needAssign.filter(a => !assignedAreaIds.has(a.areaId));
    if (missing.length > 0) {
      const names = missing.map(a => a.areaName ?? `área ${a.areaId}`).join(", ");
      res.status(400).json({ error: `Defina um avaliador para todas as áreas antes de liberar. Áreas sem avaliador: ${names}` });
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
