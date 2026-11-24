import { z } from 'zod';

const boolish = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_DAYS: z.coerce.number().positive().default(7),
  COOKIE_SECURE: boolish,
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  BOOTSTRAP_TOKEN: z.string().optional(),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
});

export interface Env {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  mongodbUri?: string;
  jwtSecret: string;
  jwtExpiresDays: number;
  cookieSecure: boolean;
  clientOrigins: string[];
  cloudinary: { cloudName: string; apiKey: string; apiSecret: string } | null;
  bootstrapToken?: string;
  adminEmail?: string;
  adminPassword?: string;
  /** Push signing keys. Optional: when unset they are generated once and stored in the database. */
  vapid: { publicKey: string; privateKey: string; subject?: string } | null;
}

const DEV_SECRET = 'dev-only-insecure-secret-change-me-please';

/** Parse and validate environment variables. Throws a readable error in production if something unsafe is missing. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = schema.parse(source);
  const production = parsed.NODE_ENV === 'production';

  if (production && (!parsed.JWT_SECRET || parsed.JWT_SECRET.length < 32)) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production.');
  }
  if (production && !parsed.MONGODB_URI) {
    throw new Error('MONGODB_URI must be set in production.');
  }

  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = parsed;
  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    mongodbUri: parsed.MONGODB_URI,
    jwtSecret: parsed.JWT_SECRET ?? DEV_SECRET,
    jwtExpiresDays: parsed.JWT_EXPIRES_DAYS,
    cookieSecure: parsed.COOKIE_SECURE ?? production,
    clientOrigins: parsed.CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
    cloudinary: cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null,
    bootstrapToken: parsed.BOOTSTRAP_TOKEN,
    adminEmail: parsed.ADMIN_EMAIL,
    adminPassword: parsed.ADMIN_PASSWORD,
    vapid: parsed.VAPID_PUBLIC_KEY && parsed.VAPID_PRIVATE_KEY ? { publicKey: parsed.VAPID_PUBLIC_KEY, privateKey: parsed.VAPID_PRIVATE_KEY, subject: parsed.VAPID_SUBJECT } : null,
  };
}
