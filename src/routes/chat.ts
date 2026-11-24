import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { Env } from '../config/env.js';
import { ChatThread, User } from '../db/models.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { signChatSocketToken } from '../realtime.js';
import {
  CHAT_ROLES,
  isStaffOnline,
  markReadByStaff,
  markReadByVisitor,
  messagesOf,
  serializeMessage,
  serializeThread,
  setThreadStatus,
  staffSend,
  tokenMatches,
  totalUnreadForStaff,
  visitorSend,
  createThread,
} from '../services/chat.js';

const idParam = z.string().regex(/^[a-f0-9]{24}$/i);
const idOf = (req: Request): string => {
  const parsed = idParam.safeParse(req.params.id);
  if (!parsed.success) throw new HttpError(404, 'Chat not found');
  return parsed.data;
};

const text = z.string().trim().min(1, 'Type a message first').max(2000, 'Messages can be up to 2000 characters');
const startBody = z.object({
  name: z.string().trim().min(1, 'Your name is required').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(200),
  message: text,
  website: z.string().max(200).optional(), // honeypot
});

// ───────── Public: visitors ─────────
export function publicChatRouter(): Router {
  const router = Router();

  /** The visitor proves it owns a chat with the secret it was given when the chat started. */
  const visitorThread = async (req: Request) => {
    const thread = await ChatThread.findById(idOf(req)).select('+tokenHash');
    const token = String(req.headers['x-chat-token'] ?? '');
    if (!thread || !tokenMatches(thread.tokenHash, token)) throw new HttpError(404, 'Chat not found');
    return thread;
  };

  router.get('/status', (_req, res) => {
    res.json({ online: isStaffOnline() });
  });

  router.post('/start', rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }), async (req, res) => {
    const body = startBody.parse(req.body);
    if (body.website) {
      res.status(201).json({ ok: true }); // bots get a success response and nothing is stored
      return;
    }
    const { thread, message, token } = await createThread({ name: body.name, email: body.email, text: body.message });
    res.status(201).json({ threadId: String(thread._id), token, message: serializeMessage(message), online: isStaffOnline() });
  });

  router.get('/:id/messages', async (req, res) => {
    const thread = await visitorThread(req);
    res.json({ thread: serializeThread(thread), messages: await messagesOf(String(thread._id)), online: isStaffOnline() });
  });

  router.post('/:id/messages', rateLimit({ windowMs: 10 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }), async (req, res) => {
    const thread = await visitorThread(req);
    const body = z.object({ text }).parse(req.body);
    const sent = await visitorSend(String(thread._id), body.text);
    res.status(201).json({ message: serializeMessage(sent.message), online: isStaffOnline() });
  });

  router.post('/:id/read', async (req, res) => {
    const thread = await visitorThread(req);
    await markReadByVisitor(String(thread._id));
    res.json({ ok: true });
  });

  return router;
}

// ───────── Admin: staff ─────────
export function adminChatRouter(env: Env): Router {
  const router = Router();
  router.use(requireRole(...CHAT_ROLES));

  /** A two-minute token for the live socket (the session cookie is not sent to the socket's host). */
  router.post('/socket-token', async (req, res) => {
    // tokenVersion is read fresh so a password change or deactivation also cuts off sockets.
    const user = await User.findById(req.user!.id);
    if (!user || !user.isActive) throw new HttpError(401, 'Session is no longer valid. Please sign in again.');
    res.json({ token: signChatSocketToken(env, String(user._id), user.tokenVersion), expiresIn: 120 });
  });

  router.get('/unread', async (_req, res) => {
    res.json({ count: await totalUnreadForStaff() });
  });

  router.get('/threads', async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const filter: Record<string, unknown> = {};
    if (status === 'open' || status === 'closed') filter.status = status;
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { lastMessageText: rx }];
    }
    const items = await ChatThread.find(filter).sort({ lastMessageAt: -1 }).limit(100).lean();
    res.json({ items: items.map(serializeThread), online: isStaffOnline() });
  });

  router.get('/threads/:id/messages', async (req, res) => {
    const id = idOf(req);
    const thread = await ChatThread.findById(id).lean();
    if (!thread) throw new HttpError(404, 'Chat not found');
    res.json({ thread: serializeThread(thread), messages: await messagesOf(id) });
  });

  router.post('/threads/:id/messages', async (req, res) => {
    const id = idOf(req);
    const body = z.object({ text }).parse(req.body);
    const sent = await staffSend(id, req.user!.name, body.text);
    res.status(201).json({ thread: serializeThread(sent.thread), message: serializeMessage(sent.message) });
  });

  router.post('/threads/:id/read', async (req, res) => {
    res.json({ thread: serializeThread(await markReadByStaff(idOf(req))) });
  });

  router.patch('/threads/:id', async (req, res) => {
    const body = z.object({ status: z.enum(['open', 'closed']) }).parse(req.body);
    res.json({ thread: serializeThread(await setThreadStatus(idOf(req), body.status)) });
  });

  return router;
}
