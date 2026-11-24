import { afterEach, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { createCompetitionProof, COMPETITION_ACCESS_COOKIE, COMPETITION_SERVICE_HEADER } from '@cuberoot/shared/competition-access';
import { requireCompetitionAccess, checkCompetitionAccess } from '../src/utils/competition_access';
import { readFileSync } from 'node:fs';
vi.mock('node:fs', () => ({ readFileSync: vi.fn(() => 'default 1;') }));

const secret = 'test-only-secret-with-more-than-32-characters';
const app = new Hono();
app.get('/v1/competition-access/check', checkCompetitionAccess);
app.use('/v1/cubing-live/*', requireCompetitionAccess);
app.get('/v1/cubing-live/:slug', c => c.json({ ok: true }));
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
  expect((await app.request('/v1/competition-access/check')).status).toBe(403);
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
  const headers = { [COMPETITION_SERVICE_HEADER]: service, 'x-cuberoot-original-uri': path };
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
