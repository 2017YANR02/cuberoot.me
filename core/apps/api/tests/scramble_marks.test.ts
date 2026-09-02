import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: vi.fn(() => '127.0.0.1') }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  ADMIN_WCA_IDS: ['2017ADMIN01'],
  checkRateLimit: vi.fn(),
  requireAuth: mocks.requireAuth,
}));

import { scrambleMarksRoutes } from '../src/routes/scramble_marks.js';
import { apiCors } from '../src/api_cors.js';

const corsApp = new Hono().use('*', apiCors).route('/v1', scrambleMarksRoutes);

const key = {
  ci: 'Example2026',
  e: '333',
  r: '1',
  g: 'A',
  x: 0,
  n: 2,
};

function write(
  method: 'PATCH' | 'POST',
  country = '',
  overrides: Record<string, unknown> = {},
) {
  return scrambleMarksRoutes.request('/scramble-marks', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...key, country, timeCs: 1_234, ...overrides }),
  });
}

describe('scramble marks authenticated writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ wcaId: '2017TEST01', name: 'Test Cuber' });
  });

  it('preserves an existing non-empty country when an upsert sends empty country', async () => {
    mocks.query.mockResolvedValueOnce([{ n: 1 }]).mockResolvedValueOnce([]);

    const response = await write('POST');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    const upsert = mocks.query.mock.calls[1];
    expect(upsert[0]).toContain(
      "country = COALESCE(NULLIF(EXCLUDED.country, ''), scramble_marks.country)",
    );
    expect(upsert[1]).toEqual([
      '2017TEST01',
      'Test Cuber',
      '',
      'Example2026',
      '333',
      '1',
      'A',
      0,
      2,
      1_234,
      expect.any(Number),
    ]);
  });

  it('updates an authenticated existing mark without consulting the public top-100 list', async () => {
    mocks.query.mockResolvedValueOnce([{ created_at: 42 }]);

    const response = await write('PATCH');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, updated: true, createdAt: 42 });
    expect(mocks.query).toHaveBeenCalledOnce();
    const update = mocks.query.mock.calls[0];
    expect(update[0]).toContain('UPDATE scramble_marks');
    expect(update[0]).toContain("country = COALESCE(NULLIF(?, ''), country)");
    expect(update[0]).toContain(`WHERE wca_id = ? AND competition_id = ?`);
    expect(update[0]).not.toContain('LIMIT 100');
    expect(update[1]).toEqual([
      'Test Cuber',
      '',
      1_234,
      expect.any(Number),
      '2017TEST01',
      'Example2026',
      '333',
      '1',
      'A',
      0,
      2,
    ]);
  });

  it('returns a safe miss and never inserts when the authenticated user has no mark', async () => {
    mocks.query.mockResolvedValueOnce([]);

    const response = await write('PATCH', 'CN');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, updated: false, createdAt: null });
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.query.mock.calls[0][0]).not.toContain('INSERT');
  });

  it.each([
    ['POST', { x: 2 }],
    ['PATCH', { x: '1' }],
    ['PATCH', { r: 'round-too-long' }],
  ] as const)('rejects an invalid %s body key without querying SQL', async (method, overrides) => {
    const response = await write(method, '', overrides);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid scramble key' });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it.each(['', '2', 'banana'])('rejects query x=%j without querying SQL', async (x) => {
    const query = new URLSearchParams({
      ...Object.fromEntries(Object.entries(key).map(([name, value]) => [name, String(value)])),
      x,
    });
    const response = await scrambleMarksRoutes.request(`/scramble-marks?${query}`);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid scramble key' });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('allows authenticated PATCH from every installed WebView origin', async () => {
    for (const origin of [
      'https://localhost',
      'capacitor://localhost',
      'tauri://localhost',
      'https://tauri.localhost',
    ]) {
      const response = await corsApp.request('/v1/scramble-marks', {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Headers': 'authorization,content-type',
          'Access-Control-Request-Method': 'PATCH',
        },
      });
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('PATCH');
      expect(response.headers.get('Access-Control-Allow-Headers')?.toLowerCase())
        .toContain('authorization');
    }
  });
});
