import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('page verification diagnostics', () => {
  it('correlates upstream timeout and 503 without exposing request data', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetcher = vi.fn(async () => { throw new DOMException('private-error', 'TimeoutError'); });
    vi.stubGlobal('fetch', fetcher);
    const result = await proxy(new NextRequest('https://cuberoot.me/zh/timer?secret=private-query', {
      headers: { cookie: 'cuberoot_page_session=private-cookie' },
    }));
    expect(result.status).toBe(503);
    expect(result.headers.get('Cache-Control')).toBe('private, no-store');
    const options = (fetcher.mock.calls as unknown as [unknown, RequestInit][])[0][1];
    const id = new Headers(options.headers).get('X-Request-ID');
    expect(result.headers.get('X-Request-ID')).toBe(id);
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ event: 'page_access', requestId: id, stage: 'home-locks', failed: true, errorType: 'TimeoutError', stepsMs: { 'home-locks': expect.any(Number) } });
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-');
  });
  it('propagates the same ID through lock and administrator verification', async () => {
    const fetcher = vi.fn(async (url: string) => url.endsWith('/home-locks')
      ? Response.json({ locks: { 'comp-sim': true } }) : Response.json({ user: { uid: 1, name: 'Fixture', avatar: '', wcaId: null, isAdmin: true } }));
    vi.stubGlobal('fetch', fetcher);
    const result = await proxy(new NextRequest('https://cuberoot.me/zh/comp-sim', { headers: { cookie: 'cuberoot_page_session=fixture' } }));
    expect(result.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const ids = (fetcher.mock.calls as unknown as [unknown, RequestInit][]).map(([, options]) => new Headers(options.headers).get('X-Request-ID'));
    expect(ids).toEqual([result.headers.get('X-Request-ID'), result.headers.get('X-Request-ID')]);
  });
  it('reports upstream status while keeping malformed permissions closed', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ locks: { timer: 'false' } })));
    expect((await proxy(new NextRequest('https://cuberoot.me/zh/timer'))).status).toBe(503);
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ failed: true, homeLocksStatus: 200 });
  });
});
