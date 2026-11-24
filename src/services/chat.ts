import crypto from 'node:crypto';
import type { Server } from 'socket.io';
import { ChatMessage, ChatThread } from '../db/models.js';
import { HttpError } from '../middleware/errors.js';
import type { Role } from '../resources/types.js';
import { notifyChat, resolveGroup } from './notify.js';

/** Staff roles that can read and answer chats (same people who see the other inboxes). */
export const CHAT_ROLES: Role[] = ['superadmin', 'admin', 'support'];

let io: Server | null = null;
export const setIo = (server: Server): void => {
  io = server;
};

/** True while at least one signed-in staff member has the admin open (and so can answer right now). */
export const isStaffOnline = (): boolean => (io?.sockets.adapter.rooms.get('staff')?.size ?? 0) > 0;

// ───────── Visitor secret ─────────
export const newToken = (): string => crypto.randomBytes(32).toString('hex');
export const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');
export function tokenMatches(hash: string | undefined, token: string): boolean {
  if (!hash || !token) return false;
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(hashToken(token), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ───────── Shapes sent to clients ─────────
export const serializeThread = (t: any) => ({
  id: String(t._id),
  name: t.name,
  email: t.email,
  status: t.status,
  lastMessageAt: t.lastMessageAt,
  lastMessageText: t.lastMessageText,
  unreadStaff: t.unreadStaff,
  unreadVisitor: t.unreadVisitor,
  createdAt: t.createdAt,
});

export const serializeMessage = (m: any) => ({
  id: String(m._id),
  threadId: String(m.thread),
  from: m.from as 'visitor' | 'staff',
  staffName: m.staffName,
  text: m.text,
  at: m.at,
});

const preview = (text: string): string => text.replace(/\s+/g, ' ').slice(0, 140);

/** Push a new message to every staff socket and to the visitor in that conversation. */
function emitMessage(thread: any, message: any): void {
  io?.to('staff').to(`thread:${String(thread._id)}`).emit('chat:message', { thread: serializeThread(thread), message: serializeMessage(message) });
}

/** Tell staff sockets a thread changed without a new message (read, closed, reopened). */
function emitThread(thread: any): void {
  io?.to('staff').emit('chat:thread', { thread: serializeThread(thread) });
}

// ───────── Operations ─────────
export async function createThread(input: { name: string; email: string; text: string }) {
  const token = newToken();
  const thread = await ChatThread.create({
    name: input.name,
    email: input.email,
    tokenHash: hashToken(token),
    lastMessageAt: new Date(),
    lastMessageText: preview(input.text),
    unreadStaff: 1,
  });
  const message = await ChatMessage.create({ thread: thread._id, from: 'visitor', text: input.text });
  emitMessage(thread, message);
  notifyChat({ id: String(thread._id), name: thread.name }, input.text, CHAT_ROLES, true);
  return { thread, message, token };
}

export async function visitorSend(threadId: string, text: string) {
  const message = await ChatMessage.create({ thread: threadId, from: 'visitor', text });
  const thread = await ChatThread.findByIdAndUpdate(
    threadId,
    { $inc: { unreadStaff: 1 }, $set: { lastMessageAt: new Date(), lastMessageText: preview(text), status: 'open' } },
    { new: true },
  );
  if (!thread) throw new HttpError(404, 'Chat not found');
  emitMessage(thread, message);
  notifyChat({ id: String(thread._id), name: thread.name }, text, CHAT_ROLES, false);
  return { thread, message };
}

export async function staffSend(threadId: string, staffName: string, text: string) {
  const exists = await ChatThread.exists({ _id: threadId });
  if (!exists) throw new HttpError(404, 'Chat not found');
  const message = await ChatMessage.create({ thread: threadId, from: 'staff', staffName, text });
  // Answering counts as having read it; reopen if it had been closed.
  const thread = await ChatThread.findByIdAndUpdate(
    threadId,
    { $inc: { unreadVisitor: 1 }, $set: { lastMessageAt: new Date(), lastMessageText: preview(text), unreadStaff: 0, status: 'open' } },
    { new: true },
  );
  emitMessage(thread, message);
  void resolveGroup(`chat:${threadId}`); // someone answered, so the "new message" alert is done for everyone
  return { thread: thread!, message };
}

export async function markReadByStaff(threadId: string) {
  const thread = await ChatThread.findByIdAndUpdate(threadId, { $set: { unreadStaff: 0 } }, { new: true });
  if (!thread) throw new HttpError(404, 'Chat not found');
  emitThread(thread);
  void resolveGroup(`chat:${threadId}`);
  return thread;
}

export async function markReadByVisitor(threadId: string): Promise<void> {
  await ChatThread.updateOne({ _id: threadId }, { $set: { unreadVisitor: 0 } });
}

export async function setThreadStatus(threadId: string, status: 'open' | 'closed') {
  const thread = await ChatThread.findByIdAndUpdate(threadId, { $set: { status } }, { new: true });
  if (!thread) throw new HttpError(404, 'Chat not found');
  emitThread(thread);
  return thread;
}

export async function totalUnreadForStaff(): Promise<number> {
  const [row] = await ChatThread.aggregate([{ $group: { _id: null, n: { $sum: '$unreadStaff' } } }]);
  return row?.n ?? 0;
}

export async function messagesOf(threadId: string, limit = 300) {
  const rows = await ChatMessage.find({ thread: threadId }).sort({ at: -1 }).limit(limit).lean();
  return rows.reverse().map(serializeMessage);
}
