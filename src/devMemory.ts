/**
 * Throw-away local server: in-memory MongoDB + stub media storage + seeded content + a demo admin.
 * For development and demos only. Requires a machine that can run mongodb-memory-server
 * (on Windows: the Visual C++ Redistributable). Data is lost when the process stops.
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { runSeed } from '../scripts/seed.js';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { User } from './db/models.js';
import { StubStorage } from './services/storage.js';

const mongod = await MongoMemoryServer.create();
await mongoose.connect(mongod.getUri(), { dbName: 'boosie_dev' });
const env = loadEnv({ ...process.env, NODE_ENV: 'development', PORT: process.env.PORT ?? '4000' });
console.log('Seeding content…');
await runSeed({ log: console.log });
const email = 'admin@boosie.test';
const password = 'Admin-Pass-12345';
await User.create({ email, name: 'Demo Admin', role: 'superadmin', passwordHash: await bcrypt.hash(password, 10) });
const app = createApp({ env, storage: new StubStorage() });
app.listen(env.port, () => {
  console.log(`\nDev API (in-memory DB) on http://localhost:${env.port}\n  admin login: ${email} / ${password}\n  uploads use in-memory stub storage (no Cloudinary)`);
});
