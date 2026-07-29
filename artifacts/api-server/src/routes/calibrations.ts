import { Router } from "express";
import { db, calibrationsTable, calibrationCommentsTable, criteriaTable, usersTable, areasTable, eventsTable, auditLogsTable } from "@workspace/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { recomputeCycleResults } from "./results.js";

const router = Router();
router.use(requireAuth);

/**
 * Calibração no nível do critério do evento/time (NÃO por colaborador).
 * A nota calibrada substitui a nota original no cálculo do evento e é aplicada
 * a todos os participantes daquele evento.
 */
router.get("/calibrations", async (req, res) => {
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
    originalAverageScore: c.originalAverageScore ? parseFloat(c.originalAverageScore as unknown as string) : null,
    calibratedScore: parseFloat(c.calibratedScore as unknown as string),
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

  const [existing] = await db.select().from(calibrationsTable)
    .where(and(
      eq(calibrationsTable.eventId, eventId),
      eq(calibrationsTable.criterionId, criterionId),
    )).limit(1);

  let calibration;
  const beforeSnap = existing
    ? { score: parseFloat(existing.calibratedScore as unknown as string), reason: existing.calibrationReason }
    : null;

  if (existing) {
    [calibration] = await db.update(calibrationsTable).set({
      calibratedScore: String(numScore),
      calibrationReason: reason,
      originalAverageScore: originalAverageScore !== undefined ? String(originalAverageScore) : existing.originalAverageScore,
      calibratedByUserId: req.user!.userId,
      calibratedAt: new Date(),
    }).where(eq(calibrationsTable.id, existing.id)).returning();
  } else {
    [calibration] = await db.insert(calibrationsTable).values({
      eventId, criterionId,
      calibratedScore: String(numScore),
      calibrationReason: reason,
      originalAverageScore: originalAverageScore !== undefined ? String(originalAverageScore) : null,
      calibratedByUserId: req.user!.userId,
    }).returning();
  }

  const afterSnap = { score: numScore, reason, eventId, criterionId, by: user.name };
  await audit(
    req.user!.userId,
    event.feedbackReleased ? "recalibrate_released" : "calibrate",
    "calibrations",
    calibration.id,
    beforeSnap,
    afterSnap,
  );

  let warnings: string[] = [];
  if (event.status === "closed") {
    const recompute = await recomputeCycleResults(event.cycleId, req.user!.userId);
    warnings = recompute.warnings;
  }

  res.status(201).json({
    ...calibration,
    calibratedScore: parseFloat(calibration.calibratedScore as unknown as string),
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
  }).from(calibrationsTable).where(eq(calibrationsTable.eventId, parseInt(eventId as string)));

  if (calRows.length === 0) { res.json([]); return; }

  const calIdStrings = calRows.map(c => String(c.id));
  const criterionByCalId = new Map(calRows.map(c => [String(c.id), c.criterionId]));

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

  res.json(logs.map(l => ({
    ...l,
    criterionId: l.entityId ? (criterionByCalId.get(l.entityId) ?? null) : null,
    criterionName: l.entityId ? (criterionNameById.get(criterionByCalId.get(l.entityId)!) ?? null) : null,
  })));
});

// ── Comentários de calibração ─────────────────────────────────────────────────

router.get("/calibrations/comments", async (req, res) => {
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
