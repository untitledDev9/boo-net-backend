import 'dotenv/config';
import mongoose from 'mongoose';
import { MediaAsset, Models } from '../src/db/models.js';
import { RESOURCE_BY_KEY } from '../src/resources/registry.js';
import { slugify } from '../src/services/content.js';
import { SEED_ORDER, buildSeed, type Doc } from '../seed/buildSeed.js';

/** The field(s) that identify "the same record" so re-running the seed never duplicates content. */
const NATURAL_KEY: Record<string, string[]> = {
  siteText: ['key'], contentBlock: ['key'], navItem: ['location', 'group', 'label'], tickerItem: ['text'], promotion: ['slot'], featureCard: ['group', 'title'],
  pillar: ['title'], video: ['title'], premiere: ['heading'], artist: ['name'], track: ['title'], liveStream: ['title'], tourDate: ['city', 'venue'], article: ['title'],
  productCategory: ['label'], product: ['name'], closetItem: ['title'], book: ['title'], shoutoutTalent: ['name'], membershipPlan: ['name'], workDoor: ['title'],
  legalCategory: ['label'], legalDocument: ['title'], comment: ['video', 'author', 'text'],
};

type Log = (msg: string) => void;

async function mediaId(url: string, alt: string | undefined): Promise<string> {
  const publicId = `local:${url}`;
  const found = await MediaAsset.findOne({ publicId });
  if (found) return String(found._id);
  const folder = url.includes('/merch/') ? 'merch' : url.includes('/logos/') ? 'logos' : 'site';
  const created = await MediaAsset.create({ provider: 'local', publicId, url, secureUrl: url, type: 'image', folder, alt: alt ?? '', tags: ['seeded'] });
  return String(created._id);
}

/** Replace {$media}/{$ref} markers with real ids. Returns the doc plus any refs that could not be resolved yet. */
async function resolve(value: unknown, deferred: { path: string; marker: Doc }[], at = ''): Promise<unknown> {
  if (Array.isArray(value)) return Promise.all(value.map((v, i) => resolve(v, deferred, `${at}.${i}`)));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const o = value as Doc;
    if (typeof o.$media === 'string') return mediaId(o.$media, o.alt);
    if (typeof o.$ref === 'string') {
      const target = await Models[o.$ref]!.findOne(o.by).lean();
      if (target) return String((target as Doc)._id);
      deferred.push({ path: at.replace(/^\./, ''), marker: o });
      return undefined;
    }
    const out: Doc = {};
    for (const [k, v] of Object.entries(o)) {
      const r = await resolve(v, deferred, `${at}.${k}`);
      if (r !== undefined) out[k] = r;
    }
    return out;
  }
  return value;
}

export async function runSeed(opts: { reset?: boolean; log?: Log } = {}): Promise<Record<string, number>> {
  const log = opts.log ?? (() => undefined);
  const data = buildSeed();
  const created: Record<string, number> = {};

  if (opts.reset) {
    for (const key of SEED_ORDER) await Models[key]!.deleteMany({});
    await MediaAsset.deleteMany({ tags: 'seeded' });
    log('Reset content collections (users and uploaded media were kept).');
  }

  const fixups: { key: string; id: string; path: string; marker: Doc }[] = [];
  for (const key of SEED_ORDER) {
    const spec = RESOURCE_BY_KEY.get(key)!;
    const Model = Models[key]!;
    let n = 0;
    for (const raw of data[key] ?? []) {
      const deferred: { path: string; marker: Doc }[] = [];
      const doc = (await resolve(raw, deferred)) as Doc;
      if (spec.slugFrom && !doc.slug) doc.slug = slugify(String(doc.slug ?? doc[spec.slugFrom] ?? ''));
      const keyFields = NATURAL_KEY[key];
      if (keyFields) {
        const probe: Doc = {};
        for (const f of keyFields) if (doc[f] !== undefined) probe[f] = doc[f];
        if (await Model.exists(probe)) continue;
      } else if (spec.singleton && (await Model.exists({}))) {
        continue;
      }
      const row = await Model.create(doc);
      n += 1;
      for (const d of deferred) fixups.push({ key, id: String(row._id), ...d });
    }
    created[key] = n;
    log(`  ${spec.label}: ${n} created`);
  }

  // Second pass: references to records inserted later in the same collection (e.g. a video's trailer).
  for (const f of fixups) {
    const target = await Models[f.marker.$ref]!.findOne(f.marker.by).lean();
    if (target) await Models[f.key]!.updateOne({ _id: f.id }, { $set: { [f.path]: (target as Doc)._id } });
  }
  return created;
}

// CLI entry: `npm run seed` or `npm run seed -- --reset`
if (process.argv[1] && /seed\.ts$/.test(process.argv[1])) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set (see backend/.env.example).');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const reset = process.argv.includes('--reset');
  console.log(reset ? 'Seeding (reset)…' : 'Seeding (adds anything missing; existing records are left untouched)…');
  const created = await runSeed({ reset, log: console.log });
  console.log(`Done. ${Object.values(created).reduce((a, b) => a + b, 0)} records created.`);
  await mongoose.disconnect();
}
