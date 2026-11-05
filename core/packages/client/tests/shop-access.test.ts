import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { PLATFORM_SITEMAP_PATHS } from '@/app/sitemap';
import { platformPageMetadata } from '@/lib/platform-metadata';
import { matchPlatformRoute } from '@/lib/platform-routes';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const request = (path: string, token?: string) => new NextRequest(`https://cuberoot.me${path}`, {
  headers: { RSC: '1', ...(token ? { cookie: `cuberoot_page_session=${token}` } : {}) },
});
const account = (isAdmin: boolean) => ({ user: { uid: 1, wcaId: null, name: 'Test', avatar: '', avatarSource: 'auto', avatarPreset: null, isAdmin } });

describe('private shop preview', () => {
  it.each(['/shop', '/zh/shop', '/en/shop/help', '/shop/cart', '/zh/shop/checkout', '/shop/mat.svg', '/zh/%73hop/mat'])('denies anonymous HTML/RSC access to %s without an API call', async path => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const response = await proxy(request(path));
    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(await response.text()).toBe('Not Found');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('checks the server role on every request and never caches a previous administrator grant', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json(account(true)))
      .mockResolvedValueOnce(Response.json(account(false)))
      .mockResolvedValueOnce(Response.json({ error: 'Unauthorized' }, { status: 401 }));
    vi.stubGlobal('fetch', fetcher);
    const admin = await proxy(request('/zh/shop', 'valid-session'));
    expect(admin.status).toBe(200);
    expect(admin.headers.get('x-middleware-next')).toBe('1');
    expect(admin.headers.get('Cache-Control')).toBe('private, no-store');
    expect(admin.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect((await proxy(request('/zh/shop', 'valid-session'))).status).toBe(404);
    expect((await proxy(request('/zh/shop', 'expired-or-forged'))).status).toBe(404);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: 'no-store', redirect: 'error', headers: { Authorization: 'Bearer valid-session' } });
  });

  it('fails closed on unavailable or malformed verification', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(Response.json({ user: { isAdmin: true } }));
    vi.stubGlobal('fetch', fetcher);
    expect((await proxy(request('/shop', 'token'))).status).toBe(404);
    expect((await proxy(request('/shop', 'token'))).status).toBe(404);
  });

  it('removes every shop page from indexing without loading public product metadata', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    for (const segments of [['shop'], ['shop', 'help'], ['shop', 'cubetown-mat'], ['shop', 'cart'], ['shop', 'checkout']]) {
      expect(matchPlatformRoute(segments)?.definition.access).toBe('admin');
      expect((await platformPageMetadata('zh', segments)).robots).toEqual({ index: false, follow: false });
    }
    expect(PLATFORM_SITEMAP_PATHS.filter(path => path === 'shop' || path.startsWith('shop/'))).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
