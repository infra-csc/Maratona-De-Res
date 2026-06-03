import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, areasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();

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
  const token = signToken({ userId: user.id, email: user.email, role: user.role });
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
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, areaId: user.areaId, areaName, active: user.active, createdAt: user.createdAt });
});

router.post("/auth/logout", requireAuth, async (_req, res) => {
  res.json({ message: "Logout efetuado" });
});

export default router;
