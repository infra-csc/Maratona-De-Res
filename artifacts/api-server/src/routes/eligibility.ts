import { Router } from "express";
import { db, employeeCycleEligibilityTable, employeesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { getCurrentCycle } from "../lib/cycle.js";

const router = Router();
router.use(requireAuth);

/**
 * Inelegibilidade por ciclo (ex.: questões disciplinares).
 * GET /cycle-eligibility?employeeId=
 */
router.get("/cycle-eligibility", async (req, res) => {
  const cycle = await getCurrentCycle();
  if (!cycle) { res.json([]); return; }

  const { employeeId } = req.query;
  const conditions = [eq(employeeCycleEligibilityTable.cycleId, cycle.id)];
  if (employeeId) conditions.push(eq(employeeCycleEligibilityTable.employeeId, parseInt(employeeId as string)));

  const query = db.select({
    id: employeeCycleEligibilityTable.id,
    employeeId: employeeCycleEligibilityTable.employeeId,
    employeeName: employeesTable.name,
    cycleId: employeeCycleEligibilityTable.cycleId,
    eligible: employeeCycleEligibilityTable.eligible,
    reason: employeeCycleEligibilityTable.reason,
    createdByUserId: employeeCycleEligibilityTable.createdByUserId,
    createdByName: usersTable.name,
    updatedAt: employeeCycleEligibilityTable.updatedAt,
  })
  .from(employeeCycleEligibilityTable)
  .leftJoin(employeesTable, eq(employeeCycleEligibilityTable.employeeId, employeesTable.id))
  .leftJoin(usersTable, eq(employeeCycleEligibilityTable.createdByUserId, usersTable.id))
  .where(and(...conditions));

  res.json(await query);
});

router.post("/cycle-eligibility", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const cycle = await getCurrentCycle();
  if (!cycle) { res.status(400).json({ error: "Nenhum ciclo ativo" }); return; }

  const { employeeId, eligible, reason } = req.body;
  if (!employeeId || eligible === undefined) {
    res.status(400).json({ error: "Campos obrigatórios: employeeId, eligible" });
    return;
  }
  const [existing] = await db.select().from(employeeCycleEligibilityTable)
    .where(and(
      eq(employeeCycleEligibilityTable.employeeId, employeeId),
      eq(employeeCycleEligibilityTable.cycleId, cycle.id),
    )).limit(1);

  let record;
  if (existing) {
    [record] = await db.update(employeeCycleEligibilityTable).set({
      eligible, reason: reason ?? null, createdByUserId: req.user!.userId, updatedAt: new Date(),
    }).where(eq(employeeCycleEligibilityTable.id, existing.id)).returning();
  } else {
    [record] = await db.insert(employeeCycleEligibilityTable).values({
      employeeId, cycleId: cycle.id, eligible, reason: reason ?? null, createdByUserId: req.user!.userId,
    }).returning();
  }
  await audit(req.user!.userId, "set_cycle_eligibility", "employee_cycle_eligibility", record.id);
  res.status(201).json(record);
});

export default router;
