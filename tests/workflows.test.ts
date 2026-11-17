/**
 * End-to-end workflow tests against a real MongoDB (Phase 9 of the brief).
 * NOT YET RUN: they need a database. They are skipped — and reported as skipped — until one is available.
 * Run them with either:
 *   - a machine that can start mongodb-memory-server (Windows needs the Visual C++ Redistributable), or
 *   - TEST_MONGO_URI=<a throw-away database URI>   (the tests drop their own database)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditLog, MediaAsset, modelOf } from '../src/db/models.js';
import { DB_AVAILABLE, PNG, PNG2, anon, loginAs, startTestApp, stopTestApp } from './helpers.js';

let ctx: Awaited<ReturnType<typeof startTestApp>>;
let editor: Awaited<ReturnType<typeof loginAs>>;
let admin: Awaited<ReturnType<typeof loginAs>>;
let support: Awaited<ReturnType<typeof loginAs>>;

describe.skipIf(!DB_AVAILABLE)('DB-backed content workflows', () => {
  beforeAll(async () => {
    ctx = await startTestApp('workflow_test');
    editor = await loginAs(ctx.app, 'editor');
    admin = await loginAs(ctx.app, 'admin');
    support = await loginAs(ctx.app, 'support');
  });
  afterAll(stopTestApp);

  const publicGet = (p: string) => anon(ctx.app).get(`/api/public/${p}`);

  describe('create → draft → publish → edit → unpublish → archive', () => {
    let id = '';
    it('a new video is a draft and is NOT visible on the public site', async () => {
      const created = await editor.post('/api/admin/videos').send({ title: 'Brand New Film', kind: 'film', access: 'own', price: 1999 });
      expect(created.status).toBe(201);
      expect(created.body.status).toBe('draft');
      expect(created.body.slug).toBe('brand-new-film');
      id = created.body.id;
      const list = await publicGet('videos');
      expect(list.body.items.map((v: { id: string }) => v.id)).not.toContain(id);
      expect((await publicGet('videos/brand-new-film')).status).toBe(404);
    });

    it('publishing makes it appear publicly, with the stored price in cents', async () => {
      expect((await editor.post(`/api/admin/videos/${id}/publish`)).status).toBe(200);
      const pub = await publicGet('videos/brand-new-film');
      expect(pub.status).toBe(200);
      expect(pub.body.price).toBe(1999);
    });

    it('editing the price and description is reflected on the public page', async () => {
      const upd = await editor.patch(`/api/admin/videos/${id}`).send({ price: 2499, synopsis: 'Updated synopsis' });
      expect(upd.status).toBe(200);
      const pub = await publicGet('videos/brand-new-film');
      expect(pub.body.price).toBe(2499);
      expect(pub.body.synopsis).toBe('Updated synopsis');
    });

    it('unpublishing hides it again', async () => {
      await editor.post(`/api/admin/videos/${id}/unpublish`);
      expect((await publicGet('videos/brand-new-film')).status).toBe(404);
    });

    it('archiving (DELETE) keeps the record but it stays hidden', async () => {
      await editor.post(`/api/admin/videos/${id}/publish`);
      const del = await editor.delete(`/api/admin/videos/${id}`);
      expect(del.body.archived).toBe(true);
      expect((await publicGet('videos/brand-new-film')).status).toBe(404);
      expect((await editor.get(`/api/admin/videos/${id}`)).body.status).toBe('archived');
    });

    it('editors cannot permanently delete; admins can', async () => {
      expect((await editor.delete(`/api/admin/videos/${id}?hard=true`)).status).toBe(403);
      expect((await admin.delete(`/api/admin/videos/${id}?hard=true`)).status).toBe(200);
      expect((await admin.get(`/api/admin/videos/${id}`)).status).toBe(404);
    });
  });

  it('scheduled content (publishAt in the future) is hidden until its time', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const a = await editor.post('/api/admin/articles').send({ title: 'Future Story', status: 'published', publishAt: future });
    expect(a.status).toBe(201);
    expect((await publicGet('articles/future-story')).status).toBe(404);
    await editor.patch(`/api/admin/articles/${a.body.id}`).send({ publishAt: new Date(Date.now() - 1000).toISOString() });
    expect((await publicGet('articles/future-story')).status).toBe(200);
  });

  it('slugs stay unique when titles collide', async () => {
    const a = await editor.post('/api/admin/artists').send({ name: 'Same Name' });
    const b = await editor.post('/api/admin/artists').send({ name: 'Same Name' });
    expect(a.body.slug).toBe('same-name');
    expect(b.body.slug).toBe('same-name-2');
  });

  it('validation failures return 400 with field messages and store nothing', async () => {
    const before = await modelOf('video').countDocuments();
    const res = await editor.post('/api/admin/videos').send({ title: '', kind: 'banana' });
    expect(res.status).toBe(400);
    expect(res.body.fields.title).toBeTruthy();
    expect(await modelOf('video').countDocuments()).toBe(before);
  });

  it('singleton pages (site settings, tour copy) are created on first read and edits show publicly', async () => {
    const first = await admin.get('/api/admin/site-settings');
    expect(first.status).toBe(200);
    expect(first.body.siteName).toBe('Boosie Network');
    await admin.put('/api/admin/site-settings').send({ siteName: 'Boosie Network HQ' });
    expect((await publicGet('site-settings')).body.siteName).toBe('Boosie Network HQ');
    await editor.put('/api/admin/tour').send({ headline: 'New Headline' });
    expect((await publicGet('tour')).body.headline).toBe('New Headline');
  });

  it('reordering changes the public order', async () => {
    const ids: string[] = [];
    for (const title of ['One', 'Two', 'Three']) {
      const r = await editor.post('/api/admin/ticker').send({ label: 'X', text: title, status: 'published' });
      ids.push(r.body.id);
    }
    await editor.post('/api/admin/ticker/reorder').send({ ids: [ids[2], ids[0], ids[1]] });
    const pub = await publicGet('ticker');
    expect(pub.body.items.map((i: { text: string }) => i.text)).toEqual(['Three', 'One', 'Two']);
  });

  it('a record that is still referenced cannot be permanently deleted', async () => {
    const cat = await admin.post('/api/admin/product-categories').send({ label: 'Hats', status: 'published' });
    await editor.post('/api/admin/products').send({ name: 'Cap', fromPrice: 2500, category: cat.body.id, status: 'published' });
    const del = await admin.delete(`/api/admin/product-categories/${cat.body.id}?hard=true`);
    expect(del.status).toBe(409);
    expect(del.body.error).toMatch(/used by/i);
  });

  describe('media: upload, attach, replace, protect', () => {
    let mediaId = '';
    let pillarId = '';

    it('uploads an image (real type is verified from its bytes)', async () => {
      const bad = await editor.post('/api/admin/media').attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'x.png', contentType: 'image/png' });
      expect(bad.status).toBe(415);
      const ok = await editor.post('/api/admin/media').attach('file', PNG, { filename: 'a.png', contentType: 'image/png' }).field('folder', 'pillars').field('alt', 'First');
      expect(ok.status).toBe(201);
      mediaId = ok.body.id;
      expect(ok.body.url).toMatch(/dev-media/);
    });

    it('support cannot use the media library', async () => {
      expect((await support.post('/api/admin/media').attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })).status).toBe(403);
    });

    it('attaching it to a pillar shows the url on the public site', async () => {
      const p = await editor.post('/api/admin/pillars').send({ kicker: 'K', title: 'Media Pillar', description: 'D', to: '/x', image: mediaId, status: 'published' });
      expect(p.status).toBe(201);
      pillarId = p.body.id;
      const pub = await publicGet('pillars');
      const mine = pub.body.items.find((x: { id: string }) => x.id === pillarId);
      expect(mine.image.id).toBe(mediaId);
      expect(mine.image.url).toMatch(/dev-media/);
    });

    it('replacing the image updates every place that uses it, without touching the records', async () => {
      const before = (await publicGet('pillars')).body.items.find((x: { id: string }) => x.id === pillarId).image.url as string;
      const rep = await editor.put(`/api/admin/media/${mediaId}/replace`).attach('file', PNG2, { filename: 'b.png', contentType: 'image/png' });
      expect(rep.status).toBe(200);
      expect(rep.body.id).toBe(mediaId);
      const after = (await publicGet('pillars')).body.items.find((x: { id: string }) => x.id === pillarId).image;
      expect(after.id).toBe(mediaId);
      expect(after.url).not.toBe(before);
    });

    it('reports where an image is used and refuses to delete it while in use', async () => {
      const usage = await editor.get(`/api/admin/media/${mediaId}/usage`);
      expect(usage.body.usage.some((u: { id: string }) => u.id === pillarId)).toBe(true);
      expect((await editor.delete(`/api/admin/media/${mediaId}`)).status).toBe(409);
      await editor.patch(`/api/admin/pillars/${pillarId}`).send({ image: null });
      expect((await editor.delete(`/api/admin/media/${mediaId}`)).status).toBe(200);
      expect(await MediaAsset.findById(mediaId)).toBeNull();
    });
  });

  describe('visitor submissions and moderation', () => {
    it('a contact message is stored, appears in the support inbox, and can be marked handled', async () => {
      const res = await anon(ctx.app).post('/api/public/contact-messages').send({ name: 'Fan', email: 'fan@example.com', message: 'Hello' });
      expect(res.status).toBe(201);
      const list = await support.get('/api/admin/contact-messages');
      expect(list.body.items[0].message).toBe('Hello');
      expect(list.body.items[0].msgStatus).toBe('new');
      const upd = await support.patch(`/api/admin/contact-messages/${list.body.items[0].id}`).send({ msgStatus: 'handled' });
      expect(upd.body.msgStatus).toBe('handled');
    });

    it('a visitor cannot choose a submission status or read the inbox', async () => {
      await anon(ctx.app).post('/api/public/contact-messages').send({ name: 'Sneaky', email: 's@example.com', message: 'x', msgStatus: 'handled' });
      const doc = await modelOf('contactMessage').findOne({ name: 'Sneaky' }).lean();
      expect((doc as Record<string, unknown>).msgStatus).toBe('new');
      expect((await publicGet('contact-messages')).status).toBe(404);
    });

    it('comments: visible after posting, hideable by support, gone from the public list', async () => {
      const video = await editor.post('/api/admin/videos').send({ title: 'Commentable', kind: 'film', access: 'free', status: 'published' });
      const posted = await anon(ctx.app).post('/api/public/comments').send({ video: video.body.id, author: 'Viewer', text: 'Great!' });
      expect(posted.status).toBe(201);
      expect((await publicGet(`comments?video=${video.body.id}`)).body.items).toHaveLength(1);
      expect((await publicGet('comments')).status).toBe(400); // must name a video
      await support.patch(`/api/admin/comments/${posted.body.id}`).send({ commentStatus: 'hidden' });
      expect((await publicGet(`comments?video=${video.body.id}`)).body.items).toHaveLength(0);
    });

    it('comments on unpublished videos are rejected', async () => {
      const draft = await editor.post('/api/admin/videos').send({ title: 'Secret Draft', kind: 'film', access: 'free' });
      const res = await anon(ctx.app).post('/api/public/comments').send({ video: draft.body.id, author: 'A', text: 'hi' });
      expect(res.status).toBe(400);
    });

    it('a shoutout order takes its price from the talent record, never from the request', async () => {
      const t = await editor.post('/api/admin/shoutout-talent').send({ name: 'Talent One', fromPrice: 64900, available: true, status: 'published' });
      const res = await anon(ctx.app).post('/api/public/shoutout-orders').send({ talent: t.body.id, recipient: 'Sam', price: 1 });
      expect(res.status).toBe(201);
      const doc = await modelOf('shoutoutOrder').findOne({ recipient: 'Sam' }).lean();
      expect((doc as Record<string, unknown>).price).toBe(64900);
    });

    it('orders are priced on the server: tampered prices and quantities are ignored/rejected', async () => {
      const p = await editor.post('/api/admin/products').send({ name: 'Hoodie', fromPrice: 5999, status: 'published' });
      const res = await anon(ctx.app).post('/api/public/orders').send({ buyerEmail: 'b@example.com', lines: [{ refType: 'product', refId: p.body.id, qty: 2, price: 1 }] });
      expect(res.status).toBe(201);
      expect(res.body.total).toBe(11998);
      const draft = await editor.post('/api/admin/products').send({ name: 'Unreleased', fromPrice: 100 });
      expect((await anon(ctx.app).post('/api/public/orders').send({ lines: [{ refType: 'product', refId: draft.body.id, qty: 1 }] })).status).toBe(400);
    });

    it('inbox exports are CSV and neutralise spreadsheet formulas', async () => {
      await anon(ctx.app).post('/api/public/contact-messages').send({ name: '=HYPERLINK("http://x")', email: 'f@example.com', message: 'm' });
      const csv = await support.get('/api/admin/contact-messages/export.csv');
      expect(csv.headers['content-type']).toMatch(/text\/csv/);
      expect(csv.text).toContain(`"'=HYPERLINK`);
    });
  });

  it('every admin change is recorded in the audit log, and the dashboard reflects the data', async () => {
    expect(await AuditLog.countDocuments({ action: 'create' })).toBeGreaterThan(5);
    const dash = await admin.get('/api/admin/dashboard');
    expect(dash.status).toBe(200);
    expect(dash.body.content.length).toBeGreaterThan(5);
    expect(dash.body.inbox.length).toBeGreaterThan(0);
    expect((await editor.get('/api/admin/audit')).status).toBe(403);
    expect((await admin.get('/api/admin/audit')).body.total).toBeGreaterThan(5);
  });

  it('admin metadata only lists the modules a role may use', async () => {
    const ed = await editor.get('/api/admin/meta');
    const sup = await support.get('/api/admin/meta');
    const names = (r: typeof ed) => r.body.modules.flatMap((m: { resources: { key: string }[] }) => m.resources.map((x) => x.key));
    expect(names(ed)).toContain('video');
    expect(names(sup)).not.toContain('video');
    expect(names(sup)).toContain('contactMessage');
    expect(ed.body.tools.users).toBe(false);
  });
});
