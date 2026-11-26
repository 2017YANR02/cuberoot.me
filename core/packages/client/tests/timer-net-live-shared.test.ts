// @vitest-environment jsdom
import { act, createElement as h, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { TimerNetPkArena, TimerNetBattleStage, useNetBattleCountdown, useNetBattleLiveCube, useNetBattleLiveView, type UseNetBattleLiveCubeOptions } from '@cuberoot/timer-ui';
import { SOLVED_3X3, cubeMove } from '@cuberoot/puzzle-solvers/timer-333-cube';
import type { NetRoomState } from '@cuberoot/shared/timer';
import { applyOrientation } from '@cuberoot/shared/smart-cube/orientation';

class Socket extends EventTarget {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 1;
  bufferedAmount = 0;
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
let renders = 0;
const credentials = { playerId: 'player01', playerToken: 'private-token' };
const solve = async () => '';
const room: NetRoomState = {
  code: '1234', revision: 1, videoGeneration: 'test', roundRoster: [], event: '333', round: 1,
  scrambles: {}, players: Object.fromEntries(['player01', 'player02'].map(name => [name, { name, joined: 1, seen: 100, ph: 'idle' as const, at: 100 }])),
  results: {}, history: [], scores: {}, admin: 'player01', syncStart: false, startAt: null, now: 100,
};
function Probe({ round = 1, code = '1234' }: { round?: number; code?: string }) {
  renders++;
  const options: UseNetBattleLiveCubeOptions = { code, round, credentials, solve,
    websocketUrl: 'wss://example.invalid/live', localConnected: true, localFacelets: SOLVED_3X3 };
  live = useNetBattleLiveCube(options);
  view = useNetBattleLiveView({ room: { ...room, code, round }, pid: credentials.playerId,
    cubeConnected: true, localFacelets: SOLVED_3X3, liveCubePlayers: live.players, liveRoomReady: live.ready, language: 'en' });
  return null;
}
beforeEach(() => {
  renders = 0;
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

it('sends the first pose immediately, coalesces bursts and backpressure, and keeps old servers compatible', async () => {
  vi.useFakeTimers();
  await act(async () => root.render(h(Probe)));
  const socket = Socket.instances[0];
  await act(async () => socket.message({ type: 'ready', version: 1 }));
  live.publishGyro({ w: 1, x: 0, y: 0, z: 0 });
  expect(socket.sent.some(m => m.type === 'gyro')).toBe(false);
  await act(async () => socket.message({ type: 'ready', version: 1, gyro: true }));
  vi.advanceTimersByTime(20);
  socket.sent = [];
  const q = { w: Math.SQRT1_2, x: 0, y: Math.SQRT1_2, z: 0 };
  live.publishGyro(q, { basis: 'rotX90', mirror: true });
  const expected = applyOrientation(q, null, { basis: 'rotX90', mirror: true });
  expect(socket.sent).toHaveLength(1);
  const sent = socket.sent[0].quaternion as typeof q;
  for (const key of ['w', 'x', 'y', 'z'] as const) expect(sent[key]).toBeCloseTo(expected[key], 5);
  socket.bufferedAmount = 100;
  for (let i = 0; i < 100; i++) live.publishGyro({ w: 0, x: 1, y: 0, z: 0 });
  live.publishGyro(q, { reference: q });
  vi.advanceTimersByTime(100);
  expect(socket.sent).toHaveLength(1);
  socket.bufferedAmount = 0;
  vi.advanceTimersByTime(20);
  expect(socket.sent).toHaveLength(2);
  expect(socket.sent.at(-1)).toMatchObject({ type: 'gyro', quaternion: { w: 1, x: 0, y: 0, z: 0 } });
  live.publishGyro(null);
  vi.advanceTimersByTime(20);
  expect(socket.sent.at(-1)).toMatchObject({ type: 'gyro', quaternion: null });
});

it('applies remote gyro samples without React renders, rejects old rounds and clears pose on disconnect', async () => {
  await act(async () => root.render(h(Probe)));
  const socket = Socket.instances[0];
  await act(async () => socket.message({ type: 'snapshot', playerId: 'player02', round: 1, seq: 0, facelets: SOLVED_3X3, updatedAt: 100 }));
  const pose = (round: number, w: number, x: number) => ({ type: 'gyro', playerId: 'player02', round, quaternion: { w, x, y: 0, z: 0 } });
  await act(async () => socket.message(pose(1, 1, 0)));
  const count = renders;
  const ref = live.players.player02.quatRef!;
  await act(async () => {
    for (let i = 0; i < 50; i++) socket.message(pose(1, 0, 1));
  });
  expect(renders).toBe(count);
  expect(ref.current).toEqual({ w: 0, x: 1, y: 0, z: 0 });
  await act(async () => socket.message(pose(2, 1, 0)));
  expect(ref.current?.x).toBe(1);
  await act(async () => socket.message({ type: 'presence', players: [] }));
  expect(ref.current).toBeNull();
});

it('cancels a queued pose when leaving the room and never leaks it to the next room', async () => {
  vi.useFakeTimers();
  await act(async () => root.render(h(Probe)));
  const socket = Socket.instances[0];
  await act(async () => socket.message({ type: 'ready', version: 1, gyro: true }));
  socket.bufferedAmount = 100;
  live.publishGyro({ w: 0, x: 1, y: 0, z: 0 });
  await act(async () => root.render(h(Probe, { code: '5678' })));
  const next = Socket.instances[1];
  await act(async () => next.message({ type: 'ready', version: 1, gyro: true }));
  vi.advanceTimersByTime(100);
  expect(next.sent.filter(m => m.type === 'gyro').every(m => m.quaternion === null)).toBe(true);
});

it('shows PK wins, the round winner and the signed effective-time gap', async () => {
  const results: NetRoomState['results'] = { '1': { player01: { t: 8_000, p: '+2' } } };
  const rename = vi.fn();
  const render = (onRename?: (name: string) => void) => act(async () => root.render(h(TimerNetPkArena, {
    room: { ...room, results, scores: { player01: 3, player02: 1 } },
    pid: 'player01', lock: { code: room.code, round: room.round, opponentId: 'player02', opponentName: 'Opponent' },
    onRename, liveCubePlayers: {}, ownStatus: 'Finished', language: 'en', liveCubeView: 'net',
    timerFont: 'segment', timerFontScale: 1, precision: 2, clockOffsetMs: null, children: null,
  })));
  const self = () => container.querySelector('.net-pk-side.is-self')!;
  const other = () => container.querySelector('.net-pk-side.is-opponent')!;
  await render(rename);
  const nameButton = self().querySelector<HTMLButtonElement>('button.net-pk-side-name')!;
  expect(nameButton.type).toBe('button');
  await act(async () => nameButton.click());
  expect(rename).toHaveBeenCalledExactlyOnceWith('player01');
  expect(other().querySelector('button.net-pk-side-name')).toBeNull();
  expect(self().querySelector('.net-pk-wins')?.textContent).toBe('3 wins');
  expect(other().querySelector('.net-pk-wins')?.textContent).toBe('1 win');
  expect(container.querySelector('[aria-label="Round winner"]')).toBeNull();
  expect(container.querySelector('.net-pk-gap')).toBeNull();

  results['1'].player02 = { t: 10_350, p: 'ok' };
  await render();
  expect(self().querySelector('button.net-pk-side-name')).toBeNull();
  expect(self().querySelector('[aria-label="Round winner"]')).not.toBeNull();
  expect(other().querySelector('[aria-label="Round winner"]')).toBeNull();
  expect(self().querySelector('.net-pk-gap')?.textContent).toBe('-0.35s');
  expect(other().querySelector('.net-pk-gap')?.textContent).toBe('+0.35s');

  results['1'].player02 = { t: 8_000, p: 'dnf' };
  await render();
  expect(self().querySelector('[aria-label="Round winner"]')).not.toBeNull();
  expect(container.querySelector('.net-pk-gap')).toBeNull();
});

it('copies the original scramble while displaying normalized moves and keeps device notices separate', async () => {
  vi.useFakeTimers();
  const writeText = vi.fn(async () => {});
  const render = (round: number, deviceNotice: string | null) => act(async () => root.render(h(TimerNetBattleStage, {
    timing: { phase: 'idle', colorClass: '', digits: '0.00', surfaceRef: createRef<HTMLDivElement>() },
    scramble: { scramble: "R U R'", match: true },
    copyScramble: { text: "x R U R' x'", writeText },
    status: { room: { ...room, round }, currentPlayerId: 'player01', idle: true, countdown: false, language: 'en',
      onPenalty: vi.fn(), onReady: vi.fn(), onNext: vi.fn() },
    error: 'Room request failed',
    deviceNotice,
  })));
  await render(1, 'Reconnecting to smart cube');
  const button = container.querySelector<HTMLButtonElement>('button.scramble-text')!;
  expect(button.textContent).toBe("R U R'");
  await act(async () => button.click());
  expect(writeText).toHaveBeenCalledExactlyOnceWith("x R U R' x'");
  expect(container.querySelector('.scramble-copied-check')).not.toBeNull();
  expect(container.querySelector('.timer-room-device-notice')?.getAttribute('role')).toBe('status');
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('Room request failed');

  await act(async () => vi.advanceTimersByTime(1_200));
  expect(container.querySelector('.scramble-copied-check')).toBeNull();
  await act(async () => button.click());
  await render(2, null);
  expect(container.querySelector('.scramble-copied-check')).toBeNull();
  expect(container.querySelector('.timer-room-device-notice')).toBeNull();
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('Room request failed');
});

it('plays each synchronized second once and consumes the start once despite offset corrections', async () => {
  vi.useFakeTimers();
  const play = vi.fn();
  const start = vi.fn(() => play('start'));
  const offset = { current: 0 };
  const deadline = Date.now() + 3_000;
  const log: number[] = [];
  function Countdown({ eligible }: { eligible: boolean }) {
    const second = useNetBattleCountdown({ scope: '1234:1:player01', startAt: deadline, eligible, offset,
      play: cue => { play(cue); log.push(Date.now() + offset.current - deadline); }, onStart: start });
    return h('span', null, second);
  }
  const render = (eligible: boolean) => act(async () => root.render(h(Countdown, { eligible })));
  await render(true);
  expect(container.textContent).toBe('3');
  await act(async () => vi.advanceTimersByTime(1_000));
  expect(container.textContent).toBe('2');
  offset.current = -200;
  await act(async () => vi.advanceTimersByTime(200));
  expect(container.textContent).toBe('2');
  await render(false);
  await render(true);
  expect(play).toHaveBeenCalledTimes(2);
  offset.current = 0;
  await act(async () => vi.advanceTimersByTime(800));
  expect(container.textContent).toBe('1');
  await act(async () => vi.advanceTimersByTime(1_000));
  expect(container.textContent).toBe('');
  expect(log).toEqual([-3_000, -2_000, -1_000]);
  expect(play.mock.calls).toEqual([['sync-countdown'], ['sync-countdown'], ['sync-countdown'], ['start']]);
  expect(start).toHaveBeenCalledExactlyOnceWith(0);
  await render(false);
  await render(true);
  expect(start).toHaveBeenCalledOnce();
});
