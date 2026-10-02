import { Router } from "express";
import { db, calibrationsTable, calibrationCommentsTable, criteriaTable, usersTable, areasTable, eventsTable, auditLogsTable, eventCriteriaTable } from "@workspace/db";
import { eq, and, inArray, desc, isNull } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { pgNum } from "../lib/pg-num.js";

const router = Router();
router.use(requireAuth);

/**
 * Calibração no nível do critério do evento/time (NÃO por colaborador).
 * A nota calibrada substitui a nota original no cálculo do evento e é aplicada
 * a todos os participantes daquele evento.
 */
// Calibração salva (ainda não publicada) é rascunho do calibrador: só quem
// calibra lê. Antes, qualquer usuário logado (inclusive colaborador) lia.
router.get("/calibrations", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const { eventId } = req.query;
  let query = db.select({
    id: calibrationsTable.id,
    eventId: calibrationsTable.eventId,
    criterionId: calibrationsTable.criterionId,
    criterionName: criteriaTable.name,
    responsibleAreaName: areasTable.name,
    originalAverageScore: calibrationsTable.originalAverageScore,
    calibratedScore: calibrationsTable.calibratedScore,
    calibrationReason: calibrationsTable.calibrationReason,
    calibratedByUserId: calibrationsTable.calibratedByUserId,
    calibratedByName: usersTable.name,
    calibratedAt: calibrationsTable.calibratedAt,
    // Salva e ainda não publicada: não vale na nota até publicar.
    pendingPublish: calibrationsTable.pendingPublish,
  })
  .from(calibrationsTable)
  .leftJoin(criteriaTable, eq(calibrationsTable.criterionId, criteriaTable.id))
  .leftJoin(areasTable, eq(criteriaTable.responsibleAreaId, areasTable.id))
  .leftJoin(usersTable, eq(calibrationsTable.calibratedByUserId, usersTable.id))
  .$dynamic();

  const conditions = [];
  if (eventId) conditions.push(eq(calibrationsTable.eventId, parseInt(eventId as string)));
  if (conditions.length) query = query.where(and(...conditions));

  const calibrations = await query;
  res.json(calibrations.map(c => ({
    ...c,
    originalAverageScore: c.originalAverageScore ? pgNum(c.originalAverageScore) : null,
    calibratedScore: pgNum(c.calibratedScore),
  })));
});

router.post("/calibrations", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const { eventId, criterionId, calibratedScore, calibrationReason, originalAverageScore } = req.body;
  if (!eventId || !criterionId || calibratedScore === undefined) {
    res.status(400).json({ error: "Campos obrigatórios: eventId, criterionId, calibratedScore" });
    return;
  }
  const reason = typeof calibrationReason === "string" && calibrationReason.trim() ? calibrationReason.trim() : null;
  const numScore = parseFloat(calibratedScore);
  if (isNaN(numScore) || numScore < 0 || numScore > 10) {
    res.status(400).json({ error: "A nota calibrada deve estar entre 0 e 10" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Usuário não encontrado. Faça login novamente." });
    return;
  }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event) { res.status(404).json({ error: "Evento não encontrado" }); return; }
  // Calibração de critério que não pertence ao evento ficava visível na tela e
  // invisível no cálculo.
  const [link] = await db.select({ id: eventCriteriaTable.id }).from(eventCriteriaTable)
    .where(and(eq(eventCriteriaTable.eventId, eventId), eq(eventCriteriaTable.criterionId, criterionId))).limit(1);
  if (!link) { res.status(400).json({ error: "Este critério não faz parte do evento" }); return; }

  const [existing] = await db.select().from(calibrationsTable)
    .where(and(
      eq(calibrationsTable.eventId, eventId),
      eq(calibrationsTable.criterionId, criterionId),
    )).limit(1);

  let calibration;
  const beforeSnap = existing
    ? { score: pgNum(existing.calibratedScore), reason: existing.calibrationReason }
    : null;

  if (existing) {
    // Calibração ANTIGA (de antes da regra "só vale publicada") que nunca foi
    // publicada conta na nota oficial pelo valor salvo. Ao re-salvar, ela vira
    // pendente — guarda antes o valor que estava valendo como retrato, senão
    // a nota cairia para a média dos avaliadores (revisão de 01/10/2026).
    if (!existing.pendingPublish) {
      await db.update(eventCriteriaTable)
        .set({ publishedScore: existing.calibratedScore, publishedReason: existing.calibrationReason })
        .where(and(eq(eventCriteriaTable.eventId, eventId), eq(eventCriteriaTable.criterionId, criterionId), isNull(eventCriteriaTable.publishedScore)));
    }
    [calibration] = await db.update(calibrationsTable).set({
      calibratedScore: String(numScore),
      calibrationReason: reason,
      originalAverageScore: originalAverageScore !== undefined ? String(originalAverageScore) : existing.originalAverageScore,
      calibratedByUserId: req.user!.userId,
      calibratedAt: new Date(),
      // Só conta na nota depois de publicar (ver feedback.ts publishSnapshot).
      pendingPublish: true,
    }).where(eq(calibrationsTable.id, existing.id)).returning();
  } else {
    // Duas calibrações do mesmo critério ao mesmo tempo: o UNIQUE barra a
    // segunda e ela vira uma atualização (antes, nota não determinística).
    [calibration] = await db.insert(calibrationsTable).values({
      eventId, criterionId,
      calibratedScore: String(numScore),
      calibrationReason: reason,
      originalAverageScore: originalAverageScore !== undefined ? String(originalAverageScore) : null,
      calibratedByUserId: req.user!.userId,
      pendingPublish: true,
    }).onConflictDoUpdate({
      target: [calibrationsTable.eventId, calibrationsTable.criterionId],
      set: {
        calibratedScore: String(numScore),
        calibrationReason: reason,
        calibratedByUserId: req.user!.userId,
        calibratedAt: new Date(),
        pendingPublish: true,
      },
    }).returning();
  }

  // pendingPublish: a linha do tempo mostra "só muda a nota quando publicar"
  // só para calibrações salvas pela regra nova (as antigas valeram na hora).
  const afterSnap = { score: numScore, reason, eventId, criterionId, by: user.name, pendingPublish: true };
  await audit(
    req.user!.userId,
    event.feedbackReleased ? "recalibrate_released" : "calibrate",
    "calibrations",
    calibration.id,
    beforeSnap,
    afterSnap,
  );

  // Salvar NÃO recalcula o ciclo: o colaborador só vê a mudança quando o
  // calibrador PUBLICA (parcial ou final) — é a publicação que grava o retrato
  // e recalcula (routes/feedback.ts). Regra do dono, 01/10/2026.
  const warnings: string[] = [];

  res.status(201).json({
    ...calibration,
    calibratedScore: pgNum(calibration.calibratedScore),
    warnings: warnings.length > 0 ? warnings : undefined,
  });
});

// ── Audit log de calibrações do evento ───────────────────────────────────────

router.get("/calibrations/audit", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const { eventId } = req.query;
  if (!eventId) { res.status(400).json({ error: "eventId obrigatório" }); return; }

  // Busca as calibrações do evento para saber quais IDs filtrar
  const calRows = await db.select({
    id: calibrationsTable.id,
    criterionId: calibrationsTable.criterionId,
    calibratedScore: calibrationsTable.calibratedScore,
  }).from(calibrationsTable).where(eq(calibrationsTable.eventId, parseInt(eventId as string)));

  if (calRows.length === 0) { res.json([]); return; }

  const calIdStrings = calRows.map(c => String(c.id));
  const criterionByCalId = new Map(calRows.map(c => [String(c.id), c.criterionId]));
  const scoreByCalId = new Map(calRows.map(c => [String(c.id), pgNum(c.calibratedScore)]));

  // Busca os critérios do evento para nomes
  const criteriaRows = await db.select({ id: criteriaTable.id, name: criteriaTable.name })
    .from(criteriaTable)
    .where(inArray(criteriaTable.id, calRows.map(c => c.criterionId)));
  const criterionNameById = new Map(criteriaRows.map(c => [c.id, c.name]));

  const logs = await db.select({
    id: auditLogsTable.id,
    userId: auditLogsTable.userId,
    userName: usersTable.name,
    action: auditLogsTable.action,
    entityId: auditLogsTable.entityId,
    beforeJson: auditLogsTable.beforeJson,
    afterJson: auditLogsTable.afterJson,
    createdAt: auditLogsTable.createdAt,
  })
  .from(auditLogsTable)
  .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
  .where(and(
    eq(auditLogsTable.entity, "calibrations"),
    inArray(auditLogsTable.entityId, calIdStrings),
  ))
  .orderBy(desc(auditLogsTable.createdAt))
  .limit(500);

  // Fallback: only apply current score to the MOST RECENT entry per calibration.
  // Older entries don't reliably reflect the score at that point in time.
  const fallbackUsed = new Set<string>();

  res.json(logs.map(l => {
    const criterionId = l.entityId ? (criterionByCalId.get(l.entityId) ?? null) : null;
    let afterJsonFinal = l.afterJson;
    if (!afterJsonFinal && l.entityId && !fallbackUsed.has(l.entityId)) {
      const fallbackScore = scoreByCalId.get(l.entityId) ?? null;
      if (fallbackScore != null) {
        afterJsonFinal = JSON.stringify({ score: fallbackScore });
      }
      fallbackUsed.add(l.entityId); // mark used regardless, so older entries get nothing
    }
    return {
      ...l,
      afterJson: afterJsonFinal,
      criterionId,
      criterionName: criterionId ? (criterionNameById.get(criterionId) ?? null) : null,
    };
  }));
});

// ── Comentários de calibração ─────────────────────────────────────────────────

router.get("/calibrations/comments", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const { eventId } = req.query;
  if (!eventId) { res.status(400).json({ error: "eventId obrigatório" }); return; }

  const rows = await db.select({
    id: calibrationCommentsTable.id,
    eventId: calibrationCommentsTable.eventId,
    criterionId: calibrationCommentsTable.criterionId,
    text: calibrationCommentsTable.text,
    createdByUserId: calibrationCommentsTable.createdByUserId,
    createdByName: usersTable.name,
    createdAt: calibrationCommentsTable.createdAt,
  })
  .from(calibrationCommentsTable)
  .leftJoin(usersTable, eq(calibrationCommentsTable.createdByUserId, usersTable.id))
  .where(eq(calibrationCommentsTable.eventId, parseInt(eventId as string)))
  .orderBy(calibrationCommentsTable.createdAt);

  res.json(rows);
});

router.post("/calibrations/comments", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const { eventId, criterionId, text } = req.body;
  if (!eventId || !criterionId || !text?.trim()) {
    res.status(400).json({ error: "eventId, criterionId e text são obrigatórios" });
    return;
  }

  const [comment] = await db.insert(calibrationCommentsTable).values({
    eventId,
    criterionId,
    text: text.trim(),
    createdByUserId: req.user!.userId,
  }).returning();

  await audit(req.user!.userId, "calibration_comment_add", "calibration_comments", comment.id, null, { eventId, criterionId, text: text.trim() });

  const [withUser] = await db.select({
    id: calibrationCommentsTable.id,
    eventId: calibrationCommentsTable.eventId,
    criterionId: calibrationCommentsTable.criterionId,
    text: calibrationCommentsTable.text,
    createdByUserId: calibrationCommentsTable.createdByUserId,
    createdByName: usersTable.name,
    createdAt: calibrationCommentsTable.createdAt,
  })
  .from(calibrationCommentsTable)
  .leftJoin(usersTable, eq(calibrationCommentsTable.createdByUserId, usersTable.id))
  .where(eq(calibrationCommentsTable.id, comment.id));

  res.status(201).json(withUser);
});

router.delete("/calibrations/comments/:id", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [existing] = await db.select().from(calibrationCommentsTable)
    .where(eq(calibrationCommentsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Comentário não encontrado" }); return; }

  await db.delete(calibrationCommentsTable).where(eq(calibrationCommentsTable.id, id));
  await audit(req.user!.userId, "calibration_comment_delete", "calibration_comments", id);
  res.status(204).end();
});

export default router;
