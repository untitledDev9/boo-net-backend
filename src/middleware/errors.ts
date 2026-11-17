import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, _res, next) => next(new HttpError(404, 'Not found'));

export function errorHandler(isProduction: boolean): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }
    if (err instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of err.issues) fields[issue.path.join('.') || '_'] = issue.message;
      res.status(400).json({ error: 'Validation failed', fields });
      return;
    }
    const e = err as { code?: number; name?: string; message?: string; keyPattern?: Record<string, unknown>; type?: string };
    if (e?.code === 11000) {
      res.status(409).json({ error: `Duplicate value for ${Object.keys(e.keyPattern ?? {}).join(', ') || 'a unique field'}` });
      return;
    }
    if (e?.name === 'CastError' || e?.name === 'ValidationError') {
      res.status(400).json({ error: isProduction ? 'Invalid request' : (e.message ?? 'Invalid request') });
      return;
    }
    if (e?.type === 'entity.parse.failed' || e?.type === 'entity.too.large') {
      res.status(e.type === 'entity.too.large' ? 413 : 400).json({ error: 'Invalid request body' });
      return;
    }
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: isProduction ? 'Internal server error' : String((err as Error)?.message ?? err) });
  };
}
