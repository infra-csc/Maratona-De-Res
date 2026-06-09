import { Router } from "express";
import { db, evaluationsTable, criteriaTable, usersTable, eventsTable, eventCriteriaTable, eventAreaAssignmentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

/**
 * Per-event assignment check: is `userId` the RH-designated evaluator for the
 * area that owns `criterionId`, in this specific event? This REPLACES the old
 * "criterion area == user's fixed profile area" rule. Multiple users can belong
 * to an area, but only the one RH assigned for the event may score it.
 */
// Audio justification paths must point at an uploaded object entity
// (/objects/uploads/<id>). This prevents bypassing the "áudio obrigatório"
// rule by saving an arbitrary non-empty string as the audioUrl.
const AUDIO_PATH_RE = /^\/objects\/uploads\/[^/\s]+$/;
function isValidAudioPath(value: unknown): value is string {
  return typeof value === "string" && AUDIO_PATH_RE.test(value.trim());
}

async function isAssignedForCriterion(eventId: number, criterionId: number, userId: number): Promise<boolean> {
  const [crit] = await db
    .select({ areaId: criteriaTable.responsibleAreaId })
    .from(criteriaTable)
    .where(eq(criteriaTable.id, criterionId))
    .limit(1);
  if (!crit || crit.areaId == null) return false;
  const [assignment] = await db
    .select({ id: eventAreaAssignmentsTable.id })
    .from(eventAreaAssignmentsTable)
    .where(and(
      eq(eventAreaAssignmentsTable.eventId, eventId),
      eq(eventAreaAssignmentsTable.areaId, crit.areaId),
      eq(eventAreaAssignmentsTable.evaluatorUserId, userId),
    ))
    .limit(1);
  return !!assignment;
}

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

  let query = db.select({
    id: evaluationsTable.id,
    eventId: evaluationsTable.eventId,
    criterionId: evaluationsTable.criterionId,
    criterionName: criteriaTable.name,
    evaluatorUserId: evaluationsTable.evaluatorUserId,
    evaluatorName: usersTable.name,
    score: evaluationsTable.score,
    comments: evaluationsTable.comments,
    audioUrl: evaluationsTable.audioUrl,
    commentVisibility: evaluationsTable.commentVisibility,
    status: evaluationsTable.status,
    submittedAt: evaluationsTable.submittedAt,
    createdAt: evaluationsTable.createdAt,
  })
  .from(evaluationsTable)
  .leftJoin(criteriaTable, eq(evaluationsTable.criterionId, criteriaTable.id))
  .leftJoin(usersTable, eq(evaluationsTable.evaluatorUserId, usersTable.id))
  .$dynamic();

  // Avaliador: só enxerga avaliações das áreas em que FOI DESIGNADO neste evento.
  // O escopo agora é por atribuição evento→área→avaliador, não pela área fixa do perfil.
  if (user.role === "avaliador") {
    query = query.innerJoin(eventAreaAssignmentsTable, and(
      eq(eventAreaAssignmentsTable.eventId, evaluationsTable.eventId),
      eq(eventAreaAssignmentsTable.areaId, criteriaTable.responsibleAreaId),
      eq(eventAreaAssignmentsTable.evaluatorUserId, user.userId),
    ));
  }

  const conditions = [];
  if (eventId) conditions.push(eq(evaluationsTable.eventId, parseInt(eventId as string)));
  if (status) conditions.push(eq(evaluationsTable.status, status as string));
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
 * Escala oficial: 1 a 10 (nota 0 não é permitida). Áudio obrigatório no submit.
 */
router.post("/evaluations", requireRole("admin", "rh", "avaliador"), async (req, res) => {
  const { eventId, criterionId, score, comments, commentVisibility, audioUrl } = req.body;
  if (!eventId || !criterionId || score === undefined) {
    res.status(400).json({ error: "Campos obrigatórios: eventId, criterionId, score" });
    return;
  }
  const numScore = parseFloat(score);
  if (isNaN(numScore) || numScore < 1 || numScore > 10) {
    res.status(400).json({ error: "A nota deve estar entre 1 e 10 (nota 0 não é permitida na avaliação oficial)" });
    return;
  }
  if (numScore < 6 && (!comments || comments.trim().length === 0)) {
    res.status(400).json({ error: "Comentário obrigatório para pontuação inferior a 6" });
    return;
  }
  if (audioUrl !== undefined && audioUrl !== null && !isValidAudioPath(audioUrl)) {
    res.status(400).json({ error: "Áudio inválido: o arquivo de áudio deve ser enviado pelo gravador." });
    return;
  }

  // Avaliador só pode avaliar áreas para as quais foi designado NESTE evento.
  if (req.user!.role === "avaliador") {
    const allowed = await isAssignedForCriterion(eventId, criterionId, req.user!.userId);
    if (!allowed) {
      res.status(403).json({ error: "Você não é o avaliador designado para esta área neste evento" });
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
      audioUrl: audioUrl ?? existing.audioUrl,
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
      audioUrl: audioUrl ?? null,
    }).returning();
  }
  res.status(201).json({ ...evaluation, score: parseFloat(evaluation.score as unknown as string) });
});

router.patch("/evaluations/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { score, comments, commentVisibility, audioUrl } = req.body;

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

  // Avaliador só pode editar áreas para as quais foi designado NESTE evento.
  if (req.user!.role === "avaliador") {
    const allowed = await isAssignedForCriterion(existing.eventId, existing.criterionId, req.user!.userId);
    if (!allowed) {
      res.status(403).json({ error: "Você não é o avaliador designado para esta área neste evento" });
      return;
    }
  }

  const numScore = score !== undefined ? parseFloat(score) : parseFloat(existing.score as unknown as string);
  if (score !== undefined && (isNaN(numScore) || numScore < 1 || numScore > 10)) {
    res.status(400).json({ error: "A nota deve estar entre 1 e 10 (nota 0 não é permitida)" });
    return;
  }
  const finalComments = comments !== undefined ? comments : existing.comments;
  if (numScore < 6 && (!finalComments || finalComments.trim().length === 0)) {
    res.status(400).json({ error: "Comentário obrigatório para pontuação inferior a 6" });
    return;
  }
  if (audioUrl !== undefined && audioUrl !== null && !isValidAudioPath(audioUrl)) {
    res.status(400).json({ error: "Áudio inválido: o arquivo de áudio deve ser enviado pelo gravador." });
    return;
  }

  const [evaluation] = await db.update(evaluationsTable).set({
    ...(score !== undefined && { score: String(numScore) }),
    ...(comments !== undefined && { comments }),
    ...(commentVisibility !== undefined && { commentVisibility }),
    ...(audioUrl !== undefined && { audioUrl }),
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
  // Avaliador só pode submeter áreas para as quais foi designado NESTE evento.
  if (req.user!.role === "avaliador") {
    const allowed = await isAssignedForCriterion(existing.eventId, existing.criterionId, req.user!.userId);
    if (!allowed) {
      res.status(403).json({ error: "Você não é o avaliador designado para esta área neste evento" });
      return;
    }
  }
  const numScore = parseFloat(existing.score as unknown as string);
  if (numScore < 6 && (!existing.comments || existing.comments.trim().length === 0)) {
    res.status(400).json({ error: "Comentário obrigatório para pontuação inferior a 6 antes de submeter" });
    return;
  }
  if (!isValidAudioPath(existing.audioUrl)) {
    res.status(400).json({ error: "Áudio obrigatório: grave um áudio explicando a avaliação antes de submeter." });
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
