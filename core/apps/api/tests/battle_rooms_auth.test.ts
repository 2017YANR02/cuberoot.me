import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({ query: vi.fn(), withTransaction: vi.fn(), evictBattleVideoParticipant: vi.fn() }));

vi.mock('../src/db/connection.js', () => ({ query: mocks.query, withTransaction: mocks.withTransaction }));
vi.mock('../src/routes/video_rooms.js', () => ({ evictBattleVideoParticipant: mocks.evictBattleVideoParticipant }));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: vi.fn(() => '127.0.0.1') }));
vi.mock('../src/utils/recon_helpers.js', () => ({ checkRateLimit: vi.fn() }));

import { battleRoomsRoutes } from '../src/routes/battle_rooms.js';
import { hashBattlePlayerToken } from '../src/utils/battle_room_auth.js';

const app = new Hono().route('/v1', battleRoomsRoutes);
const PLAYER_TOKEN = 'a'.repeat(43);
const PLAYER_ID = 'player1234';

function roomRow() {
  const now = Date.now();
  return {
    code: '0427',
    revision: 1,
    event: '333',
    round: 1,
    scrambles: { '333': "R U R'" },
    players: {
      [PLAYER_ID]: { name: 'Cuber', joined: now, seen: now, ph: 'idle', at: now, event: '333' },
    },
    results: {},
    history: [],
    scores: {},
    player_auth: { [PLAYER_ID]: hashBattlePlayerToken(PLAYER_TOKEN) },
    admin: PLAYER_ID,
    sync_start: false,
    start_at: null,
  };
}

function post(path: string, body: Record<string, unknown>, token?: string) {
  return app.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Battle-Token': token } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('battle-room player capabilities', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.withTransaction.mockReset();
    mocks.evictBattleVideoParticipant.mockReset();
    mocks.withTransaction.mockImplementation(async (run) => run(mocks.query));
  });

  it('rejects events outside the canonical shared online-battle registry', async () => {
    const response = await post('/v1/battle/rooms', { event: 'banana', scramble: 'R U', name: 'Cuber' });

    expect(response.status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('allows the private capability header through Web and Capacitor preflights', () => {
    const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
    expect(source).toContain("allowHeaders: ['Content-Type', 'Authorization', 'X-Battle-Token']");
    expect(source).toContain("'capacitor://localhost'");
    expect(source).toContain("'https://localhost'");
  });

  it('returns a one-player capability while persisting only its digest', async () => {
    mocks.query.mockResolvedValue([]);

    const response = await post('/v1/battle/rooms', { event: '333', scramble: 'R U', name: 'Cuber' });
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.playerId).toEqual(expect.any(String));
    expect(body.playerToken).toEqual(expect.stringMatching(/^[A-Za-z0-9_-]{40,128}$/));
    expect(body).not.toHaveProperty('player_auth');

    const insert = mocks.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO battle_rooms'));
    expect(insert).toBeTruthy();
    const params = insert![1] as unknown[];
    const auth = params[4] as Record<string, string>;
    expect(auth[body.playerId as string]).toBe(hashBattlePlayerToken(body.playerToken as string));
    expect(JSON.stringify(params)).not.toContain(body.playerToken as string);
  });

  it('never serializes capability digests in public room state', async () => {
    mocks.query.mockResolvedValueOnce([roomRow()]);

    const response = await app.request('/v1/battle/rooms/0427');
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).not.toHaveProperty('player_auth');
    expect(JSON.stringify(body)).not.toContain(hashBattlePlayerToken(PLAYER_TOKEN));
  });

  it('rejects heartbeat impersonation with a missing or wrong capability', async () => {
    mocks.query.mockResolvedValueOnce([roomRow()]).mockResolvedValueOnce([roomRow()]);

    const missing = await app.request(`/v1/battle/rooms/0427?pid=${PLAYER_ID}`);
    const wrong = await app.request(`/v1/battle/rooms/0427?pid=${PLAYER_ID}`, {
      headers: { 'X-Battle-Token': 'b'.repeat(43) },
    });

    expect(missing.status).toBe(403);
    expect(wrong.status).toBe(403);
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });

  it('checks the capability again inside the heartbeat UPDATE', async () => {
    mocks.query.mockResolvedValueOnce([roomRow()]).mockResolvedValueOnce([roomRow()]);

    const response = await app.request(`/v1/battle/rooms/0427?pid=${PLAYER_ID}`, {
      headers: { 'X-Battle-Token': PLAYER_TOKEN },
    });

    expect(response.status).toBe(200);
    const update = mocks.query.mock.calls[1];
    expect(update[0]).toContain('player_auth ->> ? = ?');
    expect(update[0]).toContain('start_at = CASE');
    expect(update[0]).toContain("THEN jsonb_build_object('ph', 'idle', 'at', ?::bigint)");
    expect(update[1]).toContain(hashBattlePlayerToken(PLAYER_TOKEN));
  });

  it('locks the room row while advancing so join/kick/leave snapshots cannot be overwritten', async () => {
    const before = { ...roomRow(), results: { '1': { [PLAYER_ID]: { t: 1_234, p: 'ok' } } } };
    const after = { ...before, round: 2, history: [{ round: 1, scrambles: before.scrambles, playerEvents: { [PLAYER_ID]: '333' }, results: {}, winners: [] }] };
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([after]);

    const response = await post('/v1/battle/rooms/0427/next', {
      pid: PLAYER_ID,
      round: 1,
      scramble: "U R U'",
    }, PLAYER_TOKEN);

    expect(response.status).toBe(200);
    expect(mocks.withTransaction).toHaveBeenCalledOnce();
    expect(mocks.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(mocks.query.mock.calls[1][0]).toContain('UPDATE battle_rooms');
  });

  it('refuses to advance a round before the caller has submitted a result', async () => {
    mocks.query.mockResolvedValueOnce([roomRow()]);

    const response = await post('/v1/battle/rooms/0427/next', {
      pid: PLAYER_ID,
      round: 1,
      scramble: "U R U'",
    }, PLAYER_TOKEN);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'submit a result before advancing' });
    expect(mocks.query).toHaveBeenCalledOnce();
  });

  it('refuses to erase another online player who is still solving', async () => {
    const secondId = 'player5678';
    const before = { ...roomRow(), results: { '1': { [PLAYER_ID]: { t: 1_234, p: 'ok' } } } };
    before.players[secondId] = {
      name: 'Second', joined: Date.now(), seen: Date.now(), ph: 'solving', at: Date.now(), event: '333',
    };
    before.player_auth[secondId] = hashBattlePlayerToken('b'.repeat(43));
    mocks.query.mockResolvedValueOnce([before]);

    const response = await post('/v1/battle/rooms/0427/next', {
      pid: PLAYER_ID, round: 1, scramble: "U R U'",
    }, PLAYER_TOKEN);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'players are still solving' });
    expect(mocks.query).toHaveBeenCalledOnce();
  });

  it('returns the current room idempotently when an old next request is retried', async () => {
    const current = { ...roomRow(), round: 2, results: {} };
    mocks.query.mockResolvedValueOnce([current]);

    const response = await post('/v1/battle/rooms/0427/next', {
      pid: PLAYER_ID, round: 1, scramble: "U R U'",
    }, PLAYER_TOKEN);

    expect(response.status).toBe(200);
    expect((await response.json() as { round: number }).round).toBe(2);
    expect(mocks.query).toHaveBeenCalledOnce();
  });

  it('decides sync-start from the locked current row, never a stale pre-settings snapshot', async () => {
    const secondId = 'player5678';
    const before = roomRow();
    before.players[secondId] = {
      name: 'Second', joined: before.players[PLAYER_ID]!.joined, seen: Date.now(), ph: 'ready', at: Date.now(), event: '333',
    };
    before.player_auth[secondId] = hashBattlePlayerToken('b'.repeat(43));
    before.sync_start = false;
    const after = { ...before, players: { ...before.players, [PLAYER_ID]: { ...before.players[PLAYER_ID]!, ph: 'ready' } } };
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([after]);

    const response = await post('/v1/battle/rooms/0427/status', { pid: PLAYER_ID, ph: 'ready' }, PLAYER_TOKEN);

    expect(response.status).toBe(200);
    expect(mocks.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(mocks.query.mock.calls[1][0]).toContain('SET players = ?::jsonb, start_at = ?');
    expect(mocks.query.mock.calls[1][1][1]).toBeNull();
  });

  it('cancels a future synchronized countdown when a player withdraws readiness', async () => {
    const before = { ...roomRow(), sync_start: true, start_at: Date.now() + 3_000 };
    const after = { ...before, start_at: null, players: { ...before.players, [PLAYER_ID]: { ...before.players[PLAYER_ID]!, ph: 'idle' } } };
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([after]);

    const response = await post('/v1/battle/rooms/0427/status', { pid: PLAYER_ID, ph: 'idle' }, PLAYER_TOKEN);

    expect(response.status).toBe(200);
    expect(mocks.query.mock.calls[1][1][1]).toBeNull();
  });

  it('rejects joining during a synchronized countdown or active synchronized round', async () => {
    mocks.query.mockResolvedValueOnce([{ ...roomRow(), start_at: Date.now() + 3_000 }]);

    const response = await post('/v1/battle/rooms/0427/join', { name: 'Second' });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'round in progress' });
    expect(mocks.query).toHaveBeenCalledOnce();
  });

  it('patches identity fields onto the current DB player instead of restoring a stale phase', async () => {
    const before = roomRow();
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([before]).mockResolvedValueOnce([before]);

    const response = await post('/v1/battle/rooms/0427/name', { pid: PLAYER_ID, name: 'Renamed' }, PLAYER_TOKEN);

    expect(response.status).toBe(200);
    const updateSql = String(mocks.query.mock.calls[2][0]);
    expect(updateSql).toContain("(players -> ?) - 'wcaId' - 'iso2'");
    expect(updateSql).not.toContain('jsonb_build_object(?::text, ?::jsonb)');
  });

  it('atomically rejects changing event after submitting the current round', async () => {
    const submitted = { ...roomRow(), results: { '1': { [PLAYER_ID]: { t: 1_234, p: 'ok' } } } };
    mocks.query.mockResolvedValueOnce([submitted]).mockResolvedValueOnce([]).mockResolvedValueOnce([submitted]);

    const response = await post('/v1/battle/rooms/0427/event', {
      pid: PLAYER_ID, event: '222', scramble: "R U R'",
    }, PLAYER_TOKEN);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'round already submitted' });
    expect(mocks.query.mock.calls[1][0]).toContain("NOT jsonb_exists(COALESCE(results -> round::text, '{}'::jsonb), ?)");
    expect(mocks.query.mock.calls[1][0]).toContain('(players -> ?) || jsonb_build_object');
  });

  it('only lets a player fill a scramble for their own current event', async () => {
    const before = roomRow();
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([]).mockResolvedValueOnce([before]);

    const response = await post('/v1/battle/rooms/0427/scramble', {
      pid: PLAYER_ID, event: '222', scramble: "R U R'",
    }, PLAYER_TOKEN);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'event does not match player' });
    expect(mocks.query.mock.calls[1][0]).toContain("players -> ? ->> 'event' = ?");
  });

  it('atomically rejects a colliding generated player id on join', async () => {
    const before = roomRow();
    for (let attempt = 0; attempt < 12; attempt++) {
      mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([]);
    }

    const response = await post('/v1/battle/rooms/0427/join', { name: 'Second' });

    expect(response.status).toBe(409);
    expect(mocks.query.mock.calls[1][0]).toContain('NOT jsonb_exists(players, ?)');
  });

  it('requires the same capability for lazy scramble creation', async () => {
    mocks.query.mockResolvedValueOnce([roomRow()]);

    const response = await post('/v1/battle/rooms/0427/scramble', {
      pid: PLAYER_ID,
      event: '222',
      scramble: "R U R'",
    });

    expect(response.status).toBe(403);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['/v1/battle/rooms/0427/status', { pid: PLAYER_ID, ph: 'ready' }],
    ['/v1/battle/rooms/0427/name', { pid: PLAYER_ID, name: 'Renamed' }],
    ['/v1/battle/rooms/0427/event', { pid: PLAYER_ID, event: '222', scramble: 'R U' }],
    ['/v1/battle/rooms/0427/scramble', { pid: PLAYER_ID, event: '222', scramble: 'R U' }],
    ['/v1/battle/rooms/0427/result', { pid: PLAYER_ID, round: 1, t: 1_234, p: 'ok' }],
    ['/v1/battle/rooms/0427/next', { pid: PLAYER_ID, round: 1, scramble: 'R U' }],
    ['/v1/battle/rooms/0427/settings', { pid: PLAYER_ID, syncStart: true }],
    ['/v1/battle/rooms/0427/admin', { pid: PLAYER_ID, target: PLAYER_ID }],
    ['/v1/battle/rooms/0427/kick', { pid: PLAYER_ID, target: 'target1234' }],
    ['/v1/battle/rooms/0427/leave', { pid: PLAYER_ID }],
  ])('rejects an unauthenticated mutation at %s', async (path, body) => {
    mocks.query.mockResolvedValueOnce([roomRow()]);

    const response = await post(path, body);

    expect(response.status).toBe(403);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
});
