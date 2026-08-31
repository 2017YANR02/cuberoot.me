import { describe, expect, it, vi } from 'vitest';
import {
  NET_EVENTS,
  acceptNetRoomResponse,
  createNetBattleClient,
  createNetAdmissionGate,
  decodeNetRoomState,
  effectiveNetMs,
  isRoundComplete,
  isNetBattlePlayerId,
  isNetPenalty,
  isNetRoundParticipant,
  isNetWritablePhase,
  netPlayerEvent,
  netReadyRoster,
  pendingCount,
  roundWinners,
  preferLatestNetRoomState,
  settleNetRound,
  type NetRoomState,
} from '@cuberoot/shared/timer';
import * as webLogic from '@/lib/battle-room-logic';

const AUTH = { playerId: 'playera123', playerToken: 'a'.repeat(43) };

const ROOM: NetRoomState = {
  code: '0427',
  revision: 1,
  videoGeneration: '11111111-1111-4111-8111-111111111111',
  roundRoster: [],
  event: '333',
  round: 1,
  scrambles: { '333': "R U R' U'" },
  players: {},
  results: {},
  history: [],
  scores: {},
  admin: '',
  syncStart: false,
  startAt: null,
  now: 1_800_000_000_000,
};

describe('shared online battle migration', () => {
  it('serializes explicit admissions and lets a user choice supersede a delayed restore', () => {
    const gate = createNetAdmissionGate();
    const first = gate.beginExclusive();
    expect(first).toEqual(expect.any(Number));
    expect(gate.beginExclusive()).toBeNull();
    expect(gate.finish(first!)).toBe(true);

    const restore = gate.beginBackground();
    const manualJoin = gate.beginExclusive();
    expect(restore).toEqual(expect.any(Number));
    expect(manualJoin).toEqual(expect.any(Number));
    expect(gate.isCurrent(restore!)).toBe(false);
    expect(gate.isCurrent(manualJoin!)).toBe(true);
    gate.cancel();
    expect(gate.isCurrent(manualJoin!)).toBe(false);
  });

  it('keeps the Web compatibility module on the exact shared functions and registry', () => {
    expect(webLogic.effectiveNetMs).toBe(effectiveNetMs);
    expect(webLogic.roundWinners).toBe(roundWinners);
    expect(webLogic.NET_EVENTS).toBe(NET_EVENTS);
  });

  it('injects the host API origin without changing room paths or payloads', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ ...ROOM, ...AUTH }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const client = createNetBattleClient({
      apiUrl: (path) => `https://api.example.test${path}`,
      fetcher,
    });

    const admission = await client.createNetRoom('333', { name: 'Cuber', wcaId: '2026TEST01', iso2: 'US' });
    await client.getNetRoom('0427', AUTH);
    await client.postNetStatus('0427', AUTH, 'solving');
    await client.postNetEvent('0427', AUTH, '222');
    await client.ensureNetScramble('0427', AUTH, '222');
    await client.postNetResult('0427', AUTH, 3, 9_870, '+2');
    await client.nextNetRound('0427', AUTH, 3, true);
    await client.leaveNetRoom('0427', AUTH);

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/v1/battle/rooms',
      'https://api.example.test/v1/battle/rooms/0427?pid=playera123',
      'https://api.example.test/v1/battle/rooms/0427/status',
      'https://api.example.test/v1/battle/rooms/0427/event',
      'https://api.example.test/v1/battle/rooms/0427/scramble',
      'https://api.example.test/v1/battle/rooms/0427/result',
      'https://api.example.test/v1/battle/rooms/0427/next',
      'https://api.example.test/v1/battle/rooms/0427/leave',
    ]);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      event: '333',
      name: 'Cuber',
      wcaId: '2026TEST01',
      iso2: 'US',
    });
    expect(admission.credentials).toEqual(AUTH);
    expect(admission.state).toEqual(ROOM);
    expect(admission.state).not.toHaveProperty('playerId');
    expect(admission.state).not.toHaveProperty('playerToken');
    expect(fetcher.mock.calls[1][1]).toEqual({ headers: { 'X-Battle-Token': AUTH.playerToken } });
    for (const call of fetcher.mock.calls.slice(1)) {
      expect(new Headers(call[1]?.headers).get('X-Battle-Token')).toBe(AUTH.playerToken);
      expect(String(call[0])).not.toContain(AUTH.playerToken);
    }
    expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body))).toEqual({ pid: 'playera123', ph: 'solving' });
    expect(JSON.parse(String(fetcher.mock.calls[3][1]?.body))).toEqual({ pid: 'playera123', event: '222' });
    expect(JSON.parse(String(fetcher.mock.calls[4][1]?.body))).toEqual({ pid: 'playera123', event: '222' });
    expect(JSON.parse(String(fetcher.mock.calls[5][1]?.body))).toEqual({
      pid: 'playera123',
      round: 3,
      t: 9_870,
      p: '+2',
    });
    expect(JSON.parse(String(fetcher.mock.calls[6][1]?.body))).toEqual({
      pid: 'playera123',
      round: 3,
      force: true,
    });
  });

  it('preserves server error messages for the shared bilingual classifier', async () => {
    const client = createNetBattleClient({
      apiUrl: (path) => path,
      fetcher: vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ error: 'room full' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })),
    });

    await expect(client.joinNetRoom('0427', { name: 'Cuber' })).rejects.toThrow('room full');
  });

  it('rejects malformed or non-canonical room payloads at the transport boundary', () => {
    expect(() => decodeNetRoomState({ ...ROOM, event: 'banana' })).toThrow('invalid battle room response');
    expect(() => decodeNetRoomState({ ...ROOM, players: { p: { name: 'P' } } })).toThrow('invalid battle room response');
    expect(() => decodeNetRoomState({ ...ROOM, code: '../../video/token' })).toThrow('invalid battle room response');
    expect(() => decodeNetRoomState({ ...ROOM, round: 0 })).toThrow('invalid battle room response');
    expect(() => decodeNetRoomState({ ...ROOM, now: Number.NaN })).toThrow('invalid battle room response');
    expect(() => decodeNetRoomState({ ...ROOM, roundRoster: ['missing123'] })).toThrow('invalid battle room response');
  });

  it('freezes synchronized completion to the admitted roster and ignores later observers', () => {
    const now = ROOM.now;
    const players = {
      playera123: { name: 'A', joined: now, seen: now, ph: 'done' as const, at: now, event: '333' as const },
      playerb123: { name: 'B', joined: now, seen: now, ph: 'solving' as const, at: now, event: '333' as const },
      lateplayer: { name: 'Late', joined: now, seen: now, ph: 'idle' as const, at: now, event: '333' as const },
    };
    const state: NetRoomState = {
      ...ROOM,
      startAt: now - 1_000,
      roundRoster: ['playera123', 'playerb123'],
      players,
      results: { '1': { playera123: { t: 1_234, p: 'ok' } } },
    };

    expect(pendingCount(state)).toBe(1);
    expect(isRoundComplete(state)).toBe(false);
    const complete = {
      ...state,
      results: { '1': { ...state.results['1'], playerb123: { t: 2_345, p: 'ok' as const } } },
    };
    expect(pendingCount(complete)).toBe(0);
    expect(isRoundComplete(complete)).toBe(true);

    const defensiveEmpty = { ...state, roundRoster: [] };
    expect(pendingCount(defensiveEmpty)).toBe(0);
    expect(isNetRoundParticipant(defensiveEmpty, 'lateplayer')).toBe(false);
    expect(isNetRoundParticipant({ ...defensiveEmpty, startAt: null }, 'lateplayer')).toBe(true);
  });

  it('keeps server and clients on one player, phase, penalty, event, and ready-roster contract', () => {
    const now = ROOM.now;
    const players = {
      playera123: { name: 'A', joined: now - 2, seen: now, ph: 'ready' as const, at: now, event: '222' as const },
      playerb123: { name: 'B', joined: now - 1, seen: now, ph: 'ready' as const, at: now },
    };

    expect(isNetBattlePlayerId('playera123')).toBe(true);
    expect(isNetBattlePlayerId('P!')).toBe(false);
    expect(isNetWritablePhase('solving')).toBe(true);
    expect(isNetWritablePhase('done')).toBe(false);
    expect(isNetPenalty('+2')).toBe(true);
    expect(isNetPenalty('dns')).toBe(false);
    expect(netPlayerEvent(players.playera123, '333')).toBe('222');
    expect(netPlayerEvent(players.playerb123, '333')).toBe('333');
    expect(netReadyRoster({ players, results: {}, round: 1, now })).toEqual(['playera123', 'playerb123']);
    expect(netReadyRoster({
      players,
      results: { '1': { playerb123: { t: 1_234, p: 'ok' } } },
      round: 1,
      now,
    })).toBeNull();
  });

  it('rejects a non-canonical room code before constructing any request URL', async () => {
    const fetcher = vi.fn();
    const client = createNetBattleClient({ apiUrl: (path) => path, fetcher });

    expect(() => client.joinNetRoom('../../video/token', { name: 'Cuber' })).toThrow('invalid battle room code');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('keeps a newer room revision when a delayed poll response arrives last', () => {
    const newer = { ...ROOM, revision: 3, results: { '1': { playera123: { t: 1_234, p: 'ok' as const } } } };
    const delayed = { ...ROOM, revision: 2, results: {} };

    expect(preferLatestNetRoomState(newer, delayed)).toBe(newer);
    expect(preferLatestNetRoomState(delayed, newer)).toBe(newer);
    const sameRevisionOlderClock = { ...newer, now: newer.now - 1_000 };
    expect(preferLatestNetRoomState(newer, sameRevisionOlderClock)).toBe(newer);
  });

  it('cannot revive a room after its lifecycle has been cleared', () => {
    expect(acceptNetRoomResponse(null, null, ROOM)).toBeNull();
    expect(acceptNetRoomResponse('9999', null, ROOM)).toBeNull();
    expect(acceptNetRoomResponse('0427', null, ROOM)).toBe(ROOM);
  });

  it('preserves the server advanced marker while decoding the room payload', async () => {
    const client = createNetBattleClient({
      apiUrl: (path) => path,
      fetcher: vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
        ...ROOM,
        advanced: true,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    });

    await expect(client.postNetResult('0427', AUTH, 1, 1_234, 'ok')).resolves.toMatchObject({ advanced: true });
  });

  it('uses one shared event-group settlement rule for display winners and scored wins', () => {
    const settled = settleNetRound({
      a: { t: 10_000, p: 'ok' },
      b: { t: 8_000, p: '+2' },
      c: { t: 7_000, p: 'ok' },
    }, { a: '333', b: '333', c: '222' });
    expect(settled.winners.sort()).toEqual(['a', 'b', 'c']);
    expect(settled.scored.sort()).toEqual(['a', 'b']);
  });
});
