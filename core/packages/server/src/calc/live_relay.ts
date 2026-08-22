import {
  CALC_LIVE_MAX_MESSAGE_BYTES,
  parseCalcLiveHello,
  parseCalcLiveStateMessage,
  type CalcLiveHello,
} from '@cuberoot/shared';

export interface CalcLiveRelaySocket {
  readonly bufferedAmount?: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface CalcLivePeer {
  hello: CalcLiveHello;
  messagesInWindow: number;
  socket: CalcLiveRelaySocket;
  windowStartedAt: number;
}

interface CalcLiveRoom {
  createdAt: number;
  host: CalcLivePeer | null;
  hostToken: string;
  ownerKey: string;
  revision: number;
  snapshot: string | null;
  touchedAt: number;
  viewers: Set<CalcLivePeer>;
}

const textEncoder = new TextEncoder();
const MAX_ROOMS = 512;
const MAX_VIEWERS_PER_ROOM = 64;
const MESSAGE_WINDOW_MS = 10_000;
const CREATION_WINDOW_MS = 60_000;
export const CALC_LIVE_ROOM_IDLE_MS = 30 * 60_000;
export const CALC_LIVE_HELLO_TIMEOUT_MS = 5_000;
export const CALC_LIVE_MAX_PENDING_PER_CLIENT = 8;
export const CALC_LIVE_MAX_ROOMS_PER_CLIENT = 16;
export const CALC_LIVE_MAX_CREATIONS_PER_WINDOW = 16;
export const CALC_LIVE_MAX_MESSAGES_PER_WINDOW = 120;
export const CALC_LIVE_MAX_BUFFERED_BYTES = 256 * 1024;

function encodedBytes(data: string): number {
  return textEncoder.encode(data).byteLength;
}

function parseMessage(data: unknown): unknown {
  if (typeof data !== 'string' || encodedBytes(data) > CALC_LIVE_MAX_MESSAGE_BYTES) return null;
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
}

function closeSafely(socket: CalcLiveRelaySocket, code: number, reason: string): void {
  try {
    socket.close(code, reason);
  } catch {
    // A broken transport is already closed from the relay's point of view.
  }
}

export class CalcLiveRelay {
  private readonly rooms = new Map<string, CalcLiveRoom>();
  private readonly creations = new Map<string, { count: number; startedAt: number }>();
  private readonly pending = new Map<string, number>();

  connect(socket: CalcLiveRelaySocket, clientKey = 'unknown'): {
    handleMessage(data: unknown): void;
    handleClose(): void;
  } {
    const pendingCount = this.pending.get(clientKey) ?? 0;
    if (pendingCount >= CALC_LIVE_MAX_PENDING_PER_CLIENT) {
      closeSafely(socket, 1008, 'client pending limit');
      return { handleMessage: () => {}, handleClose: () => {} };
    }
    this.pending.set(clientKey, pendingCount + 1);

    let peer: CalcLivePeer | null = null;
    let closed = false;
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
    }, CALC_LIVE_HELLO_TIMEOUT_MS);
    helloTimer.unref();

    const detach = (broadcast = true): void => {
      if (!peer) return;
      const detached = peer;
      peer = null;
      const room = this.rooms.get(detached.hello.code);
      if (!room) return;
      if (detached.hello.role === 'host' && room.host === detached) room.host = null;
      if (detached.hello.role === 'viewer') room.viewers.delete(detached);
      room.touchedAt = Date.now();
      if (broadcast) this.broadcastStatus(room);
    };

    const reject = (reason: string): void => {
      if (closed) return;
      closed = true;
      clearTimeout(helloTimer);
      releasePending();
      detach();
      closeSafely(socket, 1008, reason);
    };

    return {
      handleMessage: (data): void => {
        if (closed) return;
        const message = parseMessage(data);
        if (!peer) {
          const hello = parseCalcLiveHello(message);
          if (!hello) {
            reject('hello required');
            return;
          }
          this.pruneExpired();
          let room = this.rooms.get(hello.code);
          if (hello.role === 'host') {
            if (!room) {
              if (this.rooms.size >= MAX_ROOMS) {
                reject('relay busy');
                return;
              }
              if (this.roomCountFor(clientKey) >= CALC_LIVE_MAX_ROOMS_PER_CLIENT) {
                reject('client room limit');
                return;
              }
              if (!this.consumeCreation(clientKey)) {
                reject('client creation rate limit');
                return;
              }
              const now = Date.now();
              room = {
                createdAt: now,
                host: null,
                hostToken: hello.token,
                ownerKey: clientKey,
                revision: 0,
                snapshot: null,
                touchedAt: now,
                viewers: new Set(),
              };
              this.rooms.set(hello.code, room);
            } else if (room.hostToken !== hello.token) {
              reject('room code taken');
              return;
            }
          } else if (!room) {
            reject('room not found');
            return;
          }

          const nextPeer: CalcLivePeer = {
            hello,
            messagesInWindow: 0,
            socket,
            windowStartedAt: Date.now(),
          };
          if (hello.role === 'host') {
            if (room.host) {
              const replaced = room.host;
              room.host = null;
              closeSafely(replaced.socket, 4000, 'host replaced');
            }
            room.host = nextPeer;
          } else {
            if (room.viewers.size >= MAX_VIEWERS_PER_ROOM) {
              reject('room full');
              return;
            }
            room.viewers.add(nextPeer);
          }
          peer = nextPeer;
          room.touchedAt = Date.now();
          clearTimeout(helloTimer);
          releasePending();

          if (!this.send(nextPeer, JSON.stringify({ type: 'ready', role: hello.role }))) return;
          if (hello.role === 'viewer' && room.snapshot && !this.send(nextPeer, room.snapshot)) return;
          this.broadcastStatus(room);
          return;
        }

        if (peer.hello.role !== 'host') {
          reject('viewer is read only');
          return;
        }
        const stateMessage = parseCalcLiveStateMessage(message);
        if (!stateMessage) {
          reject('invalid payload');
          return;
        }
        const now = Date.now();
        if (now - peer.windowStartedAt >= MESSAGE_WINDOW_MS) {
          peer.windowStartedAt = now;
          peer.messagesInWindow = 0;
        }
        peer.messagesInWindow++;
        if (peer.messagesInWindow > CALC_LIVE_MAX_MESSAGES_PER_WINDOW) {
          reject('rate limit');
          return;
        }
        const room = this.rooms.get(peer.hello.code);
        if (!room || room.host !== peer) {
          reject('peer detached');
          return;
        }
        room.touchedAt = now;
        room.revision++;
        room.snapshot = JSON.stringify({
          type: 'snapshot',
          revision: room.revision,
          updatedAt: now,
          state: stateMessage.state,
        });
        let membershipChanged = false;
        for (const viewer of [...room.viewers]) {
          if (!this.send(viewer, room.snapshot)) membershipChanged = true;
        }
        if (membershipChanged) this.broadcastStatus(room);
      },
      handleClose: (): void => {
        if (closed) return;
        closed = true;
        clearTimeout(helloTimer);
        releasePending();
        detach();
      },
    };
  }

  roomCount(): number {
    return this.rooms.size;
  }

  pruneExpired(now = Date.now()): void {
    for (const [code, room] of this.rooms) {
      if (now - room.touchedAt <= CALC_LIVE_ROOM_IDLE_MS) continue;
      if (room.host) closeSafely(room.host.socket, 1001, 'room expired');
      for (const viewer of room.viewers) closeSafely(viewer.socket, 1001, 'room expired');
      this.rooms.delete(code);
    }
    for (const [key, window] of this.creations) {
      if (now - window.startedAt >= CREATION_WINDOW_MS) this.creations.delete(key);
    }
  }

  private send(peer: CalcLivePeer, data: string): boolean {
    if ((peer.socket.bufferedAmount ?? 0) + encodedBytes(data) > CALC_LIVE_MAX_BUFFERED_BYTES) {
      closeSafely(peer.socket, 1013, 'relay backpressure');
      this.detachPeer(peer);
      return false;
    }
    try {
      peer.socket.send(data);
      return true;
    } catch {
      closeSafely(peer.socket, 1011, 'relay send failed');
      this.detachPeer(peer);
      return false;
    }
  }

  private detachPeer(peer: CalcLivePeer): void {
    const room = this.rooms.get(peer.hello.code);
    if (!room) return;
    if (peer.hello.role === 'host' && room.host === peer) room.host = null;
    if (peer.hello.role === 'viewer') room.viewers.delete(peer);
    room.touchedAt = Date.now();
  }

  private broadcastStatus(room: CalcLiveRoom): void {
    // A failed send detaches that peer. Broadcast once more so the remaining
    // peers never keep a stale live/viewer count after backpressure or I/O loss.
    let membershipChanged = true;
    while (membershipChanged) {
      membershipChanged = false;
      const host = room.host;
      const viewers = [...room.viewers];
      const encoded = JSON.stringify({
        type: 'status',
        live: host !== null,
        viewers: viewers.length,
      });
      if (host && !this.send(host, encoded)) membershipChanged = true;
      for (const viewer of viewers) {
        if (room.viewers.has(viewer) && !this.send(viewer, encoded)) membershipChanged = true;
      }
    }
  }

  private roomCountFor(clientKey: string): number {
    let count = 0;
    for (const room of this.rooms.values()) {
      if (room.ownerKey === clientKey) count++;
    }
    return count;
  }

  private consumeCreation(clientKey: string): boolean {
    const now = Date.now();
    const current = this.creations.get(clientKey);
    if (!current || now - current.startedAt >= CREATION_WINDOW_MS) {
      this.creations.set(clientKey, { count: 1, startedAt: now });
      return true;
    }
    if (current.count >= CALC_LIVE_MAX_CREATIONS_PER_WINDOW) return false;
    current.count++;
    return true;
  }
}

export const calcLiveRelay = new CalcLiveRelay();
