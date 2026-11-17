import mongoose from 'mongoose';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';

const env = loadEnv();
if (!env.mongodbUri) {
  // eslint-disable-next-line no-console
  console.error('MONGODB_URI is not set. Copy backend/.env.example to backend/.env and add your connection string (or run `npm run dev:memory` for a throw-away local database).');
  process.exit(1);
}

await mongoose.connect(env.mongodbUri);
const app = createApp({ env });
app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});
