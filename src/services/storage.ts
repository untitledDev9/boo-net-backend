import { randomUUID } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import type { Env } from '../config/env.js';
import { HttpError } from '../middleware/errors.js';

export interface UploadResult {
  provider: 'cloudinary' | 'stub';
  publicId: string;
  url: string;
  secureUrl: string;
  width?: number;
  height?: number;
  bytes: number;
  format?: string;
}

export interface MediaStorage {
  readonly name: 'cloudinary' | 'stub' | 'unconfigured';
  upload(buffer: Buffer, opts: { folder: string; publicId?: string; mimeType: string }): Promise<UploadResult>;
  destroy(publicId: string): Promise<void>;
}

export class CloudinaryStorage implements MediaStorage {
  readonly name = 'cloudinary' as const;
  constructor(cfg: { cloudName: string; apiKey: string; apiSecret: string }) {
    cloudinary.config({ cloud_name: cfg.cloudName, api_key: cfg.apiKey, api_secret: cfg.apiSecret, secure: true });
  }

  upload(buffer: Buffer, opts: { folder: string; publicId?: string }): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: opts.publicId ? undefined : `boosie-network/${opts.folder}`,
          public_id: opts.publicId,
          overwrite: Boolean(opts.publicId),
          invalidate: Boolean(opts.publicId),
          resource_type: 'image',
        },
        (err, result) => {
          if (err || !result) return reject(new HttpError(502, `Cloudinary upload failed: ${err?.message ?? 'unknown error'}`));
          resolve({
            provider: 'cloudinary',
            publicId: result.public_id,
            url: result.url,
            secureUrl: result.secure_url,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            format: result.format,
          });
        },
      );
      stream.end(buffer);
    });
  }

  async destroy(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
  }
}

/** Used when no Cloudinary credentials are configured: uploads fail with a clear message. */
export class UnconfiguredStorage implements MediaStorage {
  readonly name = 'unconfigured' as const;
  upload(): Promise<UploadResult> {
    throw new HttpError(503, 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in backend/.env.');
  }
  async destroy(): Promise<void> {
    /* nothing to remove */
  }
}

/** In-memory storage for automated tests and the local demo server. Never used in production. */
export class StubStorage implements MediaStorage {
  readonly name = 'stub' as const;
  readonly files = new Map<string, { buffer: Buffer; mimeType: string }>();
  destroyed: string[] = [];

  async upload(buffer: Buffer, opts: { folder: string; publicId?: string; mimeType: string }): Promise<UploadResult> {
    const publicId = opts.publicId ?? `boosie-network/${opts.folder}/${randomUUID()}`;
    const version = Date.now();
    this.files.set(publicId, { buffer, mimeType: opts.mimeType });
    const url = `/api/dev-media/${encodeURIComponent(publicId)}?v=${version}`;
    return { provider: 'stub', publicId, url, secureUrl: url, width: 100, height: 100, bytes: buffer.length, format: opts.mimeType.split('/')[1] };
  }

  async destroy(publicId: string): Promise<void> {
    this.destroyed.push(publicId);
    this.files.delete(publicId);
  }
}

export function createStorage(env: Env): MediaStorage {
  return env.cloudinary ? new CloudinaryStorage(env.cloudinary) : new UnconfiguredStorage();
}
