import { Hono } from 'hono';
import { platformErrorHandler } from './errors.js';

export function platformRouter(): Hono {
  const router = new Hono();
  router.onError(platformErrorHandler);
  return router;
}

export function publicCache(c: { header(name: string, value: string): void }, hasRows = true): void {
  c.header('Cache-Control', hasRows ? 'public, max-age=60, s-maxage=300' : 'no-store');
}

export function privateNoStore(c: { header(name: string, value: string): void }): void {
  c.header('Cache-Control', 'private, no-store');
}
