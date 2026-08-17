import {
  SMART_CUBE_RELAY_MAX_MESSAGE_BYTES,
  isSmartCubeRelayHello,
  isSmartCubeRelayPayload,
  type SmartCubeRelayHello,
} from '@cuberoot/shared/smart-cube/relay';

export interface SmartCubeRelaySocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface RelayPeer {
  hello: SmartCubeRelayHello;
  messagesInWindow: number;
  socket: SmartCubeRelaySocket;
  windowStartedAt: number;
}

interface RelayChannel {
  createdAt: number;
  lastMoveSeq: number;
  moves: Array<{ encoded: string; seq: number }>;
  ownerKey: string;
  source: RelayPeer | null;
  sourceSeen: boolean;
  sinks: Set<RelayPeer>;
  sinklessTimer: ReturnType<typeof setTimeout> | null;
  snapshots: Map<'status' | 'state' | 'battery', string>;
  touchedAt: number;
}

const MAX_CHANNELS = 512;
const MAX_SINKS_PER_CHANNEL = 2;
const MAX_REPLAYED_MOVES = 512;
const CHANNEL_PRUNE_INTERVAL_MS = 60_000;
const MESSAGE_WINDOW_MS = 10_000;
const CHANNEL_CREATION_WINDOW_MS = 60_000;
const DISCONNECTED_STATUS = JSON.stringify({ type: 'status', phase: 'disconnected' });
export const SMART_CUBE_RELAY_CHANNEL_IDLE_MS = 10 * 60_000;
export const SMART_CUBE_RELAY_UNPAIRED_IDLE_MS = 30_000;
export const SMART_CUBE_RELAY_MAX_CHANNELS_PER_CLIENT = 16;
export const SMART_CUBE_RELAY_MAX_CHANNEL_CREATIONS_PER_WINDOW = 16;
export const SMART_CUBE_RELAY_MAX_MESSAGES_PER_WINDOW = 1_200;
export const SMART_CUBE_RELAY_HELLO_TIMEOUT_MS = 5_000;
export const SMART_CUBE_RELAY_MAX_PENDING_PER_CLIENT = 8;
export const SMART_CUBE_RELAY_SINK_GRACE_MS = 15_000;

function parseMessage(data: unknown): unknown {
  if (typeof data !== 'string') return null;
  if (new TextEncoder().encode(data).byteLength > SMART_CUBE_RELAY_MAX_MESSAGE_BYTES) return null;
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
}

function closeSafely(socket: SmartCubeRelaySocket, code: number, reason: string): void {
  try {
    socket.close(code, reason);
  } catch {
    // A broken transport is already closed from the relay's point of view.
  }
}

export class SmartCubeRelay {
  private readonly channels = new Map<string, RelayChannel>();
  private readonly channelCreations = new Map<string, { count: number; startedAt: number }>();
  private readonly pendingConnections = new Map<string, number>();

  connect(socket: SmartCubeRelaySocket, clientKey = 'unknown'): {
    handleMessage(data: unknown): void;
    handleClose(): void;
  } {
    const pendingCount = this.pendingConnections.get(clientKey) ?? 0;
    if (pendingCount >= SMART_CUBE_RELAY_MAX_PENDING_PER_CLIENT) {
      closeSafely(socket, 1008, 'client pending limit');
      return { handleMessage: () => {}, handleClose: () => {} };
    }
    this.pendingConnections.set(clientKey, pendingCount + 1);

    let peer: RelayPeer | null = null;
    let closed = false;
    let pending = true;
    const releasePending = (): void => {
      if (!pending) return;
      pending = false;
      const count = this.pendingConnections.get(clientKey) ?? 0;
      if (count <= 1) this.pendingConnections.delete(clientKey);
      else this.pendingConnections.set(clientKey, count - 1);
    };
    const helloTimer = setTimeout(() => {
      if (closed || peer) return;
      closed = true;
      releasePending();
      closeSafely(socket, 1008, 'hello timeout');
    }, SMART_CUBE_RELAY_HELLO_TIMEOUT_MS);
    helloTimer.unref();
    const clearHelloTimer = (): void => clearTimeout(helloTimer);

    const detach = (): void => {
      if (!peer) return;
      const detachedPeer = peer;
      peer = null;
      const channel = this.channels.get(detachedPeer.hello.token);
      if (!channel) return;

      if (detachedPeer.hello.role === 'source' && channel.source === detachedPeer) {
        this.markSourceDisconnected(detachedPeer.hello.token, channel);
      } else if (detachedPeer.hello.role === 'sink') {
        channel.sinks.delete(detachedPeer);
        this.scheduleSourceCloseIfSinkless(detachedPeer.hello.token, channel);
      }
      channel.touchedAt = Date.now();
      this.deleteIfEmpty(detachedPeer.hello.token, channel);
    };

    const reject = (reason: string): void => {
      if (closed) return;
      closed = true;
      clearHelloTimer();
      releasePending();
      detach();
      closeSafely(socket, 1008, reason);
    };

    return {
      handleMessage: (data): void => {
        if (closed) return;
        const message = parseMessage(data);
        if (!peer) {
          if (!isSmartCubeRelayHello(message)) {
            reject('hello required');
            return;
          }
          this.pruneExpired();
          let channel = this.channels.get(message.token);
          if (!channel) {
            if (message.role !== 'sink') {
              reject('sink must create channel');
              return;
            }
            if (this.channels.size >= MAX_CHANNELS) {
              reject('relay busy');
              return;
            }
            if (this.channelCountFor(clientKey) >= SMART_CUBE_RELAY_MAX_CHANNELS_PER_CLIENT) {
              reject('client channel limit');
              return;
            }
            if (!this.consumeChannelCreation(clientKey)) {
              reject('client creation rate limit');
              return;
            }
            const createdAt = Date.now();
            channel = {
              createdAt,
              lastMoveSeq: 0,
              moves: [],
              ownerKey: clientKey,
              source: null,
              sourceSeen: false,
              sinks: new Set(),
              sinklessTimer: null,
              snapshots: new Map(),
              touchedAt: createdAt,
            };
            this.channels.set(message.token, channel);
          }
          const nextPeer: RelayPeer = {
            hello: message,
            messagesInWindow: 0,
            socket,
            windowStartedAt: Date.now(),
          };
          if (message.role === 'source') {
            if (channel.source) {
              reject('source already connected');
              return;
            }
            channel.source = nextPeer;
            channel.sourceSeen = true;
          } else {
            if (channel.sinks.size >= MAX_SINKS_PER_CHANNEL) {
              reject('too many sinks');
              return;
            }
            const requestedMoveSeq = message.lastMoveSeq ?? 0;
            const earliestMoveSeq = channel.moves[0]?.seq ?? channel.lastMoveSeq + 1;
            if (requestedMoveSeq > channel.lastMoveSeq
              || requestedMoveSeq < earliestMoveSeq - 1) {
              if (channel.source) {
                closeSafely(channel.source.socket, 1012, 'relay replay unavailable');
                this.markSourceDisconnected(message.token, channel);
              }
              reject('relay replay unavailable');
              return;
            }
            try {
              for (const snapshot of channel.snapshots.values()) {
                if (snapshot.includes('"type":"state"')
                  && requestedMoveSeq < channel.lastMoveSeq) continue;
                socket.send(snapshot);
              }
              for (const move of channel.moves) {
                if (move.seq > requestedMoveSeq) socket.send(move.encoded);
              }
            } catch {
              closed = true;
              clearHelloTimer();
              releasePending();
              closeSafely(socket, 1011, 'relay send failed');
              return;
            }
            this.cancelSinklessTimer(channel);
            channel.sinks.add(nextPeer);
          }
          channel.touchedAt = Date.now();
          peer = nextPeer;
          clearHelloTimer();
          releasePending();
          try {
            socket.send(JSON.stringify({
              type: 'ready',
              role: message.role,
              lastMoveSeq: channel.lastMoveSeq,
            }));
          } catch {
            closed = true;
            detach();
            closeSafely(socket, 1011, 'relay send failed');
          }
          return;
        }

        if (!isSmartCubeRelayPayload(message)) {
          reject('invalid payload');
          return;
        }
        const now = Date.now();
        if (now - peer.windowStartedAt >= MESSAGE_WINDOW_MS) {
          peer.windowStartedAt = now;
          peer.messagesInWindow = 0;
        }
        peer.messagesInWindow++;
        if (peer.messagesInWindow > SMART_CUBE_RELAY_MAX_MESSAGES_PER_WINDOW) {
          reject('rate limit');
          return;
        }
        const channel = this.channels.get(peer.hello.token);
        if (!channel) {
          reject('channel expired');
          return;
        }
        const isCurrentPeer = peer.hello.role === 'source'
          ? channel.source === peer
          : channel.sinks.has(peer);
        if (!isCurrentPeer) {
          reject('peer detached');
          return;
        }
        channel.touchedAt = now;
        if (peer.hello.role === 'source') {
          if (message.type === 'command') {
            reject('source cannot send commands');
            return;
          }
          if (message.type === 'move' && message.relaySeq !== undefined) {
            reject('source cannot set relay sequence');
            return;
          }
          const outboundMessage = message.type === 'move'
            ? { ...message, relaySeq: ++channel.lastMoveSeq }
            : message;
          const encoded = JSON.stringify(outboundMessage);
          if (outboundMessage.type === 'move') {
            channel.moves.push({ encoded, seq: outboundMessage.relaySeq });
            if (channel.moves.length > MAX_REPLAYED_MOVES) channel.moves.shift();
          }
          if (message.type === 'status' || message.type === 'state' || message.type === 'battery') {
            channel.snapshots.set(message.type, encoded);
          }
          this.broadcastToSinks(peer.hello.token, channel, encoded);
          return;
        }
        if (message.type !== 'command') {
          reject('sink can only send commands');
          return;
        }
        const encoded = JSON.stringify(message);
        if (!channel.source) return;
        try {
          channel.source.socket.send(encoded);
        } catch {
          closeSafely(channel.source.socket, 1011, 'relay send failed');
          this.markSourceDisconnected(peer.hello.token, channel);
        }
      },
      handleClose: (): void => {
        if (closed) return;
        closed = true;
        clearHelloTimer();
        releasePending();
        detach();
      },
    };
  }

  channelCount(): number {
    return this.channels.size;
  }

  pruneExpired(now = Date.now()): void {
    const deadline = now - SMART_CUBE_RELAY_CHANNEL_IDLE_MS;
    for (const [token, channel] of this.channels) {
      const unpairedExpired = !channel.sourceSeen
        && channel.createdAt < now - SMART_CUBE_RELAY_UNPAIRED_IDLE_MS;
      if (channel.touchedAt < deadline || unpairedExpired) {
        this.cancelSinklessTimer(channel);
        if (channel.source) closeSafely(channel.source.socket, 1001, 'channel expired');
        for (const sink of channel.sinks) closeSafely(sink.socket, 1001, 'channel expired');
        this.channels.delete(token);
      }
    }
    for (const [clientKey, creationWindow] of this.channelCreations) {
      if (now - creationWindow.startedAt >= CHANNEL_CREATION_WINDOW_MS) {
        this.channelCreations.delete(clientKey);
      }
    }
  }

  private broadcastToSinks(token: string, channel: RelayChannel, encoded: string): void {
    for (const sink of [...channel.sinks]) {
      try {
        sink.socket.send(encoded);
      } catch {
        channel.sinks.delete(sink);
        closeSafely(sink.socket, 1011, 'relay send failed');
      }
    }
    this.scheduleSourceCloseIfSinkless(token, channel);
    this.deleteIfEmpty(token, channel);
  }

  private markSourceDisconnected(token: string, channel: RelayChannel): void {
    this.cancelSinklessTimer(channel);
    channel.source = null;
    channel.snapshots.delete('state');
    channel.snapshots.delete('battery');
    channel.snapshots.set('status', DISCONNECTED_STATUS);
    channel.touchedAt = Date.now();
    this.broadcastToSinks(token, channel, DISCONNECTED_STATUS);
  }

  private deleteIfEmpty(token: string, channel: RelayChannel): void {
    if (!channel.source && channel.sinks.size === 0) {
      this.cancelSinklessTimer(channel);
      this.channels.delete(token);
    }
  }

  private cancelSinklessTimer(channel: RelayChannel): void {
    if (!channel.sinklessTimer) return;
    clearTimeout(channel.sinklessTimer);
    channel.sinklessTimer = null;
  }

  private scheduleSourceCloseIfSinkless(token: string, channel: RelayChannel): void {
    if (!channel.source || channel.sinks.size > 0 || channel.sinklessTimer) return;
    channel.sinklessTimer = setTimeout(() => {
      channel.sinklessTimer = null;
      if (this.channels.get(token) !== channel || channel.sinks.size > 0 || !channel.source) return;
      closeSafely(channel.source.socket, 1001, 'timer disconnected');
      this.markSourceDisconnected(token, channel);
    }, SMART_CUBE_RELAY_SINK_GRACE_MS);
    channel.sinklessTimer.unref();
  }

  private channelCountFor(clientKey: string): number {
    let count = 0;
    for (const channel of this.channels.values()) {
      if (channel.ownerKey === clientKey) count++;
    }
    return count;
  }

  private consumeChannelCreation(clientKey: string, now = Date.now()): boolean {
    const current = this.channelCreations.get(clientKey);
    if (!current || now - current.startedAt >= CHANNEL_CREATION_WINDOW_MS) {
      this.channelCreations.set(clientKey, { count: 1, startedAt: now });
      return true;
    }
    if (current.count >= SMART_CUBE_RELAY_MAX_CHANNEL_CREATIONS_PER_WINDOW) return false;
    current.count++;
    return true;
  }

}

export const smartCubeRelay = new SmartCubeRelay();
const relayPruneTimer = setInterval(() => {
  smartCubeRelay.pruneExpired();
}, CHANNEL_PRUNE_INTERVAL_MS);
relayPruneTimer.unref();
