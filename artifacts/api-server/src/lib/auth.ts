import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

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
}

// Paths reachable even while a login is pending a forced password change.
// Checked against req.path (mounted under /api by app.ts, so req.path here
// is relative to the mount, e.g. "/auth/change-password").
const PASSWORD_CHANGE_ALLOWLIST = ["/auth/me", "/auth/logout", "/auth/change-password"];

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, _JWT_SECRET, { expiresIn: "24h" });
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

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  try {
    const payload = verifyToken(auth.slice(7));
    if (payload.mustChangePassword && !PASSWORD_CHANGE_ALLOWLIST.includes(req.path)) {
      res.status(403).json({ error: "Troca de senha obrigatória", code: "PASSWORD_CHANGE_REQUIRED" });
      return;
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    next();
  };
}
