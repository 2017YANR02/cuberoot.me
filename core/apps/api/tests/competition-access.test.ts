import { afterEach, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { createCompetitionProof, COMPETITION_ACCESS_COOKIE, COMPETITION_SERVICE_HEADER } from '@cuberoot/shared/competition-access';
import { requireCompetitionAccess, checkCompetitionAccess } from '../src/utils/competition_access';

const secret = 'test-only-secret-with-more-than-32-characters';
const app = new Hono();
app.get('/v1/competition-access/check', checkCompetitionAccess);
app.use('/v1/cubing-live/*', requireCompetitionAccess);
app.get('/v1/cubing-live/:slug', c => c.json({ ok: true }));
const env = (address: string) => ({ incoming: { socket: { remoteAddress: address } } });
afterEach(() => vi.unstubAllEnvs());

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
