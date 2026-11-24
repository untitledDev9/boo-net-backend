import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { User } from '../db/models.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { audit } from '../services/content.js';
import { notifyAccount } from '../services/notify.js';
import { passwordRule } from './auth.js';

const roleSchema = z.enum(['superadmin', 'admin', 'editor', 'support']);
const pub = (u: Record<string, any>) => ({ id: String(u._id), email: u.email, name: u.name, role: u.role, isActive: u.isActive, lastLoginAt: u.lastLoginAt ?? null, createdAt: u.createdAt });

/** Staff account management. Superadmin only; enforced here on the server, not just hidden in the UI. */
export function usersRouter(): Router {
  const router = Router();
  router.use(requireRole('superadmin'));

  const activeSuperadmins = () => User.countDocuments({ role: 'superadmin', isActive: true });

  router.get('/', async (_req, res) => {
    res.json({ items: (await User.find().sort({ createdAt: 1 }).lean()).map(pub) });
  });

  router.post('/', async (req, res) => {
    const { email, name, role, password } = z.object({ email: z.string().trim().toLowerCase().email(), name: z.string().trim().min(1).max(100), role: roleSchema, password: passwordRule }).parse(req.body);
    const user = await User.create({ email, name, role, passwordHash: await bcrypt.hash(password, 12) });
    await audit(req, 'create', 'user', String(user._id), `Created ${role} account: ${email}`);
    notifyAccount('New staff account', `${name} (${role}) was added by ${req.user!.name}`, req.user!.id, String(user._id));
    res.status(201).json(pub(user.toObject()));
  });

  router.patch('/:id', async (req, res) => {
    const body = z.object({ name: z.string().trim().min(1).max(100).optional(), role: roleSchema.optional(), isActive: z.boolean().optional() }).parse(req.body);
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    const isSelf = String(user._id) === req.user!.id;
    if (isSelf && (body.role && body.role !== user.role)) throw new HttpError(400, 'You cannot change your own role');
    if (isSelf && body.isActive === false) throw new HttpError(400, 'You cannot deactivate your own account');
    const losingSuper = user.role === 'superadmin' && user.isActive && ((body.role && body.role !== 'superadmin') || body.isActive === false);
    if (losingSuper && (await activeSuperadmins()) <= 1) throw new HttpError(400, 'There must be at least one active superadmin');
    const roleChanged = body.role && body.role !== user.role;
    Object.assign(user, body);
    if (roleChanged || body.isActive === false) user.tokenVersion += 1; // end that person's existing sessions
    await user.save();
    await audit(req, 'update', 'user', String(user._id), `Updated account: ${user.email}`, body);
    if (roleChanged) notifyAccount('Staff role changed', `${user.name} is now ${user.role} (by ${req.user!.name})`, req.user!.id, String(user._id));
    else if (body.isActive !== undefined) notifyAccount(body.isActive ? 'Staff account reactivated' : 'Staff account deactivated', `${user.name} (${user.email}) by ${req.user!.name}`, req.user!.id, String(user._id));
    res.json(pub(user.toObject()));
  });

  router.post('/:id/reset-password', async (req, res) => {
    const { password } = z.object({ password: passwordRule }).parse(req.body);
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    user.passwordHash = await bcrypt.hash(password, 12);
    user.tokenVersion += 1;
    await user.save();
    await audit(req, 'reset-password', 'user', String(user._id), `Reset password: ${user.email}`);
    notifyAccount('Staff password reset', `${user.name}'s password was reset by ${req.user!.name}`, req.user!.id, String(user._id));
    res.json({ ok: true });
  });

  return router;
}
