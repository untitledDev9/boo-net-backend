import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Env } from '../config/env.js';
import { User } from '../db/models.js';
import type { Role } from '../resources/types.js';
import { HttpError } from './errors.js';

export const COOKIE_NAME = 'bn_token';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function signToken(env: Env, userId: string, tokenVersion: number): string {
  return jwt.sign({ sub: userId, tv: tokenVersion }, env.jwtSecret, { expiresIn: `${env.jwtExpiresDays}d` });
}

export function cookieOptions(env: Env) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.cookieSecure,
    path: '/',
    maxAge: env.jwtExpiresDays * 24 * 60 * 60 * 1000,
  };
}

/**
 * Authenticates from the HttpOnly cookie, then loads the user from the database on every request.
 * Role and active state always come from the database, never from the token, so editing the
 * cookie or any client request cannot grant privileges.
 */
export function requireAuth(env: Env): RequestHandler {
  return async (req, _res, next) => {
    const token = (req.cookies as Record<string, string> | undefined)?.[COOKIE_NAME];
    if (!token) return next(new HttpError(401, 'Authentication required'));
    let payload: { sub?: string; tv?: number };
    try {
      payload = jwt.verify(token, env.jwtSecret) as { sub?: string; tv?: number };
    } catch {
      return next(new HttpError(401, 'Session expired. Please sign in again.'));
    }
    const user = payload.sub ? await User.findById(payload.sub) : null;
    if (!user || !user.isActive || user.tokenVersion !== payload.tv) {
      return next(new HttpError(401, 'Session is no longer valid. Please sign in again.'));
    }
    req.user = { id: String(user._id), email: user.email, name: user.name, role: user.role };
    next();
  };
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Authentication required'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have permission to do that'));
    next();
  };
}

/**
 * Defence in depth on top of SameSite=Lax cookies: reject state-changing requests whose Origin
 * header is present but not in the allow-list.
 */
export function originGuard(env: Env): RequestHandler {
  const allowed = new Set(env.clientOrigins);
  return (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (origin && !allowed.has(origin)) return next(new HttpError(403, 'Origin not allowed'));
    next();
  };
}

export const actorOf = (req: Request): AuthUser => {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
};
