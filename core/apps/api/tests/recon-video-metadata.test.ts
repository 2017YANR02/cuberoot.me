import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/db/connection.js', () => ({ query: vi.fn() }));
import { reconRoutes } from '../src/routes/recon.js';
const app = new Hono().route('/v1', reconRoutes);

afterEach(() => vi.unstubAllGlobals());
describe('Bilibili cover metadata', () => {
  it('returns the original title and HTTPS cover without the rejected browser headers', async () => {
    const fetcher = vi.fn(async () => Response.json({ data: { pic: 'http://i0.hdslb.com/cover.jpg', title: '比赛视频标题' } }));
    vi.stubGlobal('fetch', fetcher);
    const response = await app.request('/v1/recon/bili-cover?bvid=BV1qppd65EY1');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pic: 'https://i0.hdslb.com/cover.jpg', title: '比赛视频标题' });
    expect(fetcher.mock.calls[0]).toEqual([
      'https://api.bilibili.com/x/web-interface/view?bvid=BV1qppd65EY1', { signal: expect.any(AbortSignal) },
    ]);
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600, s-maxage=86400');
  });

  it('does not cache upstream failures or send invalid video IDs upstream', async () => {
    const fetcher = vi.fn(async () => new Response('Risk control', { status: 412 }));
    vi.stubGlobal('fetch', fetcher);
    expect((await app.request('/v1/recon/bili-cover?bvid=invalid')).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
    const response = await app.request('/v1/recon/bili-cover?bvid=BV1qppd65EY1');
    expect(response.status).toBe(502);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
