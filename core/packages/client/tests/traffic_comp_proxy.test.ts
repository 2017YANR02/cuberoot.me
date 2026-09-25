import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/comp/[slug]/route';

afterEach(() => vi.unstubAllGlobals());

const request = (query = '') => GET(
  new Request(`https://cuberoot.me/api/comp/TestComp2026${query}`),
  { params: Promise.resolve({ slug: 'TestComp2026' }) },
);

describe('competition proxy query budget', () => {
  it('rejects cache-busting variants before contacting the origin', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    for (const query of ['?random=1', '?only=333&only=444', '?only=333%3A' + 'x'.repeat(33), '?v=bad']) {
      const response = await request(query);
      expect(response.status).toBe(400);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it('keeps supported version and event variants working', async () => {
    const upstream = vi.fn(async () => Response.json({ events: [{ rs: [{ s: 1 }] }] }));
    vi.stubGlobal('fetch', upstream);
    const response = await request('?v=4&only=333');
    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledWith(
      'https://api.cuberoot.me/v1/cubing-live/TestComp2026?v=4&only=333',
      expect.any(Object),
    );
  });
});
