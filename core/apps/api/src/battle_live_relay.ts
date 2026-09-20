import { SmartCubeStateTracker } from '@cuberoot/shared/smart-cube/cubie';
import {
  NET_BATTLE_LIVE_MAX_MESSAGE_BYTES,
  NET_BATTLE_LIVE_PROTOCOL_VERSION,
  parseNetBattleLiveClientPayload,
  parseNetBattleLiveHello,
  type NetBattleCredentials,
  type NetBattleLiveHello,
  type NetBattleLivePresencePlayer,
} from '@cuberoot/shared/timer';

export interface BattleRoomLiveSocket {
  readonly bufferedAmount?: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type BattleRoomLiveAuthorize = (
  code: string,
  credentials: NetBattleCredentials,
) => Promise<boolean>;

interface BattleRoomLivePeer {
  hello: NetBattleLiveHello;
  messagesInWindow: number;
  socket: BattleRoomLiveSocket;
  windowStartedAt: number;
}

interface BattleRoomLivePlayerState {
  connected: boolean;
  facelets: string | null;
  round: number | null;
  seq: number;
  smart: boolean;
  tracker: SmartCubeStateTracker | null;
  updatedAt: number;
}

interface BattleRoomLiveRoom {
  createdAt: number;
  peers: Map<string, BattleRoomLivePeer>;
  states: Map<string, BattleRoomLivePlayerState>;
  touchedAt: number;
}

const textEncoder = new TextEncoder();
const MAX_ROOMS = 512;
const MAX_PEERS_PER_ROOM = 8;
const MESSAGE_WINDOW_MS = 10_000;
const PRUNE_INTERVAL_MS = 60_000;
export const BATTLE_ROOM_LIVE_IDLE_MS = 30 * 60_000;
export const BATTLE_ROOM_LIVE_HELLO_TIMEOUT_MS = 5_000;
export const BATTLE_ROOM_LIVE_MAX_PENDING_PER_CLIENT = 8;
export const BATTLE_ROOM_LIVE_MAX_MESSAGES_PER_WINDOW = 600;
export const BATTLE_ROOM_LIVE_MAX_BUFFERED_BYTES = 256 * 1024;

function encodedBytes(data: string): number {
  return textEncoder.encode(data).byteLength;
}

function parseMessage(data: unknown): unknown {
  if (typeof data !== 'string' || encodedBytes(data) > NET_BATTLE_LIVE_MAX_MESSAGE_BYTES) return null;
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
}

function closeSafely(socket: BattleRoomLiveSocket, code: number, reason: string): void {
  try {
    socket.close(code, reason);
  } catch {
    // A broken transport is already closed from the relay's point of view.
  }
}

export class BattleRoomLiveRelay {
  private readonly rooms = new Map<string, BattleRoomLiveRoom>();
  private readonly pending = new Map<string, number>();

  connect(
    socket: BattleRoomLiveSocket,
    authorize: BattleRoomLiveAuthorize,
    clientKey = 'unknown',
  ): { handleMessage(data: unknown): void; handleClose(): void } {
    const pendingCount = this.pending.get(clientKey) ?? 0;
    if (pendingCount >= BATTLE_ROOM_LIVE_MAX_PENDING_PER_CLIENT) {
      closeSafely(socket, 1008, 'client pending limit');
      return { handleMessage: () => {}, handleClose: () => {} };
    }
    this.pending.set(clientKey, pendingCount + 1);

    let peer: BattleRoomLivePeer | null = null;
    let closed = false;
    let authenticating = false;
    let isPending = true;
    const releasePending = (): void => {
      if (!isPending) return;
      isPending = false;
      const count = this.pending.get(clientKey) ?? 0;
      if (count <= 1) this.pending.delete(clientKey);
      else this.pending.set(clientKey, count - 1);
    };
    const helloTimer = setTimeout(() => {
      if (closed || peer) return;
      closed = true;
      releasePending();
      closeSafely(socket, 1008, 'hello timeout');
    }, BATTLE_ROOM_LIVE_HELLO_TIMEOUT_MS);
    helloTimer.unref();

    const reject = (reason: string): void => {
      if (closed) return;
      closed = true;
      clearTimeout(helloTimer);
      releasePending();
      if (peer) this.removePeer(peer, true);
      closeSafely(socket, 1008, reason);
    };

    const attach = (hello: NetBattleLiveHello): void => {
      this.pruneExpired();
      let room = this.rooms.get(hello.code);
      if (!room) {
        if (this.rooms.size >= MAX_ROOMS) {
          reject('relay busy');
          return;
        }
        const now = Date.now();
        room = { createdAt: now, peers: new Map(), states: new Map(), touchedAt: now };
        this.rooms.set(hello.code, room);
      }
      const existing = room.peers.get(hello.playerId);
      if (!existing && room.peers.size >= MAX_PEERS_PER_ROOM) {
        reject('room full');
        return;
      }
      if (existing) {
        room.peers.delete(hello.playerId);
        closeSafely(existing.socket, 4000, 'connection replaced');
      }

      const nextPeer: BattleRoomLivePeer = {
        hello,
        messagesInWindow: 0,
        socket,
        windowStartedAt: Date.now(),
      };
      const previous = room.states.get(hello.playerId);
      room.states.set(hello.playerId, {
        connected: true,
        facelets: previous?.facelets ?? null,
        round: previous?.round ?? null,
        seq: previous?.seq ?? 0,
        smart: false,
        tracker: previous?.tracker ?? null,
        updatedAt: previous?.updatedAt ?? 0,
      });
      room.peers.set(hello.playerId, nextPeer);
      room.touchedAt = Date.now();
      peer = nextPeer;
      authenticating = false;
      clearTimeout(helloTimer);
      releasePending();

      if (!this.send(nextPeer, JSON.stringify({
        type: 'ready',
        version: NET_BATTLE_LIVE_PROTOCOL_VERSION,
      }))) return;
      for (const [playerId, state] of room.states) {
        if (playerId === hello.playerId || !state.facelets || state.round === null) continue;
        if (!this.send(nextPeer, this.snapshotMessage(playerId, state))) return;
      }
      this.broadcastPresence(room);
    };

    return {
      handleMessage: (data): void => {
        if (closed) return;
        const message = parseMessage(data);
        if (!peer) {
          if (authenticating) {
            reject('authentication pending');
            return;
          }
          const hello = parseNetBattleLiveHello(message);
          if (!hello) {
            reject('hello required');
            return;
          }
          authenticating = true;
          void authorize(hello.code, {
            playerId: hello.playerId,
            playerToken: hello.playerToken,
          }).then((allowed) => {
            if (closed) return;
            if (!allowed) {
              reject('invalid player capability');
              return;
            }
            attach(hello);
          }).catch(() => reject('authorization failed'));
          return;
        }

        const payload = parseNetBattleLiveClientPayload(message);
        if (!payload) {
          reject('invalid payload');
          return;
        }
        const now = Date.now();
        if (now - peer.windowStartedAt >= MESSAGE_WINDOW_MS) {
          peer.windowStartedAt = now;
          peer.messagesInWindow = 0;
        }
        peer.messagesInWindow++;
        if (peer.messagesInWindow > BATTLE_ROOM_LIVE_MAX_MESSAGES_PER_WINDOW) {
          reject('rate limit');
          return;
        }
        const room = this.rooms.get(peer.hello.code);
        if (!room || room.peers.get(peer.hello.playerId) !== peer) {
          reject('peer detached');
          return;
        }
        room.touchedAt = now;

        if (payload.type === 'unavailable') {
          const previous = room.states.get(peer.hello.playerId);
          room.states.set(peer.hello.playerId, {
            connected: true,
            facelets: previous?.facelets ?? null,
            round: payload.round,
            seq: previous?.seq ?? 0,
            smart: false,
            tracker: previous?.tracker ?? null,
            updatedAt: now,
          });
          this.broadcastPresence(room);
          return;
        }

        if (payload.type === 'snapshot') {
          const tracker = new SmartCubeStateTracker();
          if (!tracker.adoptFacelets(payload.facelets)) {
            reject('invalid cube state');
            return;
          }
          const state: BattleRoomLivePlayerState = {
            connected: true,
            facelets: payload.facelets,
            round: payload.round,
            seq: payload.seq,
            smart: true,
            tracker,
            updatedAt: now,
          };
          room.states.set(peer.hello.playerId, state);
          this.broadcast(room, this.snapshotMessage(peer.hello.playerId, state), peer);
          this.broadcastPresence(room);
          return;
        }

        const state = room.states.get(peer.hello.playerId);
        if (!state?.smart
          || !state.tracker
          || state.round !== payload.round
          || payload.seq !== state.seq + 1) {
          this.send(peer, JSON.stringify({ type: 'resync', round: payload.round }));
          return;
        }
        state.tracker.applyMove(payload.move);
        state.facelets = state.tracker.getFacelets();
        state.seq = payload.seq;
        state.updatedAt = now;
        this.broadcast(room, JSON.stringify({
          type: 'move',
          playerId: peer.hello.playerId,
          round: payload.round,
          seq: payload.seq,
          move: payload.move,
          updatedAt: now,
        }), peer);
      },
      handleClose: (): void => {
        if (closed) return;
        closed = true;
        clearTimeout(helloTimer);
        releasePending();
        if (peer) this.removePeer(peer, true);
      },
    };
  }

  roomCount(): number {
    return this.rooms.size;
  }

  disconnectPlayer(code: string, playerId: string, reason = 'membership revoked'): void {
    const room = this.rooms.get(code);
    if (!room) return;
    const peer = room.peers.get(playerId);
    room.peers.delete(playerId);
    room.states.delete(playerId);
    if (peer) closeSafely(peer.socket, 4001, reason);
    if (room.peers.size === 0) this.rooms.delete(code);
    else this.broadcastPresence(room);
  }

  disconnectRoom(code: string, reason = 'room closed'): void {
    const room = this.rooms.get(code);
    if (!room) return;
    this.rooms.delete(code);
    for (const peer of room.peers.values()) closeSafely(peer.socket, 4001, reason);
  }

  pruneExpired(now = Date.now()): void {
    for (const [code, room] of this.rooms) {
      if (now - room.touchedAt <= BATTLE_ROOM_LIVE_IDLE_MS) continue;
      this.rooms.delete(code);
      for (const peer of room.peers.values()) closeSafely(peer.socket, 1001, 'room expired');
    }
  }

  private snapshotMessage(playerId: string, state: BattleRoomLivePlayerState): string {
    return JSON.stringify({
      type: 'snapshot',
      playerId,
      round: state.round,
      seq: state.seq,
      facelets: state.facelets,
      updatedAt: state.updatedAt,
    });
  }

  private presencePlayers(room: BattleRoomLiveRoom): NetBattleLivePresencePlayer[] {
    return [...room.states.entries()].map(([playerId, state]) => ({
      playerId,
      connected: state.connected,
      smart: state.smart,
      round: state.round,
    }));
  }

  private broadcastPresence(room: BattleRoomLiveRoom): void {
    let membershipChanged = true;
    while (membershipChanged) {
      membershipChanged = false;
      const encoded = JSON.stringify({ type: 'presence', players: this.presencePlayers(room) });
      for (const peer of [...room.peers.values()]) {
        if (room.peers.get(peer.hello.playerId) === peer && !this.send(peer, encoded)) {
          membershipChanged = true;
        }
      }
      if (room.peers.size === 0) return;
    }
  }

  private broadcast(room: BattleRoomLiveRoom, data: string, exclude?: BattleRoomLivePeer): void {
    let membershipChanged = false;
    for (const peer of [...room.peers.values()]) {
      if (peer === exclude) continue;
      if (!this.send(peer, data)) membershipChanged = true;
    }
    if (membershipChanged && room.peers.size > 0) this.broadcastPresence(room);
  }

  private send(peer: BattleRoomLivePeer, data: string): boolean {
    if ((peer.socket.bufferedAmount ?? 0) + encodedBytes(data) > BATTLE_ROOM_LIVE_MAX_BUFFERED_BYTES) {
      closeSafely(peer.socket, 1013, 'relay backpressure');
      this.removePeer(peer, false);
      return false;
    }
    try {
      peer.socket.send(data);
      return true;
    } catch {
      closeSafely(peer.socket, 1011, 'relay send failed');
      this.removePeer(peer, false);
      return false;
    }
  }

  private removePeer(peer: BattleRoomLivePeer, broadcast: boolean): void {
    const room = this.rooms.get(peer.hello.code);
    if (!room || room.peers.get(peer.hello.playerId) !== peer) return;
    room.peers.delete(peer.hello.playerId);
    const state = room.states.get(peer.hello.playerId);
    if (state) {
      state.connected = false;
      state.smart = false;
      state.updatedAt = Date.now();
    }
    room.touchedAt = Date.now();
    if (room.peers.size === 0) {
      this.rooms.delete(peer.hello.code);
      return;
    }
    if (broadcast) this.broadcastPresence(room);
  }
}

export const battleRoomLiveRelay = new BattleRoomLiveRelay();
const pruneTimer = setInterval(() => battleRoomLiveRelay.pruneExpired(), PRUNE_INTERVAL_MS);
pruneTimer.unref();
