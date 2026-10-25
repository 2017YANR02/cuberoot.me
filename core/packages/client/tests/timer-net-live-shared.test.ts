// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { useNetBattleLiveCube, useNetBattleLiveView, type UseNetBattleLiveCubeOptions } from '@cuberoot/timer-ui';
import { SOLVED_3X3, cubeMove } from '@cuberoot/puzzle-solvers/timer-333-cube';
import type { NetRoomState } from '@cuberoot/shared/timer';

class Socket extends EventTarget {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 1;
  sent: Record<string, unknown>[] = [];
  closes: number[] = [];
  constructor(readonly url: string) { super(); Socket.instances.push(this); }
  send(text: string) { this.sent.push(JSON.parse(text)); }
  close(code: number) { this.closes.push(code); this.readyState = 3; this.dispatchEvent(new CloseEvent('close', { code })); }
  message(data: unknown) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })); }
}
let root: Root;
let container: HTMLDivElement;
let live: ReturnType<typeof useNetBattleLiveCube>;
let view: ReturnType<typeof useNetBattleLiveView>;
const credentials = { playerId: 'player01', playerToken: 'private-token' };
const solve = async () => '';
const room: NetRoomState = {
  code: '1234', revision: 1, videoGeneration: 'test', roundRoster: [], event: '333', round: 1,
  scrambles: {}, players: Object.fromEntries(['player01', 'player02'].map(name => [name, { name, joined: 1, seen: 100, ph: 'idle' as const, at: 100 }])),
  results: {}, history: [], scores: {}, admin: 'player01', syncStart: false, startAt: null, now: 100,
};
function Probe({ round = 1, code = '1234' }: { round?: number; code?: string }) {
  const options: UseNetBattleLiveCubeOptions = { code, round, credentials, solve,
    websocketUrl: 'wss://example.invalid/live', localConnected: true, localFacelets: SOLVED_3X3 };
  live = useNetBattleLiveCube(options);
  view = useNetBattleLiveView({ room: { ...room, code, round }, pid: credentials.playerId,
    cubeConnected: true, localFacelets: SOLVED_3X3, liveCubePlayers: live.players, liveRoomReady: live.ready, language: 'en' });
  return null;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('WebSocket', Socket); Socket.instances = [];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('publishes ordered moves, reconstructs opponents, locks PK only after current snapshots and resets on the next round', async () => {
  await act(async () => root.render(h(Probe)));
  const socket = Socket.instances[0];
  await act(async () => socket.dispatchEvent(new Event('open')));
  expect(socket.sent[0]).toMatchObject({ type: 'hello', ...credentials, code: '1234' });
  await act(async () => socket.message({ type: 'ready', version: 1 }));
  expect(socket.sent.at(-1)).toMatchObject({ type: 'snapshot', round: 1, seq: 0, facelets: SOLVED_3X3 });
  await act(async () => socket.message({ type: 'presence', players: ['player01', 'player02'].map(playerId => ({ playerId, connected: true, smart: true, round: 1 })) }));
  expect(view.activePkLock).toBeNull();
  await act(async () => socket.message({ type: 'snapshot', playerId: 'player02', round: 1, seq: 0, facelets: SOLVED_3X3, updatedAt: 100 }));
  expect(view.activePkLock?.opponentId).toBe('player02');
  await act(async () => socket.message({ type: 'move', playerId: 'player02', round: 1, seq: 1, move: 'R', updatedAt: 101 }));
  expect(live.players.player02.facelets).toBe(cubeMove(SOLVED_3X3, 'R'));
  await act(async () => live.publishMove('U'));
  expect(socket.sent.at(-1)).toMatchObject({ type: 'move', round: 1, seq: 1, move: 'U' });
  await act(async () => socket.message({ type: 'presence', players: [] }));
  expect(view.activePkLock?.opponentId).toBe('player02');
  await act(async () => root.render(h(Probe, { round: 2 })));
  expect(view.activePkLock).toBeNull();
  expect(socket.sent.at(-1)).toMatchObject({ type: 'snapshot', round: 2, seq: 0 });
});

it('reconnects after a sequence gap and rejects late messages from the departed room', async () => {
  vi.useFakeTimers();
  await act(async () => root.render(h(Probe)));
  const socket = Socket.instances[0];
  await act(async () => socket.message({ type: 'snapshot', playerId: 'player02', round: 1, seq: 0, facelets: SOLVED_3X3, updatedAt: 100 }));
  await act(async () => socket.message({ type: 'move', playerId: 'player02', round: 1, seq: 2, move: 'R', updatedAt: 102 }));
  expect(socket.closes).toContain(1012);
  await act(async () => vi.advanceTimersByTime(500));
  expect(Socket.instances).toHaveLength(2);
  await act(async () => root.render(h(Probe, { code: '5678' })));
  expect(Socket.instances[1].closes).toContain(1000);
  await act(async () => socket.message({ type: 'snapshot', playerId: 'player02', round: 1, seq: 9, facelets: SOLVED_3X3, updatedAt: 110 }));
  expect(live.players).toEqual({});
});
