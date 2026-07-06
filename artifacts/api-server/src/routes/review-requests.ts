import { Router } from "express";
import { db, eventReviewRequestsTable, eventsTable, employeesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

/**
 * GET /review-requests
 * Lista todos os pedidos de revisão feitos por colaboradores, mais recentes
 * primeiro. Usado pelo admin/rh/diretoria para acompanhar e resolver.
 */
router.get("/review-requests", requireRole("admin", "rh", "diretoria"), async (_req, res) => {
  const rows = await db.select({
    id: eventReviewRequestsTable.id,
    eventId: eventReviewRequestsTable.eventId,
    eventName: eventsTable.name,
    employeeId: eventReviewRequestsTable.employeeId,
    employeeName: employeesTable.name,
    comment: eventReviewRequestsTable.comment,
    status: eventReviewRequestsTable.status,
    createdAt: eventReviewRequestsTable.createdAt,
    resolvedAt: eventReviewRequestsTable.resolvedAt,
    resolutionNotes: eventReviewRequestsTable.resolutionNotes,
  })
    .from(eventReviewRequestsTable)
    .leftJoin(eventsTable, eq(eventReviewRequestsTable.eventId, eventsTable.id))
    .leftJoin(employeesTable, eq(eventReviewRequestsTable.employeeId, employeesTable.id))
    .orderBy(desc(eventReviewRequestsTable.createdAt));
  res.json(rows);
});

/**
 * PATCH /review-requests/:id/resolve
 * Marca um pedido de revisão como resolvido, com uma nota opcional explicando
 * o desfecho (ex.: "nota corrigida", "revisado, sem alteração").
 */
router.patch("/review-requests/:id/resolve", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }
  const { resolutionNotes } = req.body;
  const [before] = await db.select().from(eventReviewRequestsTable).where(eq(eventReviewRequestsTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Não encontrado" }); return; }
  const [updated] = await db.update(eventReviewRequestsTable).set({
    status: "resolved",
    resolvedAt: new Date(),
    resolvedByUserId: req.user!.userId,
    resolutionNotes: resolutionNotes ?? null,
  }).where(eq(eventReviewRequestsTable.id, id)).returning();
  await audit(req.user!.userId, "update", "event_review_requests", id, before, updated);
  res.json(updated);
});

export default router;
