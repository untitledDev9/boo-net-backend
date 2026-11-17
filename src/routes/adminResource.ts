import { Router, type Request } from 'express';
import { z } from 'zod';
import { modelOf } from '../db/models.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { RESOURCES, readRolesOf } from '../resources/registry.js';
import type { ResourceSpec } from '../resources/types.js';
import { validatorsFor } from '../resources/validators.js';
import { audit, diffOf, queryFilters, searchFilter, sortFor, uniqueSlug } from '../services/content.js';
import { populateFor, serialize } from '../services/serialize.js';

const idParam = z.string().regex(/^[a-f0-9]{24}$/i);
const objectIdOf = (req: Request): string => {
  const parsed = idParam.safeParse(req.params.id);
  if (!parsed.success) throw new HttpError(400, 'Invalid id');
  return parsed.data;
};

/** Defaults (from the spec) used to create a singleton the first time it is read. */
export function singletonDefaults(spec: ResourceSpec): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of spec.fields) if (f.default !== undefined) out[f.name] = f.default;
  return out;
}

export async function ensureSingleton(spec: ResourceSpec) {
  const Model = modelOf(spec.key);
  let doc = await Model.findOne();
  if (!doc) doc = await Model.create(singletonDefaults(spec));
  return doc;
}

/** Fields that reference this resource (used to block deleting something still in use). */
function referencesTo(key: string): { resource: ResourceSpec; field: string }[] {
  const out: { resource: ResourceSpec; field: string }[] = [];
  for (const r of RESOURCES) for (const f of r.fields) if (f.type === 'ref' && f.ref === key) out.push({ resource: r, field: f.name });
  return out;
}

const csvCell = (v: unknown): string => {
  let s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export function adminResourceRouter(spec: ResourceSpec): Router {
  const router = Router();
  const Model = modelOf(spec.key);
  const { create, update } = validatorsFor(spec);
  const canRead = requireRole(...readRolesOf(spec));
  const canWrite = requireRole(...spec.writeRoles);
  const populate = populateFor(spec);
  const fieldNames = spec.fields.filter((f) => !f.readOnly).map((f) => f.name);
  const trackedKeys = [...fieldNames, ...(spec.publishable ? ['status', 'publishAt', 'sortOrder'] : [])];

  const find = async (id: string) => Model.findById(id).populate(populate).lean();

  // ───────── Singletons ─────────
  if (spec.singleton) {
    router.get('/', canRead, async (_req, res) => {
      const doc = await ensureSingleton(spec);
      res.json(serialize(spec, (await find(String(doc._id)))!));
    });
    router.put('/', canWrite, async (req, res) => {
      const body = update.parse(req.body);
      const doc = await ensureSingleton(spec);
      const before = doc.toObject();
      Object.assign(doc, body, { updatedBy: req.user!.id });
      await doc.save();
      await audit(req, 'update', spec.key, String(doc._id), `Updated ${spec.label}`, diffOf(before, doc.toObject(), trackedKeys));
      res.json(serialize(spec, (await find(String(doc._id)))!));
    });
    return router;
  }

  // ───────── List ─────────
  router.get('/', canRead, async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const filter: Record<string, unknown> = { ...queryFilters(spec, req.query), ...searchFilter(spec, req.query.q) };
    if (spec.publishable && typeof req.query.status === 'string' && ['draft', 'published', 'archived'].includes(req.query.status)) filter.status = req.query.status;
    const sort = sortFor(spec, typeof req.query.sort === 'string' ? req.query.sort : undefined);
    const [items, total] = await Promise.all([
      Model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).populate(populate).lean(),
      Model.countDocuments(filter),
    ]);
    res.json({ items: items.map((d) => serialize(spec, d)), total, page, limit });
  });

  // CSV export for inbox-style resources
  if (spec.publicSubmit) {
    router.get('/export.csv', canRead, async (_req, res) => {
      const rows = await Model.find().sort({ createdAt: -1 }).limit(10000).populate(populate).lean();
      const cols = ['id', ...spec.fields.map((f) => f.name), 'createdAt'];
      const lines = [cols.map(csvCell).join(',')];
      for (const r of rows) {
        const s = serialize(spec, r);
        lines.push(cols.map((c) => csvCell(typeof s[c] === 'object' && s[c] && 'title' in s[c] ? s[c].title : s[c])).join(','));
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${spec.path}.csv"`);
      res.send(lines.join('\r\n'));
    });
  }

  router.get('/:id', canRead, async (req, res) => {
    const doc = await find(objectIdOf(req));
    if (!doc) throw new HttpError(404, `${spec.singular} not found`);
    res.json(serialize(spec, doc));
  });

  // ───────── Create ─────────
  router.post('/', canWrite, async (req, res) => {
    const body = create.parse(req.body) as Record<string, any>;
    const data: Record<string, any> = { ...body, createdBy: req.user!.id, updatedBy: req.user!.id };
    if (spec.slugFrom) data.slug = await uniqueSlug(Model, body.slug || String(body[spec.slugFrom] ?? ''));
    const doc = await Model.create(data);
    await audit(req, 'create', spec.key, String(doc._id), `Created ${spec.singular}: ${String(doc[spec.titleField] ?? doc._id)}`);
    res.status(201).json(serialize(spec, (await find(String(doc._id)))!));
  });

  // ───────── Update ─────────
  router.patch('/:id', canWrite, async (req, res) => {
    const id = objectIdOf(req);
    const body = update.parse(req.body) as Record<string, any>;
    const doc = await Model.findById(id);
    if (!doc) throw new HttpError(404, `${spec.singular} not found`);
    const before = doc.toObject();
    if (spec.slugFrom && body.slug && body.slug !== doc.slug) body.slug = await uniqueSlug(Model, body.slug, id);
    Object.assign(doc, body, { updatedBy: req.user!.id });
    await doc.save();
    await audit(req, 'update', spec.key, id, `Updated ${spec.singular}: ${String(doc[spec.titleField] ?? id)}`, diffOf(before, doc.toObject(), trackedKeys));
    res.json(serialize(spec, (await find(id))!));
  });

  // ───────── Publish / unpublish ─────────
  if (spec.publishable) {
    for (const [name, status] of [['publish', 'published'], ['unpublish', 'draft']] as const) {
      router.post(`/:id/${name}`, canWrite, async (req, res) => {
        const id = objectIdOf(req);
        const doc = await Model.findByIdAndUpdate(id, { status, updatedBy: req.user!.id }, { new: true });
        if (!doc) throw new HttpError(404, `${spec.singular} not found`);
        await audit(req, name, spec.key, id, `${name === 'publish' ? 'Published' : 'Unpublished'} ${spec.singular}: ${String(doc[spec.titleField] ?? id)}`);
        res.json(serialize(spec, (await find(id))!));
      });
    }

    router.post('/reorder', canWrite, async (req, res) => {
      const { ids } = z.object({ ids: z.array(idParam).min(1).max(500) }).parse(req.body);
      await Model.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { sortOrder: i * 10 } } } })));
      await audit(req, 'reorder', spec.key, undefined, `Reordered ${ids.length} ${spec.label.toLowerCase()}`);
      res.json({ ok: true });
    });
  }

  // ───────── Delete / archive ─────────
  router.delete('/:id', canWrite, async (req, res) => {
    const id = objectIdOf(req);
    const doc = await Model.findById(id);
    if (!doc) throw new HttpError(404, `${spec.singular} not found`);
    const hard = !spec.publishable || req.query.hard === 'true';
    if (hard && spec.publishable && !['superadmin', 'admin'].includes(req.user!.role)) {
      throw new HttpError(403, 'Only admins can permanently delete content. Archive it instead.');
    }
    if (!hard) {
      doc.status = 'archived';
      await doc.save();
      await audit(req, 'archive', spec.key, id, `Archived ${spec.singular}: ${String(doc[spec.titleField] ?? id)}`);
      res.json({ ok: true, archived: true });
      return;
    }
    for (const { resource, field } of referencesTo(spec.key)) {
      const used = await modelOf(resource.key).countDocuments({ [field]: id });
      if (used > 0) throw new HttpError(409, `Cannot delete: used by ${used} ${resource.label.toLowerCase()}. Remove or archive those first.`);
    }
    await doc.deleteOne();
    await audit(req, 'delete', spec.key, id, `Deleted ${spec.singular}: ${String(doc[spec.titleField] ?? id)}`);
    res.json({ ok: true, deleted: true });
  });

  return router;
}
