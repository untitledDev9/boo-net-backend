import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { loadEnv, type Env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { publicChatRouter } from './routes/chat.js';
import { publicRouter } from './routes/public.js';
import { createStorage, StubStorage, type MediaStorage } from './services/storage.js';

export interface AppOptions {
  env?: Env;
  storage?: MediaStorage;
  loginLimit?: number;
}

export function createApp(options: AppOptions = {}): Express {
  const env = options.env ?? loadEnv();
  const storage = options.storage ?? createStorage(env);
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    // ok = the process is serving requests (use this for Render's health check); db = Mongo connection state.
    res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', storage: storage.name, uptime: Math.round(process.uptime()) });
  });

  // Development/test only: serve files held by the in-memory stub storage.
  if (storage instanceof StubStorage) {
    const stub = storage;
    app.get('/api/dev-media/:id', (req, res) => {
      const file = stub.files.get(decodeURIComponent(String(req.params.id)));
      if (!file) {
        res.status(404).end();
        return;
      }
      res.type(file.mimeType).send(file.buffer);
    });
  }

  app.use('/api/public/chat', publicChatRouter());
  app.use('/api/public', publicRouter());
  app.use('/api/auth', authRouter(env, { loginLimit: options.loginLimit }));
  app.use('/api/admin', adminRouter(env, storage));

  app.use(notFound);
  app.use(errorHandler(env.nodeEnv === 'production'));
  return app;
}
