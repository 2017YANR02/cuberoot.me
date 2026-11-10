import { SOLVED_SMART_CUBE_FACELETS, SmartCubeStateTracker } from '@cuberoot/shared/smart-cube/cubie';
import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';

import {
  BATTLE_ROOM_LIVE_MAX_BUFFERED_BYTES,
  BattleRoomLiveRelay,
  type BattleRoomLiveAuthorize,
  type BattleRoomLiveSocket,
} from '../src/battle_live_relay.js';

const CODE = '0427';
const TOKEN = 'a'.repeat(43);
const PLAYER_A = 'playera';
const PLAYER_B = 'playerb';
const PLAYER_C = 'playerc';

function fakeSocket(): BattleRoomLiveSocket & {
  bufferedAmount: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
} {
  return { bufferedAmount: 0, send: vi.fn(), close: vi.fn() };
}

function messages(socket: ReturnType<typeof fakeSocket>): Array<Record<string, unknown>> {
  return socket.send.mock.calls.map(([data]) => JSON.parse(data) as Record<string, unknown>);
}

async function connectPlayer(
  relay: BattleRoomLiveRelay,
  playerId: string,
  socket = fakeSocket(),
  authorize: BattleRoomLiveAuthorize = async () => true,
  gyro = false,
) {
  const connection = relay.connect(socket, authorize, playerId);
  connection.handleMessage(JSON.stringify({
    type: 'hello',
    version: 1,
    code: CODE,
    playerId,
    playerToken: TOKEN,
    ...(gyro ? { gyro: true } : {}),
  }));
  await vi.waitFor(() => {
    expect(messages(socket)).toContainEqual({ type: 'ready', version: 1, ...(gyro ? { gyro: true } : {}) });
  });
  return { connection, socket };
}

function snapshot(connection: { handleMessage(data: unknown): void }, seq = 0): void {
  connection.handleMessage(JSON.stringify({
    type: 'snapshot',
    round: 1,
    seq,
    facelets: SOLVED_SMART_CUBE_FACELETS,
  }));
}

describe('BattleRoomLiveRelay', () => {
  it('delivers bidirectional orientation over real local WebSockets alongside ordered turns', async () => {
    const relay = new BattleRoomLiveRelay();
    const app = new Hono();
    const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
    app.get('/live', upgradeWebSocket(() => {
      let connection: ReturnType<BattleRoomLiveRelay['connect']>;
      return {
        onOpen(_event, ws) {
          connection = relay.connect({
            get bufferedAmount() { return ws.raw?.bufferedAmount ?? 0; },
            send: data => ws.send(data), close: (code, reason) => ws.close(code, reason),
          }, async () => true);
        },
        onMessage(event) { connection.handleMessage(event.data); },
        onClose() { connection?.handleClose(); },
      };
    }));
    const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });
    injectWebSocket(server);
    const sockets: WebSocket[] = [];
    try {
      await vi.waitFor(() => expect(server.address()).not.toBeNull());
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing local server port');
      const connect = async (playerId: string) => {
        const socket = new WebSocket(`ws://127.0.0.1:${address.port}/live`);
        sockets.push(socket);
        const received: Array<Record<string, unknown>> = [];
        socket.addEventListener('message', event => received.push(JSON.parse(String(event.data))));
        await new Promise<void>((resolve, reject) => {
          socket.addEventListener('open', () => resolve(), { once: true });
          socket.addEventListener('error', reject, { once: true });
        });
        socket.send(JSON.stringify({ type: 'hello', version: 1, code: CODE, playerId, playerToken: TOKEN, gyro: true }));
        await vi.waitFor(() => expect(received).toContainEqual({ type: 'ready', version: 1, gyro: true }));
        socket.send(JSON.stringify({ type: 'snapshot', round: 1, seq: 0, facelets: SOLVED_SMART_CUBE_FACELETS }));
        return { socket, received };
      };
      const first = await connect(PLAYER_A);
      const second = await connect(PLAYER_B);
      const q = { w: 0, x: 0, y: 1, z: 0 };
      first.socket.send(JSON.stringify({ type: 'gyro', round: 1, quaternion: q }));
      second.socket.send(JSON.stringify({ type: 'gyro', round: 1, quaternion: q }));
      first.socket.send(JSON.stringify({ type: 'move', round: 1, seq: 1, move: 'R' }));
      await vi.waitFor(() => {
        expect(first.received).toContainEqual({ type: 'gyro', playerId: PLAYER_B, round: 1, quaternion: q });
        expect(second.received).toContainEqual({ type: 'gyro', playerId: PLAYER_A, round: 1, quaternion: q });
        expect(second.received).toContainEqual(expect.objectContaining({ type: 'move', seq: 1, move: 'R' }));
      });
    } finally {
      relay.disconnectRoom(CODE);
      for (const socket of sockets) socket.close();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
  it('relays canonical poses only to capable peers without consuming move sequences or their rate budget', async () => {
    const relay = new BattleRoomLiveRelay();
    const first = await connectPlayer(relay, PLAYER_A, fakeSocket(), undefined, true);
    const second = await connectPlayer(relay, PLAYER_B, fakeSocket(), undefined, true);
    const legacy = await connectPlayer(relay, PLAYER_C);
    snapshot(first.connection);
    second.socket.send.mockClear();
    legacy.socket.send.mockClear();
    const quaternion = { w: 0, x: 0, y: 1, z: 0 };
    for (let i = 0; i < 500; i++) {
      first.connection.handleMessage(JSON.stringify({ type: 'gyro', round: 1, quaternion }));
    }
    for (let seq = 1; seq <= 150; seq++) {
      first.connection.handleMessage(JSON.stringify({ type: 'move', round: 1, seq, move: 'U' }));
    }
    expect(first.socket.close).not.toHaveBeenCalled();
    expect(messages(second.socket).filter(m => m.type === 'gyro')).toHaveLength(500);
    expect(messages(legacy.socket).some(m => m.type === 'gyro')).toBe(false);
    expect(messages(second.socket).at(-1)).toMatchObject({ type: 'move', seq: 150 });
    const late = await connectPlayer(relay, 'playerd', fakeSocket(), undefined, true);
    expect(messages(late.socket)).toContainEqual({ type: 'gyro', playerId: PLAYER_A, round: 1, quaternion });
    relay.disconnectRoom(CODE);
  });

  it('coalesces congested poses and delivers the final pose once writable, without replaying stale rounds', async () => {
    const relay = new BattleRoomLiveRelay();
    const first = await connectPlayer(relay, PLAYER_A, fakeSocket(), undefined, true);
    const second = await connectPlayer(relay, PLAYER_B, fakeSocket(), undefined, true);
    snapshot(first.connection);
    second.socket.send.mockClear();
    vi.useFakeTimers();
    try {
      second.socket.bufferedAmount = 100;
      first.connection.handleMessage(JSON.stringify({ type: 'gyro', round: 1, quaternion: { w: 1, x: 0, y: 0, z: 0 } }));
      first.connection.handleMessage(JSON.stringify({ type: 'gyro', round: 1, quaternion: { w: 0, x: 1, y: 0, z: 0 } }));
      expect(second.socket.send).not.toHaveBeenCalled();
      second.socket.bufferedAmount = 0;
      vi.advanceTimersByTime(20);
      expect(messages(second.socket)).toEqual([{ type: 'gyro', playerId: PLAYER_A, round: 1, quaternion: { w: 0, x: 1, y: 0, z: 0 } }]);
      second.socket.send.mockClear();
      first.connection.handleMessage(JSON.stringify({ type: 'gyro', round: 2, quaternion: { w: 1, x: 0, y: 0, z: 0 } }));
      expect(second.socket.send).not.toHaveBeenCalled();
      first.connection.handleMessage(JSON.stringify({ type: 'unavailable', round: 1 }));
      second.socket.send.mockClear();
      first.connection.handleMessage(JSON.stringify({ type: 'gyro', round: 1, quaternion: { w: 1, x: 0, y: 0, z: 0 } }));
      expect(second.socket.send).not.toHaveBeenCalled();
    } finally { relay.disconnectRoom(CODE); vi.useRealTimers(); }
  });

  it('rejects invalid quaternions and prevents unnegotiated gyro messages', async () => {
    for (const quaternion of [{ w: 0, x: 0, y: 0, z: 0 }, { w: 2, x: 0, y: 0, z: 0 }, { w: '1', x: 0, y: 0, z: 0 }]) {
      const relay = new BattleRoomLiveRelay();
      const peer = await connectPlayer(relay, PLAYER_A, fakeSocket(), undefined, true);
      snapshot(peer.connection);
      peer.connection.handleMessage(JSON.stringify({ type: 'gyro', round: 1, quaternion }));
      expect(peer.socket.close).toHaveBeenCalledWith(1008, 'invalid payload');
    }
    const relay = new BattleRoomLiveRelay();
    const legacy = await connectPlayer(relay, PLAYER_A);
    legacy.connection.handleMessage(JSON.stringify({ type: 'gyro', round: 1, quaternion: null }));
    expect(legacy.socket.close).toHaveBeenCalledWith(1008, 'gyro not negotiated');
  });
  it('authenticates the first message before attaching a room peer', async () => {
    const relay = new BattleRoomLiveRelay();
    const authorize = vi.fn(async () => false);
    const socket = fakeSocket();
    const connection = relay.connect(socket, authorize, 'rejected-client');

    connection.handleMessage(JSON.stringify({
      type: 'hello',
      version: 1,
      code: CODE,
      playerId: PLAYER_A,
      playerToken: TOKEN,
    }));

    await vi.waitFor(() => {
      expect(socket.close).toHaveBeenCalledWith(1008, 'invalid player capability');
    });
    expect(authorize).toHaveBeenCalledWith(CODE, { playerId: PLAYER_A, playerToken: TOKEN });
    expect(relay.roomCount()).toBe(0);
  });

  it('broadcasts snapshots and moves, then replays server-derived state to late peers', async () => {
    const relay = new BattleRoomLiveRelay();
    const first = await connectPlayer(relay, PLAYER_A);
    const second = await connectPlayer(relay, PLAYER_B);
    snapshot(first.connection);
    snapshot(second.connection);
    second.socket.send.mockClear();

    first.connection.handleMessage(JSON.stringify({ type: 'move', round: 1, seq: 1, move: 'R' }));
    expect(messages(second.socket)).toContainEqual(expect.objectContaining({
      type: 'move', playerId: PLAYER_A, round: 1, seq: 1, move: 'R',
    }));

    const tracker = new SmartCubeStateTracker();
    tracker.applyMove('R');
    const late = await connectPlayer(relay, PLAYER_C);
    expect(messages(late.socket)).toContainEqual(expect.objectContaining({
      type: 'snapshot',
      playerId: PLAYER_A,
      round: 1,
      seq: 1,
      facelets: tracker.getFacelets(),
    }));
  });

  it('requests a fresh snapshot when a player skips a move sequence', async () => {
    const relay = new BattleRoomLiveRelay();
    const first = await connectPlayer(relay, PLAYER_A);
    const second = await connectPlayer(relay, PLAYER_B);
    snapshot(first.connection);
    second.socket.send.mockClear();
    first.socket.send.mockClear();

    first.connection.handleMessage(JSON.stringify({ type: 'move', round: 1, seq: 2, move: 'U' }));

    expect(messages(first.socket)).toContainEqual({ type: 'resync', round: 1 });
    expect(messages(second.socket).some((message) => message.type === 'move')).toBe(false);
  });

  it('drops a backpressured observer without interrupting the sender', async () => {
    const relay = new BattleRoomLiveRelay();
    const first = await connectPlayer(relay, PLAYER_A);
    const second = await connectPlayer(relay, PLAYER_B);
    second.socket.bufferedAmount = BATTLE_ROOM_LIVE_MAX_BUFFERED_BYTES;

    snapshot(first.connection);

    expect(second.socket.close).toHaveBeenCalledWith(1013, 'relay backpressure');
    expect(first.socket.close).not.toHaveBeenCalled();
  });

  it('revokes kicked players and closes every peer when the room ends', async () => {
    const relay = new BattleRoomLiveRelay();
    const first = await connectPlayer(relay, PLAYER_A);
    const second = await connectPlayer(relay, PLAYER_B);

    relay.disconnectPlayer(CODE, PLAYER_B, 'removed from room');
    expect(second.socket.close).toHaveBeenCalledWith(4001, 'removed from room');
    expect(messages(first.socket).at(-1)).toEqual({
      type: 'presence',
      players: [{ playerId: PLAYER_A, connected: true, smart: false, round: null }],
    });

    relay.disconnectRoom(CODE);
    expect(first.socket.close).toHaveBeenCalledWith(4001, 'room closed');
    expect(relay.roomCount()).toBe(0);
  });
});
