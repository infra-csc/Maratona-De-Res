import { Router } from "express";
import { db, employeeQuarterEligibilityTable, employeesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

/**
 * Inelegibilidade trimestral (ex.: questões disciplinares).
 * GET /quarter-eligibility?year=&quarter=&employeeId=
 */
router.get("/quarter-eligibility", async (req, res) => {
  const { year, quarter, employeeId } = req.query;
  const conditions = [];
  if (year) conditions.push(eq(employeeQuarterEligibilityTable.year, parseInt(year as string)));
  if (quarter) conditions.push(eq(employeeQuarterEligibilityTable.quarter, parseInt(quarter as string)));
  if (employeeId) conditions.push(eq(employeeQuarterEligibilityTable.employeeId, parseInt(employeeId as string)));

  let query = db.select({
    id: employeeQuarterEligibilityTable.id,
    employeeId: employeeQuarterEligibilityTable.employeeId,
    employeeName: employeesTable.name,
    year: employeeQuarterEligibilityTable.year,
    quarter: employeeQuarterEligibilityTable.quarter,
    eligible: employeeQuarterEligibilityTable.eligible,
    reason: employeeQuarterEligibilityTable.reason,
    createdByUserId: employeeQuarterEligibilityTable.createdByUserId,
    createdByName: usersTable.name,
    updatedAt: employeeQuarterEligibilityTable.updatedAt,
  })
  .from(employeeQuarterEligibilityTable)
  .leftJoin(employeesTable, eq(employeeQuarterEligibilityTable.employeeId, employeesTable.id))
  .leftJoin(usersTable, eq(employeeQuarterEligibilityTable.createdByUserId, usersTable.id))
  .$dynamic();
  if (conditions.length) query = query.where(and(...conditions));

  res.json(await query);
});

router.post("/quarter-eligibility", requireRole("admin", "rh", "diretoria"), async (req, res) => {
  const { employeeId, year, quarter, eligible, reason } = req.body;
  if (!employeeId || !year || !quarter || eligible === undefined) {
    res.status(400).json({ error: "Campos obrigatórios: employeeId, year, quarter, eligible" });
    return;
  }
  const [existing] = await db.select().from(employeeQuarterEligibilityTable)
    .where(and(
      eq(employeeQuarterEligibilityTable.employeeId, employeeId),
      eq(employeeQuarterEligibilityTable.year, year),
      eq(employeeQuarterEligibilityTable.quarter, quarter),
    )).limit(1);

  let record;
  if (existing) {
    [record] = await db.update(employeeQuarterEligibilityTable).set({
      eligible, reason: reason ?? null, createdByUserId: req.user!.userId, updatedAt: new Date(),
    }).where(eq(employeeQuarterEligibilityTable.id, existing.id)).returning();
  } else {
    [record] = await db.insert(employeeQuarterEligibilityTable).values({
      employeeId, year, quarter, eligible, reason: reason ?? null, createdByUserId: req.user!.userId,
    }).returning();
  }
  await audit(req.user!.userId, "set_quarter_eligibility", "employee_quarter_eligibility", record.id);
  res.status(201).json(record);
});

export default router;
