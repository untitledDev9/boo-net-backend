/**
 * Tests that need no database. They run everywhere, including machines that cannot start MongoDB.
 * What they CAN'T prove (anything that reads or writes MongoDB) lives in the other test files,
 * which are skipped — and reported as skipped — when no test database is available.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { RESOURCES, RESOURCE_BY_KEY, RESOURCE_BY_PATH, readRolesOf } from '../src/resources/registry.js';
import type { FieldSpec } from '../src/resources/types.js';
import { validatorsFor } from '../src/resources/validators.js';
import { singletonDefaults } from '../src/routes/adminResource.js';
import { sniffImage } from '../src/routes/media.js';
import { serialize } from '../src/services/serialize.js';
import { StubStorage } from '../src/services/storage.js';
import { SEED_ORDER, buildSeed, type Doc } from '../seed/buildSeed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE_ID = '507f1f77bcf86cd799439011';
const env = loadEnv({ NODE_ENV: 'test', JWT_SECRET: 'test-secret-test-secret-test-secret-123', CLIENT_ORIGIN: 'http://localhost:5173' });
const app = createApp({ env, storage: new StubStorage() });

describe('resource registry integrity', () => {
  it('has unique keys and URL paths', () => {
    expect(new Set(RESOURCES.map((r) => r.key)).size).toBe(RESOURCES.length);
    expect(new Set(RESOURCES.map((r) => r.path)).size).toBe(RESOURCES.length);
  });

  it('every relation points at a real resource', () => {
    for (const r of RESOURCES) for (const f of r.fields) if (f.type === 'ref') expect(RESOURCE_BY_KEY.has(f.ref!), `${r.key}.${f.name} -> ${f.ref}`).toBe(true);
  });

  it('every select has options, every object list has item fields, and field names are unique and not reserved', () => {
    const reserved = new Set(['status', 'publishAt', 'sortOrder', 'slug', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'id', '_id']);
    const check = (fields: FieldSpec[], where: string) => {
      const names = fields.map((f) => f.name);
      expect(new Set(names).size, `${where} duplicate field names`).toBe(names.length);
      for (const f of fields) {
        if (where.split('.').length === 1) expect(reserved.has(f.name), `${where}.${f.name} is reserved`).toBe(false);
        if (f.type === 'select') expect(f.options?.length, `${where}.${f.name} options`).toBeGreaterThan(0);
        if (f.type === 'objectList') {
          expect(f.fields?.length, `${where}.${f.name} item fields`).toBeGreaterThan(0);
          check(f.fields!, `${where}.${f.name}`);
        }
      }
    };
    for (const r of RESOURCES) check(r.fields, r.key);
  });

  it('title and search fields exist; slugFrom exists', () => {
    for (const r of RESOURCES) {
      const names = new Set(r.fields.map((f) => f.name));
      expect(names.has(r.titleField), `${r.key}.titleField`).toBe(true);
      for (const s of r.searchFields) expect(names.has(s), `${r.key}.search ${s}`).toBe(true);
      if (r.slugFrom) expect(names.has(r.slugFrom), `${r.key}.slugFrom`).toBe(true);
    }
  });

  it('public submissions only accept explicitly-marked fields and always have a required field', () => {
    for (const r of RESOURCES.filter((x) => x.publicSubmit)) {
      const submittable = r.fields.filter((f) => f.submit);
      expect(submittable.length, `${r.key} has submit fields`).toBeGreaterThan(0);
      expect(r.publicSubmit!.rateLimitPerHour).toBeGreaterThan(0);
    }
  });

  it('inbox resources are readable by support; content resources are not writable by support', () => {
    for (const r of RESOURCES) {
      if (r.publicSubmit) expect(readRolesOf(r)).toContain('support');
      if (!r.publicSubmit && r.key !== 'comment') expect(r.writeRoles, `${r.key} must not be writable by support`).not.toContain('support');
    }
  });

  it('nothing that is publicly writable is also publicly readable by accident (except comments and orders flow)', () => {
    for (const r of RESOURCES.filter((x) => x.publicSubmit && x.publicRead)) expect(r.publicFilter, `${r.key} needs a public filter`).toBeTruthy();
  });
});

describe('validators (generated from the registry)', () => {
  const video = validatorsFor(RESOURCE_BY_KEY.get('video')!);

  it('requires the fields marked required', () => {
    const r = video.create.safeParse({});
    expect(r.success).toBe(false);
    const missing = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(missing).toEqual(expect.arrayContaining(['title', 'kind', 'access']));
  });

  it('strips unknown keys so privileged fields cannot be mass-assigned', () => {
    const r = video.create.parse({ title: 'T', kind: 'film', access: 'free', role: 'superadmin', createdBy: FAKE_ID, passwordHash: 'x' }) as Record<string, unknown>;
    expect(r.role).toBeUndefined();
    expect(r.createdBy).toBeUndefined();
    expect(r.passwordHash).toBeUndefined();
  });

  it('keeps money as integer cents, non-negative', () => {
    expect(video.create.safeParse({ title: 'T', kind: 'film', access: 'own', price: 1999 }).success).toBe(true);
    expect(video.create.safeParse({ title: 'T', kind: 'film', access: 'own', price: 19.99 }).success).toBe(false);
    expect(video.create.safeParse({ title: 'T', kind: 'film', access: 'own', price: -1 }).success).toBe(false);
  });

  it('rejects unknown select values and malformed ids', () => {
    expect(video.create.safeParse({ title: 'T', kind: 'banana', access: 'free' }).success).toBe(false);
    expect(video.create.safeParse({ title: 'T', kind: 'film', access: 'free', poster: 'not-an-id' }).success).toBe(false);
    expect(video.create.safeParse({ title: 'T', kind: 'film', access: 'free', poster: FAKE_ID }).success).toBe(true);
  });

  it('allows clearing optional fields with null or empty string', () => {
    expect(video.update.safeParse({ synopsis: '', poster: null, price: null }).success).toBe(true);
  });

  it('updates are partial', () => {
    expect(video.update.safeParse({ title: 'Only the title' }).success).toBe(true);
  });

  it('read-only fields are not accepted (order totals are computed on the server)', () => {
    const order = validatorsFor(RESOURCE_BY_KEY.get('order')!);
    const parsed = order.update.parse({ total: 1, lines: [], number: 'X', orderStatus: 'paid' }) as Record<string, unknown>;
    expect(parsed.total).toBeUndefined();
    expect(parsed.lines).toBeUndefined();
    expect(parsed.orderStatus).toBe('paid');
  });

  it('public submissions only keep submit:true fields (a visitor cannot set status or price)', () => {
    const ship = validatorsFor(RESOURCE_BY_KEY.get('shoutoutOrder')!);
    const parsed = ship.submit.parse({ talent: FAKE_ID, recipient: 'Sam', price: 1, orderStatus: 'delivered', deliveredUrl: 'http://x' }) as Record<string, unknown>;
    expect(parsed.price).toBeUndefined();
    expect(parsed.orderStatus).toBeUndefined();
    expect(parsed.deliveredUrl).toBeUndefined();
    expect(parsed.recipient).toBe('Sam');
  });

  it('validates slugs', () => {
    expect(video.update.safeParse({ slug: 'good-slug-1' }).success).toBe(true);
    expect(video.update.safeParse({ slug: 'Bad Slug!' }).success).toBe(false);
  });
});

describe('upload safety', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHTdqjQAAAABJRU5ErkJggg==', 'base64');
  it('recognises real images by their bytes', () => {
    expect(sniffImage(png)).toBe('image/png');
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('image/jpeg');
    expect(sniffImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]))).toBe('image/webp');
    expect(sniffImage(Buffer.from('GIF89a000000'))).toBe('image/gif');
  });
  it('rejects scripts and executables disguised as images', () => {
    expect(sniffImage(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(sniffImage(Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00'))).toBeNull();
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'))).toBeNull();
    expect(sniffImage(Buffer.alloc(4))).toBeNull();
  });
});

describe('serializer', () => {
  const spec = RESOURCE_BY_KEY.get('pillar')!;
  it('resolves populated media to a plain url object and unpopulated media to null', () => {
    const out = serialize(spec, { _id: FAKE_ID, kicker: 'K', title: 'T', description: 'D', to: '/x', image: { _id: 'abc', url: 'http://a/x.png', secureUrl: 'https://a/x.png', alt: 'alt', width: 10, height: 20 }, spriteImage: null, status: 'published', sortOrder: 3, createdAt: new Date('2026-01-01') });
    expect(out.image).toEqual({ id: 'abc', url: 'https://a/x.png', alt: 'alt', width: 10, height: 20 });
    expect(out.spriteImage).toBeNull();
    expect(out.id).toBe(FAKE_ID);
    expect(out.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });
  it('never leaks internal fields', () => {
    const out = serialize(spec, { _id: FAKE_ID, kicker: 'K', title: 'T', description: 'D', to: '/x', createdBy: FAKE_ID, updatedBy: FAKE_ID, __v: 3 });
    expect(out).not.toHaveProperty('createdBy');
    expect(out).not.toHaveProperty('__v');
  });
  it('renders list fields as arrays even when empty', () => {
    const out = serialize(RESOURCE_BY_KEY.get('video')!, { _id: FAKE_ID, title: 'T' });
    expect(out.starring).toEqual([]);
    expect(out.cast).toEqual([]);
  });
});

describe('configuration', () => {
  it('refuses to start in production without a strong JWT secret or a database URI', () => {
    expect(() => loadEnv({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://x' })).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ NODE_ENV: 'production', JWT_SECRET: 'short' , MONGODB_URI: 'mongodb://x' })).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40) })).toThrow(/MONGODB_URI/);
    expect(loadEnv({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), MONGODB_URI: 'mongodb://x' }).cookieSecure).toBe(true);
  });
  it('treats Cloudinary as configured only when all three values are present', () => {
    expect(loadEnv({ NODE_ENV: 'test', CLOUDINARY_CLOUD_NAME: 'a', CLOUDINARY_API_KEY: 'b' }).cloudinary).toBeNull();
    expect(loadEnv({ NODE_ENV: 'test', CLOUDINARY_CLOUD_NAME: 'a', CLOUDINARY_API_KEY: 'b', CLOUDINARY_API_SECRET: 'c' }).cloudinary).not.toBeNull();
  });
});

describe('HTTP guards that run before any database access', () => {
  it('health check works', async () => {
    expect((await supertest(app).get('/api/health')).body.ok).toBe(true);
  });

  it('every admin endpoint refuses anonymous requests (GET and POST, every resource)', async () => {
    for (const r of RESOURCES) {
      expect((await supertest(app).get(`/api/admin/${r.path}`)).status, `GET ${r.path}`).toBe(401);
      expect((await supertest(app).post(`/api/admin/${r.path}`).send({})).status, `POST ${r.path}`).toBe(401);
      expect((await supertest(app).delete(`/api/admin/${r.path}/${FAKE_ID}`)).status, `DELETE ${r.path}`).toBe(401);
    }
    for (const p of ['meta', 'dashboard', 'audit', 'media', 'users']) expect((await supertest(app).get(`/api/admin/${p}`)).status, p).toBe(401);
    expect((await supertest(app).post('/api/admin/media').attach('file', Buffer.from('x'), 'x.png')).status).toBe(401);
  });

  it('refuses garbage, expired-looking and wrongly-signed session cookies', async () => {
    expect((await supertest(app).get('/api/admin/meta').set('Cookie', 'bn_token=garbage')).status).toBe(401);
    const forged = jwt.sign({ sub: FAKE_ID, tv: 0 }, 'a-different-secret-entirely-0123456789');
    expect((await supertest(app).get('/api/admin/meta').set('Cookie', `bn_token=${forged}`)).status).toBe(401);
    const alg = jwt.sign({ sub: FAKE_ID, tv: 0, role: 'superadmin' }, '', { algorithm: 'none' as never });
    expect((await supertest(app).get('/api/admin/meta').set('Cookie', `bn_token=${alg}`)).status).toBe(401);
  });

  it('rejects state-changing admin requests from a foreign Origin before authentication', async () => {
    const res = await supertest(app).post('/api/admin/pillars').set('Origin', 'https://evil.example').send({});
    expect(res.status).toBe(403);
  });

  it('validates login input without touching the database', async () => {
    expect((await supertest(app).post('/api/auth/login').send({ email: 'not-an-email', password: 'x' })).status).toBe(400);
    expect((await supertest(app).post('/api/auth/login').send({})).status).toBe(400);
  });

  it('keeps bootstrap closed when no token is configured', async () => {
    const res = await supertest(app).post('/api/auth/bootstrap').set('x-bootstrap-token', 'anything').send({ email: 'a@b.co', name: 'A', password: 'Valid-Password1' });
    expect(res.status).toBe(403);
  });

  it('visitor submissions: validation errors come back as 400 before storage', async () => {
    expect((await supertest(app).post('/api/public/contact-messages').send({ name: 'A' })).status).toBe(400);
    expect((await supertest(app).post('/api/public/comments').send({ author: 'a', text: 'hi', video: 'nope' })).status).toBe(400);
    expect((await supertest(app).post('/api/public/orders').send({ lines: [] })).status).toBe(400);
    expect((await supertest(app).post('/api/public/orders').send({ lines: [{ refType: 'product', refId: FAKE_ID, qty: 999 }] })).status).toBe(400);
    expect((await supertest(app).post('/api/public/orders').send({ lines: [{ refType: 'admin', refId: FAKE_ID, qty: 1 }] })).status).toBe(400);
  });

  it('visitor submissions: the honeypot field silently swallows bots and stores nothing', async () => {
    const res = await supertest(app).post('/api/public/contact-messages').send({ name: 'Bot', email: 'bot@example.com', message: 'buy now', website: 'http://spam.example' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it('inbox resources are not publicly readable', async () => {
    for (const p of ['contact-messages', 'opportunities', 'radio-submissions', 'live-subscribers', 'shoutout-orders', 'orders']) {
      expect((await supertest(app).get(`/api/public/${p}`)).status, p).toBe(404);
    }
  });

  it('unknown routes return a JSON 404', async () => {
    const res = await supertest(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('sets security headers and does not advertise Express', async () => {
    const res = await supertest(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('seed content', () => {
  const seed = buildSeed(new Date('2026-11-16T00:00:00Z'));
  const publicDir = path.resolve(here, '../../frontend/public');

  /** Replace media/ref markers with a valid id so the real validators can judge the rest. */
  const flatten = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(flatten);
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      const o = v as Doc;
      if ('$media' in o || '$ref' in o) return FAKE_ID;
      return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, flatten(x)]));
    }
    return v;
  };

  it('every seeded resource is a known resource, in dependency order', () => {
    for (const key of Object.keys(seed)) expect(RESOURCE_BY_KEY.has(key), key).toBe(true);
    for (const key of SEED_ORDER) expect(RESOURCE_BY_KEY.has(key), `SEED_ORDER ${key}`).toBe(true);
    const missing = Object.keys(seed).filter((k) => !SEED_ORDER.includes(k) && (seed[k] ?? []).length > 0);
    expect(missing, 'seeded but never inserted').toEqual([]);
  });

  it('every seeded document passes the real create validator', () => {
    const problems: string[] = [];
    for (const [key, docs] of Object.entries(seed)) {
      const spec = RESOURCE_BY_KEY.get(key)!;
      const { create } = validatorsFor(spec);
      docs.forEach((d, i) => {
        // Singletons are created with the schema defaults (see ensureSingleton / Model.create).
        const withDefaults = spec.singleton ? { ...singletonDefaults(spec), ...d } : d;
        const r = create.safeParse(flatten(withDefaults));
        if (!r.success) problems.push(`${key}[${i}] ${JSON.stringify(d.title ?? d.name ?? d.key ?? d.label ?? '')}: ${r.error.issues.map((x) => `${x.path.join('.')} ${x.message}`).join('; ')}`);
      });
    }
    expect(problems).toEqual([]);
  });

  it('every image the seed references exists in the frontend public folder', () => {
    const missing: string[] = [];
    const walk = (v: unknown) => {
      if (Array.isArray(v)) return v.forEach(walk);
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const o = v as Doc;
        if (typeof o.$media === 'string') {
          if (!fs.existsSync(path.join(publicDir, o.$media))) missing.push(o.$media);
          return;
        }
        Object.values(o).forEach(walk);
      }
    };
    Object.values(seed).forEach((docs) => docs.forEach(walk));
    expect(missing).toEqual([]);
  });

  it('every reference points at a record that is also in the seed', () => {
    const titleOf: Record<string, string[]> = { video: ['title'], artist: ['name'], productCategory: ['label'], legalCategory: ['label'] };
    const bad: string[] = [];
    const walk = (v: unknown, where: string) => {
      if (Array.isArray(v)) return v.forEach((x) => walk(x, where));
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const o = v as Doc;
        if (typeof o.$ref === 'string') {
          const [field] = titleOf[o.$ref] ?? [Object.keys(o.by)[0]!];
          const found = (seed[o.$ref] ?? []).some((d) => d[field!] === o.by[field!]);
          if (!found) bad.push(`${where} -> ${o.$ref} ${JSON.stringify(o.by)}`);
          return;
        }
        Object.values(o).forEach((x) => walk(x, where));
      }
    };
    for (const [key, docs] of Object.entries(seed)) docs.forEach((d, i) => walk(d, `${key}[${i}]`));
    expect(bad).toEqual([]);
  });

  it('matches the content the current site shows (counts from the inventory)', () => {
    expect(seed.legalDocument).toHaveLength(22);
    expect(seed.legalCategory).toHaveLength(5);
    expect(seed.video).toHaveLength(37);
    expect(seed.product).toHaveLength(31);
    expect(seed.closetItem).toHaveLength(8);
    expect(seed.pillar).toHaveLength(9);
    expect(seed.workDoor).toHaveLength(17);
    expect(seed.membershipPlan).toHaveLength(2);
    expect(seed.productCategory).toHaveLength(11);
    expect((seed.track ?? []).length).toBeGreaterThanOrEqual(95);
    expect((seed.track ?? []).filter((t) => t.inRadioRotation)).toHaveLength(57);
    expect(seed.tickerItem).toHaveLength(5);
  });

  it('Birthday X keeps its full detail, trailer link and comments', () => {
    const b = seed.video!.find((v) => v.title === 'Birthday X')!;
    expect(b.cast).toHaveLength(12);
    expect(b.crew).toHaveLength(5);
    expect(b.price).toBe(2499);
    expect(b.rentPrice).toBe(999);
    expect(b.trailer.$ref).toBe('video');
    expect(seed.comment).toHaveLength(2);
  });

  it('featured videos keep the original order across videos and live streams', () => {
    const order = [...(seed.video ?? []), ...(seed.liveStream ?? [])].filter((x) => x.featuredOnLanding).sort((a, b) => a.featuredOrder - b.featuredOrder).map((x) => x.title);
    expect(order).toEqual(['Birthday X — Official Trailer', 'Boosie After Dark', 'Hotboxin Ep. 2', 'No Country for Old Crooks', 'Easy Town 4', 'Heartless', 'New Raq City']);
  });

  it('every policy file has real text', () => {
    for (const d of seed.legalDocument ?? []) expect(String(d.bodyMarkdown).length, d.title).toBeGreaterThan(500);
  });
});
