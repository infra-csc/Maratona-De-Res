import { Router } from "express";
import { db, evaluationsTable, criteriaTable, usersTable, eventsTable, eventCriteriaTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

/**
 * Freeze each active criterion's effective weight for an event so that later
 * edits to a global criterion's default weight can never alter an event that
 * already has evaluations. Idempotent: only fills null overrides.
 */
async function freezeEventCriteriaWeights(eventId: number) {
  const rows = await db
    .select({ id: eventCriteriaTable.id, active: eventCriteriaTable.active, weightOverride: eventCriteriaTable.weightOverride, defaultWeight: criteriaTable.defaultWeight })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .where(eq(eventCriteriaTable.eventId, eventId));
  for (const r of rows) {
    if (r.active && r.weightOverride == null) {
      await db.update(eventCriteriaTable)
        .set({ weightOverride: String(parseFloat(r.defaultWeight ?? "0")) })
        .where(eq(eventCriteriaTable.id, r.id));
    }
  }
}

/**
 * Avaliação por TIME do evento.
 * A nota é por (evento, critério, avaliador) — NÃO por colaborador.
 * O resultado do evento é aplicado a todos os participantes do time.
 *
 * GET /evaluations
 * - admin/rh/diretoria: veem tudo (mas nunca retornam avaliadorName para visualizador)
 * - avaliador: veem apenas avaliações de critérios da sua área
 * - visualizador: veem avaliações sem nome do avaliador
 */
router.get("/evaluations", async (req, res) => {
  const { eventId, status } = req.query;
  const user = req.user!;

  let criterionIds: number[] | null = null;
  if (user.role === "avaliador" && user.areaId) {
    const areaCriteria = await db.select({ id: criteriaTable.id })
      .from(criteriaTable)
      .where(eq(criteriaTable.responsibleAreaId, user.areaId));
    criterionIds = areaCriteria.map(c => c.id);
    if (criterionIds.length === 0) {
      res.json([]);
      return;
    }
  }

  let query = db.select({
    id: evaluationsTable.id,
    eventId: evaluationsTable.eventId,
    criterionId: evaluationsTable.criterionId,
    criterionName: criteriaTable.name,
    evaluatorUserId: evaluationsTable.evaluatorUserId,
    evaluatorName: usersTable.name,
    score: evaluationsTable.score,
    comments: evaluationsTable.comments,
    commentVisibility: evaluationsTable.commentVisibility,
    status: evaluationsTable.status,
    submittedAt: evaluationsTable.submittedAt,
    createdAt: evaluationsTable.createdAt,
  })
  .from(evaluationsTable)
  .leftJoin(criteriaTable, eq(evaluationsTable.criterionId, criteriaTable.id))
  .leftJoin(usersTable, eq(evaluationsTable.evaluatorUserId, usersTable.id))
  .$dynamic();

  const conditions = [];
  if (eventId) conditions.push(eq(evaluationsTable.eventId, parseInt(eventId as string)));
  if (status) conditions.push(eq(evaluationsTable.status, status as string));
  if (criterionIds) {
    const { inArray } = await import("drizzle-orm");
    conditions.push(inArray(evaluationsTable.criterionId, criterionIds));
  }
  if (conditions.length) query = query.where(and(...conditions));

  const evaluations = await query;

  const hideEvaluatorName = user.role === "visualizador";
  res.json(evaluations.map(e => ({
    ...e,
    score: parseFloat(e.score as unknown as string),
    evaluatorName: hideEvaluatorName ? null : e.evaluatorName,
    evaluatorUserId: hideEvaluatorName ? null : e.evaluatorUserId,
  })));
});

/**
 * POST /evaluations
 * Cria/atualiza a nota do TIME para um critério do evento.
 * avaliador só pode avaliar critérios da sua área.
 * Escala oficial: 1 a 5 (nota 0 não é permitida).
 */
router.post("/evaluations", requireRole("admin", "rh", "avaliador"), async (req, res) => {
  const { eventId, criterionId, score, comments, commentVisibility } = req.body;
  if (!eventId || !criterionId || score === undefined) {
    res.status(400).json({ error: "Campos obrigatórios: eventId, criterionId, score" });
    return;
  }
  const numScore = parseFloat(score);
  if (isNaN(numScore) || numScore < 1 || numScore > 5) {
    res.status(400).json({ error: "A nota deve estar entre 1 e 5 (nota 0 não é permitida na avaliação oficial)" });
    return;
  }
  if (numScore < 3 && (!comments || comments.trim().length === 0)) {
    res.status(400).json({ error: "Comentário obrigatório para pontuação inferior a 3" });
    return;
  }

  // Avaliador só pode avaliar critérios da sua própria área
  if (req.user!.role === "avaliador") {
    if (!req.user!.areaId) {
      res.status(403).json({ error: "Avaliador sem área definida — contate o administrador" });
      return;
    }
    const [criterion] = await db.select().from(criteriaTable).where(eq(criteriaTable.id, criterionId)).limit(1);
    if (!criterion || criterion.responsibleAreaId !== req.user!.areaId) {
      res.status(403).json({ error: "Você só pode avaliar quesitos da sua área de responsabilidade" });
      return;
    }
  }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event || event.status === "closed") {
    res.status(400).json({ error: "Evento fechado ou não encontrado" });
    return;
  }
  if (req.user!.role === "avaliador" && !event.criteriaConfirmed) {
    res.status(400).json({ error: "Os critérios deste evento ainda não foram confirmados pelo RH. Aguarde a liberação para avaliar." });
    return;
  }

  const [existing] = await db.select().from(evaluationsTable)
    .where(and(
      eq(evaluationsTable.eventId, eventId),
      eq(evaluationsTable.criterionId, criterionId),
      eq(evaluationsTable.evaluatorUserId, req.user!.userId),
    )).limit(1);

  let evaluation;
  if (existing) {
    if (existing.status === "submitted") {
      res.status(400).json({ error: "Avaliação já submetida e bloqueada para edição" });
      return;
    }
    [evaluation] = await db.update(evaluationsTable).set({
      score: String(numScore),
      comments: comments ?? existing.comments,
      commentVisibility: commentVisibility ?? existing.commentVisibility,
    }).where(eq(evaluationsTable.id, existing.id)).returning();
  } else {
    // First evaluation for this (event, criterion, evaluator): freeze the
    // event's criteria weights so they can never drift once evaluations exist.
    await freezeEventCriteriaWeights(eventId);
    [evaluation] = await db.insert(evaluationsTable).values({
      eventId, criterionId,
      evaluatorUserId: req.user!.userId,
      score: String(numScore),
      comments: comments ?? null,
      commentVisibility: commentVisibility ?? "internal",
    }).returning();
  }
  res.status(201).json({ ...evaluation, score: parseFloat(evaluation.score as unknown as string) });
});

router.patch("/evaluations/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { score, comments, commentVisibility } = req.body;

  const [existing] = await db.select().from(evaluationsTable).where(eq(evaluationsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Não encontrado" }); return; }
  if (existing.status === "submitted") {
    res.status(400).json({ error: "Avaliação já submetida e bloqueada para edição" });
    return;
  }
  if (existing.evaluatorUserId !== req.user!.userId && !["admin", "rh"].includes(req.user!.role)) {
    res.status(403).json({ error: "Sem permissão para editar esta avaliação" });
    return;
  }

  // Avaliador só pode editar critérios da sua área
  if (req.user!.role === "avaliador" && req.user!.areaId) {
    const [criterion] = await db.select().from(criteriaTable).where(eq(criteriaTable.id, existing.criterionId)).limit(1);
    if (!criterion || criterion.responsibleAreaId !== req.user!.areaId) {
      res.status(403).json({ error: "Você só pode editar quesitos da sua área de responsabilidade" });
      return;
    }
  }

  const numScore = score !== undefined ? parseFloat(score) : parseFloat(existing.score as unknown as string);
  if (score !== undefined && (isNaN(numScore) || numScore < 1 || numScore > 5)) {
    res.status(400).json({ error: "A nota deve estar entre 1 e 5 (nota 0 não é permitida)" });
    return;
  }
  const finalComments = comments !== undefined ? comments : existing.comments;
  if (numScore < 3 && (!finalComments || finalComments.trim().length === 0)) {
    res.status(400).json({ error: "Comentário obrigatório para pontuação inferior a 3" });
    return;
  }

  const [evaluation] = await db.update(evaluationsTable).set({
    ...(score !== undefined && { score: String(numScore) }),
    ...(comments !== undefined && { comments }),
    ...(commentVisibility !== undefined && { commentVisibility }),
  }).where(eq(evaluationsTable.id, id)).returning();
  res.json({ ...evaluation, score: parseFloat(evaluation.score as unknown as string) });
});

router.post("/evaluations/:id/submit", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [existing] = await db.select().from(evaluationsTable).where(eq(evaluationsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Não encontrado" }); return; }
  if (existing.evaluatorUserId !== req.user!.userId && !["admin", "rh"].includes(req.user!.role)) {
    res.status(403).json({ error: "Sem permissão para submeter esta avaliação" });
    return;
  }
  // Avaliador só pode submeter critérios da sua área
  if (req.user!.role === "avaliador" && req.user!.areaId) {
    const [criterion] = await db.select().from(criteriaTable).where(eq(criteriaTable.id, existing.criterionId)).limit(1);
    if (!criterion || criterion.responsibleAreaId !== req.user!.areaId) {
      res.status(403).json({ error: "Você só pode submeter avaliações da sua área de responsabilidade" });
      return;
    }
  }
  const numScore = parseFloat(existing.score as unknown as string);
  if (numScore < 3 && (!existing.comments || existing.comments.trim().length === 0)) {
    res.status(400).json({ error: "Comentário obrigatório para pontuação inferior a 3 antes de submeter" });
    return;
  }
  const [evaluation] = await db.update(evaluationsTable).set({
    status: "submitted",
    submittedAt: new Date(),
  }).where(eq(evaluationsTable.id, id)).returning();
  await audit(req.user!.userId, "submit", "evaluations", id, existing, evaluation);
  res.json({ ...evaluation, score: parseFloat(evaluation.score as unknown as string) });
});

router.post("/evaluations/:id/reopen", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [existing] = await db.select().from(evaluationsTable).where(eq(evaluationsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Não encontrado" }); return; }
  const [evaluation] = await db.update(evaluationsTable).set({
    status: "draft",
    submittedAt: null,
  }).where(eq(evaluationsTable.id, id)).returning();
  await audit(req.user!.userId, "reopen", "evaluations", id, existing, evaluation);
  res.json({ ...evaluation, score: parseFloat(evaluation.score as unknown as string) });
});

export default router;
