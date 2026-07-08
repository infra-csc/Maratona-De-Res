import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, areasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { normalizeCpf, MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES } from "../lib/credentials.js";

const router = Router();

async function buildAuthResponse(user: typeof usersTable.$inferSelect) {
  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    areaId: user.areaId ?? null,
    employeeId: user.employeeId ?? null,
    mustChangePassword: user.mustChangePassword,
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
      cpfLogin: user.cpfLogin,
      role: user.role,
      areaId: user.areaId,
      areaName,
      employeeId: user.employeeId ?? null,
      active: user.active,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
    },
  };
}

router.post("/auth/login", async (req, res) => {
  const { identifier, password } = req.body as { identifier?: string; password?: string };
  if (!identifier || !password) {
    res.status(400).json({ error: "CPF/e-mail e senha obrigatórios" });
    return;
  }
  const trimmed = identifier.trim();
  const isEmail = trimmed.includes("@");
  const lookupValue = isEmail ? trimmed.toLowerCase() : normalizeCpf(trimmed);

  const [user] = await db
    .select()
    .from(usersTable)
    .where(isEmail ? eq(usersTable.email, lookupValue) : eq(usersTable.cpfLogin, lookupValue))
    .limit(1);

  if (!user || !user.active) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    res.status(429).json({ error: `Conta bloqueada temporariamente. Tente novamente em ${minutesLeft} min.` });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null;
    await db
      .update(usersTable)
      .set({ failedLoginAttempts: attempts, lockedUntil })
      .where(eq(usersTable.id, user.id));
    if (lockedUntil) {
      res.status(429).json({ error: `Muitas tentativas. Conta bloqueada por ${LOCKOUT_MINUTES} minutos.` });
      return;
    }
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }

  await db
    .update(usersTable)
    .set({ failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(usersTable.id, user.id));
  await audit(user.id, "login", "users", user.id);
  res.json(await buildAuthResponse(user));
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
    cpfLogin: user.cpfLogin,
    role: user.role,
    areaId: user.areaId,
    areaName,
    employeeId: user.employeeId ?? null,
    active: user.active,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
  });
});

router.post("/auth/logout", requireAuth, async (_req, res) => {
  res.json({ message: "Logout efetuado" });
});

router.post("/auth/change-password", requireAuth, async (req, res) => {
  const { newPassword, confirmPassword } = req.body as { newPassword?: string; confirmPassword?: string };
  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "A nova senha deve ter ao menos 6 caracteres" });
    return;
  }
  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    res.status(400).json({ error: "As senhas não coincidem" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(usersTable)
    .set({ passwordHash, mustChangePassword: false })
    .where(eq(usersTable.id, user.id));
  await audit(user.id, "change_password", "users", user.id);
  res.json(await buildAuthResponse({ ...user, passwordHash, mustChangePassword: false }));
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
