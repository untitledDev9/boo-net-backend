import { Router, type Request } from 'express';
import { z } from 'zod';
import { Notification, PushSubscription, User } from '../db/models.js';
import { HttpError } from '../middleware/errors.js';
import { DEFAULT_MUTED, NOTIF_KINDS, feedFilter, isKind, pushPublicKey, sendTestPush, serializeNotification, unreadCountFor } from '../services/notify.js';

const idParam = z.string().regex(/^[a-f0-9]{24}$/i);

/** The signed-in person with the fields the notification feed depends on. */
async function me(req: Request) {
  const user = await User.findById(req.user!.id).lean();
  if (!user || !user.isActive) throw new HttpError(401, 'Session is no longer valid. Please sign in again.');
  return user;
}

/** The signed-in person's notification feed, read state, alert preferences and phone/desktop devices. */
export function notificationsRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const user = await me(req);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30));
    const filter: Record<string, unknown> = { ...feedFilter(user) };
    if (typeof req.query.kind === 'string' && isKind(req.query.kind)) filter.kind = req.query.kind;
    const before = typeof req.query.before === 'string' ? new Date(req.query.before) : null;
    if (before && !Number.isNaN(before.getTime())) filter.touchedAt = { $lt: before };
    const [rows, unread, devices] = await Promise.all([
      Notification.find(filter).sort({ touchedAt: -1 }).limit(limit + 1).lean(),
      unreadCountFor(user),
      PushSubscription.countDocuments({ user: user._id }),
    ]);
    const page = rows.slice(0, limit);
    res.json({
      items: page.map((n) => serializeNotification(n, user)),
      hasMore: rows.length > limit,
      unread,
      muted: user.notifMuted ?? DEFAULT_MUTED,
      kinds: NOTIF_KINDS,
      push: { available: Boolean(pushPublicKey()), devices },
    });
  });

  router.get('/unread', async (req, res) => {
    res.json({ count: await unreadCountFor(await me(req)) });
  });

  router.post('/read-all', async (req, res) => {
    await User.updateOne({ _id: req.user!.id }, { $set: { notifReadAllAt: new Date() } });
    res.json({ ok: true });
  });

  router.put('/prefs', async (req, res) => {
    const { muted } = z.object({ muted: z.array(z.string()).max(20) }).parse(req.body);
    const clean = Array.from(new Set(muted.filter(isKind)));
    await User.updateOne({ _id: req.user!.id }, { $set: { notifMuted: clean } });
    res.json({ muted: clean });
  });

  // ───────── Phone / desktop push ─────────
  router.get('/push/key', (_req, res) => {
    const key = pushPublicKey();
    if (!key) throw new HttpError(503, 'Push alerts are not available on this server right now.');
    res.json({ publicKey: key });
  });

  router.post('/push/subscribe', async (req, res) => {
    const body = z
      .object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }) })
      .parse(req.body);
    // One device belongs to whoever is signed in on it now (upsert on the endpoint, so switching accounts moves it).
    await PushSubscription.updateOne(
      { endpoint: body.endpoint },
      { $set: { user: req.user!.id, p256dh: body.keys.p256dh, auth: body.keys.auth, userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300) } },
      { upsert: true },
    );
    res.status(201).json({ ok: true, devices: await PushSubscription.countDocuments({ user: req.user!.id }) });
  });

  router.post('/push/unsubscribe', async (req, res) => {
    const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(req.body);
    await PushSubscription.deleteOne({ endpoint, user: req.user!.id });
    res.json({ ok: true, devices: await PushSubscription.countDocuments({ user: req.user!.id }) });
  });

  router.post('/push/test', async (req, res) => {
    if (!pushPublicKey()) throw new HttpError(503, 'Push alerts are not available on this server right now.');
    const sent = await sendTestPush(req.user!.id);
    if (!sent) throw new HttpError(409, 'No device is set up to receive alerts yet. Turn on alerts on this device first.');
    res.json({ ok: true, sent });
  });

  // ───────── One entry ─────────
  router.post('/:id/read', async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    if (!id.success) throw new HttpError(404, 'Notification not found');
    await Notification.updateOne({ _id: id.data }, { $addToSet: { readBy: req.user!.id } });
    res.json({ ok: true });
  });

  return router;
}
