import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, modelOf } from '../src/db/models.js';
import { RESOURCES } from '../src/resources/registry.js';
import { DB_AVAILABLE, PASSWORD, anon, loginAs, makeUser, startTestApp, stopTestApp } from './helpers.js';

let ctx: Awaited<ReturnType<typeof startTestApp>>;

/** Database-backed: skipped (and reported as skipped) when no MongoDB is available. */
describe.skipIf(!DB_AVAILABLE)('DB-backed authentication & authorization', () => {
beforeAll(async () => {
  ctx = await startTestApp('auth_test', 'bootstrap-token-123');
});
afterAll(stopTestApp);

describe('unauthenticated access', () => {
  it('rejects the admin metadata and dashboard', async () => {
    expect((await anon(ctx.app).get('/api/admin/meta')).status).toBe(401);
    expect((await anon(ctx.app).get('/api/admin/dashboard')).status).toBe(401);
  });

  it('rejects EVERY admin resource endpoint (list and create)', async () => {
    for (const r of RESOURCES) {
      const list = await anon(ctx.app).get(`/api/admin/${r.path}`);
      expect(list.status, `GET ${r.path}`).toBe(401);
      const create = await anon(ctx.app).post(`/api/admin/${r.path}`).send({});
      expect(create.status, `POST ${r.path}`).toBe(401);
    }
    for (const p of ['media', 'users', 'audit']) expect((await anon(ctx.app).get(`/api/admin/${p}`)).status, p).toBe(401);
  });

  it('rejects a forged / garbage session cookie', async () => {
    const res = await anon(ctx.app).get('/api/admin/meta').set('Cookie', 'bn_token=not.a.jwt');
    expect(res.status).toBe(401);
  });
});

describe('login / logout', () => {
  it('gives the same error for a wrong password and an unknown email', async () => {
    await makeUser('admin');
    const wrong = await anon(ctx.app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'nope-nope-nope' });
    const unknown = await anon(ctx.app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'nope-nope-nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });

  it('sets an HttpOnly session cookie and never returns the password hash or token in the body', async () => {
    const res = await anon(ctx.app).post('/api/auth/login').send({ email: 'admin@example.com', password: PASSWORD });
    expect(res.status).toBe(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/bn_token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|token/i);
  });

  it('logs out: the cookie is cleared and the session stops working', async () => {
    const agent = await loginAs(ctx.app, 'admin');
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('rejects login for a deactivated account', async () => {
    await makeUser('editor', 'gone@example.com');
    await User.updateOne({ email: 'gone@example.com' }, { isActive: false });
    const res = await anon(ctx.app).post('/api/auth/login').send({ email: 'gone@example.com', password: PASSWORD });
    expect(res.status).toBe(401);
  });
});

describe('role-based authorization is enforced on the server', () => {
  it('editor can write content but cannot see staff accounts or the audit log', async () => {
    const editor = await loginAs(ctx.app, 'editor');
    expect((await editor.post('/api/admin/pillars').send({ kicker: 'K', title: 'T', description: 'D', to: '/x' })).status).toBe(201);
    expect((await editor.get('/api/admin/users')).status).toBe(403);
    expect((await editor.get('/api/admin/audit')).status).toBe(403);
  });

  it('editor cannot change site-wide admin-only settings (navigation, membership, legal)', async () => {
    const editor = await loginAs(ctx.app, 'editor');
    expect((await editor.post('/api/admin/navigation').send({ location: 'main', label: 'X', to: '/x' })).status).toBe(403);
    expect((await editor.post('/api/admin/membership-plans').send({ name: 'P', monthlyPrice: 100 })).status).toBe(403);
    expect((await editor.put('/api/admin/site-settings').send({ siteName: 'Hacked' })).status).toBe(403);
  });

  it('support can work the inbox but cannot create or edit content', async () => {
    const support = await loginAs(ctx.app, 'support');
    expect((await support.get('/api/admin/contact-messages')).status).toBe(200);
    expect((await support.post('/api/admin/videos').send({ title: 'x', kind: 'film', access: 'free' })).status).toBe(403);
    expect((await support.get('/api/admin/media')).status).toBe(403);
  });

  it('only superadmin can manage users', async () => {
    const admin = await loginAs(ctx.app, 'admin');
    expect((await admin.get('/api/admin/users')).status).toBe(403);
    const sup = await loginAs(ctx.app, 'superadmin');
    expect((await sup.get('/api/admin/users')).status).toBe(200);
  });

  it('role changes in the database take effect immediately (the token carries no role)', async () => {
    const agent = await loginAs(ctx.app, 'editor');
    expect((await agent.post('/api/admin/pillars').send({ kicker: 'K', title: 'T2', description: 'D', to: '/x' })).status).toBe(201);
    await User.updateOne({ email: 'editor@example.com' }, { role: 'support' });
    expect((await agent.post('/api/admin/pillars').send({ kicker: 'K', title: 'T3', description: 'D', to: '/x' })).status).toBe(403);
    await User.updateOne({ email: 'editor@example.com' }, { role: 'editor' });
  });

  it('deactivating a user ends their existing session', async () => {
    const agent = await loginAs(ctx.app, 'support');
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    await User.updateOne({ email: 'support@example.com' }, { isActive: false });
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    await User.updateOne({ email: 'support@example.com' }, { isActive: true });
  });

  it('a user cannot make themselves an administrator by sending a role in a request', async () => {
    const editor = await loginAs(ctx.app, 'editor');
    // Role/ownership fields are not part of any content validator, so they are stripped.
    const res = await editor.post('/api/admin/pillars').send({ kicker: 'K', title: 'Sneaky', description: 'D', to: '/x', role: 'superadmin', createdBy: '000000000000000000000000' });
    expect(res.status).toBe(201);
    const doc = await modelOf('pillar').findById(res.body.id).lean();
    expect(String((doc as Record<string, any>).createdBy)).not.toBe('000000000000000000000000');
    expect((doc as Record<string, any>).role).toBeUndefined();
    expect((await editor.get('/api/auth/me')).body.user.role).toBe('editor');
  });
});

describe('request hardening', () => {
  it('rejects state-changing requests from a foreign Origin', async () => {
    const agent = await loginAs(ctx.app, 'editor');
    const res = await agent.post('/api/admin/pillars').set('Origin', 'https://evil.example').send({ kicker: 'K', title: 'T', description: 'D', to: '/x' });
    expect(res.status).toBe(403);
  });

  it('accepts the configured frontend origin', async () => {
    const agent = await loginAs(ctx.app, 'editor');
    const res = await agent.post('/api/admin/pillars').set('Origin', 'http://localhost:5173').send({ kicker: 'K', title: 'T-ok', description: 'D', to: '/x' });
    expect(res.status).toBe(201);
  });

  it('returns field-level validation errors, not stack traces', async () => {
    const editor = await loginAs(ctx.app, 'editor');
    const res = await editor.post('/api/admin/pillars').send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.fields).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.ts/);
  });
});

describe('first administrator bootstrap', () => {
  it('requires the server-side token', async () => {
    await User.deleteMany({});
    const bad = await anon(ctx.app).post('/api/auth/bootstrap').set('x-bootstrap-token', 'wrong').send({ email: 'a@b.co', name: 'A', password: 'Valid-Password1' });
    expect(bad.status).toBe(403);
    const none = await anon(ctx.app).post('/api/auth/bootstrap').send({ email: 'a@b.co', name: 'A', password: 'Valid-Password1' });
    expect(none.status).toBe(403);
  });

  it('creates exactly one superadmin and then permanently closes', async () => {
    const ok = await anon(ctx.app).post('/api/auth/bootstrap').set('x-bootstrap-token', 'bootstrap-token-123').send({ email: 'first@example.com', name: 'First', password: 'Valid-Password1' });
    expect(ok.status).toBe(201);
    expect((await User.findOne({ email: 'first@example.com' }))?.role).toBe('superadmin');
    const again = await anon(ctx.app).post('/api/auth/bootstrap').set('x-bootstrap-token', 'bootstrap-token-123').send({ email: 'second@example.com', name: 'Second', password: 'Valid-Password1' });
    expect(again.status).toBe(409);
  });

  it('enforces a strong password', async () => {
    await User.deleteMany({});
    const weak = await anon(ctx.app).post('/api/auth/bootstrap').set('x-bootstrap-token', 'bootstrap-token-123').send({ email: 'w@example.com', name: 'W', password: 'short' });
    expect(weak.status).toBe(400);
  });
});

describe('staff account management', () => {
  it('creates, edits and protects accounts (cannot demote/deactivate yourself or the last superadmin)', async () => {
    await User.deleteMany({});
    const sup = await loginAs(ctx.app, 'superadmin');
    const created = await sup.post('/api/admin/users').send({ email: 'new@example.com', name: 'New Editor', role: 'editor', password: 'Another-Pass1' });
    expect(created.status).toBe(201);
    expect(JSON.stringify(created.body)).not.toMatch(/passwordHash/);
    const me = (await sup.get('/api/auth/me')).body.user.id as string;
    expect((await sup.patch(`/api/admin/users/${me}`).send({ role: 'admin' })).status).toBe(400);
    expect((await sup.patch(`/api/admin/users/${me}`).send({ isActive: false })).status).toBe(400);
    const weak = await sup.post('/api/admin/users').send({ email: 'weak@example.com', name: 'Weak', role: 'editor', password: 'weak' });
    expect(weak.status).toBe(400);
  });

  it('a password reset signs the affected user out everywhere', async () => {
    const sup = await loginAs(ctx.app, 'superadmin');
    await makeUser('editor', 'victim@example.com');
    const victim = supertest.agent(ctx.app);
    await victim.post('/api/auth/login').send({ email: 'victim@example.com', password: PASSWORD });
    expect((await victim.get('/api/auth/me')).status).toBe(200);
    const id = String((await User.findOne({ email: 'victim@example.com' }))!._id);
    expect((await sup.post(`/api/admin/users/${id}/reset-password`).send({ password: 'Brand-New-Pass1' })).status).toBe(200);
    expect((await victim.get('/api/auth/me')).status).toBe(401);
  });
});

});
