import { Router } from "express";
import { db, evaluationsTable, calibrationsTable, employeesTable, criteriaTable, usersTable, eventCriteriaTable, eventParticipantsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

router.get("/evaluations", async (req, res) => {
  const { eventId, employeeId, status } = req.query;
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
  if (conditions.length) query = query.where(and(...conditions));

  const evaluations = await query;
  res.json(evaluations.map(e => ({ ...e, score: parseFloat(e.score as unknown as string) })));
});

router.post("/evaluations", async (req, res) => {
  const { eventId, employeeId, criterionId, score, comments } = req.body;
  if (!eventId || !employeeId || !criterionId || score === undefined) {
    res.status(400).json({ error: "Campos obrigatórios: eventId, employeeId, criterionId, score" });
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
    [evaluation] = await db.update(evaluationsTable).set({
      score: String(score),
      comments: comments ?? existing.comments,
    }).where(eq(evaluationsTable.id, existing.id)).returning();
  } else {
    [evaluation] = await db.insert(evaluationsTable).values({
      eventId, employeeId, criterionId,
      evaluatorUserId: req.user!.userId,
      score: String(score),
      comments: comments ?? null,
    }).returning();
  }
  res.status(201).json({ ...evaluation, score: parseFloat(evaluation.score as unknown as string) });
});

router.patch("/evaluations/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { score, comments } = req.body;
  const [evaluation] = await db.update(evaluationsTable).set({
    ...(score !== undefined && { score: String(score) }),
    ...(comments !== undefined && { comments }),
  }).where(eq(evaluationsTable.id, id)).returning();
  if (!evaluation) { res.status(404).json({ error: "Não encontrado" }); return; }
  res.json({ ...evaluation, score: parseFloat(evaluation.score as unknown as string) });
});

router.post("/evaluations/:id/submit", async (req, res) => {
  const id = parseInt(req.params.id);
  const [evaluation] = await db.update(evaluationsTable).set({
    status: "submitted",
    submittedAt: new Date(),
  }).where(eq(evaluationsTable.id, id)).returning();
  if (!evaluation) { res.status(404).json({ error: "Não encontrado" }); return; }
  res.json({ ...evaluation, score: parseFloat(evaluation.score as unknown as string) });
});

router.post("/evaluations/:id/reopen", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [evaluation] = await db.update(evaluationsTable).set({
    status: "draft",
    submittedAt: null,
  }).where(eq(evaluationsTable.id, id)).returning();
  if (!evaluation) { res.status(404).json({ error: "Não encontrado" }); return; }
  res.json({ ...evaluation, score: parseFloat(evaluation.score as unknown as string) });
});

export default router;
