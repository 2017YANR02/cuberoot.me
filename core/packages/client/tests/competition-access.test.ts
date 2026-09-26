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
    expect(await verifyCompetitionProof(secret, proof.replace('v2.', 'v1.'), 'service', '/v1/cubing-live/A?v=4', now)).toBe(false);
    expect(await verifyCompetitionProof(secret, proof, 'service', '/v1/cubing-live/B?v=4', now)).toBe(false);
    expect(await verifyCompetitionProof(secret, proof, 'service', '/v1/cubing-live/A?v=4', now + 60_000)).toBe(false);
    expect(competitionCookie(`${COMPETITION_ACCESS_COOKIE}=a; ${COMPETITION_ACCESS_COOKIE}=b`)).toBe('');
  });
  it('never automatically mints a browser proof', async () => {
    const response = await GET();
    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
  it('requires manual verification instead of retrying after an automatic grant', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({ code: 'competition_verification_required' }, { status: 403 }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }));
    vi.stubGlobal('fetch', request);
    vi.stubGlobal('window', { location: { pathname: '/zh/wca/comp/A', search: '', hash: '', assign: vi.fn() } });
    const { competitionFetch } = await import('@/lib/competition-access');
    await expect(competitionFetch('https://api.cuberoot.me/v1/cubing-live/A')).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(2);
    expect(window.location.assign).toHaveBeenCalledWith('/zh/competition-verify?returnTo=%2Fzh%2Fwca%2Fcomp%2FA');
  });
});
