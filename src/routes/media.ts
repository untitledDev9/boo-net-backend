import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { MediaAsset, modelOf } from '../db/models.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { RESOURCES } from '../resources/registry.js';
import { audit, escapeRegex } from '../services/content.js';
import type { MediaStorage } from '../services/storage.js';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** Verify the file's real type from its first bytes; the client-supplied MIME type is not trusted. */
export function sniffImage(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.subarray(0, 4).toString('ascii') === 'GIF8') return 'image/gif';
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => (ALLOWED.has(file.mimetype) ? cb(null, true) : cb(new HttpError(415, 'Only JPEG, PNG, WebP and GIF images are allowed'))),
});

/** Every place a media asset is referenced, found from the resource registry. */
export async function usageOf(mediaId: string): Promise<{ resource: string; label: string; id: string; title: string }[]> {
  const found: { resource: string; label: string; id: string; title: string }[] = [];
  for (const spec of RESOURCES) {
    const mediaFields = spec.fields.filter((f) => f.type === 'media' || f.type === 'mediaList');
    if (!mediaFields.length) continue;
    const docs = await modelOf(spec.key)
      .find({ $or: mediaFields.map((f) => ({ [f.name]: mediaId })) }, `${spec.titleField}`)
      .limit(50)
      .lean();
    for (const d of docs) found.push({ resource: spec.key, label: spec.label, id: String(d._id), title: String((d as Record<string, unknown>)[spec.titleField] ?? d._id) });
  }
  return found;
}

const serializeAsset = (a: Record<string, any>) => ({
  id: String(a._id),
  url: a.secureUrl || a.url,
  alt: a.alt ?? '',
  publicId: a.publicId,
  provider: a.provider,
  folder: a.folder,
  width: a.width,
  height: a.height,
  bytes: a.bytes,
  format: a.format,
  tags: a.tags ?? [],
  createdAt: a.createdAt,
});

const folderSchema = z.string().regex(/^[a-z0-9-]{1,40}$/).default('general');

export function mediaRouter(storage: MediaStorage): Router {
  const router = Router();
  const canEdit = requireRole('superadmin', 'admin', 'editor');
  router.use(canEdit);

  router.get('/', async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 48));
    const filter: Record<string, unknown> = {};
    if (typeof req.query.folder === 'string' && req.query.folder) filter.folder = req.query.folder;
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const rx = new RegExp(escapeRegex(req.query.q.trim().slice(0, 80)), 'i');
      filter.$or = [{ alt: rx }, { publicId: rx }, { tags: rx }];
    }
    const [items, total] = await Promise.all([MediaAsset.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), MediaAsset.countDocuments(filter)]);
    res.json({ items: items.map(serializeAsset), total, page, limit });
  });

  router.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) throw new HttpError(400, 'No file uploaded');
    const real = sniffImage(req.file.buffer);
    if (!real) throw new HttpError(415, 'That file is not a valid image');
    const folder = folderSchema.parse(req.body?.folder || undefined);
    const alt = z.string().max(300).optional().parse(req.body?.alt) ?? '';
    const result = await storage.upload(req.file.buffer, { folder, mimeType: real });
    const asset = await MediaAsset.create({ ...result, type: 'image', folder, alt, uploadedBy: req.user!.id, tags: [] });
    await audit(req, 'upload', 'mediaAsset', String(asset._id), `Uploaded image ${result.publicId}`);
    res.status(201).json(serializeAsset(asset.toObject()));
  });

  router.patch('/:id', async (req, res) => {
    const body = z.object({ alt: z.string().max(300).optional(), tags: z.array(z.string().max(40)).max(20).optional() }).parse(req.body);
    const asset = await MediaAsset.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!asset) throw new HttpError(404, 'Media not found');
    await audit(req, 'update', 'mediaAsset', String(asset._id), 'Updated media details');
    res.json(serializeAsset(asset.toObject()));
  });

  /** Replace the image behind an asset. Everything that uses it updates automatically. */
  router.put('/:id/replace', upload.single('file'), async (req, res) => {
    if (!req.file) throw new HttpError(400, 'No file uploaded');
    const real = sniffImage(req.file.buffer);
    if (!real) throw new HttpError(415, 'That file is not a valid image');
    const asset = await MediaAsset.findById(req.params.id);
    if (!asset) throw new HttpError(404, 'Media not found');
    // Assets that came from the original site's static files have no Cloudinary id yet, so a fresh upload is created for them.
    const reuse = asset.provider === storage.name;
    const result = await storage.upload(req.file.buffer, { folder: asset.folder || 'general', publicId: reuse ? asset.publicId : undefined, mimeType: real });
    Object.assign(asset, { ...result, bytes: result.bytes });
    await asset.save();
    await audit(req, 'replace', 'mediaAsset', String(asset._id), `Replaced image ${asset.publicId}`);
    res.json(serializeAsset(asset.toObject()));
  });

  router.get('/:id/usage', async (req, res) => {
    res.json({ usage: await usageOf(String(req.params.id)) });
  });

  router.delete('/:id', async (req, res) => {
    const asset = await MediaAsset.findById(req.params.id);
    if (!asset) throw new HttpError(404, 'Media not found');
    const usage = await usageOf(String(asset._id));
    if (usage.length) throw new HttpError(409, `Cannot delete: used by ${usage.length} item(s), e.g. ${usage[0]!.label}: ${usage[0]!.title}`, { usage });
    if (asset.provider !== 'local') await storage.destroy(asset.publicId);
    await asset.deleteOne();
    await audit(req, 'delete', 'mediaAsset', String(asset._id), `Deleted image ${asset.publicId}`);
    res.json({ ok: true });
  });

  return router;
}
