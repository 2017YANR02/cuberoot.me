import { SOLVED_SMART_CUBE_FACELETS, SmartCubeStateTracker } from '@cuberoot/shared/smart-cube/cubie';
import { describe, expect, it, vi } from 'vitest';

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
) {
  const connection = relay.connect(socket, authorize, playerId);
  connection.handleMessage(JSON.stringify({
    type: 'hello',
    version: 1,
    code: CODE,
    playerId,
    playerToken: TOKEN,
  }));
  await vi.waitFor(() => {
    expect(messages(socket)).toContainEqual({ type: 'ready', version: 1 });
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