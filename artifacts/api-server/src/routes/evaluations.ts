import { Router } from "express";
import { db, evaluationsTable, criteriaTable, usersTable, eventsTable, eventCriteriaTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole, isRole } from "../lib/auth.js";
import { autoReleaseSafely, isOpenForEvaluation, opensLabel } from "../lib/evaluation-release.js";
import { evaluatorVisibleEvaluationsSql } from "../lib/evaluator-visibility.js";
import { audit } from "../lib/audit.js";
import type { DbOrTx } from "../lib/db-tx.js";
import { recomputeCycleResults } from "./results.js";
import { pgNum } from "../lib/pg-num.js";
import {
  evaluationAccess, findClosure, closedMessage, lockCriterionInEvent, AreaClosedError, noAccessBody, lockEventCycleShared,
  dayAfterLockMessage, tokenSubmitterNameSql, type EvaluationAccess,
} from "../lib/area-evaluation.js";

// Submissão/reabertura muda a média do critério; se o evento já conta para o
// ciclo (resultsConfirmed ou fechado), o snapshot oficial precisa acompanhar.
async function recomputeIfEventCounts(eventId: number, userId: number): Promise<void> {
  const [ev] = await db.select({ cycleId: eventsTable.cycleId, resultsConfirmed: eventsTable.resultsConfirmed, status: eventsTable.status })
    .from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (ev && (ev.resultsConfirmed || ev.status === "closed")) await recomputeCycleResults(ev.cycleId, userId);
}

const router = Router();
router.use(requireAuth);

// Quem pode avaliar (designado no evento OU avaliador da área do critério) e a
// regra "a primeira resposta da área fecha" vivem em lib/area-evaluation.ts.

// Audio justification paths must point at an uploaded object entity
// (/objects/uploads/<id>). This prevents bypassing the "áudio obrigatório"
// rule by saving an arbitrary non-empty string as the audioUrl.
const AUDIO_PATH_RE = /^\/objects\/uploads\/[^/\s]+$/;
function isValidAudioPath(value: unknown): value is string {
  return typeof value === "string" && AUDIO_PATH_RE.test(value.trim());
}

class AlreadySubmittedError extends Error {
  constructor() { super("Avaliação já submetida e bloqueada para edição"); }
}
/** Permissão conferida de novo dentro da transação do envio (B2) e negada. */
class NoAccessError extends Error {
  constructor(readonly access: EvaluationAccess) { super("Sem acesso ao critério"); }
}

/**
 * Freeze each active criterion's effective weight for an event so that later
 * edits to a global criterion's default weight can never alter an event that
 * already has evaluations. Idempotent: only fills null overrides.
 */
export async function freezeEventCriteriaWeights(eventId: number, exec: DbOrTx = db) {
  const rows = await exec
    .select({ id: eventCriteriaTable.id, active: eventCriteriaTable.active, weightOverride: eventCriteriaTable.weightOverride, defaultWeight: criteriaTable.defaultWeight })
    .from(eventCriteriaTable)
    .leftJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .where(eq(eventCriteriaTable.eventId, eventId));
  for (const r of rows) {
    if (r.active && r.weightOverride == null) {
      await exec.update(eventCriteriaTable)
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
 * - admin/rh/diretoria: veem tudo
 * - avaliador: as próprias (rascunho inclusive) e, de OUTRAS pessoas, só as
 *   ENVIADAS (B1: rascunho de colega — nota, comentário, áudio — não aparece)
 *   da ÁREA DO CADASTRO, da área em que foi designado no evento e, no ciclo
 *   SEM avaliação por área (fluxo antigo), das áreas em que é avaliador
 *   principal (getPrincipalAreaIds, como sempre foi)
 * - operador: vê só o status (nota, comentário e áudio redigidos)
 * - visualizador: lista vazia (o colaborador usa GET /my-performance)
 */
router.get("/evaluations", async (req, res) => {
  const { eventId, status } = req.query;
  const user = req.user!;

  // Visualizador (colaborador) não recebe avaliação de ninguém: nota por
  // avaliador, comentários internos e caminho do áudio são dados de RH. O que
  // lhe cabe (média do time, comentários marcados "public", matriz resumida)
  // chega por GET /my-performance. Devolve lista vazia em vez de 403 porque a
  // tela /evaluations (alcançável por URL) trata o papel como "consulta" e
  // renderiza o estado vazio sem erro nem toast.
  if (isRole(user.role, "visualizador")) {
    res.json([]);
    return;
  }

  let query = db.select({
    id: evaluationsTable.id,
    eventId: evaluationsTable.eventId,
    criterionId: evaluationsTable.criterionId,
    criterionName: criteriaTable.name,
    evaluatorUserId: evaluationsTable.evaluatorUserId,
    evaluatorName: usersTable.name,
    // Freela que respondeu pelo link: vínculo gravado no envio
    // (public_token_id) ou, antes da 0011, a ligação exata do envio.
    tokenSubmitterName: tokenSubmitterNameSql(),
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

  const conditions = [];
  if (eventId) conditions.push(eq(evaluationsTable.eventId, parseInt(eventId as string)));
  if (status) conditions.push(eq(evaluationsTable.status, status as string));

  // Avaliador (regra do dono: só vê o que foi avaliado da SUA área): as
  // PRÓPRIAS avaliações (rascunho inclusive) e, de outras pessoas, só as
  // ENVIADAS: da área do próprio cadastro — quem responde pela área precisa
  // ver quem já respondeu cada critério e quando —, da área em que foi
  // designado NAQUELE evento e, no fluxo antigo, das áreas em que é o
  // avaliador principal. Nada de outras áreas.
  // (Regra única em lib/evaluator-visibility.ts — o áudio em /storage usa a mesma.)
  if (isRole(user.role, "avaliador")) {
    conditions.push(await evaluatorVisibleEvaluationsSql(user.userId));
  }

  if (conditions.length) query = query.where(and(...conditions));

  const evaluations = await query;

  // Defensivo: o visualizador já saiu acima com lista vazia.
  const hideEvaluatorName = isRole(user.role, "visualizador");
  // "operador" atribui/envia avaliações mas nunca deve ver o CONTEÚDO de uma
  // resposta já enviada (nota, comentário, áudio) — só se foi respondida ou
  // não. Redact aqui, na origem, em vez de confiar só na UI escondendo o
  // botão "Ver resposta" (a API não pode devolver o dado que a tela esconde).
  const redactContent = isRole(user.role, "operador");
  res.json(evaluations.map(e => ({
    ...e,
    score: redactContent ? null : pgNum(e.score),
    comments: redactContent ? null : e.comments,
    audioUrl: redactContent ? null : e.audioUrl,
    evaluatorName: hideEvaluatorName ? null : (e.tokenSubmitterName ?? e.evaluatorName),
    evaluatorUserId: hideEvaluatorName ? null : e.evaluatorUserId,
    tokenSubmitterName: undefined, // strip internal field
  })));
});

/**
 * POST /evaluations
 * Cria/atualiza o RASCUNHO da nota do TIME para um critério do evento.
 * Avaliador: só critérios para os quais foi designado no evento OU da área do
 * seu cadastro; pela área, um critério já respondido por outra pessoa fica
 * fechado (409). Escala oficial: 0 a 10. Comentário obrigatório no submit;
 * áudio é opcional.
 */
router.post("/evaluations", requireRole("admin", "rh", "avaliador"), async (req, res) => {
  const { eventId, criterionId, score, comments, commentVisibility, audioUrl } = req.body;
  if (!eventId || !criterionId || score === undefined) {
    res.status(400).json({ error: "Campos obrigatórios: eventId, criterionId, score" });
    return;
  }
  const numScore = parseFloat(score);
  if (isNaN(numScore) || numScore < 0 || numScore > 10) {
    res.status(400).json({ error: "A nota deve estar entre 0 e 10" });
    return;
  }
  if (audioUrl !== undefined && audioUrl !== null && !isValidAudioPath(audioUrl)) {
    res.status(400).json({ error: "Áudio inválido: o arquivo de áudio deve ser enviado pelo gravador." });
    return;
  }

  const access = await evaluationAccess(eventId, criterionId, req.user!);
  if (!access.allowed) {
    res.status(403).json(noAccessBody(access));
    return;
  }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event || event.status === "closed") {
    res.status(400).json({ error: "Evento fechado ou não encontrado" });
    return;
  }
  if (isRole(req.user!.role, "avaliador")) {
    // A avaliação abre no dia seguinte ao evento — sozinha, sem depender do RH.
    if (!isOpenForEvaluation(event)) {
      res.status(400).json({ error: `A avaliação deste evento abre ${opensLabel(event)} (dia seguinte ao evento).` });
      return;
    }
    if (!event.criteriaConfirmed && (await autoReleaseSafely({ eventIds: [eventId] })).length === 0) {
      res.status(400).json({ error: "Os critérios deste evento ainda não foram confirmados pelo RH. Aguarde a liberação para avaliar." });
      return;
    }
  }

  const [existing] = await db.select().from(evaluationsTable)
    .where(and(
      eq(evaluationsTable.eventId, eventId),
      eq(evaluationsTable.criterionId, criterionId),
      eq(evaluationsTable.evaluatorUserId, req.user!.userId),
    )).limit(1);

  if (existing?.status === "submitted") {
    res.status(400).json({ error: "Avaliação já submetida e bloqueada para edição" });
    return;
  }
  // Modo por área: critério já respondido por QUALQUER pessoa está fechado
  // (designado inclusive). Fluxo antigo: designados somam na média.
  if (access.firstAnswerCloses) {
    const closure = await findClosure(db, eventId, criterionId, existing?.id);
    if (closure) {
      res.status(409).json({ error: closedMessage(closure), code: "AREA_ALREADY_ANSWERED" });
      return;
    }
  }

  let evaluation;
  if (existing) {
    [evaluation] = await db.update(evaluationsTable).set({
      score: String(numScore),
      comments: comments ?? existing.comments,
      commentVisibility: commentVisibility ?? existing.commentVisibility,
      audioUrl: audioUrl ?? existing.audioUrl,
    }).where(eq(evaluationsTable.id, existing.id)).returning();
  } else {
    // First evaluation for this (event, criterion, evaluator): freeze the
    // event's criteria weights so they can never drift once evaluations exist.
    // Congelamento e inserção na MESMA transação: se a inserção falhar, os
    // pesos não ficam congelados "à toa" (e vice-versa: nunca existe avaliação
    // num evento com pesos ainda flutuando).
    evaluation = await db.transaction(async (tx) => {
      await freezeEventCriteriaWeights(eventId, tx);
      const [row] = await tx.insert(evaluationsTable).values({
        eventId, criterionId,
        evaluatorUserId: req.user!.userId,
        score: String(numScore),
        comments: comments ?? null,
        commentVisibility: commentVisibility ?? "internal",
        audioUrl: audioUrl ?? null,
      }).onConflictDoUpdate({
        // Duplo clique/duas abas: a segunda inserção do mesmo (evento, critério,
        // avaliador) vira atualização do rascunho em vez de uma linha duplicada.
        target: [evaluationsTable.eventId, evaluationsTable.criterionId, evaluationsTable.evaluatorUserId],
        set: { score: String(numScore), comments: comments ?? null, commentVisibility: commentVisibility ?? "internal", audioUrl: audioUrl ?? null },
      }).returning();
      return row;
    });
  }
  res.status(201).json({ ...evaluation, score: pgNum(evaluation.score) });
});

router.patch("/evaluations/:id", requireRole("admin", "rh", "avaliador"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { score, comments, commentVisibility, audioUrl } = req.body;

  const [existing] = await db.select().from(evaluationsTable).where(eq(evaluationsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Não encontrado" }); return; }
  if (existing.status === "submitted") {
    res.status(400).json({ error: "Avaliação já submetida e bloqueada para edição" });
    return;
  }
  if (existing.evaluatorUserId !== req.user!.userId && !isRole(req.user!.role, "admin") && !isRole(req.user!.role, "rh")) {
    res.status(403).json({ error: "Sem permissão para editar esta avaliação" });
    return;
  }

  const access = await evaluationAccess(existing.eventId, existing.criterionId, req.user!);
  if (!access.allowed) {
    res.status(403).json(noAccessBody(access));
    return;
  }
  // Mesma trava do POST: o avaliador só escreve a partir do dia seguinte ao evento.
  if (isRole(req.user!.role, "avaliador")) {
    const lock = await dayAfterLockMessage(existing.eventId);
    if (lock) { res.status(400).json({ error: lock }); return; }
  }
  if (access.firstAnswerCloses) {
    const closure = await findClosure(db, existing.eventId, existing.criterionId, existing.id);
    if (closure) {
      res.status(409).json({ error: closedMessage(closure), code: "AREA_ALREADY_ANSWERED" });
      return;
    }
  }

  const numScore = score !== undefined ? parseFloat(score) : pgNum(existing.score);
  if (score !== undefined && (isNaN(numScore) || numScore < 0 || numScore > 10)) {
    res.status(400).json({ error: "A nota deve estar entre 0 e 10" });
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
  res.json({ ...evaluation, score: pgNum(evaluation.score) });
});

router.post("/evaluations/:id/submit", requireRole("admin", "rh", "avaliador"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [existing] = await db.select().from(evaluationsTable).where(eq(evaluationsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Não encontrado" }); return; }
  if (existing.evaluatorUserId !== req.user!.userId && !isRole(req.user!.role, "admin") && !isRole(req.user!.role, "rh")) {
    res.status(403).json({ error: "Sem permissão para submeter esta avaliação" });
    return;
  }
  const access = await evaluationAccess(existing.eventId, existing.criterionId, req.user!);
  if (!access.allowed) {
    res.status(403).json(noAccessBody(access));
    return;
  }
  if (existing.status === "submitted") {
    res.status(400).json({ error: "Avaliação já submetida e bloqueada para edição" });
    return;
  }
  // Rascunho criado antes (ou por outro caminho) também só é enviado a partir
  // do dia seguinte ao evento.
  if (isRole(req.user!.role, "avaliador")) {
    const lock = await dayAfterLockMessage(existing.eventId);
    if (lock) { res.status(400).json({ error: lock }); return; }
  }
  // Comentário/justificativa é o único campo obrigatório além da nota, igual
  // ao formulário oficial do MS Forms. Áudio é opcional (complemento, não
  // travamento de envio).
  if (!existing.comments || !existing.comments.trim()) {
    res.status(400).json({ error: "Comentário obrigatório: preencha a justificativa antes de submeter." });
    return;
  }

  let evaluation;
  try {
    evaluation = await db.transaction(async (tx) => {
      // B2 (4ª revisão): trava compartilhada no ciclo — o PATCH /cycles que
      // troca a avaliação por área espera este envio (ou este envio espera a
      // troca e confere de novo, abaixo, com a regra já gravada).
      await lockEventCycleShared(tx, existing.eventId);
      const accessNow = await evaluationAccess(existing.eventId, existing.criterionId, req.user!, tx);
      if (!accessNow.allowed) throw new NoAccessError(accessNow);
      // Trava o critério no evento: envios simultâneos ficam em fila, e o
      // segundo enxerga a resposta que acabou de ser gravada.
      await lockCriterionInEvent(tx, existing.eventId, [existing.criterionId]);
      if (accessNow.firstAnswerCloses) {
        const closure = await findClosure(tx, existing.eventId, existing.criterionId, existing.id);
        if (closure) throw new AreaClosedError(closure);
      }
      const [row] = await tx.update(evaluationsTable).set({
        status: "submitted",
        submittedAt: new Date(),
      }).where(and(eq(evaluationsTable.id, id), eq(evaluationsTable.status, "draft"))).returning();
      if (!row) throw new AlreadySubmittedError();
      return row;
    });
  } catch (e) {
    if (e instanceof NoAccessError) { res.status(403).json(noAccessBody(e.access)); return; }
    if (e instanceof AreaClosedError) { res.status(409).json({ error: e.message, code: "AREA_ALREADY_ANSWERED" }); return; }
    if (e instanceof AlreadySubmittedError) { res.status(400).json({ error: e.message }); return; }
    throw e;
  }
  await audit(req.user!.userId, "submit", "evaluations", id, existing, evaluation);
  await recomputeIfEventCounts(existing.eventId, req.user!.userId);
  res.json({ ...evaluation, score: pgNum(evaluation.score) });
});

router.post("/evaluations/:id/reopen", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [existing] = await db.select().from(evaluationsTable).where(eq(evaluationsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Não encontrado" }); return; }
  const [evaluation] = await db.update(evaluationsTable).set({
    status: "draft",
    submittedAt: null,
    // Reaberta: o próximo envio é de quem enviar (tela ou outro link).
    publicTokenId: null,
  }).where(eq(evaluationsTable.id, id)).returning();
  await audit(req.user!.userId, "reopen", "evaluations", id, existing, evaluation);
  await recomputeIfEventCounts(existing.eventId, req.user!.userId);
  res.json({ ...evaluation, score: pgNum(evaluation.score) });
});

/**
 * DELETE /evaluations/:id — apaga um RASCUNHO. Só o dono do rascunho (ou
 * admin/RH). Enviada não se apaga (409): reabrir é com admin/RH. Serve para
 * limpar o rascunho que ficou "órfão" quando outra pessoa da área enviou
 * primeiro (modo por área) — B2.
 */
router.delete("/evaluations/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "ID inválido" }); return; }
  const [existing] = await db.select().from(evaluationsTable).where(eq(evaluationsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Não encontrado" }); return; }
  const isOwner = existing.evaluatorUserId === req.user!.userId;
  if (!isOwner && !isRole(req.user!.role, "admin") && !isRole(req.user!.role, "rh")) {
    res.status(403).json({ error: "Só quem escreveu o rascunho pode apagá-lo" });
    return;
  }
  if (existing.status !== "draft") {
    res.status(409).json({ error: "Avaliação já enviada não pode ser apagada" });
    return;
  }
  const [deleted] = await db.delete(evaluationsTable)
    .where(and(eq(evaluationsTable.id, id), eq(evaluationsTable.status, "draft")))
    .returning({ id: evaluationsTable.id });
  if (!deleted) { res.status(409).json({ error: "Avaliação já enviada não pode ser apagada" }); return; }
  await audit(req.user!.userId, "delete_draft", "evaluations", id, existing, null);
  res.json({ ok: true });
});

export default router;
