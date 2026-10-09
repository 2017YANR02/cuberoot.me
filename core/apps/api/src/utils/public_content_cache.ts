import { createHash } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { query } from '../db/connection.js';

// Only these reviewed, viewer-independent JSON reads may share a response.
// No blanket /v1 cache: account, teacher, draft and permission data stay outside.
export function publicContentDomain(path: string, params: URLSearchParams): string | null {
  if (/^\/v1\/alg\/sets(?:\/[^/]+\/(?:order|[^/]+))?$/.test(path)) return 'alg';
  if (['/v1/nav/sites', '/v1/nav/topics', '/v1/nav/home-order'].includes(path)) return 'nav';
  if ((path === '/v1/sponsors' && params.get('admin') !== '1') || path === '/v1/contributors') return 'support';
  if (path === '/v1/ops/commands') return 'ops';
  if (path === '/v1/page-notices') return 'notices';
  if (/^\/v1\/recon\/(?:latest|today|\d+\/same-scramble)$/.test(path)) return 'recon';
  if (path === '/v1/creator-gallery/captions') return 'gallery';
  if (path === '/v1/sim-masks' || path === '/v1/sim-masks/layout') return 'sim';
  if (path === '/v1/article' && params.get('mine') !== '1') return 'article';
  return null;
}

type Entry = { revision: string; body: string; etag: string; expires: number; bytes: number };
const MAX_BYTES = 32 * 1024 * 1024;
const MAX_ENTRIES = 256;
const MAX_AGE = 5 * 60_000;
const cacheControl = 'public, no-cache, must-revalidate';

/** One indexed version lookup per request; no repeated full-table read or
 * JSON generation on a cache hit. Versions live in PG, not in a worker-local
 * counter, so writes from another process or direct SQL are visible too. */
export function publicContentCache(): MiddlewareHandler {
  const entries = new Map<string, Entry>();
  let bytes = 0;
  const remove = (key: string) => {
    bytes -= entries.get(key)?.bytes ?? 0;
    entries.delete(key);
  };
  return async (c, next) => {
    if (c.req.method !== 'GET') return next();
    const url = new URL(c.req.url);
    const domain = publicContentDomain(url.pathname, url.searchParams);
    if (!domain) {
      await next();
      // Article details include viewer-dependent canEdit. Never share those.
      if (/^\/v1\/article\/[^/]+$/.test(url.pathname)) c.header('Cache-Control', 'no-store');
      return;
    }
    let revision: string | undefined;
    try {
      const rows = await query<{ revision: string }>(
        'SELECT revision::text FROM public_content_revisions WHERE domain = ?', [domain],
      );
      revision = rows[0]?.revision;
    } catch {
      // Rolling deployment / unavailable version lookup: read through, never
      // serve unchecked cached data. The route still owns DB error handling.
    }
    const key = url.pathname + url.search;
    const now = Date.now();
    const hit = entries.get(key);
    const respond = (entry: Entry) => {
      const validators = (c.req.header('If-None-Match') ?? '').split(',').map(s => s.trim().replace(/^W\//, ''));
      c.header('Cache-Control', cacheControl);
      c.header('ETag', entry.etag);
      if (validators.includes(entry.etag) || validators.includes('*')) {
        c.res = new Response(null, { status: 304, headers: c.res.headers });
      } else {
        c.header('Content-Type', 'application/json; charset=UTF-8');
        c.res = new Response(entry.body, { headers: c.res.headers });
      }
    };
    // Notice schedules change with the clock even without a database write.
    if (revision && domain !== 'notices' && hit?.revision === revision && hit.expires > now) {
      respond(hit);
      return;
    }
    if (hit) remove(key);
    await next();
    if (c.res.status !== 200 || !revision) {
      c.header('Cache-Control', 'no-store');
      return;
    }
    const body = await c.res.clone().text();
    if (body === 'null' || body === '[]' || body === '{}') {
      c.header('Cache-Control', 'no-store');
      return;
    }
    const entry: Entry = {
      revision, body, etag: `"${createHash('sha256').update(body).digest('hex')}"`,
      expires: now + MAX_AGE, bytes: Buffer.byteLength(body),
    };
    if (domain !== 'notices' && entry.bytes <= MAX_BYTES && key.length <= 1024) {
      // Another request may have populated the same key while next() awaited.
      remove(key);
      for (const [oldKey, old] of entries) if (old.expires <= now) remove(oldKey);
      while (entries.size >= MAX_ENTRIES || bytes + entry.bytes > MAX_BYTES) {
        remove(entries.keys().next().value!);
      }
      entries.set(key, entry);
      bytes += entry.bytes;
    }
    respond(entry);
  };
}
