import { Router } from "express";
import { db, evaluationsTable, calibrationsTable, employeesTable, criteriaTable, usersTable, eventCriteriaTable, eventParticipantsTable, eventsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

/**
 * GET /evaluations
 * - admin/rh/diretoria: veem tudo (mas nunca retornam avaliadorName para visualizador/colaborador)
 * - avaliador: veem apenas avaliações de critérios da sua área
 * - visualizador: veem avaliações sem nome do avaliador
 */
router.get("/evaluations", async (req, res) => {
  const { eventId, employeeId, status } = req.query;
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
    employeeId: evaluationsTable.employeeId,
    employeeName: employeesTable.name,
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
  .leftJoin(employeesTable, eq(evaluationsTable.employeeId, employeesTable.id))
  .leftJoin(criteriaTable, eq(evaluationsTable.criterionId, criteriaTable.id))
  .leftJoin(usersTable, eq(evaluationsTable.evaluatorUserId, usersTable.id))
  .$dynamic();

  const conditions = [];
  if (eventId) conditions.push(eq(evaluationsTable.eventId, parseInt(eventId as string)));
  if (employeeId) conditions.push(eq(evaluationsTable.employeeId, parseInt(employeeId as string)));
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
 * avaliador só pode avaliar critérios da sua área.
 */
router.post("/evaluations", requireRole("admin", "rh", "avaliador"), async (req, res) => {
  const { eventId, employeeId, criterionId, score, comments, commentVisibility } = req.body;
  if (!eventId || !employeeId || !criterionId || score === undefined) {
    res.status(400).json({ error: "Campos obrigatórios: eventId, employeeId, criterionId, score" });
    return;
  }
  const numScore = parseFloat(score);
  if (isNaN(numScore) || numScore < 0 || numScore > 5) {
    res.status(400).json({ error: "score deve estar entre 0 e 5" });
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

  const [existing] = await db.select().from(evaluationsTable)
    .where(and(
      eq(evaluationsTable.eventId, eventId),
      eq(evaluationsTable.employeeId, employeeId),
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
    [evaluation] = await db.insert(evaluationsTable).values({
      eventId, employeeId, criterionId,
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
