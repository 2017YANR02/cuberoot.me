import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SITE_DIRECTORY_GROUPS } from '@cuberoot/shared/site-directory';
import { proxy } from '@/proxy';

afterEach(() => vi.unstubAllGlobals());
const cards = SITE_DIRECTORY_GROUPS.flatMap(group => [...group.entries])
  .filter(card => card.internal);

describe('homepage visibility does not restrict page delivery', () => {
  it.each(cards)('serves $id without an API dependency, including descendants and RSC', async card => {
    const fetcher = vi.fn(async () => { throw new Error('permissions API offline'); });
    vi.stubGlobal('fetch', fetcher);
    const target = new URL(card.href, 'https://cuberoot.me');
    for (const prefix of ['', '/en', '/zh']) {
      for (const suffix of ['', '/child', '/child.json']) {
        for (const cookie of ['', 'cuberoot_page_session=expired']) {
          const response = await proxy(new NextRequest(`https://cuberoot.me${prefix}${target.pathname}${suffix}${target.search}`, {
            headers: { RSC: '1', cookie },
          }));
          expect(response.status).toBe(200);
          expect(response.headers.get('location')).toBeNull();
          expect(response.headers.get('X-Request-ID')).toBeNull();
        }
      }
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([{ timer: true }, { timer: false }, { timer: 'invalid' }])('does not consult homepage lock state %j', async locks => {
    const fetcher = vi.fn(async () => Response.json({ locks }));
    vi.stubGlobal('fetch', fetcher);
    expect((await proxy(new NextRequest('https://cuberoot.me/zh/timer'))).status).toBe(200);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
