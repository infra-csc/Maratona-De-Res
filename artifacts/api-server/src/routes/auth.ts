import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, areasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();

async function buildAuthResponse(user: typeof usersTable.$inferSelect) {
  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    areaId: user.areaId ?? null,
    employeeId: user.employeeId ?? null,
  });
  let areaName: string | null = null;
  if (user.areaId) {
    const [area] = await db.select({ name: areasTable.name }).from(areasTable).where(eq(areasTable.id, user.areaId)).limit(1);
    areaName = area?.name ?? null;
  }
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      areaId: user.areaId,
      areaName,
      employeeId: user.employeeId ?? null,
      active: user.active,
      createdAt: user.createdAt,
    },
  };
}

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email e senha obrigatórios" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (!user || !user.active) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }
  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    areaId: user.areaId ?? null,
    employeeId: user.employeeId ?? null,
  });
  await audit(user.id, "login", "users", user.id);
  let areaName: string | null = null;
  if (user.areaId) {
    const [area] = await db.select({ name: areasTable.name }).from(areasTable).where(eq(areasTable.id, user.areaId)).limit(1);
    areaName = area?.name ?? null;
  }
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      areaId: user.areaId,
      areaName,
      employeeId: user.employeeId ?? null,
      active: user.active,
      createdAt: user.createdAt,
    },
  });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  let areaName: string | null = null;
  if (user.areaId) {
    const [area] = await db.select({ name: areasTable.name }).from(areasTable).where(eq(areasTable.id, user.areaId)).limit(1);
    areaName = area?.name ?? null;
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    areaId: user.areaId,
    areaName,
    employeeId: user.employeeId ?? null,
    active: user.active,
    createdAt: user.createdAt,
  });
});

router.post("/auth/logout", requireAuth, async (_req, res) => {
  res.json({ message: "Logout efetuado" });
});

// Dev mode: admin issues a session token to view the app as any other user.
router.post("/auth/impersonate", requireAuth, requireRole("admin"), async (req, res) => {
  const { userId } = req.body;
  if (!userId || typeof userId !== "number") {
    res.status(400).json({ error: "userId obrigatório" });
    return;
  }
  if (userId === req.user!.userId) {
    res.status(400).json({ error: "Você já está autenticado como este usuário" });
    return;
  }
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!target || !target.active) {
    res.status(404).json({ error: "Usuário não encontrado ou inativo" });
    return;
  }
  await audit(req.user!.userId, "impersonate", "users", target.id);
  res.json(await buildAuthResponse(target));
});

export default router;
