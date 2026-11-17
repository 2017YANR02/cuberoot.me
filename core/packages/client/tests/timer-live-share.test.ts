// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTimerLiveConnection, useTimerLiveShare } from '@cuberoot/timer-ui/live-share';
import type { TimerLiveSnapshot } from '@cuberoot/shared/timer/live-share';

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 1; bufferedAmount = 0;
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number }) => void;
  send = vi.fn();
  constructor() { Socket.instances.push(this); }
  close(code = 1000) {
    if (code !== 1000 && (code < 3000 || code > 4999)) throw new Error('Invalid browser WebSocket close code');
    this.readyState = 3; this.onclose?.({ code });
  }
  receive(message: unknown) { this.onmessage?.({ data: JSON.stringify(message) }); }
}
const credential = { id: 'i'.repeat(22), token: 't'.repeat(43) };
const transport = { apiUrl: (p: string) => p, websocketUrl: 'ws://local.test/socket' };
const snapshot: TimerLiveSnapshot = {
  state: { context: 'group', sessionName: 'Lesson', event: '333', scramble: 'R', phase: 'idle', elapsedMs: 0,
    inspectionMs: 0, inspectionSec: 15, sampledAt: 1000, trainingObservation: false, lastPenalty: null,
    timingEnabled: true, hideTime: false, precision: 3, runningPrecision: 3 },
  cube: { connected: false, facelets: null, quaternion: null, moves: [], algAnchored: false }, history: [], attempt: null,
};
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('WebSocket', Socket); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Socket.instances = []; sessionStorage.clear(); root = createRoot(document.createElement('div'));
});
afterEach(async () => {
  await act(async () => root.unmount());
  // jsdom queues storage events on zero-delay timers; drain those, not retries/heartbeats.
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.getTimerCount()).toBe(0); vi.useRealTimers(); vi.unstubAllGlobals();
});
it('ignores other viewers’ details and recovers from a missing delta', async () => {
  let live!: ReturnType<typeof useTimerLiveConnection>;
  function View() { live = useTimerLiveConnection(transport, credential, 'viewer'); return null; }
  await act(async () => root.render(createElement(View)));
  const socket = Socket.instances[0];
  const solve = { id: 'solve', event: '333', scramble: 'R', timeMs: 100, ts: 1, penalty: 'ok' };
  await act(async () => {
    socket.receive({ type: 'ready', serverNow: Date.now() });
    socket.receive({ type: 'snapshot', revision: 1, snapshot });
    live.requestDetail('solve', 'group', 'mine');
    socket.receive({ type: 'detail', requestId: 'mine', context: 'group', solve });
  });
  expect(live.detail?.requestId).toBe('mine');
  await act(async () => socket.receive({ type: 'detail', requestId: 'theirs', context: 'group', solve }));
  expect(live.detail?.requestId).toBe('mine');
  await act(async () => socket.receive({ type: 'patch', revision: 3, patch: { cube: snapshot.cube } }));
  expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toEqual({ type: 'resync' });
  await act(async () => socket.close(4001));
  expect(live.connection).toBe('ended'); expect(live.snapshot).toBeNull(); expect(live.detail).toBeNull();
});
it.each(['v'.repeat(43), 'AQIDBAUGBwgJCgsMDQ4PEA'])('can restart sharing with viewer token %s', async viewerToken => {
  const fetcher = vi.fn(async (_path: unknown, init?: RequestInit) => ({ ok: true, status: 200, json: async () => init?.method === 'POST'
    ? { ...credential, viewerToken, expiresAt: Date.now() + 60_000 } : { ok: true } }) as Response);
  let share!: ReturnType<typeof useTimerLiveShare>;
  function View() { share = useTimerLiveShare({ ...transport, fetcher }, { snapshot: () => snapshot, detail: () => null }); return null; }
  await act(async () => root.render(createElement(View)));
  await act(async () => share.start()); expect(share.session?.id).toBe(credential.id);
  await act(async () => share.stop());
  expect(share.session).toBeNull(); expect(share.paused).toBe(false);
  expect(sessionStorage.getItem('cuberoot.timer.live-share.v1')).toBeNull();
  await act(async () => share.start()); expect(share.session).not.toBeNull();
  const deletion = fetcher.mock.calls.find(([, init]) => init?.method === 'DELETE');
  expect(deletion?.[1]?.headers).toEqual({ Authorization: `Bearer ${credential.token}` });
});
it('reconnects with a full snapshot and does not reconnect after unmount', async () => {
  function View() { useTimerLiveConnection(transport, credential, 'host', { snapshot: () => snapshot, detail: () => null }); return null; }
  await act(async () => root.render(createElement(View)));
  await act(async () => { Socket.instances[0].receive({ type: 'ready', serverNow: Date.now() }); Socket.instances[0].onclose?.({ code: 1012 }); });
  await act(async () => vi.advanceTimersByTimeAsync(600));
  expect(Socket.instances).toHaveLength(2);
  await act(async () => Socket.instances[1].receive({ type: 'ready', serverNow: Date.now() }));
  expect(Socket.instances[1].send.mock.calls.map(([s]) => JSON.parse(s).type)).toContain('snapshot');
});
it('uses a browser-valid close code when its heartbeat becomes stale', async () => {
  let live!: ReturnType<typeof useTimerLiveConnection>;
  function View() { live = useTimerLiveConnection(transport, credential, 'viewer'); return null; }
  await act(async () => root.render(createElement(View)));
  await act(async () => Socket.instances[0].receive({ type: 'ready', serverNow: Date.now() }));
  await act(async () => vi.advanceTimersByTimeAsync(10_600));
  expect(Socket.instances[0].readyState).toBe(3);
  expect(Socket.instances).toHaveLength(2);
  expect(live.connection).toBe('connecting');
});
it('keeps a failed revocation paused after reopening the timer', async () => {
  sessionStorage.setItem('cuberoot.timer.live-share.v1', JSON.stringify({ ...credential,
    viewerToken: 'v'.repeat(43), expiresAt: Date.now() + 60_000, paused: true }));
  let share!: ReturnType<typeof useTimerLiveShare>;
  function View() { share = useTimerLiveShare(transport, { snapshot: () => snapshot, detail: () => null }); return null; }
  await act(async () => root.render(createElement(View)));
  expect(share.session).not.toBeNull(); expect(share.paused).toBe(true);
  expect(Socket.instances).toHaveLength(0);
});
it('remembers failed stop intent and allows a fresh share once that link expires', async () => {
  const session = { ...credential, viewerToken: 'v'.repeat(43), expiresAt: Date.now() + 60_000 };
  sessionStorage.setItem('cuberoot.timer.live-share.v1', JSON.stringify(session));
  let share!: ReturnType<typeof useTimerLiveShare>;
  function View() { share = useTimerLiveShare({ ...transport, fetcher: async () => { throw new Error('offline'); } },
    { snapshot: () => snapshot, detail: () => null }); return null; }
  await act(async () => root.render(createElement(View)));
  await act(async () => share.stop());
  expect(share.paused).toBe(true);
  expect(JSON.parse(sessionStorage.getItem('cuberoot.timer.live-share.v1')!).paused).toBe(true);
  await act(async () => root.unmount());
  root = createRoot(document.createElement('div'));
  vi.setSystemTime(Date.now() + 61_000);
  await act(async () => root.render(createElement(View)));
  expect(share.session).toBeNull(); expect(share.paused).toBe(false);
});
