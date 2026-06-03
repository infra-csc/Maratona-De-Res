import { Router } from "express";
import { db, absencesTable, employeesTable, eventsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

router.get("/absences", async (req, res) => {
  const { employeeId, year, quarter } = req.query;
  let query = db.select({
    id: absencesTable.id,
    employeeId: absencesTable.employeeId,
    employeeName: employeesTable.name,
    eventId: absencesTable.eventId,
    eventName: eventsTable.name,
    date: absencesTable.date,
    year: absencesTable.year,
    quarter: absencesTable.quarter,
    quantity: absencesTable.quantity,
    reason: absencesTable.reason,
    registeredByUserId: absencesTable.registeredByUserId,
    createdAt: absencesTable.createdAt,
  })
  .from(absencesTable)
  .leftJoin(employeesTable, eq(absencesTable.employeeId, employeesTable.id))
  .leftJoin(eventsTable, eq(absencesTable.eventId, eventsTable.id))
  .$dynamic();

  const conditions = [];
  if (employeeId) conditions.push(eq(absencesTable.employeeId, parseInt(employeeId as string)));
  if (year) conditions.push(eq(absencesTable.year, parseInt(year as string)));
  if (quarter) conditions.push(eq(absencesTable.quarter, parseInt(quarter as string)));
  if (conditions.length) query = query.where(and(...conditions));

  res.json(await query);
});

router.post("/absences", requireRole("admin", "rh", "avaliador"), async (req, res) => {
  const { employeeId, eventId, date, year, quarter, quantity, reason } = req.body;
  if (!employeeId || !date || !year || !quarter) {
    res.status(400).json({ error: "Campos obrigatórios: employeeId, date, year, quarter" });
    return;
  }
  const [absence] = await db.insert(absencesTable).values({
    employeeId, eventId: eventId ?? null, date, year, quarter,
    quantity: quantity ?? 1, reason: reason ?? null,
    registeredByUserId: req.user!.userId,
  }).returning();
  await audit(req.user!.userId, "create", "absences", absence.id, null, absence);
  res.status(201).json(absence);
});

router.delete("/absences/:id", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(absencesTable).where(eq(absencesTable.id, id));
  await audit(req.user!.userId, "delete", "absences", id);
  res.status(204).end();
});

export default router;
