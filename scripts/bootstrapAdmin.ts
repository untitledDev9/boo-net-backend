import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../src/db/models.js';
import { passwordRule } from '../src/routes/auth.js';

/**
 * Creates the first administrator. Reads credentials from ADMIN_EMAIL / ADMIN_PASSWORD (set them in
 * backend/.env or the shell, run once, then remove them). Refuses to run if any user already exists.
 */
const uri = process.env.MONGODB_URI;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || 'Administrator';

if (!uri) fail('MONGODB_URI is not set.');
if (!email || !password) fail('Set ADMIN_EMAIL and ADMIN_PASSWORD (and optionally ADMIN_NAME) first.');

const check = passwordRule.safeParse(password);
if (!check.success) fail(check.error.issues.map((i) => i.message).join('; '));

await mongoose.connect(uri!);
if ((await User.countDocuments()) > 0) {
  await mongoose.disconnect();
  fail('An account already exists. Create further staff accounts from /sharp/users instead.');
}
await User.create({ email: email!, name, role: 'superadmin', passwordHash: await bcrypt.hash(password!, 12) });
console.log(`Created superadmin ${email}. You can now sign in at /sharp. Remove ADMIN_PASSWORD from your environment.`);
await mongoose.disconnect();

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}
