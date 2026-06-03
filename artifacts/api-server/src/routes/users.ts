import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, areasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();

router.use(requireAuth);

router.get("/users", requireRole("admin", "rh", "diretoria"), async (_req, res) => {
  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      areaId: usersTable.areaId,
      areaName: areasTable.name,
      active: usersTable.active,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .leftJoin(areasTable, eq(usersTable.areaId, areasTable.id));
  res.json(users);
});

router.get("/users/:id", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const [user] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      areaId: usersTable.areaId,
      areaName: areasTable.name,
      active: usersTable.active,
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
  const { name, email, role, areaId, password } = req.body;
  if (!name || !email || !role || !password) {
    res.status(400).json({ error: "Campos obrigatórios: name, email, role, password" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({
    name, email: email.toLowerCase(), passwordHash, role, areaId: areaId ?? null,
  }).returning();
  await audit(req.user!.userId, "create", "users", user.id, null, { email, role });
  res.status(201).json({ ...user, passwordHash: undefined });
});

router.patch("/users/:id", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { name, email, role, areaId, active } = req.body;
  const [before] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Não encontrado" }); return; }
  const [user] = await db.update(usersTable).set({
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email: email.toLowerCase() }),
    ...(role !== undefined && { role }),
    ...(areaId !== undefined && { areaId }),
    ...(active !== undefined && { active }),
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
  await db.delete(usersTable).where(eq(usersTable.id, id));
  await audit(req.user!.userId, "delete", "users", id);
  res.status(204).end();
});

router.post("/users/:id/reset-password", requireRole("admin", "rh"), async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { newPassword } = req.body;
  if (!newPassword) { res.status(400).json({ error: "newPassword obrigatório" }); return; }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, id));
  await audit(req.user!.userId, "reset_password", "users", id);
  res.json({ message: "Senha redefinida com sucesso" });
});

export default router;
