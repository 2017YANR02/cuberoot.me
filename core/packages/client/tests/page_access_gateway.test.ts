import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/page-access/route';
import { pageAccessApiUrl } from '@/lib/page-access-api';
import { proxy } from '@/proxy';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const requestId = '86fab93b-eb3b-4808-ba4c-5c190905cb2c';
const request = (check: string, authorization?: string) => new Request(
  `https://cuberoot-me.vercel.app/api/page-access?check=${encodeURIComponent(check)}`,
  { headers: { 'X-Request-ID': requestId, ...(authorization ? { Authorization: authorization } : {}) } },
);

describe('regional page access gateway', () => {
  it.each(['development', 'preview'])('keeps %s requests on the original API', environment => {
    vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_ENV', environment);
    expect(pageAccessApiUrl('locks')).toBe('https://api.cuberoot.me/v1/nav/home-locks');
    expect(pageAccessApiUrl('session')).toBe('https://api.cuberoot.me/v1/auth/me');
  });
  it('only uses the Vercel-only alias for Vercel production', () => {
    vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_ENV', 'production');
    expect(pageAccessApiUrl('locks')).toBe('https://cuberoot-me.vercel.app/api/page-access?check=locks');
    expect(pageAccessApiUrl('session')).toBe('https://cuberoot-me.vercel.app/api/page-access?check=session');
    vi.stubEnv('VERCEL', '');
    expect(pageAccessApiUrl('locks')).toBe('https://api.cuberoot.me/v1/nav/home-locks');
  });
  it.each(['https://example.com', '/v1/auth/profile', '', 'constructor', '__proto__'])('rejects unsupported target %s', async check => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const response = await GET(request(check));
    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not forward cookies, credentials or arbitrary headers to the locks endpoint', async () => {
    const fetcher = vi.fn(async () => Response.json({ locks: {} })); vi.stubGlobal('fetch', fetcher);
    const input = request('locks', 'Bearer private-token'); input.headers.set('Cookie', 'private-cookie');
    input.headers.set('Host', 'attacker.example');
    await GET(input);
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.cuberoot.me/v1/nav/home-locks');
    expect(Object.fromEntries(new Headers(options.headers))).toEqual({ 'x-request-id': requestId });
    expect(options).toMatchObject({ cache: 'no-store', redirect: 'error' });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it('keeps session tokens isolated and preserves expired/forged-token denial', async () => {
    const fetcher = vi.fn(async () => Response.json({ error: 'Unauthorized' }, { status: 401 }));
    vi.stubGlobal('fetch', fetcher);
    expect((await GET(request('session'))).status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
    for (const token of ['Bearer expired', 'Bearer forged']) {
      const response = await GET(request('session', token));
      expect(response.status).toBe(401);
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      const [url, options] = fetcher.mock.calls.at(-1)! as unknown as [string, RequestInit];
      expect(url).toBe('https://api.cuberoot.me/v1/auth/me');
      expect(new Headers(options.headers).get('Authorization')).toBe(token);
    }
  });
  it('fails closed without disclosing upstream error details', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('private-token'); }));
    const response = await GET(request('locks'));
    expect(response.status).toBe(503);
    expect(response.headers.get('X-Request-ID')).toBe(requestId);
    expect(await response.text()).not.toContain('private-token');
  });
  it('is no longer called by production page delivery', async () => {
    vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_ENV', 'production');
    const fetcher = vi.fn(async () => { throw new Error('gateway unavailable'); });
    vi.stubGlobal('fetch', fetcher);
    for (const path of ['/zh/timer', '/zh/comp-sim', '/zh/partnership']) {
      expect((await proxy(new NextRequest(`https://cuberoot.me${path}`))).status).toBe(200);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});
