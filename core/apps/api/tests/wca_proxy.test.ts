import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { wcaProxyRoutes } from '../src/routes/wca_proxy';

const app = new Hono().route('/v1', wcaProxyRoutes);
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('WCA conditional egress', () => {
  it('forwards validators without disclosing the proxy secret, and returns bodyless 304', async () => {
    vi.stubEnv('WCA_PROXY_SECRET', 'test-secret');
    const upstream = vi.fn(async () => new Response(null, { status: 304, headers: { etag: '"v1"' } }));
    vi.stubGlobal('fetch', upstream);
    const result = await app.request('/v1/wca-proxy/api/v0/competitions/OC2026', {
      headers: { 'X-Proxy-Secret': 'test-secret', 'If-None-Match': '"v1"' },
    });
    expect(result.status).toBe(304);
    expect(await result.text()).toBe('');
    expect(result.headers.get('etag')).toBe('"v1"');
    expect(result.headers.get('cache-control')).toBe('no-store');
    const [, options] = upstream.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(options.headers);
    expect(headers.get('If-None-Match')).toBe('"v1"');
    expect(headers.has('X-Proxy-Secret')).toBe(false);
  });

  it('allows only the exact lightweight index and retains upstream retry timing', async () => {
    vi.stubEnv('WCA_PROXY_SECRET', 'test-secret');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429, headers: { 'retry-after': '60' } })));
    const headers = { 'X-Proxy-Secret': 'test-secret' };
    const result = await app.request('/v1/wca-proxy/api/v0/competition_index?page=1', { headers });
    expect(result.status).toBe(429);
    expect(result.headers.get('retry-after')).toBe('60');
    expect((await app.request('/v1/wca-proxy/api/v0/competition_index/other', { headers })).status).toBe(403);
    expect((await app.request('/v1/wca-proxy/api/v0/competition_index')).status).toBe(403);
  });
});
