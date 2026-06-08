import { Router } from "express";
import { db, calibrationsTable, criteriaTable, usersTable, areasTable, eventsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

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
  if (isNaN(numScore) || numScore < 1 || numScore > 5) {
    res.status(400).json({ error: "A nota calibrada deve estar entre 1 e 5" });
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
  await audit(req.user!.userId, "calibrate", "calibrations", calibration.id);
  res.status(201).json({ ...calibration, calibratedScore: parseFloat(calibration.calibratedScore as unknown as string) });
});

export default router;
