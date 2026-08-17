import { describe, expect, it, vi } from 'vitest';

import {
  SMART_CUBE_RELAY_CHANNEL_IDLE_MS,
  SMART_CUBE_RELAY_HELLO_TIMEOUT_MS,
  SMART_CUBE_RELAY_MAX_CHANNEL_CREATIONS_PER_WINDOW,
  SMART_CUBE_RELAY_MAX_CHANNELS_PER_CLIENT,
  SMART_CUBE_RELAY_MAX_MESSAGES_PER_WINDOW,
  SMART_CUBE_RELAY_MAX_PENDING_PER_CLIENT,
  SMART_CUBE_RELAY_SINK_GRACE_MS,
  SMART_CUBE_RELAY_UNPAIRED_IDLE_MS,
  SmartCubeRelay,
  type SmartCubeRelaySocket,
} from '../src/smart_cube/relay.js';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEF';
const OTHER_TOKEN = '0123456789abcdefghijklmnopqrstuv';

function fakeSocket(send = vi.fn()): SmartCubeRelaySocket & {
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
} {
  return { send, close: vi.fn() };
}

function hello(
  relay: SmartCubeRelay,
  socket: SmartCubeRelaySocket,
  role: 'sink' | 'source',
  token = TOKEN,
  clientKey = '127.0.0.1',
  lastMoveSeq?: number,
) {
  const connection = relay.connect(socket, clientKey);
  connection.handleMessage(JSON.stringify({ type: 'hello', role, token, lastMoveSeq }));
  return connection;
}

function ready(role: 'sink' | 'source', lastMoveSeq = 0): string {
  return JSON.stringify({ type: 'ready', role, lastMoveSeq });
}

describe('SmartCubeRelay', () => {
  it('acknowledges both peers and forwards events in the allowed direction', () => {
    const relay = new SmartCubeRelay();
    const sinkSocket = fakeSocket();
    const sourceSocket = fakeSocket();
    const sink = hello(relay, sinkSocket, 'sink');
    const source = hello(relay, sourceSocket, 'source');

    expect(sinkSocket.send).toHaveBeenCalledWith(ready('sink'));
    expect(sourceSocket.send).toHaveBeenCalledWith(ready('source'));
    source.handleMessage(JSON.stringify({ type: 'move', move: "R'", deviceTs: 123 }));
    expect(sinkSocket.send).toHaveBeenCalledWith(JSON.stringify({
      type: 'move', move: "R'", deviceTs: 123, relaySeq: 1,
    }));

    sink.handleMessage(JSON.stringify({ type: 'command', command: 'disconnect' }));
    expect(sourceSocket.send).toHaveBeenCalledWith(JSON.stringify({
      type: 'command', command: 'disconnect',
    }));
  });

  it('requires hello, requires the sink to create a channel, and rejects role violations', () => {
    const relay = new SmartCubeRelay();
    const socket = fakeSocket();
    relay.connect(socket).handleMessage(JSON.stringify({ type: 'move', move: 'R' }));
    expect(socket.close).toHaveBeenCalledWith(1008, 'hello required');

    const orphanSourceSocket = fakeSocket();
    hello(relay, orphanSourceSocket, 'source');
    expect(orphanSourceSocket.close).toHaveBeenCalledWith(1008, 'sink must create channel');

    hello(relay, fakeSocket(), 'sink');
    const sourceSocket = fakeSocket();
    const source = hello(relay, sourceSocket, 'source');
    source.handleMessage(JSON.stringify({ type: 'command', command: 'disconnect' }));
    expect(sourceSocket.close).toHaveBeenCalledWith(1008, 'source cannot send commands');
  });

  it('times out silent sockets and limits pending handshakes per client', () => {
    vi.useFakeTimers();
    try {
      const relay = new SmartCubeRelay();
      const silentSockets = Array.from(
        { length: SMART_CUBE_RELAY_MAX_PENDING_PER_CLIENT },
        () => fakeSocket(),
      );
      for (const silentSocket of silentSockets) relay.connect(silentSocket, 'silent-client');

      const rejectedSocket = fakeSocket();
      relay.connect(rejectedSocket, 'silent-client');
      expect(rejectedSocket.close).toHaveBeenCalledWith(1008, 'client pending limit');

      vi.advanceTimersByTime(SMART_CUBE_RELAY_HELLO_TIMEOUT_MS);
      for (const silentSocket of silentSockets) {
        expect(silentSocket.close).toHaveBeenCalledWith(1008, 'hello timeout');
      }

      const recoveredSocket = fakeSocket();
      hello(relay, recoveredSocket, 'sink', TOKEN, 'silent-client');
      expect(recoveredSocket.send).toHaveBeenCalledWith(ready('sink'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('isolates channels and removes them after their final peer closes', () => {
    const relay = new SmartCubeRelay();
    const sink = hello(relay, fakeSocket(), 'sink');
    const source = hello(relay, fakeSocket(), 'source');
    const otherSinkSocket = fakeSocket();
    const otherSink = hello(relay, otherSinkSocket, 'sink', OTHER_TOKEN);
    otherSinkSocket.send.mockClear();

    source.handleMessage(JSON.stringify({ type: 'move', move: 'U' }));
    expect(otherSinkSocket.send).not.toHaveBeenCalled();
    source.handleClose();
    sink.handleClose();
    otherSink.handleClose();
    expect(relay.channelCount()).toBe(0);
  });

  it('replays connection snapshots when the timer resumes without missed moves', () => {
    const relay = new SmartCubeRelay();
    hello(relay, fakeSocket(), 'sink');
    const source = hello(relay, fakeSocket(), 'source');
    source.handleMessage(JSON.stringify({
      type: 'status',
      phase: 'connected',
      brand: 'gan-v4',
      deviceName: 'GAN16ui',
      hasGyro: true,
    }));
    source.handleMessage(JSON.stringify({ type: 'battery', level: 86 }));

    const resumedSinkSocket = fakeSocket();
    hello(relay, resumedSinkSocket, 'sink');

    expect(resumedSinkSocket.send.mock.calls.map(([payload]) => payload)).toEqual([
      JSON.stringify({
        type: 'status',
        phase: 'connected',
        brand: 'gan-v4',
        deviceName: 'GAN16ui',
        hasGyro: true,
      }),
      JSON.stringify({ type: 'battery', level: 86 }),
      ready('sink'),
    ]);
  });

  it('replays every move produced while the timer sink is disconnected', () => {
    const relay = new SmartCubeRelay();
    const firstSinkSocket = fakeSocket();
    const firstSink = hello(relay, firstSinkSocket, 'sink');
    const source = hello(relay, fakeSocket(), 'source');
    source.handleMessage(JSON.stringify({ type: 'move', move: 'R' }));
    firstSink.handleClose();
    source.handleMessage(JSON.stringify({ type: 'move', move: 'U' }));
    source.handleMessage(JSON.stringify({ type: 'move', move: 'F2' }));

    const resumedSinkSocket = fakeSocket();
    hello(relay, resumedSinkSocket, 'sink', TOKEN, '127.0.0.1', 1);

    expect(resumedSinkSocket.send.mock.calls.map(([payload]) => JSON.parse(payload))).toEqual([
      { type: 'move', move: 'U', relaySeq: 2 },
      { type: 'move', move: 'F2', relaySeq: 3 },
      { type: 'ready', role: 'sink', lastMoveSeq: 3 },
    ]);
  });

  it('closes the hardware source after the timer reconnect grace expires', () => {
    vi.useFakeTimers();
    try {
      const relay = new SmartCubeRelay();
      const sink = hello(relay, fakeSocket(), 'sink');
      const sourceSocket = fakeSocket();
      hello(relay, sourceSocket, 'source');

      sink.handleClose();
      vi.advanceTimersByTime(SMART_CUBE_RELAY_SINK_GRACE_MS - 1);
      expect(sourceSocket.close).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);

      expect(sourceSocket.close).toHaveBeenCalledWith(1001, 'timer disconnected');
      expect(relay.channelCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the hardware source alive when the timer reconnects within the grace period', () => {
    vi.useFakeTimers();
    try {
      const relay = new SmartCubeRelay();
      const sink = hello(relay, fakeSocket(), 'sink');
      const sourceSocket = fakeSocket();
      hello(relay, sourceSocket, 'source');

      sink.handleClose();
      vi.advanceTimersByTime(SMART_CUBE_RELAY_SINK_GRACE_MS - 1);
      const resumedSocket = fakeSocket();
      hello(relay, resumedSocket, 'sink');
      vi.advanceTimersByTime(1);

      expect(sourceSocket.close).not.toHaveBeenCalled();
      expect(resumedSocket.send).toHaveBeenCalledWith(ready('sink'));
      expect(relay.channelCount()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails closed when the requested move history is no longer available', () => {
    const relay = new SmartCubeRelay();
    hello(relay, fakeSocket(), 'sink');
    const sourceSocket = fakeSocket();
    const source = hello(relay, sourceSocket, 'source');
    for (let index = 0; index < 513; index++) {
      source.handleMessage(JSON.stringify({ type: 'move', move: 'R' }));
    }

    const resumedSinkSocket = fakeSocket();
    hello(relay, resumedSinkSocket, 'sink', TOKEN, '127.0.0.1', 0);

    expect(sourceSocket.close).toHaveBeenCalledWith(1012, 'relay replay unavailable');
    expect(resumedSinkSocket.close).toHaveBeenCalledWith(1008, 'relay replay unavailable');
  });

  it('rejects a source-supplied relay sequence', () => {
    const relay = new SmartCubeRelay();
    hello(relay, fakeSocket(), 'sink');
    const sourceSocket = fakeSocket();
    const source = hello(relay, sourceSocket, 'source');

    source.handleMessage(JSON.stringify({ type: 'move', move: 'R', relaySeq: 99 }));
    expect(sourceSocket.close).toHaveBeenCalledWith(1008, 'source cannot set relay sequence');
  });

  it('clears stale state and battery snapshots when the hardware source closes', () => {
    const relay = new SmartCubeRelay();
    const firstSinkSocket = fakeSocket();
    hello(relay, firstSinkSocket, 'sink');
    const source = hello(relay, fakeSocket(), 'source');
    source.handleMessage(JSON.stringify({ type: 'state', facelets: 'U'.repeat(54) }));
    source.handleMessage(JSON.stringify({ type: 'battery', level: 86 }));

    source.handleClose();
    expect(firstSinkSocket.send).toHaveBeenCalledWith(JSON.stringify({
      type: 'status', phase: 'disconnected',
    }));

    const resumedSinkSocket = fakeSocket();
    hello(relay, resumedSinkSocket, 'sink');
    expect(resumedSinkSocket.send.mock.calls.map(([payload]) => payload)).toEqual([
      JSON.stringify({ type: 'status', phase: 'disconnected' }),
      ready('sink'),
    ]);
  });

  it('closes a source that floods a relay channel without dropping the timer sink', () => {
    const relay = new SmartCubeRelay();
    const sinkSocket = fakeSocket();
    hello(relay, sinkSocket, 'sink');
    const sourceSocket = fakeSocket();
    const source = hello(relay, sourceSocket, 'source');

    for (let index = 0; index <= SMART_CUBE_RELAY_MAX_MESSAGES_PER_WINDOW; index++) {
      source.handleMessage(JSON.stringify({ type: 'battery', level: index % 101 }));
    }

    expect(sourceSocket.close).toHaveBeenCalledWith(1008, 'rate limit');
    expect(sinkSocket.send).toHaveBeenCalledWith(JSON.stringify({
      type: 'status', phase: 'disconnected',
    }));
    expect(relay.channelCount()).toBe(1);
  });

  it('limits active channels and channel churn owned by one client', () => {
    const relay = new SmartCubeRelay();
    for (let index = 0; index < SMART_CUBE_RELAY_MAX_CHANNELS_PER_CLIENT; index++) {
      const token = index.toString(16).padStart(32, '0');
      hello(relay, fakeSocket(), 'sink', token, 'active-client');
    }
    const rejectedSocket = fakeSocket();
    hello(relay, rejectedSocket, 'sink', 'f'.repeat(32), 'active-client');
    expect(rejectedSocket.close).toHaveBeenCalledWith(1008, 'client channel limit');

    for (let index = 0; index < SMART_CUBE_RELAY_MAX_CHANNEL_CREATIONS_PER_WINDOW; index++) {
      const connection = hello(
        relay,
        fakeSocket(),
        'sink',
        `c${index.toString(16).padStart(31, '0')}`,
        'churn-client',
      );
      connection.handleClose();
    }
    const churnSocket = fakeSocket();
    hello(relay, churnSocket, 'sink', 'd'.repeat(32), 'churn-client');
    expect(churnSocket.close).toHaveBeenCalledWith(1008, 'client creation rate limit');
  });

  it('does not register a sink when snapshot replay throws', () => {
    const relay = new SmartCubeRelay();
    hello(relay, fakeSocket(), 'sink');
    const source = hello(relay, fakeSocket(), 'source');
    source.handleMessage(JSON.stringify({ type: 'battery', level: 75 }));

    const brokenSocket = fakeSocket(vi.fn(() => { throw new Error('closed'); }));
    hello(relay, brokenSocket, 'sink');
    expect(brokenSocket.close).toHaveBeenCalledWith(1011, 'relay send failed');

    const healthySocket = fakeSocket();
    hello(relay, healthySocket, 'sink');
    expect(healthySocket.close).not.toHaveBeenCalled();
    expect(healthySocket.send).toHaveBeenCalledWith(JSON.stringify({
      type: 'battery', level: 75,
    }));
  });

  it('removes a new channel when its initial ready acknowledgement fails', () => {
    const relay = new SmartCubeRelay();
    const brokenSocket = fakeSocket(vi.fn(() => { throw new Error('closed'); }));
    hello(relay, brokenSocket, 'sink');

    expect(brokenSocket.close).toHaveBeenCalledWith(1011, 'relay send failed');
    expect(relay.channelCount()).toBe(0);

    const orphanSourceSocket = fakeSocket();
    hello(relay, orphanSourceSocket, 'source');
    expect(orphanSourceSocket.close).toHaveBeenCalledWith(1008, 'sink must create channel');
  });

  it('removes a broken sink and rejects its queued messages after removal', () => {
    const relay = new SmartCubeRelay();
    const brokenSend = vi.fn()
      .mockImplementationOnce(() => {})
      .mockImplementation(() => { throw new Error('closed'); });
    const brokenSocket = fakeSocket(brokenSend);
    const broken = hello(relay, brokenSocket, 'sink');
    const healthySocket = fakeSocket();
    hello(relay, healthySocket, 'sink');
    const sourceSocket = fakeSocket();
    const source = hello(relay, sourceSocket, 'source');
    sourceSocket.send.mockClear();

    source.handleMessage(JSON.stringify({ type: 'move', move: 'R' }));
    expect(brokenSocket.close).toHaveBeenCalledWith(1011, 'relay send failed');
    expect(healthySocket.send).toHaveBeenCalledWith(JSON.stringify({
      type: 'move', move: 'R', relaySeq: 1,
    }));

    broken.handleMessage(JSON.stringify({ type: 'command', command: 'disconnect' }));
    expect(brokenSocket.close).toHaveBeenCalledWith(1008, 'peer detached');
    expect(sourceSocket.send).not.toHaveBeenCalled();
  });

  it('expires idle and never-paired channels without another client hello', () => {
    const relay = new SmartCubeRelay();
    const sinkSocket = fakeSocket();
    const sourceSocket = fakeSocket();
    hello(relay, sinkSocket, 'sink');
    hello(relay, sourceSocket, 'source');

    relay.pruneExpired(Date.now() + SMART_CUBE_RELAY_CHANNEL_IDLE_MS + 1);

    expect(sourceSocket.close).toHaveBeenCalledWith(1001, 'channel expired');
    expect(sinkSocket.close).toHaveBeenCalledWith(1001, 'channel expired');
    expect(relay.channelCount()).toBe(0);

    const unpairedSinkSocket = fakeSocket();
    hello(relay, unpairedSinkSocket, 'sink');
    relay.pruneExpired(Date.now() + SMART_CUBE_RELAY_UNPAIRED_IDLE_MS + 1);
    expect(unpairedSinkSocket.close).toHaveBeenCalledWith(1001, 'channel expired');
    expect(relay.channelCount()).toBe(0);
  });
});
