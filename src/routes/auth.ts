import { timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Env } from '../config/env.js';
import { User } from '../db/models.js';
import { COOKIE_NAME, cookieOptions, requireAuth, signToken } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { audit } from '../services/content.js';

export const passwordRule = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), 'Password needs upper-case, lower-case and a number');

// A valid hash compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const safeEqual = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export interface AuthRouterOptions {
  loginLimit?: number;
}

export function authRouter(env: Env, opts: AuthRouterOptions = {}): Router {
  const router = Router();
  const auth = requireAuth(env);

  router.post(
    '/login',
    rateLimit({ windowMs: 15 * 60 * 1000, limit: opts.loginLimit ?? 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many sign-in attempts. Try again later.' } }),
    async (req, res) => {
      const { email, password } = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) }).parse(req.body);
      const user = await User.findOne({ email }).select('+passwordHash');
      const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
      if (!user || !ok || !user.isActive) throw new HttpError(401, 'Incorrect email or password');
      user.lastLoginAt = new Date();
      await user.save();
      res.cookie(COOKIE_NAME, signToken(env, String(user._id), user.tokenVersion), cookieOptions(env));
      req.user = { id: String(user._id), email: user.email, name: user.name, role: user.role };
      await audit(req, 'login', 'user', String(user._id), `Signed in: ${user.email}`);
      res.json({ user: req.user });
    },
  );

  router.post('/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME, { ...cookieOptions(env), maxAge: undefined });
    res.json({ ok: true });
  });

  router.get('/me', auth, (req, res) => {
    res.json({ user: req.user });
  });

  router.post('/change-password', auth, async (req, res) => {
    const { currentPassword, newPassword } = z.object({ currentPassword: z.string().min(1), newPassword: passwordRule }).parse(req.body);
    const user = await User.findById(req.user!.id).select('+passwordHash');
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new HttpError(400, 'Current password is incorrect');
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.tokenVersion += 1; // signs out every other session
    await user.save();
    res.cookie(COOKIE_NAME, signToken(env, String(user._id), user.tokenVersion), cookieOptions(env));
    await audit(req, 'change-password', 'user', String(user._id), 'Changed own password');
    res.json({ ok: true });
  });

  /**
   * One-time creation of the first administrator. Only works while no user exists and only with the
   * BOOTSTRAP_TOKEN from the server environment. After that it is permanently closed.
   */
  router.post('/bootstrap', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false }), async (req, res) => {
    const token = String(req.headers['x-bootstrap-token'] ?? '');
    if (!env.bootstrapToken || !safeEqual(token, env.bootstrapToken)) throw new HttpError(403, 'Bootstrap is not enabled or the token is wrong');
    if ((await User.countDocuments()) > 0) throw new HttpError(409, 'An administrator already exists');
    const { email, name, password } = z.object({ email: z.string().trim().toLowerCase().email(), name: z.string().trim().min(1).max(100), password: passwordRule }).parse(req.body);
    const user = await User.create({ email, name, passwordHash: await bcrypt.hash(password, 12), role: 'superadmin' });
    res.status(201).json({ ok: true, id: String(user._id) });
  });

  return router;
}
