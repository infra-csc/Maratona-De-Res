import { Router } from "express";
import { db, calibrationsTable, employeesTable, criteriaTable, usersTable, areasTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

router.get("/calibrations", async (req, res) => {
  const { eventId, employeeId } = req.query;
  let query = db.select({
    id: calibrationsTable.id,
    eventId: calibrationsTable.eventId,
    employeeId: calibrationsTable.employeeId,
    employeeName: employeesTable.name,
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
  .leftJoin(employeesTable, eq(calibrationsTable.employeeId, employeesTable.id))
  .leftJoin(criteriaTable, eq(calibrationsTable.criterionId, criteriaTable.id))
  .leftJoin(areasTable, eq(criteriaTable.responsibleAreaId, areasTable.id))
  .leftJoin(usersTable, eq(calibrationsTable.calibratedByUserId, usersTable.id))
  .$dynamic();

  const conditions = [];
  if (eventId) conditions.push(eq(calibrationsTable.eventId, parseInt(eventId as string)));
  if (employeeId) conditions.push(eq(calibrationsTable.employeeId, parseInt(employeeId as string)));
  if (conditions.length) query = query.where(and(...conditions));

  const calibrations = await query;
  res.json(calibrations.map(c => ({
    ...c,
    originalAverageScore: c.originalAverageScore ? parseFloat(c.originalAverageScore as unknown as string) : null,
    calibratedScore: parseFloat(c.calibratedScore as unknown as string),
  })));
});

router.post("/calibrations", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const { eventId, employeeId, criterionId, calibratedScore, calibrationReason } = req.body;
  if (!eventId || !employeeId || !criterionId || calibratedScore === undefined || !calibrationReason) {
    res.status(400).json({ error: "Campos obrigatórios" });
    return;
  }
  const [existing] = await db.select().from(calibrationsTable)
    .where(and(
      eq(calibrationsTable.eventId, eventId),
      eq(calibrationsTable.employeeId, employeeId),
      eq(calibrationsTable.criterionId, criterionId),
    )).limit(1);

  let calibration;
  if (existing) {
    [calibration] = await db.update(calibrationsTable).set({
      calibratedScore: String(calibratedScore),
      calibrationReason,
      calibratedByUserId: req.user!.userId,
      calibratedAt: new Date(),
    }).where(eq(calibrationsTable.id, existing.id)).returning();
  } else {
    [calibration] = await db.insert(calibrationsTable).values({
      eventId, employeeId, criterionId,
      calibratedScore: String(calibratedScore),
      calibrationReason,
      calibratedByUserId: req.user!.userId,
    }).returning();
  }
  await audit(req.user!.userId, "calibrate", "calibrations", calibration.id);
  res.status(201).json({ ...calibration, calibratedScore: parseFloat(calibration.calibratedScore as unknown as string) });
});

export default router;
