import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { competitionGate } from '@/lib/competition-gate';
import { safeCompetitionReturn } from '@/lib/competition-return';
import { COMPETITION_ACCESS_COOKIE, createCompetitionProof, verifyCompetitionProof } from '@cuberoot/shared/competition-access';
const secret = 'test-only-secret-with-more-than-32-characters';
afterEach(() => vi.unstubAllEnvs());
it('gates every language and subpage before cached content; API denial is JSON', async () => {
  vi.stubEnv('COMPETITION_ACCESS_SECRET', secret); vi.stubEnv('VERCEL', '1');
  for (const path of ['/wca/comp', '/zh/wca/comp/A/results', '/en/wca/comp/A']) {
    const response = await competitionGate(new NextRequest('https://cuberoot.me' + path));
    expect(response?.status).toBe(307);
    expect(response?.headers.get('cache-control')).toBe('private, no-store');
    expect(response?.headers.get('location')).toContain('competition-verify?returnTo=');
  }
  expect((await competitionGate(new NextRequest('https://cuberoot.me/api/comp/A')))?.status).toBe(403);
  expect(await competitionGate(new NextRequest('https://cuberoot.me/timer'))).toBeNull();
  expect(await competitionGate(new NextRequest('https://cuberoot.me/competition-verify'))).toBeNull();
  const headers = { 'x-cuberoot-cn-exempt': '1', 'x-forwarded-for': '47.97.30.181' };
  expect((await competitionGate(new NextRequest('https://cuberoot.me/api/comp/A', { headers })))?.status).toBe(403);
  expect(await competitionGate(new NextRequest('https://cuberoot.me/api/comp/A', { headers: { 'x-vercel-ip-country': 'CN' } }))).toBeNull();
  const proof = await createCompetitionProof(secret, 'browser', 'ua');
  expect(await competitionGate(new NextRequest('https://cuberoot.me/api/comp/A', { headers: { cookie: `${COMPETITION_ACCESS_COOKIE}=${proof}`, 'user-agent': 'ua' } }))).toBeNull();
  expect(await verifyCompetitionProof(secret, proof.replace('v2.', 'v1.'), 'browser', 'ua')).toBe(false);
  vi.stubEnv('VERCEL', '');
  expect(await competitionGate(new NextRequest('https://cuberoot.me/api/comp/A', { headers: { 'x-cuberoot-cn-exempt': '1' } }))).toBeNull();
});
it('rejects external and recursive return URLs', () => {
  for (const value of ['//evil.example', '/\\evil.example', '/competition-verify', '/zh/competition-verify?x=1', '/api/comp/A', 'https://evil.example']) expect(safeCompetitionReturn(value)).toBe('/wca/comp');
  expect(safeCompetitionReturn('/zh/wca/comp/A?view=x#round')).toBe('/zh/wca/comp/A?view=x#round');
});
