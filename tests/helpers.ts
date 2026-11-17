import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { User } from '../src/db/models.js';
import { StubStorage } from '../src/services/storage.js';

export const PASSWORD = 'Sup3rSecret-pass';

/** True when a MongoDB is available for the database-backed tests. */
export const DB_AVAILABLE = !process.env.TEST_DB_UNAVAILABLE;

/** Minimal valid 1x1 PNG and JPEG headers for upload tests. */
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHTdqjQAAAABJRU5ErkJggg==', 'base64');
export const PNG2 = Buffer.concat([PNG, Buffer.from([0])]);

export async function startTestApp(dbName: string, bootstrapToken?: string) {
  await mongoose.connect(process.env.TEST_MONGO_URI!, { dbName });
  await mongoose.connection.dropDatabase();
  const storage = new StubStorage();
  const env = loadEnv({
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-test-secret-test-secret-123',
    CLIENT_ORIGIN: 'http://localhost:5173',
    ...(bootstrapToken ? { BOOTSTRAP_TOKEN: bootstrapToken } : {}),
  });
  const app = createApp({ env, storage, loginLimit: 1000 });
  return { app, storage, env };
}

export async function stopTestApp() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

export async function makeUser(role: 'superadmin' | 'admin' | 'editor' | 'support', email = `${role}@example.com`) {
  return User.create({ email, name: `${role} user`, role, passwordHash: await bcrypt.hash(PASSWORD, 4) });
}

/** A supertest agent that keeps the session cookie, signed in as the given role. */
export async function loginAs(app: ReturnType<typeof createApp>, role: 'superadmin' | 'admin' | 'editor' | 'support') {
  const email = `${role}@example.com`;
  if (!(await User.findOne({ email }))) await makeUser(role, email);
  const agent = supertest.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${role}: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export const anon = (app: ReturnType<typeof createApp>) => supertest(app);
