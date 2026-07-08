import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, areasTable, employeesTable, evaluationsTable, calibrationsTable, eventConformitiesTable, eventsTable, eventAreaAssignmentsTable } from "@workspace/db";
import { eq, and, isNull, inArray, ne } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { normalizeCpf, isValidCpfLength, defaultPasswordForCpf } from "../lib/credentials.js";

const router = Router();

router.use(requireAuth);

router.get("/users", requireRole("admin", "rh", "diretoria"), async (_req, res) => {
  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      cpfLogin: usersTable.cpfLogin,
      role: usersTable.role,
      areaId: usersTable.areaId,
      areaName: areasTable.name,
      employeeId: usersTable.employeeId,
      employeeName: employeesTable.name,
      active: usersTable.active,
      mustChangePassword: usersTable.mustChangePassword,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .leftJoin(areasTable, eq(usersTable.areaId, areasTable.id))
    .leftJoin(employeesTable, eq(usersTable.employeeId, employeesTable.id));
  res.json(users);
});

router.get("/users/collaborators-without-access", requireRole("admin", "rh"), async (req, res) => {
  const { employmentType } = req.query as { employmentType?: string };
  const typeFilter = employmentType === "casa" || employmentType === "freela" ? eq(employeesTable.employmentType, employmentType) : undefined;
  const employees = await db
    .select({
      id: employeesTable.id,
      name: employeesTable.name,
      document: employeesTable.document,
    })
    .from(employeesTable)
    .leftJoin(usersTable, eq(usersTable.employeeId, employeesTable.id))
    .where(and(eq(employeesTable.active, true), isNull(usersTable.id), typeFilter));

  const eligible: { id: number; name: string; cpfDigits: string }[] = [];
  const missingCpf: { id: number; name: string }[] = [];
  for (const e of employees) {
    const digits = e.document ? normalizeCpf(e.document) : "";
    if (isValidCpfLength(digits)) {
      eligible.push({ id: e.id, name: e.name, cpfDigits: digits });
    } else {
      missingCpf.push({ id: e.id, name: e.name });
    }
  }
  res.json({ eligibleCount: eligible.length, missingCpfCount: missingCpf.length, missingCpf });
});

router.post("/users/bulk-generate-collaborator-access", requireRole("admin", "rh"), async (req, res) => {
  const dryRun = req.body?.dryRun === true;
  const { employmentType } = req.body as { employmentType?: string };
  const typeFilter = employmentType === "casa" || employmentType === "freela" ? eq(employeesTable.employmentType, employmentType) : undefined;

  const employees = await db
    .select({
      id: employeesTable.id,
      name: employeesTable.name,
      document: employeesTable.document,
    })
    .from(employeesTable)
    .leftJoin(usersTable, eq(usersTable.employeeId, employeesTable.id))
    .where(and(eq(employeesTable.active, true), isNull(usersTable.id), typeFilter));

  const created: { employeeId: number; name: string; cpfLogin: string; password: string }[] = [];
  const missingCpf: { employeeId: number; name: string }[] = [];
  const conflicts: { employeeId: number; name: string }[] = [];
  const seenCpf = new Set<string>();

  for (const e of employees) {
    const digits = e.document ? normalizeCpf(e.document) : "";
    if (!isValidCpfLength(digits)) {
      missingCpf.push({ employeeId: e.id, name: e.name });
      continue;
    }
    if (seenCpf.has(digits)) {
      conflicts.push({ employeeId: e.id, name: e.name });
      continue;
    }
    if (!dryRun) {
      const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.cpfLogin, digits)).limit(1);
      if (existing) {
        conflicts.push({ employeeId: e.id, name: e.name });
        continue;
      }
    }
    seenCpf.add(digits);
    const password = defaultPasswordForCpf(digits);
    if (!dryRun) {
      const passwordHash = await bcrypt.hash(password, 12);
      await db.insert(usersTable).values({
        name: e.name,
        email: null,
        cpfLogin: digits,
        passwordHash,
        role: "visualizador",
        employeeId: e.id,
        active: true,
        mustChangePassword: true,
      });
    }
    created.push({ employeeId: e.id, name: e.name, cpfLogin: digits, password });
  }

  if (!dryRun && created.length > 0) {
    await audit(req.user!.userId, "bulk_generate_access", "users", undefined, undefined, {
      count: created.length,
      employeeIds: created.map(c => c.employeeId),
    });
  }

  res.json({
    dryRun,
    createdCount: created.length,
    created: dryRun ? [] : created,
    missingCpf,
    conflicts,
  });
});

router.get("/users/:id", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [user] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      cpfLogin: usersTable.cpfLogin,
      role: usersTable.role,
      areaId: usersTable.areaId,
      areaName: areasTable.name,
      active: usersTable.active,
      mustChangePassword: usersTable.mustChangePassword,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .leftJoin(areasTable, eq(usersTable.areaId, areasTable.id))
    .where(eq(usersTable.id, id))
    .limit(1);
  if (!user) { res.status(404).json({ error: "Não encontrado" }); return; }
  res.json(user);
});

router.post("/users", requireRole("admin", "rh"), async (req, res) => {
  const { name, email, role, areaId, password, employeeId } = req.body;
  if (!name || !email || !role || !password) {
    res.status(400).json({ error: "Campos obrigatórios: name, email, role, password" });
    return;
  }
  if (employeeId != null) {
    const [emp] = await db.select({ id: employeesTable.id }).from(employeesTable).where(eq(employeesTable.id, employeeId)).limit(1);
    if (!emp) { res.status(400).json({ error: "Colaborador não encontrado" }); return; }
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({
    name, email: email.toLowerCase(), passwordHash, role, areaId: areaId ?? null,
    employeeId: employeeId ?? null,
  }).returning();
  await audit(req.user!.userId, "create", "users", user.id, null, { email, role, employeeId: employeeId ?? null });
  res.status(201).json({ ...user, passwordHash: undefined });
});

router.patch("/users/:id", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, email, role, areaId, active, employeeId } = req.body;
  const [before] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Não encontrado" }); return; }
  if (employeeId != null) {
    const [emp] = await db.select({ id: employeesTable.id }).from(employeesTable).where(eq(employeesTable.id, employeeId)).limit(1);
    if (!emp) { res.status(400).json({ error: "Colaborador não encontrado" }); return; }
  }
  const [user] = await db.update(usersTable).set({
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email: email.toLowerCase() }),
    ...(role !== undefined && { role }),
    ...(areaId !== undefined && { areaId }),
    ...(active !== undefined && { active }),
    ...(employeeId !== undefined && { employeeId }),
  }).where(eq(usersTable.id, id)).returning();
  await audit(req.user!.userId, "update", "users", id, before, { ...user, passwordHash: undefined });
  res.json({ ...user, passwordHash: undefined });
});

router.delete("/users/:id", requireRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (id === req.user!.userId) {
    res.status(400).json({ error: "Não é possível excluir seu próprio usuário" });
    return;
  }
  try {
    await db.delete(usersTable).where(eq(usersTable.id, id));
  } catch (err: unknown) {
    const e = err as { code?: string; cause?: { code?: string } };
    const code = e.code ?? e.cause?.code;
    if (code === "23503") {
      res.status(400).json({
        error: "Este usuário possui histórico no sistema (logins, avaliações ou registros) e não pode ser excluído. Desative o acesso em vez de excluir.",
      });
      return;
    }
    throw err;
  }
  await audit(req.user!.userId, "delete", "users", id);
  res.status(204).end();
});

// POST /users/:id/merge — mescla avaliadores duplicados no canônico
router.post("/users/:id/merge", requireRole("admin", "rh"), async (req, res) => {
  const canonicalId = parseInt(req.params.id as string);
  const { duplicateIds } = req.body as { duplicateIds: number[] };
  if (!Array.isArray(duplicateIds) || duplicateIds.length === 0) {
    res.status(400).json({ error: "duplicateIds obrigatório" }); return;
  }
  const [canonical] = await db.select().from(usersTable).where(eq(usersTable.id, canonicalId)).limit(1);
  if (!canonical) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

  const dupIds = duplicateIds.filter(id => id !== canonicalId);
  if (dupIds.length === 0) { res.status(400).json({ error: "Nenhum duplicado válido" }); return; }

  let movedEvaluations = 0, movedCalibrations = 0, movedConformities = 0, movedAssignments = 0;

  await db.transaction(async (tx) => {
    // evaluations.evaluator_user_id
    const evRes = await tx.update(evaluationsTable)
      .set({ evaluatorUserId: canonicalId })
      .where(inArray(evaluationsTable.evaluatorUserId, dupIds));
    movedEvaluations = (evRes as unknown as { rowCount?: number }).rowCount ?? 0;

    // calibrations.calibrated_by_user_id
    const calRes = await tx.update(calibrationsTable)
      .set({ calibratedByUserId: canonicalId })
      .where(inArray(calibrationsTable.calibratedByUserId, dupIds));
    movedCalibrations = (calRes as unknown as { rowCount?: number }).rowCount ?? 0;

    // event_conformities.created_by_user_id
    const confRes = await tx.update(eventConformitiesTable)
      .set({ createdByUserId: canonicalId })
      .where(inArray(eventConformitiesTable.createdByUserId, dupIds));
    movedConformities = (confRes as unknown as { rowCount?: number }).rowCount ?? 0;

    // events.conformity_evaluator_user_id / conformity_evaluator_ferramentas_user_id
    for (const dupId of dupIds) {
      await tx.update(eventsTable)
        .set({ conformityEvaluatorUserId: canonicalId })
        .where(eq(eventsTable.conformityEvaluatorUserId, dupId));
      await tx.update(eventsTable)
        .set({ conformityEvaluatorFerramentasUserId: canonicalId })
        .where(eq(eventsTable.conformityEvaluatorFerramentasUserId, dupId));
    }

    // event_area_assignments.evaluator_user_id (unique: event+area+evaluator — skip conflicts)
    const canonicalAssign = await tx.select({ eventId: eventAreaAssignmentsTable.eventId, areaId: eventAreaAssignmentsTable.areaId })
      .from(eventAreaAssignmentsTable).where(eq(eventAreaAssignmentsTable.evaluatorUserId, canonicalId));
    const canonicalKeys = new Set(canonicalAssign.map(a => `${a.eventId}-${a.areaId}`));
    for (const dupId of dupIds) {
      const dupAssign = await tx.select().from(eventAreaAssignmentsTable)
        .where(eq(eventAreaAssignmentsTable.evaluatorUserId, dupId));
      for (const a of dupAssign) {
        const key = `${a.eventId}-${a.areaId}`;
        if (!canonicalKeys.has(key)) {
          await tx.update(eventAreaAssignmentsTable)
            .set({ evaluatorUserId: canonicalId })
            .where(eq(eventAreaAssignmentsTable.id, a.id));
          canonicalKeys.add(key);
          movedAssignments++;
        }
      }
    }

    // Se canônico não tem área mas duplicado tem, herda a área
    if (!canonical.areaId) {
      for (const dupId of dupIds) {
        const [dup] = await tx.select({ areaId: usersTable.areaId }).from(usersTable).where(eq(usersTable.id, dupId)).limit(1);
        if (dup?.areaId) {
          await tx.update(usersTable).set({ areaId: dup.areaId }).where(eq(usersTable.id, canonicalId));
          break;
        }
      }
    }

    // Desativa os duplicados
    await tx.update(usersTable)
      .set({ active: false })
      .where(inArray(usersTable.id, dupIds));
  });

  await audit(req.user!.userId, "merge", "users", canonicalId, { duplicateIds: dupIds }, { movedEvaluations, movedCalibrations, movedConformities, movedAssignments });
  res.json({ canonicalId, merged: dupIds, movedEvaluations, movedCalibrations, movedConformities, movedAssignments });
});

// ─── Bulk Office 365 email migration ────────────────────────────────────────
const OFFICE365_EMAIL_MAP: { id: number; email: string }[] = [
  { id: 59, email: "aline.candido@ttkmarketing.com.br" },
  { id: 34, email: "agatha.nadolsky@nortemkt.com" },
  { id: 67, email: "aline.soares@nortemkt.com" },
  { id: 61, email: "ana.motta@nortemkt.com" },
  { id: 71, email: "anderson.andreotti@ttkmarketing.com.br" },
  { id: 41, email: "camilla.lopes@nortemkt.com" },
  { id: 36, email: "edney.siqueira@ttkmarketing.com.br" },
  { id: 72, email: "eduardo.meira@cscdoesporte.com.br" },
  { id: 73, email: "fabio.santoniello@ttkmarketing.com.br" },
  { id: 57, email: "fernanda.toussaint@ttkmarketing.com.br" },
  { id: 64, email: "geuderson.silva@ttkmarketing.com.br" },
  { id: 32, email: "giovanni.bertoni@ttkmarketing.com.br" },
  { id: 42, email: "guilherme.flauzino@ttkmarketing.com.br" },
  { id: 70, email: "igor.santos@ttkmarketing.com.br" },
  { id: 74, email: "jaqueline.oshiro@ttkmarketing.com.br" },
  { id: 35, email: "leonardo.almeida@ttkmarketing.com.br" },
  { id: 33, email: "lucas.vicenzo@ttkmarketing.com.br" },
  { id: 40, email: "luciano.nascimento@ttkmarketing.com.br" },
  { id: 60, email: "manoel.alves@ttkmarketing.com.br" },
  { id: 77, email: "marcelo.toscano@ttkmarketing.com.br" },
  { id: 78, email: "mirella.milani@nortemkt.com" },
  { id: 48, email: "natasha.barbosa@ttkmarketing.com.br" },
  { id: 79, email: "oscar.cardoso@cscdoesporte.onmicrosoft.com" },
  { id: 39, email: "paulo.roberto@ttkmarketing.com.br" },
  { id: 69, email: "priscila.elias@ttkmarketing.com.br" },
  { id: 58, email: "rubem.vasques@ttkmarketing.com.br" },
  { id: 51, email: "rafael.silva@ttkmarketing.com.br" },
  { id: 44, email: "reinaldo.sousa@nortemkt.com" },
  { id: 43, email: "renan.mota@ttkmarketing.com.br" },
  { id: 82, email: "sandro.paiva@cscdoesporte.com.br" },
  { id: 83, email: "tarcisio.ferreira@ttkmarketing.com.br" },
  { id: 63, email: "ulisses.souza@cscdoesporte.com.br" },
  { id: 66, email: "vinicius.alexandre@ttkmarketing.com.br" },
  { id: 38, email: "gabriel.bernardineli@ttkmarketing.com.br" },
];

router.post("/users/bulk-update-emails", requireRole("admin"), async (req, res) => {
  const dryRun = req.body?.dryRun === true;

  const ids = OFFICE365_EMAIL_MAP.map(r => r.id);
  const existing = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(inArray(usersTable.id, ids));

  const existingMap = new Map(existing.map(u => [u.id, u]));

  const preview = OFFICE365_EMAIL_MAP.map(({ id, email }) => {
    const u = existingMap.get(id);
    if (!u) return { id, email, status: "not_found" as const };
    const changed = u.email !== email;
    return { id, name: u.name, emailFrom: u.email ?? null, emailTo: email, status: changed ? "will_update" as const : "no_change" as const };
  });

  if (dryRun) {
    res.json({ dryRun: true, preview });
    return;
  }

  const toUpdate = preview.filter(p => p.status === "will_update");
  for (const row of toUpdate) {
    await db.update(usersTable).set({ email: row.emailTo }).where(eq(usersTable.id, row.id));
    await audit(req.user!.userId, "bulk_update_email", "users", row.id, undefined, { emailTo: row.emailTo });
  }

  res.json({ dryRun: false, updated: toUpdate.length, preview });
});

router.post("/users/:id/reset-password", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { newPassword } = req.body;
  if (!newPassword) { res.status(400).json({ error: "newPassword obrigatório" }); return; }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ passwordHash, mustChangePassword: true }).where(eq(usersTable.id, id));
  await audit(req.user!.userId, "reset_password", "users", id);
  res.json({ message: "Senha redefinida com sucesso" });
});

export default router;
