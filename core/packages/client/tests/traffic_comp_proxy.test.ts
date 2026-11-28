import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPETITION_ACCESS_COOKIE, COMPETITION_SERVICE_HEADER, createCompetitionProof, verifyCompetitionProof } from '@cuberoot/shared/competition-access';
import { GET } from '@/app/api/comp/[slug]/route';
import { competitionOnlyVerificationEnabled, trafficDefenseEnabled } from '@/lib/traffic-defense';
vi.mock('@/lib/traffic-defense', () => ({
  trafficDefenseEnabled: vi.fn(async () => true),
  competitionOnlyVerificationEnabled: vi.fn(async () => false),
}));

beforeEach(() => { vi.stubEnv('COMPETITION_ACCESS_SECRET', 's'.repeat(32)); vi.mocked(trafficDefenseEnabled).mockResolvedValue(true); vi.mocked(competitionOnlyVerificationEnabled).mockResolvedValue(false); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const request = (query = '', headers?: HeadersInit) => GET(
  new Request(`https://cuberoot.me/api/comp/TestComp2026${query}`, { headers }),
  { params: Promise.resolve({ slug: 'TestComp2026' }) },
);

describe('competition proxy query budget', () => {
  it('allows anonymous development proxy requests in open mode', async () => {
    vi.stubEnv('COMPETITION_ACCESS_SECRET', '');
    vi.mocked(trafficDefenseEnabled).mockResolvedValue(false);
    const upstream = vi.fn(async () => Response.json({ events: [] })); vi.stubGlobal('fetch', upstream);
    expect((await request()).status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(1);
  });
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
    const service = await createCompetitionProof('s'.repeat(32), 'service', '/api/comp/TestComp2026?v=4&only=333');
    const response = await request('?v=4&only=333', { [COMPETITION_SERVICE_HEADER]: service });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledWith(
      'https://api.cuberoot.me/v1/cubing-live/TestComp2026?v=4&only=333',
      expect.any(Object),
    );
    const headers = (upstream.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Headers;
    expect(await verifyCompetitionProof('s'.repeat(32), headers.get(COMPETITION_SERVICE_HEADER)!, 'service', '/v1/cubing-live/TestComp2026?v=4&only=333')).toBe(true);
  });

  it('never elevates a browser to an internal service and preserves the session limit', async () => {
    const proof = await createCompetitionProof('s'.repeat(32), 'browser', 'visitor');
    const upstream = vi.fn(async (_url: string, _options: RequestInit) =>
      Response.json({ code: 'competition_session_limited' }, { status: 429, headers: { 'retry-after': '45' } }));
    vi.stubGlobal('fetch', upstream);
    const response = await request('', { cookie: `unrelated=private; ${COMPETITION_ACCESS_COOKIE}=${proof}`, 'user-agent': 'visitor' });
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('45');
    const headers = new Headers(upstream.mock.calls[0][1].headers);
    expect(headers.get(COMPETITION_SERVICE_HEADER)).toBeNull();
    expect(headers.get('x-cuberoot-relay-visitor')).toBe('1');
    expect(headers.get('cookie')).toBe(`${COMPETITION_ACCESS_COOKIE}=${proof}`);
    expect(headers.get('user-agent')).toBe('visitor');
  });

  it('denies an unverified visitor and a mismatched internal proof even with a signing key installed', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const other = await createCompetitionProof('s'.repeat(32), 'service', '/api/comp/Other');
    expect((await request()).status).toBe(403);
    expect((await request('', { [COMPETITION_SERVICE_HEADER]: other })).status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('signs an upstream path for verified Google Search but rejects a visitor claiming its user agent', async () => {
    vi.stubEnv('VERCEL', '1');
    const fetcher = vi.fn(async (url: string, _options?: RequestInit) => url.includes('/ipranges/')
      ? Response.json({ prefixes: [{ ipv4Prefix: '192.0.2.0/24' }] })
      : Response.json({ events: [] }));
    vi.stubGlobal('fetch', fetcher);
    expect((await request('', { 'user-agent': 'Googlebot', 'x-forwarded-for': '192.0.2.8' })).status).toBe(403);
    const result = await request('', { 'user-agent': 'Googlebot', 'x-vercel-forwarded-for': '192.0.2.8' });
    expect(result.status).toBe(200);
    const headers = new Headers(fetcher.mock.calls.at(-1)?.[1]?.headers);
    expect(await verifyCompetitionProof('s'.repeat(32), headers.get(COMPETITION_SERVICE_HEADER)!, 'service', '/v1/cubing-live/TestComp2026?v=4')).toBe(true);
  });

  it('requires verification even from an exempt site region when global results protection is active', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.mocked(competitionOnlyVerificationEnabled).mockResolvedValue(true);
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const result = await request('', { 'x-vercel-ip-country': 'CN' });
    expect(result.status).toBe(403);
    expect(await result.json()).toMatchObject({ scope: 'competition' });
    expect(upstream).not.toHaveBeenCalled();
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
