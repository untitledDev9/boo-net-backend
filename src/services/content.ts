import type { Request } from 'express';
import type { Model } from 'mongoose';
import { AuditLog } from '../db/models.js';
import type { FieldSpec, ResourceSpec } from '../resources/types.js';

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'item';

/** Generate a slug that is unique within the collection. */
export async function uniqueSlug(model: Model<any>, base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  for (let n = 2; n < 500; n++) {
    const clash = await model.findOne({ slug: candidate, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) }, '_id').lean();
    if (!clash) return candidate;
    candidate = `${root}-${n}`;
  }
  return `${root}-${Date.now()}`;
}

/** Query filter that only returns records visible on the public site. */
export function publishedFilter(spec: ResourceSpec): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(spec.publicFilter ?? {}) };
  if (!spec.publishable) return base;
  const now = new Date();
  return {
    ...base,
    status: 'published',
    $or: [{ publishAt: null }, { publishAt: { $lte: now } }],
  };
}

const coerceFilter = (f: FieldSpec, raw: string): unknown => {
  if (f.type === 'boolean') return raw === 'true';
  if (f.type === 'number' || f.type === 'money') return Number(raw);
  return raw;
};

/** Build a filter from ?field=value query params, restricted to fields marked filter:true. */
export function queryFilters(spec: ResourceSpec, query: Request['query']): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of spec.fields) {
    if (!f.filter) continue;
    const raw = query[f.name];
    if (typeof raw !== 'string' || raw === '') continue;
    if (f.type === 'ref' && !/^[a-f0-9]{24}$/i.test(raw)) continue; // ignore malformed ids rather than 500
    out[f.name] = coerceFilter(f, raw);
  }
  return out;
}

/** Parse "-field"/"field" into a Mongo sort object, tie-breaking on creation time. */
export function sortFor(spec: ResourceSpec, requested?: string): Record<string, 1 | -1> {
  const allowed = new Set([...spec.fields.map((f) => f.name), 'createdAt', 'updatedAt', ...(spec.publishable ? ['sortOrder', 'status', 'publishAt'] : [])]);
  const pick = (s: string): Record<string, 1 | -1> | null => {
    const desc = s.startsWith('-');
    const name = desc ? s.slice(1) : s;
    return allowed.has(name) ? { [name]: desc ? -1 : 1 } : null;
  };
  const chosen = (requested && pick(requested)) || (spec.defaultSort && pick(spec.defaultSort)) || (spec.publishable ? { sortOrder: 1 as const } : { createdAt: -1 as const });
  return { ...chosen, createdAt: -1 };
}

export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function searchFilter(spec: ResourceSpec, q: unknown): Record<string, unknown> {
  if (typeof q !== 'string' || !q.trim()) return {};
  const rx = new RegExp(escapeRegex(q.trim().slice(0, 80)), 'i');
  return { $or: spec.searchFields.map((f) => ({ [f]: rx })) };
}

const SHORT = 200;
const short = (v: unknown): unknown => (typeof v === 'string' && v.length > SHORT ? `${v.slice(0, SHORT)}…` : v);

/** Compact, readable diff for the audit log. */
export function diffOf(before: Record<string, any> | null, after: Record<string, any>, keys: string[]): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of keys) {
    const a = before?.[k];
    const b = after[k];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    const plain = (v: unknown) => (typeof v === 'object' && v !== null ? '[changed]' : short(v));
    out[k] = { from: before ? plain(a) : undefined, to: plain(b) };
  }
  return out;
}

export async function audit(req: Request, action: string, entity: string, entityId: string | undefined, summary: string, changes?: unknown): Promise<void> {
  try {
    await AuditLog.create({
      actor: req.user?.id,
      actorEmail: req.user?.email,
      action,
      entity,
      entityId,
      summary,
      changes,
      ip: req.ip,
    });
  } catch {
    // Auditing must never block the action it records.
  }
}
