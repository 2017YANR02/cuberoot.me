import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
  retireBattleVideoGeneration: vi.fn(),
  generateNetBattleScramble: vi.fn(),
  generateNetBattleScrambleForSlot: vi.fn(),
}));

vi.mock('../src/db/connection.js', () => ({ query: mocks.query, withTransaction: mocks.withTransaction }));
vi.mock('../src/routes/video_rooms.js', () => ({ retireBattleVideoGeneration: mocks.retireBattleVideoGeneration }));
vi.mock('../src/utils/battle_scramble.js', () => ({
  generateNetBattleScramble: mocks.generateNetBattleScramble,
  generateNetBattleScrambleForSlot: mocks.generateNetBattleScrambleForSlot,
}));
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
    video_generation: '11111111-1111-4111-8111-111111111111',
    round_roster: [],
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
    mocks.retireBattleVideoGeneration.mockReset();
    mocks.generateNetBattleScramble.mockReset();
    mocks.generateNetBattleScramble.mockImplementation(async (event: string) => `SERVER-${event}`);
    mocks.generateNetBattleScrambleForSlot.mockReset();
    mocks.generateNetBattleScrambleForSlot.mockImplementation(async (_slot: string, event: string) => `SERVER-${event}`);
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

  it('keeps revision and self-hosted media generation in every schema source and write', () => {
    const route = readFileSync(new URL('../src/routes/battle_rooms.ts', import.meta.url), 'utf8');
    const migration192 = readFileSync(new URL('../migrations/0196_battle_room_revision.sql', import.meta.url), 'utf8');
    const migration193 = readFileSync(new URL('../migrations/0197_battle_room_video_generation.sql', import.meta.url), 'utf8');
    const schema = readFileSync(new URL('../src/db/schema.pg.sql', import.meta.url), 'utf8');
    const updates = route.split('UPDATE battle_rooms').slice(1).map((part) => part.split('RETURNING')[0]);

    expect(migration192).toContain('revision BIGINT NOT NULL DEFAULT 1');
    expect(migration193).toContain('video_generation UUID NOT NULL DEFAULT gen_random_uuid()');
    expect(schema).toContain('revision     BIGINT NOT NULL DEFAULT 1');
    expect(schema).toContain('video_generation UUID NOT NULL DEFAULT gen_random_uuid()');
    expect(route).toContain("COALESCE(players -> ? ->> 'event', event) = ?");
    expect(updates.length).toBeGreaterThanOrEqual(10);
    expect(updates.every((statement) => statement.includes('revision = revision + 1'))).toBe(true);
  });

  it('returns a one-player capability while persisting only its digest', async () => {
    mocks.query.mockResolvedValueOnce([]).mockImplementationOnce(async (_sql, params: unknown[]) => [{
      ...roomRow(),
      code: params[0],
      event: params[1],
      scrambles: params[2],
      players: params[3],
      player_auth: params[4],
      admin: params[5],
    }]);

    const response = await post('/v1/battle/rooms', { event: '333', scramble: 'MALICIOUS CLIENT SCRAMBLE', name: 'Cuber' });
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.playerId).toEqual(expect.any(String));
    expect(body.playerToken).toEqual(expect.stringMatching(/^[A-Za-z0-9_-]{40,128}$/));
    expect(body.revision).toBe(1);
    expect(body.videoGeneration).toBe('11111111-1111-4111-8111-111111111111');
    expect(body).not.toHaveProperty('player_auth');

    const insert = mocks.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO battle_rooms'));
    expect(insert).toBeTruthy();
    const params = insert![1] as unknown[];
    const auth = params[4] as Record<string, string>;
    expect(auth[body.playerId as string]).toBe(hashBattlePlayerToken(body.playerToken as string));
    expect(JSON.stringify(params)).not.toContain(body.playerToken as string);
    expect(mocks.generateNetBattleScramble).toHaveBeenCalledWith('333');
    expect(params[2]).toEqual({ '333': 'SERVER-333' });
    expect(JSON.stringify(params)).not.toContain('MALICIOUS CLIENT SCRAMBLE');
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

  it('rejects a different room member capability used with another public player id', async () => {
    const otherId = 'player5678';
    const otherToken = 'b'.repeat(43);
    const room = roomRow();
    room.players[otherId] = { name: 'Second', joined: Date.now(), seen: Date.now(), ph: 'idle', at: Date.now(), event: '333' };
    room.player_auth[otherId] = hashBattlePlayerToken(otherToken);
    mocks.query.mockResolvedValueOnce([room]);

    const response = await post('/v1/battle/rooms/0427/status', { pid: PLAYER_ID, ph: 'ready' }, otherToken);

    expect(response.status).toBe(403);
    expect(mocks.query).toHaveBeenCalledOnce();
  });

  it('checks the capability again inside the heartbeat UPDATE', async () => {
    const active = { ...roomRow(), sync_start: true, start_at: Date.now() - 1_000, round_roster: [PLAYER_ID] };
    mocks.query.mockResolvedValueOnce([active]).mockResolvedValueOnce([active]);

    const response = await app.request(`/v1/battle/rooms/0427?pid=${PLAYER_ID}`, {
      headers: { 'X-Battle-Token': PLAYER_TOKEN },
    });

    expect(response.status).toBe(200);
    const update = mocks.query.mock.calls[1];
    expect(update[0]).toContain('player_auth ->> ? = ?');
    expect(update[0]).not.toContain('start_at = CASE');
    expect(update[0]).toContain("THEN jsonb_build_object('ph', 'idle', 'at', ?::bigint)");
    expect(update[1]).toContain(hashBattlePlayerToken(PLAYER_TOKEN));
    expect((await response.json() as { startAt: number | null }).startAt).toBe(active.start_at);
  });

  it('locks the room row while advancing so join/kick/leave snapshots cannot be overwritten', async () => {
    const before = { ...roomRow(), results: { '1': { [PLAYER_ID]: { t: 1_234, p: 'ok' } } } };
    const after = { ...before, round: 2, history: [{ round: 1, scrambles: before.scrambles, playerEvents: { [PLAYER_ID]: '333' }, results: {}, winners: [] }] };
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([before]).mockResolvedValueOnce([after]);

    const response = await post('/v1/battle/rooms/0427/next', {
      pid: PLAYER_ID,
      round: 1,
      scramble: "U R U'",
    }, PLAYER_TOKEN);

    expect(response.status).toBe(200);
    expect(mocks.withTransaction).toHaveBeenCalledOnce();
    expect(mocks.query.mock.calls[1][0]).toContain('FOR UPDATE');
    expect(mocks.query.mock.calls[2][0]).toContain('UPDATE battle_rooms');
    expect(mocks.query.mock.calls[2][1][0]).toEqual({ '333': 'SERVER-333' });
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

  it('preserves the visible skip-waiting action only when the client explicitly forces it', async () => {
    const secondId = 'player5678';
    const before = { ...roomRow(), results: { '1': { [PLAYER_ID]: { t: 1_234, p: 'ok' } } } };
    before.players[secondId] = {
      name: 'Second', joined: Date.now(), seen: Date.now(), ph: 'solving', at: Date.now(), event: '333',
    };
    before.player_auth[secondId] = hashBattlePlayerToken('b'.repeat(43));
    const after = { ...before, round: 2, results: {}, round_roster: [] };
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([before]).mockResolvedValueOnce([after]);

    const response = await post('/v1/battle/rooms/0427/next', {
      pid: PLAYER_ID, round: 1, scramble: "U R U'", force: true,
    }, PLAYER_TOKEN);

    expect(response.status).toBe(200);
    expect(mocks.query.mock.calls[2][0]).toContain('UPDATE battle_rooms');
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

  it('freezes the exact ready roster when the final contender starts synchronized countdown', async () => {
    const secondId = 'player5678';
    const before = { ...roomRow(), sync_start: true };
    before.players[secondId] = {
      name: 'Second', joined: Date.now(), seen: Date.now(), ph: 'ready', at: Date.now(), event: '333',
    };
    before.player_auth[secondId] = hashBattlePlayerToken('b'.repeat(43));
    const after = {
      ...before,
      start_at: Date.now() + 3_000,
      round_roster: [PLAYER_ID, secondId],
      players: { ...before.players, [PLAYER_ID]: { ...before.players[PLAYER_ID]!, ph: 'ready' as const } },
    };
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([after]);

    const response = await post('/v1/battle/rooms/0427/status', { pid: PLAYER_ID, ph: 'ready' }, PLAYER_TOKEN);

    expect(response.status).toBe(200);
    expect(mocks.query.mock.calls[1][1][1]).toEqual(expect.any(Number));
    expect(mocks.query.mock.calls[1][1][2]).toEqual([PLAYER_ID, secondId]);
  });

  it('rejects an active phase before a synchronized start without cancelling the countdown', async () => {
    const waiting = { ...roomRow(), sync_start: true, start_at: Date.now() + 3_000, round_roster: [PLAYER_ID] };
    mocks.query.mockResolvedValueOnce([waiting]);

    const response = await post('/v1/battle/rooms/0427/status', {
      pid: PLAYER_ID, ph: 'solving',
    }, PLAYER_TOKEN);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'wait for synchronized start' });
    expect(mocks.query).toHaveBeenCalledOnce();
  });

  it('rejects a fake active phase after that player already submitted', async () => {
    const submitted = { ...roomRow(), results: { '1': { [PLAYER_ID]: { t: 1_234, p: 'ok' as const } } } };
    mocks.query.mockResolvedValueOnce([submitted]);

    const response = await post('/v1/battle/rooms/0427/status', {
      pid: PLAYER_ID, ph: 'solving',
    }, PLAYER_TOKEN);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'round already submitted' });
    expect(mocks.query).toHaveBeenCalledOnce();
  });

  it('rejects a non-roster observer from changing phase or submitting in an active synchronized round', async () => {
    const observerId = 'observer12';
    const observerToken = 'b'.repeat(43);
    const active = { ...roomRow(), sync_start: true, start_at: Date.now() - 1_000, round_roster: [PLAYER_ID] };
    active.players[observerId] = {
      name: 'Observer', joined: Date.now(), seen: Date.now(), ph: 'idle', at: Date.now(), event: '333',
    };
    active.player_auth[observerId] = hashBattlePlayerToken(observerToken);
    mocks.query
      .mockResolvedValueOnce([active])
      .mockResolvedValueOnce([active])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([active]);

    const status = await post('/v1/battle/rooms/0427/status', { pid: observerId, ph: 'solving' }, observerToken);
    const result = await post('/v1/battle/rooms/0427/result', {
      pid: observerId, round: 1, t: 1_234, p: 'ok',
    }, observerToken);

    expect(status.status).toBe(409);
    expect(await status.json()).toEqual({ error: 'wait for next round' });
    expect(result.status).toBe(409);
    expect(await result.json()).toEqual({ error: 'wait for next round' });
  });

  it('rejects an early result before a synchronized roster has started', async () => {
    const waiting = { ...roomRow(), sync_start: true, start_at: null, round_roster: [] };
    mocks.query.mockResolvedValueOnce([waiting]).mockResolvedValueOnce([]).mockResolvedValueOnce([waiting]);

    const response = await post('/v1/battle/rooms/0427/result', {
      pid: PLAYER_ID, round: 1, t: 1_234, p: 'ok',
    }, PLAYER_TOKEN);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'wait for synchronized start' });
  });

  it('classifies an old delayed result as advanced before consulting the new round roster', async () => {
    const otherId = 'player5678';
    const current = { ...roomRow(), round: 2, sync_start: true, start_at: Date.now() - 1_000, round_roster: [otherId] };
    current.players[otherId] = {
      name: 'Second', joined: Date.now(), seen: Date.now(), ph: 'solving', at: Date.now(), event: '333',
    };
    current.player_auth[otherId] = hashBattlePlayerToken('b'.repeat(43));
    mocks.query.mockResolvedValueOnce([current]).mockResolvedValueOnce([]).mockResolvedValueOnce([current]);

    const response = await post('/v1/battle/rooms/0427/result', {
      pid: PLAYER_ID, round: 1, t: 1_234, p: 'ok',
    }, PLAYER_TOKEN);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ advanced: true, round: 2 });
  });

  it('allows a repeated penalty update but preserves the originally submitted time', async () => {
    const before = { ...roomRow(), results: { '1': { [PLAYER_ID]: { t: 1_234, p: 'ok' } } } };
    const after = { ...before, results: { '1': { [PLAYER_ID]: { t: 1_234, p: 'dnf' } } } };
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([after]);

    const response = await post('/v1/battle/rooms/0427/result', {
      pid: PLAYER_ID, round: 1, t: 99_999, p: 'dnf',
    }, PLAYER_TOKEN);
    const body = await response.json() as { results: Record<string, Record<string, { t: number; p: string }>> };

    expect(response.status).toBe(200);
    expect(body.results['1']?.[PLAYER_ID]).toEqual({ t: 1_234, p: 'dnf' });
    const updateSql = String(mocks.query.mock.calls[1][0]);
    expect(updateSql).toContain("THEN (results -> ? -> ?) || jsonb_build_object('p', ?::text)");
  });

  it('cancels a future synchronized countdown when a player withdraws readiness', async () => {
    const before = { ...roomRow(), sync_start: true, start_at: Date.now() + 3_000, round_roster: [PLAYER_ID] };
    const after = { ...before, start_at: null, players: { ...before.players, [PLAYER_ID]: { ...before.players[PLAYER_ID]!, ph: 'idle' } } };
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([after]);

    const response = await post('/v1/battle/rooms/0427/status', { pid: PLAYER_ID, ph: 'idle' }, PLAYER_TOKEN);

    expect(response.status).toBe(200);
    expect(mocks.query.mock.calls[1][1][1]).toBeNull();
  });

  it('turning sync off cancels only a future countdown', async () => {
    const before = { ...roomRow(), sync_start: true, start_at: Date.now() + 3_000, round_roster: [PLAYER_ID] };
    const after = { ...before, sync_start: false, start_at: null, round_roster: [] };
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([after]);

    const response = await post('/v1/battle/rooms/0427/settings', { pid: PLAYER_ID, syncStart: false }, PLAYER_TOKEN);

    expect(response.status).toBe(200);
    const sql = String(mocks.query.mock.calls[1][0]);
    expect(sql).toContain('clock_timestamp()');
  });

  it('turning sync off preserves an already-started roster until next round', async () => {
    const before = { ...roomRow(), sync_start: true, start_at: Date.now() - 1_000, round_roster: [PLAYER_ID] };
    const after = { ...before, sync_start: false };
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([after]);

    const response = await post('/v1/battle/rooms/0427/settings', { pid: PLAYER_ID, syncStart: false }, PLAYER_TOKEN);
    const body = await response.json() as { startAt: number | null; roundRoster: string[] };

    expect(response.status).toBe(200);
    expect(body.startAt).toBe(before.start_at);
    expect(body.roundRoster).toEqual([PLAYER_ID]);
  });

  it('cannot enable synchronized start after this round already has a result', async () => {
    const active = { ...roomRow(), results: { '1': { [PLAYER_ID]: { t: 1_234, p: 'ok' } } } };
    mocks.query.mockResolvedValueOnce([active]);

    const response = await post('/v1/battle/rooms/0427/settings', { pid: PLAYER_ID, syncStart: true }, PLAYER_TOKEN);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'round already active' });
    expect(mocks.query).toHaveBeenCalledOnce();
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
    mocks.query.mockResolvedValueOnce([submitted]);

    const response = await post('/v1/battle/rooms/0427/event', {
      pid: PLAYER_ID, event: '222', scramble: "R U R'",
    }, PLAYER_TOKEN);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'round already submitted' });
    expect(mocks.generateNetBattleScrambleForSlot).not.toHaveBeenCalled();
  });

  it('only lets a player fill a scramble for their own current event', async () => {
    const before = roomRow();
    mocks.query.mockResolvedValueOnce([before]);

    const response = await post('/v1/battle/rooms/0427/scramble', {
      pid: PLAYER_ID, event: '222', scramble: "R U R'",
    }, PLAYER_TOKEN);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'event does not match player' });
    expect(mocks.generateNetBattleScrambleForSlot).not.toHaveBeenCalled();
  });

  it('returns an existing authoritative scramble without regenerating or trusting request text', async () => {
    const before = roomRow();
    mocks.query.mockResolvedValueOnce([before]);

    const response = await post('/v1/battle/rooms/0427/scramble', {
      pid: PLAYER_ID, event: '333', scramble: 'MALICIOUS CLIENT SCRAMBLE',
    }, PLAYER_TOKEN);
    const body = await response.json() as { scrambles: Record<string, string> };

    expect(response.status).toBe(200);
    expect(body.scrambles['333']).toBe("R U R'");
    expect(mocks.generateNetBattleScrambleForSlot).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledOnce();
  });

  it('fills a missing scramble from the server generator and ignores request text', async () => {
    const before = { ...roomRow(), scrambles: {} };
    const after = { ...before, scrambles: { '333': 'SERVER-333' }, revision: 2 };
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([after]);

    const response = await post('/v1/battle/rooms/0427/scramble', {
      pid: PLAYER_ID, event: '333', scramble: 'MALICIOUS CLIENT SCRAMBLE',
    }, PLAYER_TOKEN);

    expect(response.status).toBe(200);
    expect(mocks.generateNetBattleScrambleForSlot).toHaveBeenCalledWith('0427:1:333', '333');
    expect(mocks.query.mock.calls[1][1]).toContain('SERVER-333');
    expect(JSON.stringify(mocks.query.mock.calls[1][1])).not.toContain('MALICIOUS CLIENT SCRAMBLE');
  });

  it('does not let a slow scramble request write its old-round value into the next round', async () => {
    const before = { ...roomRow(), scrambles: {} };
    const advanced = { ...roomRow(), round: 2, revision: 2, scrambles: { '333': 'ROUND-2' } };
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([]).mockResolvedValueOnce([advanced]);

    const response = await post('/v1/battle/rooms/0427/scramble', {
      pid: PLAYER_ID, event: '333', scramble: 'MALICIOUS CLIENT SCRAMBLE',
    }, PLAYER_TOKEN);
    const body = await response.json() as { round: number; scrambles: Record<string, string> };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ round: 2, scrambles: { '333': 'ROUND-2' } });
    expect(mocks.query.mock.calls[1][0]).toContain('WHERE code = ? AND round = ?');
    expect(mocks.query.mock.calls[1][1]).toContain(1);
  });

  it('returns the advanced room when a slow event change loses its round CAS', async () => {
    const before = roomRow();
    const advanced = { ...roomRow(), round: 2, revision: 2, scrambles: { '333': 'ROUND-2' } };
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([]).mockResolvedValueOnce([advanced]);

    const response = await post('/v1/battle/rooms/0427/event', {
      pid: PLAYER_ID, event: '222', scramble: 'MALICIOUS CLIENT SCRAMBLE',
    }, PLAYER_TOKEN);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ round: 2, scrambles: { '333': 'ROUND-2' } });
    expect(mocks.query.mock.calls[1][0]).toContain('WHERE code = ? AND round = ?');
    expect(mocks.query.mock.calls[1][1]).toContain(1);
  });

  it('does not let a non-roster observer inject a scramble into an active round', async () => {
    const observerId = 'observer12';
    const observerToken = 'b'.repeat(43);
    const active = { ...roomRow(), sync_start: true, start_at: Date.now() - 1_000, round_roster: [PLAYER_ID] };
    active.players[observerId] = {
      name: 'Observer', joined: Date.now(), seen: Date.now(), ph: 'idle', at: Date.now(), event: '333',
    };
    active.player_auth[observerId] = hashBattlePlayerToken(observerToken);
    mocks.query.mockResolvedValueOnce([active]);

    const response = await post('/v1/battle/rooms/0427/scramble', {
      pid: observerId, event: '333', scramble: "R U R'",
    }, observerToken);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'wait for next round' });
    expect(mocks.generateNetBattleScrambleForSlot).not.toHaveBeenCalled();
  });

  it('rejects advancing the maximum PostgreSQL integer round instead of overflowing', async () => {
    const current = {
      ...roomRow(), round: 2_147_483_647,
      results: { '2147483647': { [PLAYER_ID]: { t: 1_234, p: 'ok' } } },
    };
    mocks.query.mockResolvedValueOnce([current]);

    const response = await post('/v1/battle/rooms/0427/next', {
      pid: PLAYER_ID, round: 2_147_483_647, scramble: "R U R'", force: true,
    }, PLAYER_TOKEN);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'round limit reached' });
    expect(mocks.query).toHaveBeenCalledOnce();
  });

  it('settles and archives only the frozen roster, not active-round observers', async () => {
    const observerId = 'observer12';
    const before = {
      ...roomRow(), sync_start: true, start_at: Date.now() - 1_000, round_roster: [PLAYER_ID],
      results: { '1': {
        [PLAYER_ID]: { t: 1_234, p: 'ok' },
        [observerId]: { t: 1, p: 'ok' },
      } },
    };
    before.players[observerId] = {
      name: 'Observer', joined: Date.now(), seen: Date.now(), ph: 'done', at: Date.now(), event: '222',
    };
    before.player_auth[observerId] = hashBattlePlayerToken('b'.repeat(43));
    const after = { ...before, round: 2, start_at: null, round_roster: [], results: {} };
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([before]).mockResolvedValueOnce([after]);

    const response = await post('/v1/battle/rooms/0427/next', {
      pid: PLAYER_ID, round: 1, scramble: "R U R'", force: true,
    }, PLAYER_TOKEN);

    expect(response.status).toBe(200);
    const history = mocks.query.mock.calls[2][1][1] as Array<{ playerEvents: Record<string, string>; results: Record<string, unknown> }>;
    expect(history.at(-1)?.playerEvents).toEqual({ [PLAYER_ID]: '333' });
    expect(history.at(-1)?.results).toEqual({ [PLAYER_ID]: { t: 1_234, p: 'ok' } });
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

  it('kicks under one row lock, rotates generation, and evicts the exact previous media room', async () => {
    const target = 'target1234';
    const before = roomRow();
    before.players[target] = { name: 'Target', joined: Date.now(), seen: Date.now(), ph: 'idle', at: Date.now(), event: '333' };
    before.player_auth[target] = hashBattlePlayerToken('b'.repeat(43));
    before.results = { '1': { [PLAYER_ID]: { t: 1_234, p: 'ok' }, [target]: { t: 2_345, p: 'ok' } } };
    const after = {
      ...before,
      revision: 2,
      video_generation: '22222222-2222-4222-8222-222222222222',
      players: { [PLAYER_ID]: before.players[PLAYER_ID]! },
      player_auth: { [PLAYER_ID]: before.player_auth[PLAYER_ID]! },
    };
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([after]);

    const response = await post('/v1/battle/rooms/0427/kick', { pid: PLAYER_ID, target }, PLAYER_TOKEN);

    expect(response.status).toBe(200);
    expect(mocks.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(mocks.query.mock.calls[1][0]).toContain('video_generation = gen_random_uuid()');
    expect(mocks.query.mock.calls[1][0]).toContain('start_at IS NOT NULL');
    expect(after.results).toEqual(before.results);
    expect(mocks.retireBattleVideoGeneration).toHaveBeenCalledWith('0427', before.video_generation);
  });

  it('cancels and clears an active round when its final roster member is kicked', async () => {
    const target = 'target1234';
    const before = { ...roomRow(), sync_start: true, start_at: Date.now() - 1_000, round_roster: [target] };
    before.players[target] = { name: 'Target', joined: Date.now(), seen: Date.now(), ph: 'done', at: Date.now(), event: '333' };
    before.player_auth[target] = hashBattlePlayerToken('b'.repeat(43));
    before.results = { '1': { [target]: { t: 2_345, p: 'ok' } } };
    const after = {
      ...before,
      start_at: null,
      round_roster: [],
      results: {},
      players: { [PLAYER_ID]: before.players[PLAYER_ID]! },
      player_auth: { [PLAYER_ID]: before.player_auth[PLAYER_ID]! },
    };
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([after]);

    const response = await post('/v1/battle/rooms/0427/kick', { pid: PLAYER_ID, target }, PLAYER_TOKEN);
    const body = await response.json() as { startAt: number | null; roundRoster: string[]; results: object };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ startAt: null, roundRoster: [], results: {} });
  });

  it('leaves under one row lock and evicts from the exact pre-rotation generation', async () => {
    const before = roomRow();
    mocks.query.mockResolvedValueOnce([before]).mockResolvedValueOnce([{ players: {} }]).mockResolvedValueOnce([]);

    const response = await post('/v1/battle/rooms/0427/leave', { pid: PLAYER_ID }, PLAYER_TOKEN);

    expect(response.status).toBe(200);
    expect(mocks.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(mocks.query.mock.calls[1][0]).toContain('start_at IS NOT NULL');
    expect(mocks.retireBattleVideoGeneration).toHaveBeenCalledWith('0427', before.video_generation);
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
