import { afterEach, expect, it, vi } from 'vitest';
import { applyTimerLivePatch, parseTimerLiveSnapshot, type TimerLiveSnapshot } from '@cuberoot/shared/timer/live-share';
import { createNativeTimerLiveShare } from '../src/lib/native-timer-live-share';

function fakeSocket() {
  let onOpen = () => {};
  let onClose = (_event: { code: number }) => {};
  let onMessage = (_event: { data: string }) => {};
  const sent: Record<string, unknown>[] = [];
  return {
    sent, open: () => onOpen(), closeWith: (code: number) => onClose({ code }),
    receive: (value: unknown) => onMessage({ data: JSON.stringify(value) }),
    task: {
      onOpen(callback: typeof onOpen) { onOpen = callback; },
      onClose(callback: typeof onClose) { onClose = callback; },
      onMessage(callback: typeof onMessage) { onMessage = callback; },
      onError() {},
      send({ data }: { data: string }) { sent.push(JSON.parse(data)); },
      close: vi.fn(),
    } as unknown as WechatMiniprogram.SocketTask,
  };
}

function fixture() {
  const sockets: ReturnType<typeof fakeSocket>[] = [];
  const credential = { id: 'A'.repeat(22), token: 'B'.repeat(43), viewerToken: 'C'.repeat(21) + 'Q', expiresAt: Date.now() + 60_000 };
  const stream: TimerLiveSnapshot = {
    state: { context: 'demo', sessionName: 'Test group', event: '333', scramble: 'R U', phase: 'idle',
      elapsedMs: 0, inspectionMs: 0, inspectionSec: 15, sampledAt: Date.now(), lastPenalty: null,
      trainingObservation: false, timingEnabled: true, hideTime: false, precision: 3, runningPrecision: 3 },
    cube: { connected: false, facelets: null, quaternion: null, moves: [], algAnchored: false },
    history: [], attempt: null,
  };
  const create = vi.fn(async () => credential);
  const revoke = vi.fn(async () => {});
  const share = createNativeTimerLiveShare({
    snapshot: () => stream,
    detail: (_, context) => context === 'demo'
      ? { id: 'test', event: '333', timeMs: 1550, penalty: 'ok', scramble: 'R U', ts: 0, comment: 'private' } : null,
  }, vi.fn(), {
    connect: () => {
      const socket = fakeSocket();
      sockets.push(socket);
      return socket.task;
    }, create, revoke,
  });
  return { share, credential, stream, sockets, revoke };
}

afterEach(() => vi.useRealTimers());

it('publishes an acknowledged native timer snapshot using the same viewer protocol', async () => {
  vi.useFakeTimers();
  const { share, credential, stream, sockets } = fixture();
  share.setEnabled(true);
  await share.start();
  const socket = sockets[0];
  socket.open();
  expect(socket.sent[0]).toEqual({ type: 'hello', role: 'host', version: 1, id: credential.id, token: credential.token });
  socket.receive({ type: 'ready', serverNow: Date.now() });
  const first = socket.sent.find(message => message.type === 'snapshot');
  const initial = parseTimerLiveSnapshot(first?.snapshot);
  expect(initial?.state.phase).toBe('idle');
  stream.state = { ...stream.state, phase: 'running', elapsedMs: 240 };
  vi.advanceTimersByTime(50);
  expect(socket.sent.some(message => message.type === 'patch')).toBe(false);
  socket.receive({ type: 'ack', revision: 1 });
  const update = socket.sent.at(-1);
  expect(update).toMatchObject({ type: 'patch', base: 1 });
  expect(applyTimerLivePatch(initial!, update?.patch)?.state.phase).toBe('running');
  socket.receive({ type: 'status', online: true, viewers: 2 });
  expect(share.snapshot().badge).toContain('2');
  socket.receive({ type: 'detail', solveId: 'test', context: 'demo', requestId: 'req' });
  expect(socket.sent.at(-1)).toMatchObject({ type: 'detail', context: 'demo', requestId: 'req', solve: { id: 'test' } });
  expect(JSON.stringify(socket.sent.at(-1))).not.toContain('private');
  expect(share.watchUrl()).toContain(`#${credential.viewerToken}`);
  expect(share.watchUrl()).not.toContain(credential.token);
  expect(share.qr()).toContain('data:image/svg+xml');
  share.dispose();
});

it('pauses off the timer, reconnects with a full snapshot, and retries a failed revocation', async () => {
  vi.useFakeTimers();
  const { share, sockets, revoke, credential } = fixture();
  share.setEnabled(true);
  await share.start();
  const first = sockets[0];
  first.open();
  first.closeWith(1006);
  vi.advanceTimersByTime(500);
  expect(sockets).toHaveLength(2);
  share.setEnabled(false);
  expect(share.snapshot()).toMatchObject({ active: true, paused: true });
  expect(share.qr()).toBe('');
  share.setEnabled(true);
  const resumed = sockets[2];
  resumed.open();
  resumed.receive({ type: 'ready' });
  expect(resumed.sent.some(message => message.type === 'snapshot')).toBe(true);
  revoke.mockRejectedValueOnce(new Error('network'));
  await share.stop();
  expect(share.snapshot()).toMatchObject({ active: true, paused: true, error: expect.any(String) });
  const sent = resumed.sent.length;
  vi.advanceTimersByTime(1000);
  expect(resumed.sent).toHaveLength(sent);
  await share.stop();
  expect(revoke).toHaveBeenLastCalledWith(credential);
  expect(share.snapshot()).toMatchObject({ active: false, paused: false, error: '' });
});
