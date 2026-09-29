import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPETITION_ACCESS_COOKIE, COMPETITION_SERVICE_HEADER, verifyCompetitionProof } from '@cuberoot/shared/competition-access';
import { GET } from '@/app/api/comp/[slug]/route';

beforeEach(() => vi.stubEnv('COMPETITION_ACCESS_SECRET', 's'.repeat(32)));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

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
    const headers = (upstream.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Headers;
    expect(await verifyCompetitionProof('s'.repeat(32), headers.get(COMPETITION_SERVICE_HEADER)!, 'service', '/v1/cubing-live/TestComp2026?v=4&only=333')).toBe(true);
  });

  it('does not repeatedly contact the protected API without a proof', async () => {
    vi.stubEnv('COMPETITION_ACCESS_SECRET', '');
    const upstream = vi.fn(); vi.stubGlobal('fetch', upstream);
    expect((await request()).status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('relays only the existing browser proof and bound UA when no signing secret is configured', async () => {
    vi.stubEnv('COMPETITION_ACCESS_SECRET', '');
    const upstream = vi.fn(async () => Response.json({ events: [] })); vi.stubGlobal('fetch', upstream);
    const response = await GET(new Request('http://localhost:3000/api/comp/TestComp2026', {
      headers: { cookie: `private_session=secret; ${COMPETITION_ACCESS_COOKIE}=browser-proof`, 'user-agent': 'test-browser' },
    }), { params: Promise.resolve({ slug: 'TestComp2026' }) });
    expect(response.status).toBe(200);
    const headers = (upstream.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Headers;
    expect(headers.get('cookie')).toBe(`${COMPETITION_ACCESS_COOKIE}=browser-proof`);
    expect(headers.get('user-agent')).toBe('test-browser');
    expect(headers.has(COMPETITION_SERVICE_HEADER)).toBe(false);
  });
});
