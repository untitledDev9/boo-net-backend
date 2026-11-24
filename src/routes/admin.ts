import { Router } from 'express';
import type { Env } from '../config/env.js';
import { AuditLog, modelOf } from '../db/models.js';
import { originGuard, requireAuth, requireRole } from '../middleware/auth.js';
import { MODULE_ORDER, RESOURCES, readRolesOf } from '../resources/registry.js';
import type { Role } from '../resources/types.js';
import { CHAT_ROLES } from '../services/chat.js';
import type { MediaStorage } from '../services/storage.js';
import { adminChatRouter } from './chat.js';
import { adminResourceRouter } from './adminResource.js';
import { mediaRouter } from './media.js';
import { usersRouter } from './users.js';

/** Which resources/fields carry the "needs attention" state for each inbox. */
const INBOX_NEW: Record<string, [string, string]> = {
  contactMessage: ['msgStatus', 'new'],
  opportunity: ['oppStatus', 'new'],
  radioSubmission: ['inboxStatus', 'new'],
  shoutoutOrder: ['orderStatus', 'new'],
  order: ['orderStatus', 'pending'],
};

export function adminRouter(env: Env, storage: MediaStorage): Router {
  const router = Router();
  router.use(originGuard(env), requireAuth(env));

  /** Everything the admin UI needs to render itself: modules, resources, field definitions and what this user may do. */
  router.get('/meta', (req, res) => {
    const role = req.user!.role as Role;
    const visible = RESOURCES.filter((r) => readRolesOf(r).includes(role));
    const modules = MODULE_ORDER.map((name) => ({
      name,
      resources: visible
        .filter((r) => r.module === name)
        .map((r) => ({
          key: r.key,
          path: r.path,
          label: r.label,
          singular: r.singular,
          description: r.description ?? '',
          singleton: Boolean(r.singleton),
          publishable: r.publishable,
          orderable: Boolean(r.orderable),
          inbox: Boolean(r.publicSubmit),
          titleField: r.titleField,
          fields: r.fields,
          canWrite: r.writeRoles.includes(role),
        })),
    })).filter((m) => m.resources.length > 0);
    res.json({
      user: req.user,
      modules,
      tools: { media: ['superadmin', 'admin', 'editor'].includes(role), chat: CHAT_ROLES.includes(role), users: role === 'superadmin', audit: ['superadmin', 'admin'].includes(role), storage: storage.name },
    });
  });

  router.get('/dashboard', async (req, res) => {
    const role = req.user!.role as Role;
    const visible = RESOURCES.filter((r) => readRolesOf(r).includes(role));
    const content = await Promise.all(
      visible
        .filter((r) => r.publishable)
        .map(async (r) => {
          const Model = modelOf(r.key);
          const [published, draft, archived] = await Promise.all(['published', 'draft', 'archived'].map((status) => Model.countDocuments({ status })));
          return { key: r.key, path: r.path, label: r.label, module: r.module, published, draft, archived };
        }),
    );
    const inbox = await Promise.all(
      visible
        .filter((r) => INBOX_NEW[r.key])
        .map(async (r) => {
          const [field, value] = INBOX_NEW[r.key]!;
          return { key: r.key, path: r.path, label: r.label, waiting: await modelOf(r.key).countDocuments({ [field]: value }) };
        }),
    );
    const next = await modelOf('tourDate').findOne({ status: 'published', phase: 'upcoming', date: { $gte: new Date() } }).sort({ date: 1 }).lean();
    const recent = ['superadmin', 'admin'].includes(role) ? await AuditLog.find().sort({ at: -1 }).limit(10).lean() : [];
    res.json({
      content,
      inbox,
      nextTourDate: next ? { city: (next as Record<string, any>).city, date: (next as Record<string, any>).date } : null,
      recent: recent.map((a: Record<string, any>) => ({ id: String(a._id), at: a.at, actor: a.actorEmail, summary: a.summary })),
      storage: storage.name,
    });
  });

  router.get('/audit', requireRole('superadmin', 'admin'), async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const filter = typeof req.query.entity === 'string' && req.query.entity ? { entity: req.query.entity } : {};
    const [items, total] = await Promise.all([AuditLog.find(filter).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).lean(), AuditLog.countDocuments(filter)]);
    res.json({
      items: items.map((a: Record<string, any>) => ({ id: String(a._id), at: a.at, actor: a.actorEmail, action: a.action, entity: a.entity, entityId: a.entityId, summary: a.summary, changes: a.changes })),
      total,
      page,
      limit,
    });
  });

  router.use('/chat', adminChatRouter(env));
  router.use('/media', mediaRouter(storage));
  router.use('/users', usersRouter());
  for (const spec of RESOURCES) router.use(`/${spec.path}`, adminResourceRouter(spec));

  return router;
}
