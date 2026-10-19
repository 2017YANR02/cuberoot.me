import { afterEach, describe, expect, it, vi } from 'vitest';
import { contestsRoutes } from '../src/routes/contests';

afterEach(() => vi.unstubAllGlobals());
describe('Contests read-only gateway', () => {
  it('forwards only validated queries to the fixed origin, without credentials', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: [{ eventId: 'fto' }] }));
    vi.stubGlobal('fetch', fetcher);
    const result = await contestsRoutes.request('/contests?view=rankings&event=fto&region=CN&url=https://evil.invalid&v=1', {
      headers: { Authorization: 'Bearer private', Cookie: 'session=private' },
    });
    expect(result.status).toBe(200);
    const [url, options] = fetcher.mock.calls[0];
    expect(String(url)).toBe('https://contests.cuberoot.me/api/default/cuberoot?view=rankings&event=fto&region=CN');
    expect(options.headers).toEqual({ Accept: 'application/json' });
    expect(options.redirect).toBe('error');
    expect(result.headers.get('cache-control')).toBe('public, max-age=300, s-maxage=300');
  });
  it('rejects traversal and excessive pagination without fetching', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    for (const query of ['view=contest&id=../admin', 'view=persons&offset=100001', 'view=enter-attempt']) {
      expect((await contestsRoutes.request(`/contests?${query}`)).status).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect((await contestsRoutes.request('/contests?view=persons', { method: 'POST' })).status).toBe(404);
  });
  it('does not cache failures or empty data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ data: [] }))
      .mockResolvedValueOnce(new Response('internal details', { status: 500 })));
    const empty = await contestsRoutes.request('/contests?view=persons');
    expect(empty.headers.get('cache-control')).toBe('no-store');
    const failed = await contestsRoutes.request('/contests?view=persons');
    expect(failed.status).toBe(502);
    expect(failed.headers.get('cache-control')).toBe('no-store');
    expect(await failed.text()).not.toContain('internal details');
  });
});
