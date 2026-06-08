import { Router } from "express";
import { db, absencesTable, employeesTable, eventsTable, rulesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

/**
 * Catálogo de penalidades. `points` fixo por tipo; quando null, usa a regra
 * configurável `absence_penalty_per_absence` (a "Falta" segue a regra do sistema).
 */
export const PENALTY_CATALOG: Record<string, { label: string; points: number | null }> = {
  falta: { label: "Falta", points: null },
  atraso_30: { label: "Atraso (30 min)", points: 50 },
  atraso_60: { label: "Atraso (1 hora)", points: 100 },
};

router.get("/absences", async (req, res) => {
  const { employeeId, year, quarter } = req.query;
  let query = db.select({
    id: absencesTable.id,
    employeeId: absencesTable.employeeId,
    employeeName: employeesTable.name,
    eventId: absencesTable.eventId,
    eventName: eventsTable.name,
    penaltyType: absencesTable.penaltyType,
    points: absencesTable.points,
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

router.post("/absences", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const { employeeId, eventId, date, year, quarter, quantity, reason, penaltyType } = req.body;
  const type = (penaltyType as string) ?? "falta";
  if (!employeeId || !eventId || !date || !year || !quarter) {
    res.status(400).json({ error: "Campos obrigatórios: employeeId, eventId, date, year, quarter" });
    return;
  }
  if (!PENALTY_CATALOG[type]) {
    res.status(400).json({ error: "Tipo de penalidade inválido" });
    return;
  }
  let points = PENALTY_CATALOG[type].points;
  if (points === null) {
    const ruleRow = await db.select().from(rulesTable).where(eq(rulesTable.key, "absence_penalty_per_absence")).limit(1);
    points = ruleRow[0] ? parseFloat(ruleRow[0].value) : 50;
  }
  const [absence] = await db.insert(absencesTable).values({
    employeeId, eventId, penaltyType: type, points, date, year, quarter,
    quantity: quantity ?? 1, reason: reason ?? null,
    registeredByUserId: req.user!.userId,
  }).returning();
  await audit(req.user!.userId, "create", "absences", absence.id, null, absence);
  res.status(201).json(absence);
});

router.delete("/absences/:id", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  await db.delete(absencesTable).where(eq(absencesTable.id, id));
  await audit(req.user!.userId, "delete", "absences", id);
  res.status(204).end();
});

export default router;
