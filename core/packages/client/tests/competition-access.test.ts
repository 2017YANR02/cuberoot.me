import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPETITION_ACCESS_COOKIE, createCompetitionProof, verifyCompetitionProof, competitionCookie } from '@cuberoot/shared/competition-access';
import { GET } from '@/app/api/comp/access/route';

const secret = 'test-only-secret-with-more-than-32-characters';
const now = 1_790_000_000_000;
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

describe('competition access proof', () => {
  it('rejects forged, expired, wrong-browser, wrong-key and wrong-purpose proofs', async () => {
    const proof = await createCompetitionProof(secret, 'browser', 'browser-a', now);
    expect(await verifyCompetitionProof(secret, proof, 'browser', 'browser-a', now)).toBe(true);
    for (const [token, purpose, context, time, key] of [
      [proof.slice(0, -1) + (proof.endsWith('0') ? '1' : '0'), 'browser', 'browser-a', now, secret],
      [proof, 'browser', 'browser-b', now, secret],
      [proof, 'service', 'browser-a', now, secret],
      [proof, 'browser', 'browser-a', now + 1800_000, secret],
      [proof, 'browser', 'browser-a', now - 1000, secret],
      [proof, 'browser', 'browser-a', now, secret + 'x'],
    ] as const) expect(await verifyCompetitionProof(key, token, purpose, context, time)).toBe(false);
  });
  it('binds service proofs to an exact URL and rejects duplicate cookies', async () => {
    const proof = await createCompetitionProof(secret, 'service', '/v1/cubing-live/A?v=4', now);
    expect(await verifyCompetitionProof(secret, proof, 'service', '/v1/cubing-live/A?v=4', now)).toBe(true);
    expect(await verifyCompetitionProof(secret, proof, 'service', '/v1/cubing-live/B?v=4', now)).toBe(false);
    expect(await verifyCompetitionProof(secret, proof, 'service', '/v1/cubing-live/A?v=4', now + 60_000)).toBe(false);
    expect(competitionCookie(`${COMPETITION_ACCESS_COOKIE}=a; ${COMPETITION_ACCESS_COOKIE}=b`)).toBe('');
  });
  it('only mints on the production Vercel canonical domain, without shared caching', async () => {
    vi.stubEnv('COMPETITION_ACCESS_SECRET', secret);
    vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_ENV', 'production');
    const ok = await GET(new Request('https://cuberoot.me/api/comp/access', { headers: { 'user-agent': 'browser-a' } }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('private, no-store');
    expect(ok.headers.get('set-cookie')).toContain('HttpOnly; Secure; SameSite=Lax');
    for (const to of ['//evil.example', '/\\evil.example', '/api/comp/access']) {
      expect((await GET(new Request('https://cuberoot.me/api/comp/access?returnTo=' + encodeURIComponent(to)))).status).toBe(400);
    }
    expect((await GET(new Request('https://preview.vercel.app/api/comp/access'))).status).toBe(503);
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect((await GET(new Request('https://cuberoot.me/api/comp/access'))).status).toBe(503);
    vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('VERCEL', '');
    expect((await GET(new Request('https://cuberoot.me/api/comp/access'))).status).toBe(503);
  });
  it('retries a rejected API request only after acquiring a proof', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({ code: 'competition_verification_required' }, { status: 403 }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(Response.json({ expiresIn: 1800 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal('fetch', request);
    const { competitionFetch } = await import('@/lib/competition-access');
    expect((await competitionFetch('https://api.cuberoot.me/v1/cubing-live/A')).status).toBe(200);
    expect(request.mock.calls.map(call => call[0])).toEqual([
      'https://api.cuberoot.me/v1/cubing-live/A', 'https://api.cuberoot.me/v1/competition-access/check',
      '/api/comp/access', 'https://api.cuberoot.me/v1/cubing-live/A',
    ]);
    expect(request.mock.calls[3][1].credentials).toBe('include');
  });
});
