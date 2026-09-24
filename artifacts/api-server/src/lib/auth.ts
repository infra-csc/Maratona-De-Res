import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import { runWithAuditActor } from "./audit.js";
import { logger } from "./logger.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is required");
const _JWT_SECRET: string = JWT_SECRET;

export interface JwtPayload {
  userId: number;
  email: string | null;
  role: string;
  areaId?: number | null;
  employeeId?: number | null;
  mustChangePassword?: boolean;
  /**
   * Versão das sessões do usuário no momento da emissão (users.token_version).
   * Tokens emitidos antes deste campo existir não o têm: tratados como 0.
   */
  tv?: number;
  /** userId do admin real quando o token é de impersonação ("Modo Dev"). */
  impersonatorId?: number;
}

// Paths reachable even while a login is pending a forced password change.
// Checked against req.path (mounted under /api by app.ts, so req.path here
// is relative to the mount, e.g. "/auth/change-password").
const PASSWORD_CHANGE_ALLOWLIST = ["/auth/me", "/auth/logout", "/auth/change-password"];

export function signToken(payload: JwtPayload): string {
  // Remove campos opcionais indefinidos para o token não carregar lixo.
  const clean: JwtPayload = { ...payload };
  if (clean.impersonatorId == null) delete clean.impersonatorId;
  return jwt.sign(clean, _JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, _JWT_SECRET) as unknown as JwtPayload;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ─── Revogação de sessão ────────────────────────────────────────────────────
// O JWT continua stateless (24 h), mas cada requisição confere, com cache em
// memória de 30 s por usuário, se ele ainda existe, está ativo e tem o mesmo
// token_version do token. Desativar, trocar papel ou senha incrementa a versão
// e derruba as sessões antigas: na hora nesta instância (o cache é invalidado
// por bumpTokenVersion) e em até 30 s em outras instâncias.

const SESSION_CACHE_TTL_MS = 30_000;
interface SessionState { active: boolean; tokenVersion: number; role: string; expiresAt: number }
const sessionCache = new Map<number, SessionState>();
let warnedMissingTokenVersion = false;

async function loadSessionState(userId: number): Promise<SessionState | null> {
  const cached = sessionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached;
  let row: { active: boolean; tokenVersion: number; role: string } | undefined;
  try {
    [row] = await db
      .select({ active: usersTable.active, tokenVersion: usersTable.tokenVersion, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
  } catch (err) {
    // Código publicado antes da migração 0001 chegar ao banco (dev e produção
    // podem ser bancos diferentes): sem users.token_version, ainda confere
    // existência/ativo/papel e trata a versão como 0, em vez de 500 em tudo.
    if ((err as { code?: string; cause?: { code?: string } })?.code !== "42703"
      && (err as { cause?: { code?: string } })?.cause?.code !== "42703") throw err;
    if (!warnedMissingTokenVersion) {
      warnedMissingTokenVersion = true;
      logger.warn("users.token_version não existe: rode `pnpm --filter @workspace/db run migrate:deploy`; revogação de sessão desligada até lá");
    }
    const [legacy] = await db
      .select({ active: usersTable.active, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    row = legacy ? { ...legacy, tokenVersion: 0 } : undefined;
  }
  if (!row) { sessionCache.delete(userId); return null; }
  const state: SessionState = { ...row, expiresAt: Date.now() + SESSION_CACHE_TTL_MS };
  sessionCache.set(userId, state);
  return state;
}

/** Esquece o estado em cache (use após qualquer mudança em users que afete sessão). */
export function invalidateSessionCache(userIds: number | number[]): void {
  for (const id of Array.isArray(userIds) ? userIds : [userIds]) sessionCache.delete(id);
}

type DbOrTx = Pick<typeof db, "update">;

/**
 * Incrementa users.token_version, invalidando todos os tokens já emitidos para
 * esses usuários. Aceita uma transação (tx) para rodar junto com a mudança que
 * motivou a revogação. Devolve a nova versão de cada usuário.
 */
export async function bumpTokenVersion(userIds: number | number[], executor: DbOrTx = db): Promise<Map<number, number>> {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  const out = new Map<number, number>();
  if (ids.length === 0) return out;
  const rows = await executor
    .update(usersTable)
    .set({ tokenVersion: sql`${usersTable.tokenVersion} + 1` })
    .where(inArray(usersTable.id, ids))
    .returning({ id: usersTable.id, tokenVersion: usersTable.tokenVersion });
  for (const r of rows) out.set(r.id, r.tokenVersion);
  invalidateSessionCache(ids);
  return out;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  let payload: JwtPayload;
  try {
    payload = verifyToken(auth.slice(7));
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }

  // Sessão revogada? (usuário removido, desativado ou com versão nova)
  const state = await loadSessionState(payload.userId);
  if (!state || !state.active || state.tokenVersion !== (payload.tv ?? 0)) {
    res.status(401).json({ error: "Sessão encerrada. Entre novamente.", code: "SESSION_REVOKED" });
    return;
  }
  // Token de impersonação: o admin que o emitiu precisa continuar admin e ativo.
  if (payload.impersonatorId != null) {
    const imp = await loadSessionState(payload.impersonatorId);
    if (!imp || !imp.active || !isRole(imp.role, "admin")) {
      res.status(401).json({ error: "Sessão de Modo Dev encerrada. Entre novamente.", code: "SESSION_REVOKED" });
      return;
    }
  }

  if (payload.mustChangePassword && !PASSWORD_CHANGE_ALLOWLIST.includes(req.path)) {
    res.status(403).json({ error: "Troca de senha obrigatória", code: "PASSWORD_CHANGE_REQUIRED" });
    return;
  }
  req.user = payload;
  // Handlers seguintes rodam dentro deste contexto: audit() lê o ator real.
  runWithAuditActor({ impersonatorId: payload.impersonatorId ?? null }, () => next());
}

/**
 * Compara o papel do usuário de forma tolerante a maiúsculas/minúsculas e
 * espaços — mesma proteção defensiva usada em requireRole, mas para checks
 * inline (ex.: "req.user!.role === 'operador'") espalhados pelas rotas.
 */
export function isRole(role: string | null | undefined, target: string): boolean {
  return (role ?? "").trim().toLowerCase() === target.toLowerCase();
}

export function requireRole(...roles: string[]) {
  // Comparação tolerante a maiúsculas/minúsculas e espaços — proteção
  // defensiva caso o valor salvo divirja do literal exato (ex.: "Operador"
  // em vez de "operador"), o que rejeitaria silenciosamente um papel válido.
  const normalizedRoles = roles.map(r => r.trim().toLowerCase());
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = (req.user?.role ?? "").trim().toLowerCase();
    if (!req.user || !normalizedRoles.includes(userRole)) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    next();
  };
}
