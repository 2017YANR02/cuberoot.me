import { describe, expect, it, vi } from 'vitest';
import {
  NET_EVENTS,
  createNetBattleClient,
  decodeNetRoomState,
  effectiveNetMs,
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

    const admission = await client.createNetRoom('333', "R U R'", { name: 'Cuber', wcaId: '2026TEST01', iso2: 'US' });
    await client.getNetRoom('0427', AUTH);
    await client.postNetStatus('0427', AUTH, 'solving');
    await client.postNetResult('0427', AUTH, 3, 9_870, '+2');
    await client.leaveNetRoom('0427', AUTH);

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/v1/battle/rooms',
      'https://api.example.test/v1/battle/rooms/0427?pid=playera123',
      'https://api.example.test/v1/battle/rooms/0427/status',
      'https://api.example.test/v1/battle/rooms/0427/result',
      'https://api.example.test/v1/battle/rooms/0427/leave',
    ]);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      event: '333',
      scramble: "R U R'",
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
    expect(JSON.parse(String(fetcher.mock.calls[3][1]?.body))).toEqual({
      pid: 'playera123',
      round: 3,
      t: 9_870,
      p: '+2',
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
