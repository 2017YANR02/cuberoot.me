import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TimerHttpRequest } from '@cuberoot/shared/timer/http';
import { createNetBattleSessionStore, type NetRoomState } from '@cuberoot/shared/timer/net-battle';
import { createNativeNetBattleClient, createNativeTimerNetRoom } from '../src/lib/native-timer-net-room';

const code = '4815';
const auth = { playerId: 'player1', playerToken: 'a'.repeat(43) };

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function state(overrides: Partial<NetRoomState> = {}): NetRoomState {
  const now = Date.now();
  return {
    code, revision: 1, videoGeneration: '10000000-0000-4000-8000-000000000000', round: 1,
    event: '333', scrambles: { '333': 'R U' }, results: {}, history: [], scores: {},
    players: {
      player1: { name: 'One', joined: now, seen: now, ph: 'idle', at: now },
      player2: { name: 'Two', joined: now + 1, seen: now, ph: 'idle', at: now },
    },
    admin: 'player1', now, syncStart: false, startAt: null, roundRoster: [], ...overrides,
  };
}

function reply(value: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => structuredClone(value) };
}

function fixture(overrides?: Partial<NetRoomState>) {
  let room = state(overrides);
  let rawSession: string | null = null;
  const sessions = createNetBattleSessionStore({
    getItem: () => rawSession, setItem: (_key, value) => { rawSession = value; },
    removeItem: () => { rawSession = null; },
  });
  let failGet = false;
  const fetcher = vi.fn(async (path: string, request?: TimerHttpRequest) => {
    const payload = request?.body ? JSON.parse(request.body) : null;
    if (path === '/battle/rooms' || path.endsWith('/join')) return reply({ ...room, ...auth });
    expect(request?.headers?.['X-Battle-Token']).toBe(auth.playerToken);
    if (path.endsWith('/leave')) return reply({});
    if (path.endsWith('/status')) {
      room = { ...room, players: { ...room.players,
        player1: { ...room.players.player1, ph: payload.ph, at: Date.now() } } };
      if (room.syncStart && payload.ph === 'ready') {
        room.startAt = Date.now() + 250;
        room.roundRoster = ['player1', 'player2'];
      }
    } else if (path.endsWith('/result')) {
      room = { ...room, results: { ...room.results,
        [payload.round]: { player1: { t: payload.t, p: payload.p } } } };
    } else if (path.endsWith('/next')) {
      room = { ...room, round: room.round + 1, scrambles: { '333': 'F2' },
        startAt: null, roundRoster: [] };
    } else if (path.endsWith('/event')) {
      room = { ...room, players: { ...room.players, player1: { ...room.players.player1, event: payload.event } } };
    } else if (path.endsWith('/scramble')) {
      room = { ...room, scrambles: { ...room.scrambles, [payload.event]: 'R2 U' } };
    } else if (request?.method === undefined && failGet) return reply({}, 503);
    return reply(room = { ...room, now: Date.now(), revision: room.revision + 1 });
  });
  return { sessions, fetcher, client: createNativeNetBattleClient(fetcher), failGet: (value: boolean) => { failGet = value; } };
}

describe('native online rooms', () => {
  it('creates, times, submits a result, changes the penalty, advances and leaves over the shared client', async () => {
    vi.useFakeTimers();
    const { client, fetcher, sessions } = fixture();
    const record = vi.fn();
    const net = createNativeTimerNetRoom({ client, sessions, restoreOnMount: false,
      settings: () => ({ holdMs: 100 }), onRecordSolve: record });
    try {
      expect(await net.create('333', { name: 'One' })).toBe(true);
      expect(await sessions.load()).toMatchObject({ code, ...auth });
      expect(JSON.stringify(net.snapshot())).not.toContain(auth.playerToken);
      expect(net.snapshot()).toMatchObject({ scramble: 'R U', phase: 'idle', admin: true, canStart: true });
      expect(net.down(10)).toBe(true);
      expect(net.up(11)).toBe(false);
      await vi.advanceTimersByTimeAsync(100);
      expect(net.up(10)).toBe(true);
      await vi.advanceTimersByTimeAsync(1400);
      expect(net.down(12)).toBe(true);
      net.up(12);
      await vi.advanceTimersByTimeAsync(0);
      expect(net.snapshot()).toMatchObject({ result: { t: 1400, p: 'ok' }, resultPending: false, display: '1.400' });
      expect(record).toHaveBeenCalledWith(expect.objectContaining({ solve: expect.objectContaining({ scramble: 'R U', timeMs: 1400 }) }));
      expect(await net.setPenalty('+2')).toBe(true);
      expect(net.snapshot()).toMatchObject({ display: '3.400+', result: { t: 1400, p: '+2' } });
      await net.next();
      expect(net.snapshot()).toMatchObject({ room: { round: 2 }, result: null, scramble: 'F2', phase: 'idle' });
      await net.leave();
      expect(await sessions.load()).toBeNull();
      expect(fetcher.mock.calls.some(([path]) => path.endsWith('/leave'))).toBe(true);
    } finally { net.dispose(); }
  });

  it('obeys the server clock and roster for synchronized attempts', async () => {
    vi.useFakeTimers();
    const { client, sessions } = fixture({ syncStart: true });
    const net = createNativeTimerNetRoom({ client, sessions, restoreOnMount: false });
    try {
      await net.create('333');
      expect(net.snapshot()).toMatchObject({ gate: { gated: true, ready: false }, canStart: false });
      expect(await net.toggleReady()).toBe(true);
      expect(net.snapshot().countdownMs).toBe(250);
      expect(net.down(10)).toBe(false);
      await vi.advanceTimersByTimeAsync(249);
      expect(net.snapshot().phase).toBe('idle');
      await vi.advanceTimersByTimeAsync(1);
      expect(net.snapshot()).toMatchObject({ phase: 'running', countdownMs: null });
      await vi.advanceTimersByTimeAsync(1300);
      expect(net.down(11)).toBe(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(net.snapshot().result).toEqual({ t: 1300, p: 'ok' });
    } finally { net.dispose(); }
  });

  it('keeps the saved capability through a temporary failure and rejoins without a new membership', async () => {
    vi.useFakeTimers();
    const { client, fetcher, sessions, failGet } = fixture();
    const net = createNativeTimerNetRoom({ client, sessions, restoreOnMount: false });
    try {
      await sessions.save({ code, name: 'One', ...auth });
      failGet(true);
      expect(await net.join(code)).toBe(false);
      expect(await sessions.load()).toMatchObject({ code, ...auth });
      failGet(false);
      expect(await net.join(code)).toBe(true);
      expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
        '/battle/rooms/4815?pid=player1', '/battle/rooms/4815?pid=player1',
      ]);
    } finally { net.dispose(); }
    expect(await sessions.load()).toMatchObject({ code, ...auth });
  });

  it('uses the room event scramble and resumes shared polling when visible again', async () => {
    vi.useFakeTimers();
    const { client, fetcher, sessions } = fixture();
    const net = createNativeTimerNetRoom({ client, sessions, restoreOnMount: false });
    try {
      await net.create('333');
      expect(await net.setEvent('222')).toBe(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(net.snapshot()).toMatchObject({ event: '222', scramble: 'R2 U' });
      net.setVisible(false);
      const before = fetcher.mock.calls.length;
      await vi.advanceTimersByTimeAsync(1500);
      expect(fetcher).toHaveBeenCalledTimes(before);
      net.setVisible(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetcher.mock.calls.at(-1)?.[0]).toBe('/battle/rooms/4815?pid=player1');
    } finally { net.dispose(); }
  });

  it('uses the existing mini-program HTTPS transport without duplicating the version path', async () => {
    const request = vi.fn((options: WechatMiniprogram.RequestOption) => {
      options.success?.({ statusCode: 200, data: state(), header: {}, cookies: [], errMsg: 'request:ok' } as never);
      return { abort() {} };
    });
    vi.stubGlobal('wx', {
      request,
      getStorageSync: (key: string) => key === 'cuberoot:session'
        ? { token: 'fixture-account-token', user: { uid: 17, name: 'Cubing guest', wcaId: null } } : '',
    });
    await createNativeNetBattleClient().getNetRoom(code, auth);
    expect(request.mock.calls[0][0]).toMatchObject({
      url: 'https://api.cuberoot.me/v1/battle/rooms/4815?pid=player1',
      header: { Authorization: 'Bearer fixture-account-token', 'X-Battle-Token': auth.playerToken },
    });
  });
});
