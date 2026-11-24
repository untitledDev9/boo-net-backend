import webpush from 'web-push';
import type { Server } from 'socket.io';
import type { Env } from '../config/env.js';
import { Notification, PushKeys, PushSubscription, User } from '../db/models.js';
import { readRolesOf } from '../resources/registry.js';
import type { ResourceSpec, Role } from '../resources/types.js';

/** What can raise a notification. The key is stored; the label is what staff see in their settings. */
export const NOTIF_KINDS = {
  chat: 'Live chat messages',
  booking: 'Shoutout bookings',
  order: 'Store orders',
  request: 'Contact messages & submissions',
  signup: 'New subscribers',
  comment: 'New comments',
  account: 'Staff accounts',
  activity: 'Team activity (edits, publishes, sign-ins)',
} as const;
export type NotifKind = keyof typeof NOTIF_KINDS;
export const isKind = (k: string): k is NotifKind => k in NOTIF_KINDS;

/** Silenced until someone turns them on: busy feeds that would otherwise ring phones all day. */
export const DEFAULT_MUTED: string[] = ['activity'];

const ALL_STAFF: Role[] = ['superadmin', 'admin', 'editor', 'support'];
const ADMINS: Role[] = ['superadmin', 'admin'];

let io: Server | null = null;
export const setNotifyIo = (server: Server): void => {
  io = server;
};

// ───────── Web push keys ─────────
interface Vapid {
  publicKey: string;
  privateKey: string;
}
let vapid: Vapid | null = null;
export const pushPublicKey = (): string | null => vapid?.publicKey ?? null;

/**
 * Prepare phone/desktop push. Keys come from VAPID_* environment variables if set; otherwise they are generated once
 * and kept in the database, so alerts work without any setup and survive restarts and redeploys.
 */
export async function initPush(env: Env): Promise<void> {
  try {
    let keys: Vapid | null = env.vapid ? { publicKey: env.vapid.publicKey, privateKey: env.vapid.privateKey } : null;
    if (!keys) {
      const generated = webpush.generateVAPIDKeys();
      // $setOnInsert + upsert: if several servers start at once they all end up using the same pair.
      await PushKeys.updateOne({ key: 'vapid' }, { $setOnInsert: { publicKey: generated.publicKey, privateKey: generated.privateKey } }, { upsert: true });
      const row = await PushKeys.findOne({ key: 'vapid' }).select('+privateKey').lean();
      if (row?.publicKey && row.privateKey) keys = { publicKey: row.publicKey, privateKey: row.privateKey };
    }
    if (!keys) return;
    const subject = env.vapid?.subject ?? env.clientOrigins.find((o) => o.startsWith('https://')) ?? 'mailto:admin@example.com';
    webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
    vapid = keys;
  } catch (err) {
    vapid = null;
    console.error('Push notifications are disabled:', err instanceof Error ? err.message : err);
  }
}

// ───────── Who sees what ─────────
const mutedOf = (user: { notifMuted?: string[] | null }): string[] => user.notifMuted ?? DEFAULT_MUTED;
const sinceOf = (user: { notifReadAllAt?: Date | null; createdAt?: Date }): Date => user.notifReadAllAt ?? user.createdAt ?? new Date(0);

type UserLike = { _id: unknown; role: string; notifMuted?: string[] | null; notifReadAllAt?: Date | null; createdAt?: Date };

/** Everything this person is allowed to see in their feed. */
export const feedFilter = (user: UserLike): Record<string, any> => ({ roles: user.role, actor: { $ne: user._id } });

/** What still needs this person's attention (and may ring their phone). */
export const unreadFilter = (user: UserLike): Record<string, any> => ({
  ...feedFilter(user),
  touchedAt: { $gt: sinceOf(user) },
  resolved: { $ne: true },
  readBy: { $ne: user._id },
  kind: { $nin: mutedOf(user) },
});

export const unreadCountFor = (user: UserLike): Promise<number> => Notification.countDocuments(unreadFilter(user));

export function serializeNotification(n: Record<string, any>, user: UserLike) {
  const read = n.resolved || n.touchedAt <= sinceOf(user) || (n.readBy ?? []).some((id: unknown) => String(id) === String(user._id));
  return {
    id: String(n._id),
    kind: n.kind as string,
    title: n.title as string,
    body: n.body as string,
    url: n.url as string,
    count: n.count as number,
    at: n.touchedAt as Date,
    unread: !read && !mutedOf(user).includes(n.kind),
  };
}

// ───────── Raising a notification ─────────
export interface NotifyInput {
  kind: NotifKind;
  title: string;
  body?: string;
  url: string;
  roles: Role[];
  entity?: string;
  entityId?: string;
  /** Who caused it (so they are not told about their own action). */
  actorId?: string;
  /** Repeat events with the same group fold into one entry. */
  group?: string;
  /** Title to use once a grouped entry has more than one event. */
  countTitle?: (n: number) => string;
}

const clip = (s: string | undefined, n: number): string => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

async function store(input: NotifyInput) {
  const now = new Date();
  const base = { title: clip(input.title, 120), body: clip(input.body, 200), url: input.url, touchedAt: now };
  if (input.group) {
    const bumped = await Notification.findOneAndUpdate(
      { group: input.group, resolved: { $ne: true }, touchedAt: { $gt: new Date(now.getTime() - 30 * 60_000) } },
      { $set: { ...base, readBy: [] }, $inc: { count: 1 } },
      { new: true },
    );
    if (bumped) {
      if (input.countTitle && bumped.count > 1) {
        bumped.title = clip(input.countTitle(bumped.count), 120);
        await bumped.save();
      }
      return bumped;
    }
  }
  return Notification.create({ ...base, kind: input.kind, roles: input.roles, group: input.group, actor: input.actorId, entity: input.entity, entityId: input.entityId });
}

/**
 * Record something that happened, show it live to staff who have the admin open, and send it to their phones.
 * Never throws and never blocks the action that caused it.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const doc = await store(input);
    io?.to(input.roles.map((r) => `role:${r}`)).emit('notify:new', {
      id: String(doc._id),
      kind: doc.kind,
      title: doc.title,
      body: doc.body,
      url: doc.url,
      count: doc.count,
      at: doc.touchedAt,
      actor: doc.actor ? String(doc.actor) : null,
      entityId: doc.entityId ?? null,
    });
    await pushToStaff(doc.kind, input.roles, input.actorId, { id: String(doc._id), title: doc.title, body: doc.body, url: doc.url, tag: input.group ?? String(doc._id) });
  } catch (err) {
    console.error('notify failed:', err instanceof Error ? err.message : err);
  }
}

/** Tell the live admin screens a feed entry changed without raising a new alert (e.g. a chat was answered). */
export const emitNotifyRefresh = (): void => {
  io?.to(ALL_STAFF.map((r) => `role:${r}`)).emit('notify:refresh');
};

/** Mark everything in one group as dealt with for everyone (the chat was read or answered). */
export async function resolveGroup(group: string): Promise<void> {
  await Notification.updateMany({ group, resolved: { $ne: true } }, { $set: { resolved: true } });
  emitNotifyRefresh();
}

// ───────── Phone / desktop push ─────────
interface PushPayload {
  id: string;
  title: string;
  body: string;
  url: string;
  tag: string;
}

async function sendToUser(user: UserLike & { _id: any }, payload: PushPayload): Promise<number> {
  if (!vapid) return 0;
  const subs = await PushSubscription.find({ user: user._id }).lean();
  if (!subs.length) return 0;
  const unread = await unreadCountFor(user);
  const message = JSON.stringify({ ...payload, unread, at: Date.now() });
  let delivered = 0;
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, { TTL: 60 * 60 * 24, urgency: 'high' });
        delivered += 1;
        await PushSubscription.updateOne({ _id: s._id }, { $set: { lastSentAt: new Date() } });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await PushSubscription.deleteOne({ _id: s._id }); // the device unsubscribed or was reset
      }
    }),
  );
  return delivered;
}

async function pushToStaff(kind: string, roles: Role[], actorId: string | undefined, payload: PushPayload): Promise<void> {
  if (!vapid) return;
  const users = await User.find({ role: { $in: roles }, isActive: true, ...(actorId ? { _id: { $ne: actorId } } : {}) }).lean();
  await Promise.allSettled(users.filter((u) => !mutedOf(u).includes(kind)).map((u) => sendToUser(u, payload)));
}

/** A test alert to just this person's devices. Returns how many devices accepted it. */
export async function sendTestPush(userId: string): Promise<number> {
  const user = await User.findById(userId).lean();
  if (!user) return 0;
  return sendToUser(user, { id: 'test', title: 'Alerts are working', body: 'You will get new chats, bookings, orders and requests like this.', url: '/sharp/notifications', tag: 'boosie-test' });
}

// ───────── Events ─────────
const inboxUrl = (spec: ResourceSpec, id: unknown): string => `/sharp/c/${spec.path}/${String(id)}`;

/** A visitor submitted a form on the public site (contact, booking, comment, sign-up…). */
export function notifySubmission(spec: ResourceSpec, doc: Record<string, any>): void {
  const roles = readRolesOf(spec);
  const url = inboxUrl(spec, doc._id);
  const entity = spec.key;
  const entityId = String(doc._id);
  const base = { roles, url, entity, entityId };
  switch (spec.key) {
    case 'contactMessage':
      return void notify({ ...base, kind: 'request', title: `New message from ${doc.name}`, body: doc.message });
    case 'opportunity':
      return void notify({ ...base, kind: 'request', title: `New ${doc.doorTitle} submission`, body: `${doc.name}: ${doc.message}` });
    case 'radioSubmission':
      return void notify({ ...base, kind: 'request', title: 'New radio submission', body: `${doc.artistName} — ${doc.trackTitle}` });
    case 'liveSubscriber':
      return void notify({ ...base, kind: 'signup', title: 'New live subscriber', body: doc.email });
    case 'shoutoutOrder':
      return void notify({ ...base, kind: 'booking', title: 'New shoutout booking', body: [`For ${doc.recipient}`, doc.occasion, doc.price ? `$${doc.price}` : ''].filter(Boolean).join(' · ') });
    case 'comment':
      return void notify({ ...base, kind: 'comment', title: `New comment from ${doc.author}`, body: doc.text });
    default:
      return void notify({ ...base, kind: 'request', title: `New ${spec.singular.toLowerCase()}`, body: String(doc[spec.titleField] ?? '') });
  }
}

export function notifyOrder(spec: ResourceSpec, order: { id: string; number: string; total: number; buyerName?: string; buyerEmail?: string; items: number }): void {
  void notify({
    kind: 'order',
    roles: readRolesOf(spec),
    url: inboxUrl(spec, order.id),
    entity: 'order',
    entityId: order.id,
    title: `New order ${order.number}`,
    body: `${order.buyerName || order.buyerEmail || 'A guest'} · ${order.items} item${order.items === 1 ? '' : 's'} · $${order.total.toFixed(2)}`,
  });
}

/** A new live-chat conversation or another message in one; the unread messages from one visitor fold into a single entry. */
export function notifyChat(thread: { id: string; name: string }, text: string, roles: Role[], first: boolean): void {
  void notify({
    kind: 'chat',
    roles,
    url: `/sharp/chat/${thread.id}`,
    entity: 'chatThread',
    entityId: thread.id,
    group: `chat:${thread.id}`,
    title: first ? `New chat from ${thread.name}` : `${thread.name} sent a message`,
    countTitle: (n) => `${thread.name} · ${n} new messages`,
    body: text,
  });
}

/** Staff-account changes, for superadmins. */
export function notifyAccount(title: string, body: string, actorId?: string, entityId?: string): void {
  void notify({ kind: 'account', roles: ['superadmin'], url: '/sharp/users', entity: 'user', entityId, actorId, title, body });
}

/** Something a teammate did in the admin, for admins. Quiet by default (muted until someone opts in). */
export function notifyActivity(summary: string, actor: string | undefined, actorId: string | undefined, entity: string, entityId?: string): void {
  void notify({ kind: 'activity', roles: ADMINS, url: '/sharp/audit', entity, entityId, actorId, title: summary, body: actor ? `By ${actor}` : '' });
}
