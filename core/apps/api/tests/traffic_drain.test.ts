import { createHmac } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { sanitizeDrainRecord, trafficDrainRoutes } from '../src/routes/traffic_drain.js';

const previousSecret = process.env.VERCEL_TRAFFIC_DRAIN_SECRET;
const previousPath = process.env.TRAFFIC_DRAIN_PATH;
let directory: string | undefined;

afterEach(async () => {
  if (previousSecret === undefined) delete process.env.VERCEL_TRAFFIC_DRAIN_SECRET;
  else process.env.VERCEL_TRAFFIC_DRAIN_SECRET = previousSecret;
  if (previousPath === undefined) delete process.env.TRAFFIC_DRAIN_PATH;
  else process.env.TRAFFIC_DRAIN_PATH = previousPath;
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});

describe('Vercel traffic drain', () => {
  it('accepts only a valid signature and stores a privacy-filtered record', async () => {
    directory = await mkdtemp(join(tmpdir(), 'cuberoot-traffic-'));
    const path = join(directory, 'vercel.ndjson');
    process.env.TRAFFIC_DRAIN_PATH = path;
    process.env.VERCEL_TRAFFIC_DRAIN_SECRET = 'test-secret';
    const payload = JSON.stringify([{
      id: 'request-1', environment: 'production',
      proxy: { host: 'cuberoot.me', timestamp: Date.now(), method: 'GET', statusCode: 200,
        path: '/zh/calc?name0=PrivateName&token=Secret', referer: 'https://example.com/private?token=Secret',
        clientIp: '203.0.113.1', userAgent: ['Reflectionbot/1.0 PrivateUserAgent'], },
    }]);
    const unsigned = await trafficDrainRoutes.request('/ops/traffic/drain', { method: 'POST', body: payload });
    expect(unsigned.status).toBe(403);
    const signature = createHmac('sha1', 'test-secret').update(payload).digest('hex');
    const accepted = await trafficDrainRoutes.request('/ops/traffic/drain', { method: 'POST', body: payload, headers: { 'x-vercel-signature': signature } });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ accepted: 1 });
    const stored = await readFile(path, 'utf8');
    expect(stored).toContain('/zh/calc');
    expect(stored).toContain('example.com');
    expect(stored).not.toMatch(/PrivateName|PrivateUserAgent|203\.0\.113\.1|token=Secret/);
  });

  it('drops requests for nonproduction hosts and masks deep paths', () => {
    expect(sanitizeDrainRecord({ id: 'x', environment: 'preview', proxy: { host: 'cuberoot.me', path: '/', timestamp: 1 } })).toBeNull();
    expect(sanitizeDrainRecord({ id: 'x', environment: 'production', proxy: { host: 'preview.vercel.app', path: '/', timestamp: 1 } })).toBeNull();
    expect(sanitizeDrainRecord({ id: 'x', environment: 'production', proxy: { host: 'cuberoot.me', path: '/zh/recon/private-name', timestamp: 1 } })?.path).toBe('/zh/recon/:detail');
  });
});
