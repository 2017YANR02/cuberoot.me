import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { competitionGate, SITE_VERIFICATION_PATH } from '@/lib/competition-gate';
import { safeCompetitionReturn } from '@/lib/competition-return';
import { COMPETITION_ACCESS_COOKIE, createCompetitionProof, verifyCompetitionProof } from '@cuberoot/shared/competition-access';
const secret = 'test-only-secret-with-more-than-32-characters';
afterEach(() => vi.unstubAllEnvs());
it('gates every language and subpage before cached content; API denial is JSON', async () => {
  vi.stubEnv('COMPETITION_ACCESS_SECRET', secret); vi.stubEnv('VERCEL', '1');
  for (const path of ['/', '/zh', '/en', '/timer', '/zh/calc', '/alg', '/dev', '/forum/t/1', '/platform/login', '/wca/persons/2017YANR02', '/wca/persons/person.png', '/wca/comp', '/zh/wca/comp/A/results', '/en/wca/comp/A', '/tools/cstimer/', '/tools/blddb/index.html', '/_cube-demo.html']) {
    const response = await competitionGate(new NextRequest('https://cuberoot.me' + path));
    expect(response?.status).toBe(307);
    expect(response?.headers.get('x-cuberoot-verification-required')).toBe('1');
    expect(response?.headers.get('cache-control')).toBe('private, no-store');
    expect(response?.headers.get('location')).toContain('competition-verify?returnTo=');
  }
  expect((await competitionGate(new NextRequest('https://cuberoot.me/api/comp/A')))?.status).toBe(403);

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
  for (const value of ['//evil.example', '/\\evil.example', '/competition-verify', '/zh/competition-verify?x=1', '/api/comp/A', 'https://evil.example']) expect(safeCompetitionReturn(value)).toBe('/');
  expect(safeCompetitionReturn('/zh/wca/comp/A?view=x#round')).toBe('/zh/wca/comp/A?view=x#round');
});

it('keeps verification, login callbacks, API clients and actual asset delivery reachable', async () => {
  vi.stubEnv('COMPETITION_ACCESS_SECRET', secret); vi.stubEnv('VERCEL', '1');
  for (const path of ['/competition-verify', '/zh/competition-verify/', '/en/competition-verify', '/auth/callback', '/auth/social/callback', '/callback.html', '/api/health', '/v1/competition-access/challenge', '/_next/static/chunk.js', '/_next/image', '/deskpet/rootbeast/01-idle.svg', '/assets/icon.webp', '/fonts/font.woff2', '/tools/cstimer/js/main.js', '/tools/blddb/data/a.json', '/tools/solver/table.bin', '/sw.js', '/manifest.json', '/robots.txt', '/sitemap.xml']) {
    expect(await competitionGate(new NextRequest('https://cuberoot.me' + path)), path).toBeNull();
  }
});
it('does not trust forged cookies or RSC/prefetch headers and preserves the destination', async () => {
  vi.stubEnv('COMPETITION_ACCESS_SECRET', secret); vi.stubEnv('VERCEL', '1');
  const path = '/zh/timer?mode=practice&event=333';
  const headers = { cookie: COMPETITION_ACCESS_COOKIE + '=forged', rsc: '1', 'next-router-prefetch': '1' };
  const response = await competitionGate(new NextRequest('https://cuberoot.me' + path, { headers }));
  expect(response?.status).toBe(307);
  expect(new URL(response!.headers.get('location')!).searchParams.get('returnTo')).toBe(path);
  const proof = await createCompetitionProof(secret, 'browser', 'ua');
  for (const page of ['/', '/zh/timer', '/tools/cstimer/index.html', '/wca/persons/2017YANR02']) {
    expect(await competitionGate(new NextRequest('https://cuberoot.me' + page, { headers: { cookie: COMPETITION_ACCESS_COOKIE + '=' + proof, 'user-agent': 'ua' } }))).toBeNull();
    expect(await competitionGate(new NextRequest('https://cuberoot.me' + page, { headers: { 'x-vercel-ip-country': 'CN' } }))).toBeNull();
  }
});
it('uses the same protected paths for the Vercel counter and the application', () => {
  const rule = JSON.parse(readFileSync(new URL('../../../../ops/vercel-ban-relay/competition-rule.json', import.meta.url), 'utf8'));
  expect(rule.conditionGroup[0].conditions[0].value).toBe(SITE_VERIFICATION_PATH);
  expect(rule.action.mitigate.actionDuration).toBe('1h');
});
