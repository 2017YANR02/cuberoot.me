import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import {
  isCalcLiveRoomCode,
  parseCalcLiveHello,
  parseCalcLiveSnapshot,
  type CalcLiveSnapshot,
} from '@cuberoot/shared';
import {
  CALC_LIVE_MAX_BUFFERED_BYTES,
  CALC_LIVE_ROOM_IDLE_MS,
  CalcLiveRelay,
  type CalcLiveRelaySocket,
} from '../src/calc/live_relay.js';

const CODE = '0427';
const TOKEN = 'a'.repeat(32);

function snapshot(event = 'sq1'): CalcLiveSnapshot {
  return {
    version: 1,
    event,
    times: [[475, 708, 828, 0, 0], [0, 0, 0, 0, 0]],
    names: ['Name A', 'Name B'],
    seedOn: 0,
    playerEnabled: [true, false],
    targetAvgs: { 0: 629 },
  };
}

function fakeSocket(): CalcLiveRelaySocket & {
  bufferedAmount: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
} {
  return { bufferedAmount: 0, send: vi.fn(), close: vi.fn() };
}

function connectHost(relay: CalcLiveRelay, socket = fakeSocket(), token = TOKEN) {
  const connection = relay.connect(socket, 'host-ip');
  connection.handleMessage(JSON.stringify({ type: 'hello', role: 'host', code: CODE, token }));
  return { connection, socket };
}

function connectViewer(relay: CalcLiveRelay, socket = fakeSocket()) {
  const connection = relay.connect(socket, 'viewer-ip');
  connection.handleMessage(JSON.stringify({ type: 'hello', role: 'viewer', code: CODE }));
  return { connection, socket };
}

describe('CalcLiveRelay', () => {
  it('broadcasts canonical score snapshots and replays the latest one to late viewers', () => {
    const relay = new CalcLiveRelay();
    const host = connectHost(relay);
    const firstViewer = connectViewer(relay);
    host.connection.handleMessage(JSON.stringify({ type: 'state', state: snapshot(), ignored: true }));

    const broadcast = JSON.parse(firstViewer.socket.send.mock.calls.at(-1)![0]);
    expect(broadcast).toMatchObject({ type: 'snapshot', revision: 1, state: snapshot() });
    expect(broadcast.state).not.toHaveProperty('ignored');

    const lateViewer = connectViewer(relay);
    const messages = lateViewer.socket.send.mock.calls.map(([data]) => JSON.parse(data));
    expect(messages[0]).toEqual({ type: 'ready', role: 'viewer' });
    expect(messages[1]).toMatchObject({ type: 'snapshot', revision: 1, state: snapshot() });
    expect(messages[2]).toEqual({ type: 'status', live: true, viewers: 2 });
  });

  it('keeps host authority secret and rejects writes from viewers', () => {
    const relay = new CalcLiveRelay();
    connectHost(relay);
    const intruder = connectHost(relay, fakeSocket(), 'b'.repeat(32));
    expect(intruder.socket.close).toHaveBeenCalledWith(1008, 'room code taken');

    const viewer = connectViewer(relay);
    viewer.connection.handleMessage(JSON.stringify({ type: 'state', state: snapshot() }));
    expect(viewer.socket.close).toHaveBeenCalledWith(1008, 'viewer is read only');
  });

  it('rejects malformed snapshots before they can replace the current score', () => {
    const relay = new CalcLiveRelay();
    const host = connectHost(relay);
    const viewer = connectViewer(relay);
    viewer.socket.send.mockClear();

    host.connection.handleMessage(JSON.stringify({
      type: 'state',
      state: { ...snapshot(), times: [[-1], [0]] },
    }));
    expect(host.socket.close).toHaveBeenCalledWith(1008, 'invalid payload');
    expect(viewer.socket.send.mock.calls.map(([data]) => JSON.parse(data)))
      .toEqual([{ type: 'status', live: false, viewers: 1 }]);
  });

  it('retains the last snapshot across a host reconnect with the same token', () => {
    const relay = new CalcLiveRelay();
    const firstHost = connectHost(relay);
    firstHost.connection.handleMessage(JSON.stringify({ type: 'state', state: snapshot() }));
    firstHost.connection.handleClose();

    const viewer = connectViewer(relay);
    expect(viewer.socket.send.mock.calls.map(([data]) => JSON.parse(data))[1])
      .toMatchObject({ type: 'snapshot', revision: 1 });

    const resumedHost = connectHost(relay);
    expect(resumedHost.socket.close).not.toHaveBeenCalled();
    resumedHost.connection.handleMessage(JSON.stringify({ type: 'state', state: snapshot('333') }));
    const lastViewerMessage = JSON.parse(viewer.socket.send.mock.calls.at(-1)![0]);
    expect(lastViewerMessage).toMatchObject({ type: 'snapshot', revision: 2, state: { event: '333' } });
  });

  it('drops backpressured viewers without interrupting the host', () => {
    const relay = new CalcLiveRelay();
    const host = connectHost(relay);
    const slowSocket = fakeSocket();
    const viewer = connectViewer(relay, slowSocket);
    slowSocket.bufferedAmount = CALC_LIVE_MAX_BUFFERED_BYTES;

    host.connection.handleMessage(JSON.stringify({ type: 'state', state: snapshot() }));
    expect(viewer.socket.close).toHaveBeenCalledWith(1013, 'relay backpressure');
    expect(host.socket.close).not.toHaveBeenCalled();
    expect(JSON.parse(host.socket.send.mock.calls.at(-1)![0]))
      .toEqual({ type: 'status', live: true, viewers: 0 });
  });

  it('expires idle rooms and rejects unknown viewer room codes', () => {
    const relay = new CalcLiveRelay();
    const host = connectHost(relay);
    relay.pruneExpired(Date.now() + CALC_LIVE_ROOM_IDLE_MS + 1);
    expect(host.socket.close).toHaveBeenCalledWith(1001, 'room expired');
    expect(relay.roomCount()).toBe(0);

    const viewer = connectViewer(relay);
    expect(viewer.socket.close).toHaveBeenCalledWith(1008, 'room not found');
  });
});

describe('parseCalcLiveSnapshot', () => {
  it('accepts bounded WCA score state and returns detached arrays', () => {
    const source = snapshot();
    const parsed = parseCalcLiveSnapshot(source);
    expect(parsed).toEqual(source);
    expect(parsed?.times).not.toBe(source.times);
  });

  it('rejects unsupported events, odd row pairs, control characters, and oversized results', () => {
    expect(parseCalcLiveSnapshot({ ...snapshot(), event: 'kilominx' })).toBeNull();
    expect(parseCalcLiveSnapshot({ ...snapshot(), times: [[0, 0, 0, 0, 0]] })).toBeNull();
    expect(parseCalcLiveSnapshot({ ...snapshot(), names: ['bad\nname', 'Name B'] })).toBeNull();
    expect(parseCalcLiveSnapshot({
      ...snapshot(),
      times: [[2_000_000_001, 0, 0, 0, 0], [0, 0, 0, 0, 0]],
    })).toBeNull();
  });
});

describe('calc live room code', () => {
  it('accepts exactly four digits including a leading zero', () => {
    expect(isCalcLiveRoomCode('0427')).toBe(true);
    expect(parseCalcLiveHello({ type: 'hello', role: 'viewer', code: '0427' }))
      .toEqual({ type: 'hello', role: 'viewer', code: '0427' });
  });

  it.each(['123', '12345', '12A4', ' 1234', '１２３４'])('rejects invalid code %s', (code) => {
    expect(isCalcLiveRoomCode(code)).toBe(false);
  });
});

describe('calc live production proxy contract', () => {
  it('forwards WebSocket upgrades without buffering or caching', async () => {
    const nginx = await readFile(
      new URL('../../../../ops/nginx/www.cuberoot.me.conf', import.meta.url),
      'utf8',
    );
    const start = nginx.indexOf('location = /v1/calc/live');
    const block = nginx.slice(start, nginx.indexOf('\n    }', start));

    expect(start).toBeGreaterThan(-1);
    expect(block).toContain('proxy_set_header Upgrade $http_upgrade');
    expect(block).toContain('proxy_set_header Connection $connection_upgrade');
    expect(block).toContain('proxy_buffering off');
    expect(block).toContain('proxy_cache off');
    expect(block).toContain('proxy_read_timeout 1h');
  });
});
