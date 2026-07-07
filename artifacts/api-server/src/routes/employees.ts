import { Router } from "express";
import { db, employeesTable, quarterlyResultsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { getCurrentCycle } from "../lib/cycle.js";
import { recomputeCycleResults } from "./results.js";

const router = Router();
router.use(requireAuth);

router.get("/employees", async (req, res) => {
  const activeFilter = req.query.active;
  const cycle = await getCurrentCycle();

  // Base employee rows
  let query = db.select().from(employeesTable).$dynamic();
  if (activeFilter !== undefined) {
    query = query.where(eq(employeesTable.active, activeFilter === "true"));
  }
  const employees = await query.orderBy(employeesTable.name);

  // Join quarterly_results for current cycle (if exists) to expose computed eligibility
  const cycleResults: Record<number, { cycleEligible: boolean; participatedEventsCount: number }> = {};
  if (cycle) {
    const rows = await db
      .select({
        employeeId: quarterlyResultsTable.employeeId,
        eligible: quarterlyResultsTable.eligible,
        participatedEventsCount: quarterlyResultsTable.participatedEventsCount,
      })
      .from(quarterlyResultsTable)
      .where(eq(quarterlyResultsTable.cycleId, cycle.id));
    for (const r of rows) {
      cycleResults[r.employeeId] = {
        cycleEligible: r.eligible,
        participatedEventsCount: r.participatedEventsCount,
      };
    }
  }

  res.json(employees.map(e => ({
    ...e,
    cycleEligible: cycleResults[e.id]?.cycleEligible ?? null,
    participatedEventsCount: cycleResults[e.id]?.participatedEventsCount ?? null,
  })));
});

router.get("/employees/:id", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, id)).limit(1);
  if (!employee) { res.status(404).json({ error: "Não encontrado" }); return; }
  res.json(employee);
});

const EMPLOYMENT_TYPES = ["casa", "freela"];

router.post("/employees", requireRole("admin", "rh"), async (req, res) => {
  const { name, document, email, phone, department, functionName, employmentType } = req.body;
  if (!name) { res.status(400).json({ error: "Nome obrigatório" }); return; }
  if (employmentType !== undefined && !EMPLOYMENT_TYPES.includes(employmentType)) {
    res.status(400).json({ error: "employmentType inválido" });
    return;
  }
  const [employee] = await db.insert(employeesTable).values({
    name,
    document: document ?? null,
    email: email ?? null,
    phone: phone ?? null,
    department: department ?? "Geral",
    functionName: functionName ?? "Colaborador",
    employmentType: employmentType ?? "casa",
  }).returning();
  await audit(req.user!.userId, "create", "employees", employee.id, null, employee);
  res.status(201).json(employee);
});

router.patch("/employees/:id", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, document, email, phone, department, functionName, employmentType, active, eligibleForBonus, eligibilityStatus, eligibilityReason } = req.body;
  const [before] = await db.select().from(employeesTable).where(eq(employeesTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Não encontrado" }); return; }
  if (eligibilityStatus !== undefined && !["eligible", "not_eligible", "suspended", "terminated"].includes(eligibilityStatus)) {
    res.status(400).json({ error: "eligibilityStatus inválido" });
    return;
  }
  if (employmentType !== undefined && !EMPLOYMENT_TYPES.includes(employmentType)) {
    res.status(400).json({ error: "employmentType inválido" });
    return;
  }
  const [employee] = await db.update(employeesTable).set({
    ...(name !== undefined && { name }),
    ...(document !== undefined && { document }),
    ...(email !== undefined && { email }),
    ...(phone !== undefined && { phone }),
    ...(department !== undefined && { department }),
    ...(functionName !== undefined && { functionName }),
    ...(employmentType !== undefined && { employmentType }),
    ...(active !== undefined && { active }),
    ...(eligibleForBonus !== undefined && { eligibleForBonus }),
    ...(eligibilityStatus !== undefined && { eligibilityStatus }),
    ...(eligibilityReason !== undefined && { eligibilityReason }),
  }).where(eq(employeesTable.id, id)).returning();
  await audit(req.user!.userId, "update", "employees", id, before, employee);
  if (active !== undefined || eligibleForBonus !== undefined || eligibilityStatus !== undefined) {
    const cycle = await getCurrentCycle();
    if (cycle) await recomputeCycleResults(cycle.id, req.user!.userId);
  }
  res.json(employee);
});

router.get("/employees/:id/history", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const results = await db.select().from(quarterlyResultsTable)
    .where(eq(quarterlyResultsTable.employeeId, id))
    .orderBy(quarterlyResultsTable.cycleId);
  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, id)).limit(1);
  const employeeName = employee?.name ?? "";
  res.json(results.map(r => ({
    employeeId: r.employeeId,
    employeeName,
    cycleId: r.cycleId,
    eventsCount: r.eventsCount,
    grossAverage: parseFloat(r.grossAverage),
    totalAbsences: r.totalAbsences,
    absencePenalty: parseFloat(r.absencePenalty),
    finalResult: parseFloat(r.finalResult),
    platoon: r.platoon,
    platoonColor: r.platoonColor,
    bonusValue: parseFloat(r.bonusValue),
    eventBreakdown: [],
  })));
});

export default router;
