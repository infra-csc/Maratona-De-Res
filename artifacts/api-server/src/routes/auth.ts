import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable, areasTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { signToken, requireAuth, requireRole, invalidateSessionCache } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { normalizeCpf, MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES } from "../lib/credentials.js";

const router = Router();

// Limite de tentativas do login por PIN (sem identificador de usuário, o
// lockout por conta não se aplica): por origem, 10 falhas em 15 minutos.
const PIN_MAX_FAILURES = 10;
const PIN_WINDOW_MS = 15 * 60_000;
const pinFailures = new Map<string, { count: number; resetAt: number }>();
function clientKey(req: { headers: Record<string, unknown>; ip?: string }): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = typeof fwd === "string" ? fwd.split(",")[0]?.trim() : undefined;
  return first || req.ip || "unknown";
}
function pinBlocked(key: string): number | null {
  const entry = pinFailures.get(key);
  if (!entry) return null;
  if (entry.resetAt <= Date.now()) { pinFailures.delete(key); return null; }
  return entry.count >= PIN_MAX_FAILURES ? Math.ceil((entry.resetAt - Date.now()) / 60000) : null;
}
function pinFailed(key: string): void {
  const now = Date.now();
  const entry = pinFailures.get(key);
  if (!entry || entry.resetAt <= now) { pinFailures.set(key, { count: 1, resetAt: now + PIN_WINDOW_MS }); return; }
  entry.count += 1;
}

// impersonator: presente só no "Modo Dev" (admin vendo o app como outro usuário).
// O token carrega impersonatorId para que requireAuth/audit saibam quem de fato
// age; a troca obrigatória de senha do impersonado não se aplica ao admin.
async function buildAuthResponse(
  user: typeof usersTable.$inferSelect,
  impersonator?: { id: number; name: string },
) {
  const mustChangePassword = impersonator ? false : user.mustChangePassword;
  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    areaId: user.areaId ?? null,
    employeeId: user.employeeId ?? null,
    mustChangePassword,
    tv: user.tokenVersion ?? 0,
    impersonatorId: impersonator?.id,
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
      mustChangePassword,
      createdAt: user.createdAt,
      ...(impersonator ? { impersonatorId: impersonator.id, impersonatorName: impersonator.name } : {}),
    },
  };
}

router.post("/auth/login", async (req, res) => {
  const { identifier, password, pin } = req.body as { identifier?: string; password?: string; pin?: string };

  // PIN-only path for casa employees (lookup by stored pinValue)
  if (pin && /^\d{4}$/.test(pin)) {
    const key = clientKey(req as unknown as { headers: Record<string, unknown>; ip?: string });
    const blockedMinutes = pinBlocked(key);
    if (blockedMinutes != null) {
      res.status(429).json({ error: `Muitas tentativas. Tente novamente em ${blockedMinutes} min.` });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.pinValue, pin)).limit(1);
    if (!user || !user.active) {
      pinFailed(key);
      res.status(401).json({ error: "Senha inválida" });
      return;
    }
    pinFailures.delete(key);
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      res.status(429).json({ error: `Conta bloqueada. Tente em ${minutesLeft} min.` });
      return;
    }
    await db.update(usersTable).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(usersTable.id, user.id));
    await audit(user.id, "login_pin", "users", user.id);
    res.json(await buildAuthResponse(user));
    return;
  }

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
  // Sessão de "Modo Dev": informa quem é o admin real por trás do token.
  let impersonator: { impersonatorId: number; impersonatorName: string | null } | null = null;
  const impersonatorId = req.user!.impersonatorId;
  if (impersonatorId != null) {
    const [imp] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, impersonatorId)).limit(1);
    impersonator = { impersonatorId, impersonatorName: imp?.name ?? null };
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
    // No Modo Dev a troca obrigatória é do impersonado, não do admin (o token
    // de impersonação é emitido com mustChangePassword=false).
    mustChangePassword: impersonator ? false : user.mustChangePassword,
    createdAt: user.createdAt,
    ...(impersonator ?? {}),
  });
});

router.post("/auth/logout", requireAuth, async (_req, res) => {
  res.json({ message: "Logout efetuado" });
});

router.post("/auth/change-password", requireAuth, async (req, res) => {
  const { newPassword, confirmPassword, currentPassword } = req.body as { newPassword?: string; confirmPassword?: string; currentPassword?: string };
  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "A nova senha deve ter ao menos 6 caracteres" });
    return;
  }
  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    res.status(400).json({ error: "As senhas não coincidem" });
    return;
  }
  // No Modo Dev o admin não troca a senha de quem está impersonando (o fluxo
  // de troca obrigatória nem pede a senha atual).
  if (req.user!.impersonatorId != null) {
    res.status(403).json({ error: "Não é possível trocar a senha no Modo Dev" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  // Fora do fluxo de "troca obrigatória", exige a senha atual: um token
  // vazado não pode virar posse permanente da conta.
  if (!user.mustChangePassword) {
    if (!currentPassword) { res.status(400).json({ error: "Informe a senha atual" }); return; }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) { res.status(401).json({ error: "Senha atual incorreta" }); return; }
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  // Nova versão de sessão: tokens anteriores (outros dispositivos, token
  // vazado) param de valer; esta sessão recebe um token novo na resposta.
  const [updated] = await db
    .update(usersTable)
    .set({ passwordHash, mustChangePassword: false, tokenVersion: sql`${usersTable.tokenVersion} + 1` })
    .where(eq(usersTable.id, user.id))
    .returning();
  invalidateSessionCache(user.id);
  await audit(user.id, "change_password", "users", user.id);
  res.json(await buildAuthResponse(updated));
});

// SSO vindo do portal NORTE — valida JWT externo e emite token Maratona
router.post("/auth/portal-sso", async (req, res) => {
  const SESSION_SECRET = process.env.SESSION_SECRET;
  if (!SESSION_SECRET) {
    res.status(500).json({ error: "SESSION_SECRET não configurado no servidor" });
    return;
  }
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: "token obrigatório" });
    return;
  }
  let payload: { email?: string; name?: string; role?: string; iss?: string; exp?: number };
  try {
    payload = jwt.verify(token, SESSION_SECRET, {
      algorithms: ["HS256"],
      issuer: "norte-portal",
    }) as typeof payload;
  } catch {
    res.status(401).json({ error: "Token SSO inválido ou expirado" });
    return;
  }
  // Token SSO sem prazo valeria para sempre se fosse capturado.
  if (!payload.exp) {
    res.status(401).json({ error: "Token SSO sem prazo de validade" });
    return;
  }
  if (!payload.email) {
    res.status(401).json({ error: "Token SSO sem e-mail" });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, payload.email.toLowerCase().trim()), eq(usersTable.active, true)))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado ou inativo" });
    return;
  }
  await audit(user.id, "portal_sso_login", "users", user.id);
  res.json(await buildAuthResponse(user));
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
  // Se o admin já está no Modo Dev (impersonando outro admin), o ator real
  // continua sendo o admin original.
  const realAdminId = req.user!.impersonatorId ?? req.user!.userId;
  const [realAdmin] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, realAdminId)).limit(1);
  if (!realAdmin) {
    res.status(401).json({ error: "Sessão inválida" });
    return;
  }
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!target || !target.active) {
    res.status(404).json({ error: "Usuário não encontrado ou inativo" });
    return;
  }
  await audit(req.user!.userId, "impersonate", "users", target.id, undefined, { impersonatedUserId: target.id, realAdminId });
  res.json(await buildAuthResponse(target, realAdmin));
});

export default router;
