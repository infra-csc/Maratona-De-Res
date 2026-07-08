import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, employeesTable, quarterlyResultsTable, usersTable, eventParticipantsTable, absencesTable, employeeEventResultsTable, employeeCycleEligibilityTable, eventReviewRequestsTable } from "@workspace/db";
import { eq, and, inArray, ne } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { getCurrentCycle } from "../lib/cycle.js";
import { recomputeCycleResults } from "./results.js";
import { normalizeCpf, isValidCpfLength, defaultPasswordForCpf } from "../lib/credentials.js";

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

  // Auto-provision a CPF-based login for the new colaborador when a valid CPF
  // was provided, mirroring the bulk-generation rule (see lib/credentials.ts).
  let generatedAccess: { cpfLogin: string; password: string } | null = null;
  const digits = employee.document ? normalizeCpf(employee.document) : "";
  if (employee.active && isValidCpfLength(digits)) {
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.cpfLogin, digits)).limit(1);
    if (!existing) {
      const password = defaultPasswordForCpf(digits);
      const passwordHash = await bcrypt.hash(password, 12);
      await db.insert(usersTable).values({
        name: employee.name,
        email: null,
        cpfLogin: digits,
        passwordHash,
        role: "visualizador",
        employeeId: employee.id,
        active: true,
        mustChangePassword: true,
      });
      generatedAccess = { cpfLogin: digits, password };
      await audit(req.user!.userId, "auto_provision_access", "users", employee.id, null, { cpfLogin: digits });
    }
  }

  res.status(201).json({ ...employee, generatedAccess });
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

router.post("/employees/:id/merge", requireRole("admin", "rh"), async (req, res) => {
  const canonicalId = parseInt(req.params.id as string);
  const { duplicateIds } = req.body as { duplicateIds: number[] };
  if (!Array.isArray(duplicateIds) || duplicateIds.length === 0) {
    res.status(400).json({ error: "duplicateIds obrigatório" }); return;
  }
  const [canonical] = await db.select().from(employeesTable).where(eq(employeesTable.id, canonicalId)).limit(1);
  if (!canonical) { res.status(404).json({ error: "Colaborador não encontrado" }); return; }

  const dupIds = duplicateIds.filter(id => id !== canonicalId);
  if (dupIds.length === 0) { res.status(400).json({ error: "Nenhum duplicado válido" }); return; }

  let movedParticipations = 0, movedAbsences = 0, movedEvals = 0, movedReviews = 0, removedUsers = 0;

  await db.transaction(async (tx) => {
    // event_participants: move if canonical doesn't already have that event
    const canonicalParts = await tx.select({ eventId: eventParticipantsTable.eventId })
      .from(eventParticipantsTable).where(eq(eventParticipantsTable.employeeId, canonicalId));
    const canonicalEventIds = new Set(canonicalParts.map(p => p.eventId));

    for (const dupId of dupIds) {
      const dupParts = await tx.select().from(eventParticipantsTable)
        .where(eq(eventParticipantsTable.employeeId, dupId));
      for (const p of dupParts) {
        if (!canonicalEventIds.has(p.eventId)) {
          await tx.update(eventParticipantsTable)
            .set({ employeeId: canonicalId })
            .where(eq(eventParticipantsTable.id, p.id));
          canonicalEventIds.add(p.eventId);
          movedParticipations++;
        }
      }
    }

    // absences: move all
    const absResult = await tx.update(absencesTable)
      .set({ employeeId: canonicalId })
      .where(inArray(absencesTable.employeeId, dupIds));
    movedAbsences = (absResult as unknown as { rowCount?: number }).rowCount ?? 0;

    // employee_event_results: move scored results
    const evalResult = await tx.update(employeeEventResultsTable)
      .set({ employeeId: canonicalId })
      .where(inArray(employeeEventResultsTable.employeeId, dupIds));
    movedEvals = (evalResult as unknown as { rowCount?: number }).rowCount ?? 0;

    // event_review_requests
    const revResult = await tx.update(eventReviewRequestsTable)
      .set({ employeeId: canonicalId })
      .where(inArray(eventReviewRequestsTable.employeeId, dupIds));
    movedReviews = (revResult as unknown as { rowCount?: number }).rowCount ?? 0;

    // eligibility: move if no conflict
    const canonicalElig = await tx.select({ cycleId: employeeCycleEligibilityTable.cycleId })
      .from(employeeCycleEligibilityTable).where(eq(employeeCycleEligibilityTable.employeeId, canonicalId));
    const canonicalCycleIds = new Set(canonicalElig.map(e => e.cycleId));
    for (const dupId of dupIds) {
      const dupElig = await tx.select().from(employeeCycleEligibilityTable)
        .where(eq(employeeCycleEligibilityTable.employeeId, dupId));
      for (const e of dupElig) {
        if (!canonicalCycleIds.has(e.cycleId)) {
          await tx.update(employeeCycleEligibilityTable)
            .set({ employeeId: canonicalId })
            .where(eq(employeeCycleEligibilityTable.id, e.id));
          canonicalCycleIds.add(e.cycleId);
        }
      }
    }

    // users: if duplicate has a user account and canonical doesn't, re-link it
    const canonicalUser = await tx.select({ id: usersTable.id })
      .from(usersTable).where(eq(usersTable.employeeId, canonicalId)).limit(1);
    if (!canonicalUser.length) {
      for (const dupId of dupIds) {
        const dupUser = await tx.select().from(usersTable)
          .where(eq(usersTable.employeeId, dupId)).limit(1);
        if (dupUser.length) {
          await tx.update(usersTable)
            .set({ employeeId: canonicalId })
            .where(eq(usersTable.id, dupUser[0].id));
          break;
        }
      }
    } else {
      // Detach (nullify) users linked to duplicates so they can be deleted
      await tx.update(usersTable).set({ employeeId: null })
        .where(and(inArray(usersTable.employeeId, dupIds), ne(usersTable.employeeId, canonicalId)));
      removedUsers++;
    }

    // quarterly_results: move if no conflict
    const canonicalQr = await tx.select({ cycleId: quarterlyResultsTable.cycleId })
      .from(quarterlyResultsTable).where(eq(quarterlyResultsTable.employeeId, canonicalId));
    const canonicalQrCycles = new Set(canonicalQr.map(r => r.cycleId));
    for (const dupId of dupIds) {
      const dupQr = await tx.select().from(quarterlyResultsTable)
        .where(eq(quarterlyResultsTable.employeeId, dupId));
      for (const r of dupQr) {
        if (!canonicalQrCycles.has(r.cycleId)) {
          await tx.update(quarterlyResultsTable)
            .set({ employeeId: canonicalId })
            .where(eq(quarterlyResultsTable.id, r.id));
          canonicalQrCycles.add(r.cycleId);
        }
      }
    }

    // Delete duplicates
    await tx.delete(employeesTable).where(inArray(employeesTable.id, dupIds));
  });

  await audit(req.user!.userId, "merge", "employees", canonicalId, { duplicateIds: dupIds }, { movedParticipations, movedAbsences, movedEvals, movedReviews });
  res.json({ canonicalId, merged: dupIds, movedParticipations, movedAbsences, movedEvals, movedReviews, removedUsers });
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
