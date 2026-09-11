import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SITE_DIRECTORY_GROUPS } from '@cuberoot/shared/site-directory';
import { proxy } from '@/proxy';
import { matchingHomeCards, PAGE_SESSION_COOKIE } from '@/lib/home-card-access';

afterEach(() => vi.unstubAllGlobals());
const user = { uid: 1, wcaId: null, name: 'Fixture', avatar: '', isAdmin: true };
function mockApi(locks: Record<string, boolean>, admin = false, status = 200) {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/home-locks')
    ? Response.json({ locks }) : Response.json({ user: { ...user, isAdmin: admin } }, { status }));
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
const cards = SITE_DIRECTORY_GROUPS.flatMap((group) => [...group.entries]).filter((card) => card.internal);

describe('homepage locks protect document and RSC routes', () => {
  it.each(cards)('protects $id, both languages and descendants', async (card) => {
    mockApi({ [card.id]: true });
    const target = new URL(card.href, 'https://cuberoot.me');
    for (const prefix of ['', '/en', '/zh']) {
      for (const suffix of ['', '/private-child', '/private-child.json']) {
        const url = `https://cuberoot.me${prefix}${target.pathname}${suffix}${target.search}`;
        const response = await proxy(new NextRequest(url, { headers: { RSC: '1' } }));
        expect(response.status, url).toBe(307);
        expect(new URL(response.headers.get('location')!).pathname).toBe('/auth/page-access');
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
        expect(response.headers.get('x-middleware-next')).toBeNull();
      }
    }
  });
  it.each([false, true])('only admits the server-confirmed admin=%s', async (admin) => {
    const fetcher = mockApi({ 'comp-sim': true }, admin);
    const response = await proxy(new NextRequest('https://cuberoot.me/zh/comp-sim', {
      headers: { cookie: `${PAGE_SESSION_COOKIE}=fixture-session` },
    }));
    expect(response.status).toBe(admin ? 200 : 307);
    expect(fetcher).toHaveBeenLastCalledWith(expect.stringContaining('/v1/auth/me'), expect.objectContaining({
      headers: { Authorization: 'Bearer fixture-session' }, cache: 'no-store',
    }));
  });
  it('rejects forged and expired credentials', async () => {
    mockApi({ 'comp-sim': true }, true, 401);
    expect((await proxy(new NextRequest('https://cuberoot.me/zh/comp-sim', {
      headers: { cookie: `${PAGE_SESSION_COOKIE}=forged` },
    }))).status).toBe(307);
  });
  it('applies unlocking immediately, including default locks', async () => {
    mockApi({ platform: false, 'comp-sim': false });
    for (const path of ['/zh/platform/events/online', '/zh/comp-sim']) {
      expect((await proxy(new NextRequest(`https://cuberoot.me${path}`))).status).toBe(200);
    }
  });
  it('keeps locked ancestors effective even if the child card is unlocked', async () => {
    mockApi({ platform: true, 'online-competitions': false });
    expect((await proxy(new NextRequest('https://cuberoot.me/zh/platform/events/online'))).status).toBe(307);
  });
  it('matches path boundaries and query-specific cards without locking unrelated pages', () => {
    expect(matchingHomeCards(new URL('https://cuberoot.me/zh/comp-similar'))).toEqual([]);
    expect(matchingHomeCards(new URL('https://cuberoot.me/zh/docs/edit?id=other')).map((c) => c.id)).toEqual(['documents']);
  });
  it.each([null, { locks: null }, { locks: { 'comp-sim': 'false' } }])('fails closed for malformed lock state %j', async (data) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(data)));
    expect((await proxy(new NextRequest('https://cuberoot.me/zh/comp-sim'))).status).toBe(503);
  });
  it('fails closed on network failure while leaving homepage and sign-in available', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect((await proxy(new NextRequest('https://cuberoot.me/zh/comp-sim'))).status).toBe(503);
    for (const path of ['/zh', '/zh/account', '/auth/page-access']) {
      expect((await proxy(new NextRequest(`https://cuberoot.me${path}`))).status).toBe(200);
    }
  });
});
