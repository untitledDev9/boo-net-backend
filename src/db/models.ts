import mongoose, { Schema, type Model, type SchemaDefinition, type SchemaDefinitionProperty } from 'mongoose';
import { RESOURCES } from '../resources/registry.js';
import type { FieldSpec, ResourceSpec } from '../resources/types.js';

const ObjectId = Schema.Types.ObjectId;

function pathFor(f: FieldSpec): SchemaDefinitionProperty {
  switch (f.type) {
    case 'string':
      return { type: String, trim: true, default: f.default as string | undefined };
    case 'text':
    case 'markdown':
      return { type: String, default: f.default as string | undefined };
    case 'number':
    case 'money':
      return { type: Number, default: f.default as number | undefined };
    case 'boolean':
      return { type: Boolean, default: (f.default as boolean | undefined) ?? false };
    case 'date':
      return { type: Date };
    case 'select':
      return { type: String, enum: [...(f.options ?? [])], default: f.default as string | undefined };
    case 'media':
      return { type: ObjectId, ref: 'mediaAsset' };
    case 'mediaList':
      return [{ type: ObjectId, ref: 'mediaAsset' }];
    case 'stringList':
      return [String];
    case 'ref':
      return { type: ObjectId, ref: f.ref };
    case 'objectList':
      return [new Schema(definition(f.fields ?? []), { _id: false })];
    case 'json':
      return { type: Schema.Types.Mixed };
  }
}

function definition(fields: FieldSpec[]): SchemaDefinition {
  const def: SchemaDefinition = {};
  for (const f of fields) def[f.name] = pathFor(f);
  return def;
}

function buildSchema(spec: ResourceSpec): Schema {
  const def = definition(spec.fields);
  if (spec.slugFrom) def.slug = { type: String, trim: true, lowercase: true };
  if (spec.publishable) {
    def.status = { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true };
    def.publishAt = { type: Date };
    def.sortOrder = { type: Number, default: 0, index: true };
  }
  def.createdBy = { type: ObjectId, ref: 'user' };
  def.updatedBy = { type: ObjectId, ref: 'user' };
  const schema = new Schema(def, { timestamps: true });
  if (spec.slugFrom) schema.index({ slug: 1 }, { unique: true, sparse: true });
  if (spec.key === 'siteText') schema.index({ key: 1 }, { unique: true });
  if (spec.key === 'contentBlock') schema.index({ key: 1 }, { unique: true });
  return schema;
}

function model<T>(name: string, schema: Schema): Model<T> {
  return (mongoose.models[name] as Model<T>) ?? mongoose.model<T>(name, schema);
}

// ───────── System models ─────────
export interface UserDoc {
  email: string;
  name: string;
  passwordHash: string;
  role: 'superadmin' | 'admin' | 'editor' | 'support';
  isActive: boolean;
  tokenVersion: number;
  lastLoginAt?: Date;
  /** Everything in the notification feed older than this counts as read for this person. */
  notifReadAllAt?: Date;
  /** Notification kinds this person silenced (no phone alert, banner or sound). Unset = the defaults. */
  notifMuted?: string[];
}
export const User = model<UserDoc>(
  'user',
  new Schema(
    {
      email: { type: String, required: true, unique: true, lowercase: true, trim: true },
      name: { type: String, required: true, trim: true },
      passwordHash: { type: String, required: true, select: false },
      role: { type: String, enum: ['superadmin', 'admin', 'editor', 'support'], required: true },
      isActive: { type: Boolean, default: true },
      tokenVersion: { type: Number, default: 0 },
      lastLoginAt: Date,
      notifReadAllAt: Date,
      notifMuted: { type: [String], default: undefined },
    },
    { timestamps: true },
  ),
);

export interface MediaDoc {
  provider: 'cloudinary' | 'local' | 'stub';
  publicId: string;
  url: string;
  secureUrl?: string;
  type: 'image' | 'video' | 'file';
  folder: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
  alt?: string;
  tags: string[];
  uploadedBy?: mongoose.Types.ObjectId;
}
export const MediaAsset = model<MediaDoc>(
  'mediaAsset',
  new Schema(
    {
      provider: { type: String, enum: ['cloudinary', 'local', 'stub'], required: true },
      publicId: { type: String, required: true, index: true },
      url: { type: String, required: true },
      secureUrl: String,
      type: { type: String, enum: ['image', 'video', 'file'], default: 'image' },
      folder: { type: String, default: 'general' },
      width: Number,
      height: Number,
      bytes: Number,
      format: String,
      alt: { type: String, default: '' },
      tags: [String],
      uploadedBy: { type: ObjectId, ref: 'user' },
    },
    { timestamps: true },
  ),
);

export const AuditLog = model(
  'auditLog',
  new Schema(
    {
      actor: { type: ObjectId, ref: 'user' },
      actorEmail: String,
      action: { type: String, required: true },
      entity: { type: String, required: true, index: true },
      entityId: String,
      summary: String,
      changes: Schema.Types.Mixed,
      ip: String,
    },
    { timestamps: { createdAt: 'at', updatedAt: false } },
  ),
);

// ───────── Live chat ─────────
export interface ChatThreadDoc {
  name: string;
  email: string;
  status: 'open' | 'closed';
  /** SHA-256 of the secret the visitor's browser holds; never returned by the API. */
  tokenHash: string;
  lastMessageAt: Date;
  lastMessageText: string;
  /** Visitor messages staff have not read yet. */
  unreadStaff: number;
  /** Staff replies the visitor has not read yet. */
  unreadVisitor: number;
}
export const ChatThread = model<ChatThreadDoc>(
  'chatThread',
  new Schema(
    {
      name: { type: String, required: true, trim: true, maxlength: 80 },
      email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
      status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
      tokenHash: { type: String, required: true, select: false },
      lastMessageAt: { type: Date, default: Date.now, index: true },
      lastMessageText: { type: String, default: '' },
      unreadStaff: { type: Number, default: 0 },
      unreadVisitor: { type: Number, default: 0 },
    },
    { timestamps: true },
  ),
);

export interface ChatMessageDoc {
  thread: mongoose.Types.ObjectId;
  from: 'visitor' | 'staff';
  staffName?: string;
  text: string;
}
export const ChatMessage = model<ChatMessageDoc>(
  'chatMessage',
  new Schema(
    {
      thread: { type: ObjectId, ref: 'chatThread', required: true, index: true },
      from: { type: String, enum: ['visitor', 'staff'], required: true },
      staffName: String,
      text: { type: String, required: true, maxlength: 2000 },
    },
    { timestamps: { createdAt: 'at', updatedAt: false } },
  ),
);

// ───────── Notifications ─────────
export interface NotificationDoc {
  kind: string;
  title: string;
  body: string;
  /** In-app path to open, e.g. /sharp/chat/<id>. */
  url: string;
  /** Roles that can see it. */
  roles: string[];
  /** Notifications with the same group collapse into one entry that keeps being updated (a chat's new messages). */
  group?: string;
  count: number;
  actor?: mongoose.Types.ObjectId;
  entity?: string;
  entityId?: string;
  /** Staff who opened or dismissed it. */
  readBy: mongoose.Types.ObjectId[];
  /** Dealt with for everybody (e.g. the chat was answered), regardless of readBy. */
  resolved: boolean;
  /** Creation time, moved forward whenever a grouped notification gets another event. */
  touchedAt: Date;
}
const notificationSchema = new Schema(
  {
    kind: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, default: '', maxlength: 400 },
    url: { type: String, default: '/sharp' },
    roles: { type: [String], index: true },
    group: { type: String, index: true },
    count: { type: Number, default: 1 },
    actor: { type: ObjectId, ref: 'user' },
    entity: String,
    entityId: String,
    readBy: [{ type: ObjectId, ref: 'user' }],
    resolved: { type: Boolean, default: false },
    touchedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);
notificationSchema.index({ touchedAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 }); // keep 60 days
export const Notification = model<NotificationDoc>('notification', notificationSchema);

/** One browser/phone that agreed to receive push alerts (works with the site closed). */
export interface PushSubscriptionDoc {
  user: mongoose.Types.ObjectId;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  lastSentAt?: Date;
}
export const PushSubscription = model<PushSubscriptionDoc>(
  'pushSubscription',
  new Schema(
    {
      user: { type: ObjectId, ref: 'user', required: true, index: true },
      endpoint: { type: String, required: true, unique: true },
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
      userAgent: { type: String, maxlength: 300 },
      lastSentAt: Date,
    },
    { timestamps: true },
  ),
);

/** The server's push (VAPID) signing keys, generated once and kept so subscriptions survive restarts. */
export const PushKeys = model<{ key: string; publicKey?: string; privateKey?: string }>(
  'pushKeys',
  new Schema({ key: { type: String, default: 'vapid', unique: true }, publicKey: String, privateKey: { type: String, select: false } }, { timestamps: true }),
);

/** Content models by resource key, built from the registry. */
export const Models: Record<string, Model<any>> = {};
for (const spec of RESOURCES) Models[spec.key] = model(spec.key, buildSchema(spec));

export const modelOf = (key: string): Model<any> => {
  const m = Models[key];
  if (!m) throw new Error(`Unknown resource ${key}`);
  return m;
};
