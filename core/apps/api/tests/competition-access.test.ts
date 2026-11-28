import { afterEach, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { createCompetitionProof, COMPETITION_ACCESS_COOKIE, COMPETITION_SERVICE_HEADER } from '@cuberoot/shared/competition-access';
import { requireCompetitionAccess, checkCompetitionAccess } from '../src/utils/competition_access';
import * as quota from '../src/utils/competition_result_quota';
import { readFileSync } from 'node:fs';
vi.mock('node:fs', () => ({ readFileSync: vi.fn(() => 'default 1;') }));

const secret = 'test-only-secret-with-more-than-32-characters';
const app = new Hono();
app.get('/v1/competition-access/check', checkCompetitionAccess);
app.use('/v1/cubing-live/*', requireCompetitionAccess);
app.get('/v1/cubing-live/:slug', c => {
  c.header('Cache-Control', 'public, max-age=86400, immutable');
  return c.json({ ok: true });
});
const env = (address: string) => ({ incoming: { socket: { remoteAddress: address } } });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.mocked(readFileSync).mockReturnValue('default 1;'); });

it('opens public reads at runtime and restores verification without trusting visitor headers', async () => {
  vi.stubEnv('COMPETITION_ACCESS_ENFORCE', '1');
  vi.mocked(readFileSync).mockReturnValue('default 0;');
  expect((await app.request('/v1/cubing-live/A')).status).toBe(200);
  expect((await app.request('/v1/competition-access/check')).status).toBe(204);
  vi.mocked(readFileSync).mockReturnValue('default 1;');
  expect((await app.request('/v1/cubing-live/A', { headers: { 'x-traffic-defense': '0' } })).status).toBe(403);
  vi.mocked(readFileSync).mockImplementation(() => { throw new Error('unreadable'); });
  expect((await app.request('/v1/competition-access/check')).status).toBe(503);
});

it('checks browser and service proofs, preserving only nginx-attested CN exemptions', async () => {
  vi.stubEnv('COMPETITION_ACCESS_ENFORCE', '1'); vi.stubEnv('COMPETITION_ACCESS_SECRET', secret);
  const path = '/v1/cubing-live/A';
  expect((await app.request(path)).status).toBe(403);
  expect((await app.request(path, { headers: { 'x-cuberoot-cn-exempt': '1' } }, env('8.8.8.8'))).status).toBe(403);
  expect((await app.request(path, { headers: { 'x-cuberoot-cn-exempt': '1' } }, env('127.0.0.1'))).status).toBe(200);
  const proof = await createCompetitionProof(secret, 'browser', 'browser-a');
  const cookie = `${COMPETITION_ACCESS_COOKIE}=${proof}`;
  expect((await app.request(path, { headers: { cookie, 'user-agent': 'browser-a' } })).status).toBe(200);
  expect((await app.request(path, { headers: { cookie, 'user-agent': 'browser-b' } })).status).toBe(403);
  const service = await createCompetitionProof(secret, 'service', path);
  expect((await app.request(path, { headers: { [COMPETITION_SERVICE_HEADER]: service } })).status).toBe(200);
  expect((await app.request('/v1/cubing-live/B', { headers: { [COMPETITION_SERVICE_HEADER]: service } })).status).toBe(403);
  const headers = { [COMPETITION_SERVICE_HEADER]: service, 'x-cuberoot-original-uri': path, 'x-cuberoot-auth-subrequest': '1' };
  expect((await app.request('/v1/competition-access/check', { headers }, env('127.0.0.1'))).status).toBe(204);
  expect((await app.request('/v1/competition-access/check', { headers }, env('8.8.8.8'))).status).toBe(403);
});

it('uses the deadline globally, accepting a browser proof or an ingress-verified Google IP', async () => {
  vi.stubEnv('COMPETITION_ACCESS_ENFORCE', '1');
  vi.stubEnv('COMPETITION_ACCESS_SECRET', secret);
  let deadline = Math.floor(Date.now() / 1000) + 3600;
  vi.mocked(readFileSync).mockImplementation(path => String(path).includes('comp-only-until') ? `default ${deadline};` : 'default 0;');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ prefixes: [{ ipv4Prefix: '192.0.2.0/24' }] })));
  const url = '/v1/cubing-live/A';
  const loopback = env('127.0.0.1');
  const crawler = { 'user-agent': 'Googlebot', 'x-real-ip': '192.0.2.10' };
  expect((await app.request(url, { headers: { 'x-cuberoot-cn-exempt': '1' } }, loopback)).status).toBe(403);
  expect((await app.request(url, { headers: crawler }, env('198.51.100.2'))).status).toBe(403);
  expect((await app.request(url, { headers: { ...crawler, 'x-real-ip': '198.51.100.2' } }, loopback)).status).toBe(403);
  expect((await app.request(url, { headers: crawler }, loopback)).status).toBe(200);
  vi.mocked(readFileSync).mockReturnValue('default 1;');
  expect((await app.request(url, { headers: crawler }, loopback)).status).toBe(200);
  expect((await app.request(url, { headers: crawler }, env('198.51.100.2'))).status).toBe(403);
  vi.mocked(readFileSync).mockImplementation(path => String(path).includes('comp-only-until') ? `default ${deadline};` : 'default 0;');
  const proof = await createCompetitionProof(secret, 'browser', 'mobile-browser');
  const passed = { headers: { 'user-agent': 'mobile-browser', cookie: `${COMPETITION_ACCESS_COOKIE}=${proof}` } };
  expect((await app.request(url, passed)).status).toBe(200);
  expect((await app.request('/v1/cubing-live/B', passed)).status).toBe(200);
  const denied = await app.request('/v1/competition-access/check');
  expect(denied.status).toBe(403);
  expect(await denied.json()).toMatchObject({ scope: 'competition' });
  deadline = 1;
  expect((await app.request(url)).status).toBe(200);
});

it('charges only authenticated browser sessions, consistently across IPs and result forms', async () => {
  vi.stubEnv('COMPETITION_ACCESS_ENFORCE', '1'); vi.stubEnv('COMPETITION_ACCESS_SECRET', secret);
  const now = Date.now();
  const session = () => createCompetitionProof(secret, 'browser', 'mobile', now, 1800, true);
  const first = await session();
  const second = await session();
  expect(first).not.toBe(second);
  const pass = { 'user-agent': 'mobile', cookie: `${COMPETITION_ACCESS_COOKIE}=${first}` };
  const quotaCheck = vi.spyOn(quota, 'admitCompetitionRead').mockResolvedValue(0);
  const revokedCheck = vi.spyOn(quota, 'competitionSessionRevoked').mockResolvedValue(false);
  try {
    expect((await app.request('/v1/cubing-live/Test2026', { headers: pass }, env('192.0.2.1'))).status).toBe(200);
    const [id,, slug] = quotaCheck.mock.calls[0];
    expect(slug).toBe('test2026');
    quotaCheck.mockResolvedValue(20);
    const direct = await app.request('/v1/cubing-live/Test2026', { headers: pass }, env('192.0.2.200'));
    expect(direct.status).toBe(429);
    expect(direct.headers.get('Retry-After')).toBe('20');

    const check = '/v1/competition-access/check';
    const headers = { ...pass, 'x-cuberoot-auth-subrequest': '1', 'x-cuberoot-competition-path': '/stats/comp/Test2026.json' };
    const internal = await app.request(check, { headers }, env('127.0.0.1'));
    expect(internal.status).toBe(403);
    expect(internal.headers.get('X-CubeRoot-Competition-Limit')).toBe('1');
    expect(internal.headers.get('Retry-After')).toBe('20');
    expect(quotaCheck.mock.calls.map(([key,, competition]) => [key, competition])).toEqual(Array(3).fill([id, 'test2026']));
    expect((await app.request(check, { headers }, env('192.0.2.200'))).status).toBe(204);
    expect(quotaCheck).toHaveBeenCalledTimes(3);

    const differentCookie = { ...pass, cookie: `${COMPETITION_ACCESS_COOKIE}=${second}` };
    quotaCheck.mockResolvedValue(0);
    expect((await app.request('/v1/cubing-live/A', { headers: differentCookie })).status).toBe(200);
    expect(quotaCheck.mock.lastCall![0]).not.toBe(id);
    const forged = first.replace(id, crypto.randomUUID());
    expect((await app.request('/v1/cubing-live/A', { headers: { ...pass, cookie: `${COMPETITION_ACCESS_COOKIE}=${forged}` } })).status).toBe(403);
    expect(quotaCheck).toHaveBeenCalledTimes(4);
    quotaCheck.mockResolvedValue('revoked');
    expect((await app.request('/v1/cubing-live/Test2026', { headers: pass })).status).toBe(403);
    revokedCheck.mockResolvedValue(true);
    expect((await app.request(check, { headers: pass })).status).toBe(403);
    quotaCheck.mockRejectedValue(new Error('test-ledger-unavailable'));
    expect((await app.request('/v1/cubing-live/A', { headers: pass })).status).toBe(503);
  } finally {
    quotaCheck.mockRestore(); revokedCheck.mockRestore();
  }
});

it('counts distinct result reads across aliases and expires both rolling windows', () => {
  const ids = ['/v1/cubing-live/Foo2026', '/v1/cubing-live/foo-2026/round/333/1', '/v1/cubing-live-stream/Foo2026',
    '/api/comp/Foo%32%30%32%36?only=333', '/stats/comp/Foo2026.json'].map(quota.resultCompetitionId);
  expect(new Set(ids)).toEqual(new Set(['foo2026']));
  expect(quota.resultCompetitionId('/api/comp/access')).toBeNull();
  const now = 100_000;
  const read = (count: number, at: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => ['competition' + i, at]));
  const short = read(30, now - 3);
  expect(quota.nextCompetitionRead(short, 'other', now)).toEqual({ retryAfter: 57 });
  const repeated = quota.nextCompetitionRead(short, 'competition0', now);
  expect(repeated.retryAfter).toBe(0);
  expect(repeated.updated?.competition0).toBe(now);
  // A read near the end of the window remains one of the most recent distinct
  // competitions after the original admission falls outside that window.
  let afterBoundary = repeated.updated!;
  for (let i = 0; i < 29; i++) afterBoundary = quota.nextCompetitionRead(afterBoundary, 'fresh' + i, now + 58).updated!;
  expect(quota.nextCompetitionRead(afterBoundary, 'oneTooMany', now + 58)).toEqual({ retryAfter: 2 });
  expect(quota.nextCompetitionRead(short, 'other', now + 57).retryAfter).toBe(0);
  const day = read(240, now - 60);
  expect(quota.nextCompetitionRead(day, 'other', now).retryAfter).toBe(86_340);
  expect(quota.nextCompetitionRead(day, 'competition0', now).retryAfter).toBe(0);
  expect(quota.nextCompetitionRead(day, '__proto__', now + 86_340).updated).toEqual(Object.fromEntries([['__proto__', now + 86_340]]));
});

it('keeps results private beyond the authenticated gateway and refuses unknown scope', async () => {
  vi.stubEnv('COMPETITION_ACCESS_ENFORCE', '1');
  vi.stubEnv('COMPETITION_ACCESS_SECRET', secret);
  const cookie = COMPETITION_ACCESS_COOKIE + '=' + await createCompetitionProof(secret, 'browser', 'browser');
  const headers = { cookie, 'user-agent': 'browser' };
  const url = '/v1/cubing-live/Test2026';
  const internal = await app.request(url, { headers }, env('127.0.0.1'));
  expect(internal.headers.get('X-Accel-Expires')).toBe('86400');
  expect(internal.headers.get('Cache-Control')).toBe('private, no-store');
  const publicPeer = await app.request(url, { headers }, env('192.0.2.2'));
  expect(publicPeer.headers.get('X-Accel-Expires')).toBeNull();
  expect(publicPeer.headers.get('Cache-Control')).toBe('private, no-store');
  vi.mocked(readFileSync).mockImplementation(path => {
    if (String(path).includes('comp-only-until')) throw new Error('missing state');
    return 'default 0;';
  });
  const unavailable = await app.request(url, { headers });
  expect(unavailable.status).toBe(503);
  expect(unavailable.headers.get('Cache-Control')).toBe('private, no-store');
});


it('keeps the global results gate independent when site-wide protection exempts ordinary CN pages', async () => {
  vi.stubEnv('COMPETITION_ACCESS_ENFORCE', '1');
  vi.stubEnv('COMPETITION_ACCESS_SECRET', secret);
  const peer = env('127.0.0.1');
  const cn = { 'x-cuberoot-cn-exempt': '1' };
  const subrequest = { ...cn, 'x-cuberoot-auth-subrequest': '1' };
  const check = '/v1/competition-access/check';
  let deadline = Math.floor(Date.now() / 1000) + 600;
  vi.mocked(readFileSync).mockImplementation(path => String(path).includes('comp-only-until') ? `default ${deadline};` : 'default 1;');
  expect((await app.request('/v1/cubing-live/Test', { headers: cn }, peer)).status).toBe(403);
  expect(await (await app.request(check, { headers: cn }, peer)).json()).toMatchObject({ scope: 'competition' });
  expect((await app.request(check, { headers: { ...subrequest, 'x-cuberoot-competition-path': '/stats/comp/Test.json' } }, peer)).status).toBe(403);
  expect((await app.request(check, { headers: { ...subrequest, 'x-cuberoot-competition-path': '/tools/cstimer/' } }, peer)).status).toBe(204);
  const browser = await createCompetitionProof(secret, 'browser', 'test');
  expect((await app.request(check, { headers: { ...cn, 'user-agent': 'test', cookie: COMPETITION_ACCESS_COOKIE + '=' + browser } }, peer)).status).toBe(204);
  deadline = 0;
  expect((await app.request('/v1/cubing-live/Test', { headers: cn }, peer)).status).toBe(200);
  expect((await app.request(check, { headers: cn }, peer)).status).toBe(204);
});
