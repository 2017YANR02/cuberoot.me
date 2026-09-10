import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
  listRooms: vi.fn(),
  listParticipants: vi.fn(),
  removeParticipant: vi.fn(),
  deleteRoom: vi.fn(),
  toJwt: vi.fn(),
  actor: vi.fn(),
}));

vi.mock('../src/db/connection.js', () => ({ query: mocks.query, withTransaction: mocks.withTransaction }));
vi.mock('../src/platform/auth.js', () => ({ requirePlatformActor: mocks.actor }));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: vi.fn(() => '127.0.0.1') }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  checkRateLimit: vi.fn(),
  requireAuth: vi.fn(),
}));
vi.mock('livekit-server-sdk', () => ({
  AccessToken: class {
    roomConfig: unknown;
    addGrant() {}
    toJwt() { return mocks.toJwt(); }
  },
  RoomServiceClient: class {
    listRooms() { return mocks.listRooms(); }
    listParticipants(room: string) { return mocks.listParticipants(room); }
    removeParticipant(room: string, identity: string) { return mocks.removeParticipant(room, identity); }
    deleteRoom(room: string) { return mocks.deleteRoom(room); }
  },
  TrackSource: {
    CAMERA: 'camera', MICROPHONE: 'microphone', SCREEN_SHARE: 'screen_share', SCREEN_SHARE_AUDIO: 'screen_share_audio',
  },
}));

import { hashBattlePlayerToken } from '../src/utils/battle_room_auth.js';

const PLAYER_TOKEN = 'a'.repeat(43);
let app: Hono;
let retireBattleVideoGeneration: (code: string, generation: string) => Promise<void>;
let competitionSupervisionReady: (id: string, generation: string, entrant: number, supervisor: number) => Promise<boolean>;

beforeAll(async () => {
  vi.stubEnv('LIVEKIT_URL', 'wss://livekit.example.test');
  vi.stubEnv('LIVEKIT_API_KEY', 'key');
  vi.stubEnv('LIVEKIT_API_SECRET', 'secret-secret-secret-secret-secret-secret');
  const routes = await import('../src/routes/video_rooms.js');
  const { videoRoomsRoutes } = routes;
  retireBattleVideoGeneration = routes.retireBattleVideoGeneration;
  competitionSupervisionReady = routes.competitionSupervisionReady;
  app = new Hono().route('/v1', videoRoomsRoutes);
});

describe('competition video admission', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const generation = '22222222-2222-4222-8222-222222222222';
  const row = { id, user_id: 1, supervisor_user_id: 2, competition_video_generation: generation };
  const request = () => app.request('/v1/video/competition/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registrationId: id }),
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.actor.mockResolvedValue({ userId: 1, displayName: 'Entrant' });
    mocks.query.mockReset().mockResolvedValue([row]);
    mocks.withTransaction.mockImplementation(async run => run(mocks.query));
    mocks.listRooms.mockResolvedValue([]);
    mocks.listParticipants.mockResolvedValue([]);
    mocks.toJwt.mockResolvedValue('signed-jwt');
  });
  it('preserves the platform unauthenticated HTTP status', async () => {
    const { PlatformApiError } = await import('../src/platform/errors.js');
    mocks.actor.mockRejectedValueOnce(new PlatformApiError('UNAUTHENTICATED', 401, 'Authentication required'));
    expect((await request()).status).toBe(401);
    expect(mocks.toJwt).not.toHaveBeenCalled();
  });
  it('rejects unrelated users without contacting the media server', async () => {
    mocks.actor.mockResolvedValue({ userId: 3 });
    expect((await request()).status).toBe(403);
    expect(mocks.listRooms).not.toHaveBeenCalled();
  });
  it('issues a private generation room to the entrant and supervisor', async () => {
    for (const userId of [1, 2]) {
      mocks.actor.mockResolvedValue({ userId });
      const response = await request();
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(await response.json()).toMatchObject({ room: `competition-${id}-${generation}`, token: 'signed-jwt' });
    }
  });
  it('denies a registration cancelled during the capacity request', async () => {
    mocks.query.mockResolvedValueOnce([row]).mockResolvedValueOnce([]);
    expect((await request()).status).toBe(403);
    expect(mocks.toJwt).not.toHaveBeenCalled();
  });
  it('denies a rotated generation or changed supervisor during admission', async () => {
    for (const change of [{ competition_video_generation: id }, { supervisor_user_id: 4 }]) {
      mocks.query.mockResolvedValueOnce([row]).mockResolvedValueOnce([{ ...row, ...change }]);
      expect((await request()).status).toBe(409);
    }
    expect(mocks.toJwt).not.toHaveBeenCalled();
  });
  it('requires both distinct participants to have an unmuted camera', async () => {
    const camera = { source: 'camera', muted: false };
    mocks.listParticipants.mockResolvedValue([{ identity: 'u1', tracks: [camera] }, { identity: 'u2', tracks: [camera] }]);
    expect(await competitionSupervisionReady(id, generation, 1, 2)).toBe(true);
    expect(await competitionSupervisionReady(id, generation, 1, 1)).toBe(false);
    mocks.listParticipants.mockResolvedValue([{ identity: 'u1', tracks: [camera] }, { identity: 'u2', tracks: [{ ...camera, muted: true }] }]);
    expect(await competitionSupervisionReady(id, generation, 1, 2)).toBe(false);
    mocks.listParticipants.mockRejectedValueOnce(new Error('unavailable'));
    expect(await competitionSupervisionReady(id, generation, 1, 2)).toBe(false);
  });
});

afterAll(() => vi.unstubAllEnvs());

describe('battle video player capability', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.withTransaction.mockReset();
    mocks.withTransaction.mockImplementation(async (run) => run(mocks.query));
    mocks.listRooms.mockReset();
    mocks.listRooms.mockResolvedValue([]);
    mocks.listParticipants.mockReset();
    mocks.listParticipants.mockResolvedValue([]);
    mocks.removeParticipant.mockReset();
    mocks.removeParticipant.mockResolvedValue(undefined);
    mocks.deleteRoom.mockReset();
    mocks.deleteRoom.mockResolvedValue(undefined);
    mocks.toJwt.mockReset();
    mocks.toJwt.mockResolvedValue('signed-jwt');
  });

  it('rejects a public player id without its private capability', async () => {
    mocks.query.mockResolvedValueOnce([{
      name: 'Cuber',
      auth_hash: hashBattlePlayerToken(PLAYER_TOKEN),
      video_generation: '11111111-1111-4111-8111-111111111111',
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
      video_generation: '11111111-1111-4111-8111-111111111111',
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

  it('rechecks membership under a row lock and isolates old self-hosted tokens by generation', () => {
    const source = readFileSync(new URL('../src/routes/video_rooms.ts', import.meta.url), 'utf8');
    expect(source).toContain("const TOKEN_TTL = '1m'");
    expect(source).toContain('FOR UPDATE');
    expect(source).toContain('battle-${code}-${videoGeneration}');
    expect(source).toContain('video_generation');
    expect(source).not.toContain('revokeTokenTs');
  });

  it('retries capacity admission when generation rotates before the locked recheck', async () => {
    const authHash = hashBattlePlayerToken(PLAYER_TOKEN);
    const g1 = '11111111-1111-4111-8111-111111111111';
    const g2 = '22222222-2222-4222-8222-222222222222';
    mocks.query
      .mockResolvedValueOnce([{ name: 'Cuber', auth_hash: authHash, video_generation: g1 }])
      .mockResolvedValueOnce([{ name: 'Cuber', auth_hash: authHash, video_generation: g2 }])
      .mockResolvedValueOnce([{ name: 'Cuber', auth_hash: authHash, video_generation: g2 }])
      .mockResolvedValueOnce([{ name: 'Cuber', auth_hash: authHash, video_generation: g2 }]);

    const response = await app.request('/v1/video/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Battle-Token': PLAYER_TOKEN },
      body: JSON.stringify({ code: '0427', pid: 'player1234' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ room: `battle-0427-${g2}`, token: 'signed-jwt' });
    expect(mocks.listRooms).toHaveBeenCalledTimes(2);
    expect(mocks.withTransaction).toHaveBeenCalledTimes(2);
  });

  it('does not return a stale full denial when capacity was checked on an old generation', async () => {
    const authHash = hashBattlePlayerToken(PLAYER_TOKEN);
    const g1 = '11111111-1111-4111-8111-111111111111';
    const g2 = '22222222-2222-4222-8222-222222222222';
    mocks.query
      .mockResolvedValueOnce([{ name: 'Cuber', auth_hash: authHash, video_generation: g1 }])
      .mockResolvedValueOnce([{ name: 'Cuber', auth_hash: authHash, video_generation: g2 }])
      .mockResolvedValueOnce([{ name: 'Cuber', auth_hash: authHash, video_generation: g2 }])
      .mockResolvedValueOnce([{ name: 'Cuber', auth_hash: authHash, video_generation: g2 }]);
    mocks.listRooms
      .mockResolvedValueOnce([{ name: `battle-0427-${g1}`, numParticipants: 4 }])
      .mockResolvedValueOnce([]);
    mocks.listParticipants.mockResolvedValueOnce([
      { identity: 'other0001', tracks: [] },
      { identity: 'other0002', tracks: [] },
      { identity: 'other0003', tracks: [] },
      { identity: 'other0004', tracks: [] },
    ]);

    const response = await app.request('/v1/video/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Battle-Token': PLAYER_TOKEN },
      body: JSON.stringify({ code: '0427', pid: 'player1234' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ room: `battle-0427-${g2}` });
    expect(mocks.withTransaction).toHaveBeenCalledTimes(2);
  });

  it('retires the exact old media generation so removed tokens cannot rejoin remaining members', async () => {
    const generation = '11111111-1111-4111-8111-111111111111';

    await retireBattleVideoGeneration('0427', generation);

    expect(mocks.deleteRoom).toHaveBeenCalledWith(`battle-0427-${generation}`);
    expect(mocks.removeParticipant).not.toHaveBeenCalled();
  });

  it('awaits bounded retries before giving up retirement of an old media generation', async () => {
    const generation = '11111111-1111-4111-8111-111111111111';
    mocks.deleteRoom
      .mockRejectedValueOnce(new Error('transient one'))
      .mockRejectedValueOnce(new Error('transient two'))
      .mockResolvedValueOnce(undefined);

    await retireBattleVideoGeneration('0427', generation);

    expect(mocks.deleteRoom).toHaveBeenCalledTimes(3);
    expect(mocks.deleteRoom).toHaveBeenNthCalledWith(3, `battle-0427-${generation}`);
  });
});
