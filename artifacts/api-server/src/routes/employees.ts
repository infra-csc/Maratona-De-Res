import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, employeesTable, quarterlyResultsTable, usersTable, eventParticipantsTable, absencesTable, employeeEventResultsTable, employeeCycleEligibilityTable, eventReviewRequestsTable, evaluationsTable } from "@workspace/db";
import { eq, and, inArray, ne, notInArray, isNotNull } from "drizzle-orm";
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

  // Map linked user accounts so the UI can offer "view as employee" and show access status
  const empIds = employees.map(e => e.id);
  const linkedUsers = empIds.length > 0
    ? await db.select({ id: usersTable.id, employeeId: usersTable.employeeId, active: usersTable.active })
        .from(usersTable).where(inArray(usersTable.employeeId, empIds))
    : [];
  const linkedByEmpId = new Map(linkedUsers.map(u => [u.employeeId!, u]));

  res.json(employees.map(e => {
    const linked = e.id != null ? linkedByEmpId.get(e.id) : undefined;
    return {
      ...e,
      cycleEligible: cycleResults[e.id]?.cycleEligible ?? null,
      participatedEventsCount: cycleResults[e.id]?.participatedEventsCount ?? null,
      linkedUserId: linked?.id ?? null,
      hasAccess: linked != null && linked.active,
    };
  }));
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
  if (active !== undefined || eligibleForBonus !== undefined || eligibilityStatus !== undefined || (functionName !== undefined && functionName !== before.functionName)) {
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

  let movedParticipations = 0, movedAbsences = 0, movedEvals = 0, movedReviews = 0, removedUsers = 0, movedEvaluatorEvals = 0;

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

    // users: if duplicate has a user account and canonical doesn't, re-link it;
    // otherwise transfer evaluations made BY the duplicate user, then deactivate it
    const [canonicalUser] = await tx.select({ id: usersTable.id })
      .from(usersTable).where(eq(usersTable.employeeId, canonicalId)).limit(1);

    for (const dupId of dupIds) {
      const [dupUser] = await tx.select({ id: usersTable.id })
        .from(usersTable).where(eq(usersTable.employeeId, dupId)).limit(1);
      if (!dupUser) continue;

      if (!canonicalUser) {
        // Canônico sem usuário — reutiliza o do duplicado
        await tx.update(usersTable)
          .set({ employeeId: canonicalId })
          .where(eq(usersTable.id, dupUser.id));
      } else {
        // Canônico já tem usuário — transfere avaliações feitas como avaliador e desativa o duplicado
        const evRes = await tx.update(evaluationsTable)
          .set({ evaluatorUserId: canonicalUser.id })
          .where(eq(evaluationsTable.evaluatorUserId, dupUser.id));
        movedEvaluatorEvals += (evRes as unknown as { rowCount?: number }).rowCount ?? 0;
        // Desvincula e desativa a conta do duplicado
        await tx.update(usersTable)
          .set({ employeeId: null, active: false })
          .where(eq(usersTable.id, dupUser.id));
        removedUsers++;
      }
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

  await audit(req.user!.userId, "merge", "employees", canonicalId, { duplicateIds: dupIds }, { movedParticipations, movedAbsences, movedEvals, movedReviews, movedEvaluatorEvals });
  res.json({ canonicalId, merged: dupIds, movedParticipations, movedAbsences, movedEvals, movedReviews, movedEvaluatorEvals, removedUsers });
});

/**
 * Redefine tipos em massa: IDs em casaIds → "casa", todos os demais ativos → "freela".
 * Após a atualização recalcula o ciclo corrente.
 */
router.post("/employees/bulk-employment-reset", requireRole("admin", "rh"), async (req, res) => {
  const { casaIds } = req.body as { casaIds: number[] };
  if (!Array.isArray(casaIds) || casaIds.some(id => typeof id !== "number")) {
    res.status(400).json({ error: "casaIds deve ser array de números" });
    return;
  }
  await db.transaction(async tx => {
    if (casaIds.length > 0) {
      await tx.update(employeesTable).set({ employmentType: "casa" }).where(inArray(employeesTable.id, casaIds));
      await tx.update(employeesTable).set({ employmentType: "freela" }).where(
        and(notInArray(employeesTable.id, casaIds), eq(employeesTable.active, true)),
      );
    } else {
      await tx.update(employeesTable).set({ employmentType: "freela" }).where(eq(employeesTable.active, true));
    }
  });
  const cycle = await getCurrentCycle();
  if (cycle) await recomputeCycleResults(cycle.id, req.user!.userId);
  await audit(req.user!.userId, "bulk-employment-reset", "employees", null, { casaIds });
  res.json({ ok: true, casaCount: casaIds.length });
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

// GET /employees/casa-pins — lista PINs atuais; filtra por ids se fornecido (?ids=1,2,3)
router.get("/employees/casa-pins", requireRole("admin", "rh"), async (req, res) => {
  const rawIds = req.query.ids as string | undefined;
  const ids = rawIds ? rawIds.split(",").map(Number).filter(Boolean) : null;

  const rows = await db
    .select({
      name: employeesTable.name,
      cpfLogin: usersTable.cpfLogin,
      pin: usersTable.pinValue,
    })
    .from(employeesTable)
    .innerJoin(usersTable, eq(usersTable.employeeId, employeesTable.id))
    .where(
      and(
        eq(employeesTable.employmentType, "casa"),
        eq(employeesTable.active, true),
        isNotNull(usersTable.pinValue),
        ids ? inArray(employeesTable.id, ids) : undefined,
      )
    )
    .orderBy(employeesTable.name);

  res.json({ results: rows });
});

// POST /employees/bulk-generate-pins — gera PINs; filtra por ids se fornecido no body
router.post("/employees/bulk-generate-pins", requireRole("admin", "rh"), async (req, res) => {
  const ids: number[] | null = Array.isArray(req.body?.ids) && req.body.ids.length > 0 ? req.body.ids : null;

  const casaEmployees = await db
    .select({ id: employeesTable.id, name: employeesTable.name, document: employeesTable.document })
    .from(employeesTable)
    .where(and(
      eq(employeesTable.employmentType, "casa"),
      eq(employeesTable.active, true),
      ids ? inArray(employeesTable.id, ids) : undefined,
    ));

  const results: { name: string; cpfLogin: string; pin: string }[] = [];
  const skipped: { name: string; reason: string }[] = [];

  // Collect existing pinValues to guarantee uniqueness within this batch
  const usedPins = new Set<string>();

  for (const emp of casaEmployees) {
    const cpfDigits = emp.document ? normalizeCpf(emp.document) : "";
    if (!isValidCpfLength(cpfDigits)) {
      skipped.push({ name: emp.name, reason: "Sem CPF válido" });
      continue;
    }

    // Generate unique PIN
    let pin: string;
    let attempts = 0;
    do {
      pin = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
      attempts++;
    } while (usedPins.has(pin) && attempts < 100);
    usedPins.add(pin);

    const passwordHash = await bcrypt.hash(pin, 12);

    const [byEmpId] = await db.select({ id: usersTable.id })
      .from(usersTable).where(eq(usersTable.employeeId, emp.id)).limit(1);

    if (byEmpId) {
      await db.update(usersTable)
        .set({ passwordHash, pinValue: pin, mustChangePassword: false })
        .where(eq(usersTable.id, byEmpId.id));
    } else {
      const [byCpf] = await db.select({ id: usersTable.id })
        .from(usersTable).where(eq(usersTable.cpfLogin, cpfDigits)).limit(1);
      if (byCpf) {
        await db.update(usersTable)
          .set({ passwordHash, pinValue: pin, mustChangePassword: false, employeeId: emp.id })
          .where(eq(usersTable.id, byCpf.id));
      } else {
        await db.insert(usersTable).values({
          name: emp.name,
          email: null,
          cpfLogin: cpfDigits,
          passwordHash,
          pinValue: pin,
          role: "visualizador",
          employeeId: emp.id,
          active: true,
          mustChangePassword: false,
        });
      }
    }

    results.push({ name: emp.name, cpfLogin: cpfDigits, pin });
  }

  await audit(req.user!.userId, "bulk_generate_pins", "users", null, null, { count: results.length, skipped: skipped.length });
  res.json({ results, skipped });
});

// POST /employees/:id/generate-pin — gera PIN de 4 dígitos para colaborador casa
router.post("/employees/:id/generate-pin", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, id)).limit(1);
  if (!emp) { res.status(404).json({ error: "Colaborador não encontrado" }); return; }
  if (emp.employmentType !== "casa") {
    res.status(400).json({ error: "Geração de PIN disponível apenas para colaboradores casa" });
    return;
  }

  const cpfDigits = emp.document ? normalizeCpf(emp.document) : "";
  if (!isValidCpfLength(cpfDigits)) {
    res.status(400).json({ error: "Colaborador sem CPF válido — não é possível criar acesso" });
    return;
  }

  // Generate unique PIN (not already used by another user)
  let pin: string;
  for (let attempt = 0; attempt < 50; attempt++) {
    pin = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.pinValue, pin!), ne(usersTable.employeeId, id))).limit(1);
    if (!existing) break;
  }
  const passwordHash = await bcrypt.hash(pin!, 12);

  let userId: number;
  let userCreated = false;

  const [byEmpId] = await db.select({ id: usersTable.id })
    .from(usersTable).where(eq(usersTable.employeeId, id)).limit(1);

  if (byEmpId) {
    userId = byEmpId.id;
    await db.update(usersTable)
      .set({ passwordHash, pinValue: pin!, mustChangePassword: false })
      .where(eq(usersTable.id, userId));
  } else {
    const [byCpf] = await db.select({ id: usersTable.id })
      .from(usersTable).where(eq(usersTable.cpfLogin, cpfDigits)).limit(1);
    if (byCpf) {
      userId = byCpf.id;
      await db.update(usersTable)
        .set({ passwordHash, pinValue: pin!, mustChangePassword: false, employeeId: id })
        .where(eq(usersTable.id, userId));
    } else {
      const [newUser] = await db.insert(usersTable).values({
        name: emp.name,
        email: null,
        cpfLogin: cpfDigits,
        passwordHash,
        pinValue: pin!,
        role: "visualizador",
        employeeId: id,
        active: true,
        mustChangePassword: false,
      }).returning({ id: usersTable.id });
      userId = newUser.id;
      userCreated = true;
    }
  }

  await audit(req.user!.userId, "generate_pin", "users", userId, null, { employeeId: id });
  res.json({ pin, cpfLogin: cpfDigits, userCreated });
});

export default router;
