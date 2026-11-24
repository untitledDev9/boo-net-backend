import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { modelOf } from '../db/models.js';
import { HttpError } from '../middleware/errors.js';
import { RESOURCES } from '../resources/registry.js';
import type { ResourceSpec } from '../resources/types.js';
import { validatorsFor } from '../resources/validators.js';
import { publishedFilter, queryFilters, sortFor } from '../services/content.js';
import { notifyOrder, notifySubmission } from '../services/notify.js';
import { populateFor, serialize } from '../services/serialize.js';
import { ensureSingleton } from './adminResource.js';

/** Item types a cart line may reference, and the price field the server reads for each. */
const PRICED: Record<string, { key: string; field: string; titleField: string }> = {
  product: { key: 'product', field: 'fromPrice', titleField: 'name' },
  video: { key: 'video', field: 'price', titleField: 'title' },
  track: { key: 'track', field: 'price', titleField: 'title' },
  album: { key: 'album', field: 'price', titleField: 'title' },
  book: { key: 'book', field: 'price', titleField: 'title' },
  shoutoutTalent: { key: 'shoutoutTalent', field: 'fromPrice', titleField: 'name' },
};

const orderBody = z.object({
  buyerEmail: z.string().trim().email().max(200).optional().or(z.literal('')),
  buyerName: z.string().trim().max(120).optional(),
  website: z.string().max(200).optional(), // honeypot
  lines: z
    .array(
      z.object({
        refType: z.enum(Object.keys(PRICED) as [string, ...string[]]),
        refId: z.string().regex(/^[a-f0-9]{24}$/i),
        qty: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(50),
});

async function createOrder(body: z.infer<typeof orderBody>) {
  const lines: { refType: string; refId: string; title: string; price: number; qty: number }[] = [];
  for (const line of body.lines) {
    const cfg = PRICED[line.refType]!;
    const spec = RESOURCES.find((r) => r.key === cfg.key)!;
    const item = await modelOf(cfg.key).findOne({ _id: line.refId, ...publishedFilter(spec) }).lean();
    if (!item) throw new HttpError(400, `Item ${line.refId} is not available`);
    const price = Number((item as Record<string, unknown>)[cfg.field] ?? 0);
    lines.push({ refType: line.refType, refId: line.refId, title: String((item as Record<string, unknown>)[cfg.titleField]), price, qty: line.qty });
  }
  const total = lines.reduce((n, l) => n + l.price * l.qty, 0);
  const number = `BN-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
  const doc = await modelOf('order').create({ number, buyerEmail: body.buyerEmail || undefined, buyerName: body.buyerName, lines, total, orderStatus: 'pending' });
  const orderSpec = RESOURCES.find((r) => r.key === 'order')!;
  notifyOrder(orderSpec, { id: String(doc._id), number, total, buyerName: body.buyerName, buyerEmail: body.buyerEmail || undefined, items: lines.reduce((n, l) => n + l.qty, 0) });
  return { id: String(doc._id), number, total, status: 'pending' };
}

/** Per-resource preparation of a visitor submission before it is stored. */
async function prepareSubmission(spec: ResourceSpec, data: Record<string, any>): Promise<Record<string, any>> {
  if (spec.key === 'comment') {
    const video = await modelOf('video').findOne({ _id: data.video, ...publishedFilter(RESOURCES.find((r) => r.key === 'video')!) }, '_id').lean();
    if (!video) throw new HttpError(400, 'That title is not available for comments');
  }
  if (spec.key === 'shoutoutOrder') {
    const talent = await modelOf('shoutoutTalent').findOne({ _id: data.talent, available: true, ...publishedFilter(RESOURCES.find((r) => r.key === 'shoutoutTalent')!) }).lean();
    if (!talent) throw new HttpError(400, 'That talent is not accepting bookings');
    data.price = (talent as Record<string, any>).fromPrice; // never trust a client-supplied price
  }
  return data;
}

export function publicRouter(): Router {
  const router = Router();

  // Orders are priced on the server from the database.
  router.post(
    '/orders',
    rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }),
    async (req, res) => {
      const body = orderBody.parse(req.body);
      if (body.website) {
        res.status(201).json({ ok: true });
        return;
      }
      res.status(201).json(await createOrder(body));
    },
  );

  for (const spec of RESOURCES) {
    const Model = modelOf(spec.key);
    const populate = populateFor(spec);
    const base = `/${spec.path}`;

    if (spec.publicRead) {
      if (spec.singleton) {
        router.get(base, async (_req, res) => {
          const doc = await ensureSingleton(spec);
          res.json(serialize(spec, (await Model.findById(doc._id).populate(populate).lean())!));
        });
      } else {
        router.get(base, async (req, res) => {
          const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
          const filter = { ...publishedFilter(spec), ...queryFilters(spec, req.query) };
          if (spec.key === 'comment' && !req.query.video) throw new HttpError(400, 'video is required');
          const docs = await Model.find(filter).sort(sortFor(spec, typeof req.query.sort === 'string' ? req.query.sort : undefined)).limit(limit).populate(populate).lean();
          res.json({ items: docs.map((d) => serialize(spec, d)) });
        });
        if (spec.slugFrom) {
          router.get(`${base}/:slug`, async (req, res) => {
            const doc = await Model.findOne({ slug: String(req.params.slug).toLowerCase(), ...publishedFilter(spec) }).populate(populate).lean();
            if (!doc) throw new HttpError(404, `${spec.singular} not found`);
            res.json(serialize(spec, doc));
          });
        }
      }
    }

    if (spec.publicSubmit && spec.key !== 'order') {
      const { submit } = validatorsFor(spec);
      const submitWithTrap = submit.extend({ website: z.string().max(200).optional() }); // honeypot
      router.post(
        base,
        rateLimit({ windowMs: 60 * 60 * 1000, limit: spec.publicSubmit.rateLimitPerHour, standardHeaders: true, legacyHeaders: false }),
        async (req, res) => {
          const { website, ...parsed } = submitWithTrap.parse(req.body) as Record<string, any>;
          if (website) {
            res.status(201).json({ ok: true }); // bots get a success response and nothing is stored
            return;
          }
          const data = await prepareSubmission(spec, { ...parsed, ...(spec.publicSubmit!.defaults ?? {}) });
          const doc = await Model.create(data);
          notifySubmission(spec, doc.toObject()); // tells staff (live + phone) without delaying the visitor
          const fresh = await Model.findById(doc._id).populate(populate).lean();
          res.status(201).json(spec.publicRead ? serialize(spec, fresh!) : { ok: true });
        },
      );
    }
  }

  return router;
}
