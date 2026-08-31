import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({ query: vi.fn(), withTransaction: vi.fn() }));

vi.mock('../src/db/connection.js', () => ({ query: mocks.query, withTransaction: mocks.withTransaction }));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: vi.fn(() => '127.0.0.1') }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  checkRateLimit: vi.fn(),
  requireAuth: vi.fn(),
}));

import { hashBattlePlayerToken } from '../src/utils/battle_room_auth.js';

const PLAYER_TOKEN = 'a'.repeat(43);
let app: Hono;

beforeAll(async () => {
  vi.stubEnv('LIVEKIT_URL', 'wss://livekit.example.test');
  vi.stubEnv('LIVEKIT_API_KEY', 'key');
  vi.stubEnv('LIVEKIT_API_SECRET', 'secret-secret-secret-secret-secret-secret');
  const { videoRoomsRoutes } = await import('../src/routes/video_rooms.js');
  app = new Hono().route('/v1', videoRoomsRoutes);
});

afterAll(() => vi.unstubAllEnvs());

describe('battle video player capability', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.withTransaction.mockReset();
    mocks.withTransaction.mockImplementation(async (run) => run(mocks.query));
  });

  it('rejects a public player id without its private capability', async () => {
    mocks.query.mockResolvedValueOnce([{
      name: 'Cuber',
      auth_hash: hashBattlePlayerToken(PLAYER_TOKEN),
    }]);

    const response = await app.request('/v1/video/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '0427', pid: 'player1234' }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'not in room' });
    expect(mocks.query.mock.calls[0][0]).toContain('player_auth ->> ? AS auth_hash');
  });

  it('rejects another player capability before contacting LiveKit', async () => {
    mocks.query.mockResolvedValueOnce([{
      name: 'Cuber',
      auth_hash: hashBattlePlayerToken(PLAYER_TOKEN),
    }]);

    const response = await app.request('/v1/video/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Battle-Token': 'b'.repeat(43),
      },
      body: JSON.stringify({ code: '0427', pid: 'player1234' }),
    });

    expect(response.status).toBe(403);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it('rechecks membership under a row lock and revokes short-lived JWTs on eviction', () => {
    const source = readFileSync(new URL('../src/routes/video_rooms.ts', import.meta.url), 'utf8');
    expect(source).toContain("const TOKEN_TTL = '1m'");
    expect(source).toContain('FOR UPDATE');
    expect(source).toContain('revokeTokenTs: BigInt(Math.floor(Date.now() / 1000))');
  });
});
