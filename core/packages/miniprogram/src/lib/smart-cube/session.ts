import {
  SMART_CUBE_RELAY_PATH,
  SMART_CUBE_RELAY_TOKEN_PATTERN,
  isSmartCubeRelayReady,
  isSmartCubeRelayPayload,
  type SmartCubeRelayEvent,
  type SmartCubeRelayHello,
} from '@cuberoot/shared/smart-cube/relay';
import { API_ORIGIN } from '../runtime-config';
import { connectGanV4 } from './gan-v4-ble';
import { connectGoCube } from './gocube-ble';
import type { BleAbortSignal } from './ble-api';

export type SmartCubeDriverKind = 'gan-v4' | 'gocube' | 'simulator';
export type SmartCubeSessionPhase =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface SmartCubeSessionSnapshot {
  phase: SmartCubeSessionPhase;
  brand: SmartCubeDriverKind | '';
  deviceName: string;
  battery: number | null;
  error: string;
  lastMove: string;
}

interface SocketTaskLike {
  close(options?: { code?: number; reason?: string }): void;
  onClose(callback: () => void): void;
  onError(callback: (error: { errMsg?: string }) => void): void;
  onMessage(callback: (message: { data: string | ArrayBuffer }) => void): void;
  onOpen(callback: () => void): void;
  send(options: {
    data: string;
    fail?(error: { errMsg?: string }): void;
    success?(): void;
  }): void;
}

interface CubeConnectionLike {
  readonly deviceName?: string;
  disconnect(): Promise<void>;
  requestBattery(): Promise<number | null>;
}

const INITIAL_SNAPSHOT: SmartCubeSessionSnapshot = {
  phase: 'idle',
  brand: '',
  deviceName: '',
  battery: null,
  error: '',
  lastMove: '',
};
const RELAY_HANDSHAKE_TIMEOUT_MS = 10_000;

function relayUrl(): string {
  const origin = API_ORIGIN.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
  const base = origin.endsWith('/v1') ? origin.slice(0, -3) : origin;
  return `${base}${SMART_CUBE_RELAY_PATH}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '连接失败，请重试';
}

interface BleCancellation {
  cancel(): void;
  drain(): Promise<void>;
  signal: BleAbortSignal;
  track(operation: Promise<unknown>): void;
}

function createBleCancellation(): BleCancellation {
  let aborted = false;
  const listeners = new Set<() => void>();
  const operations = new Set<Promise<void>>();
  const track = (operation: Promise<unknown>): void => {
    let tracked!: Promise<void>;
    tracked = operation.then(
      () => {},
      () => {},
    ).finally(() => operations.delete(tracked));
    operations.add(tracked);
  };
  const cancellation: BleCancellation = {
    cancel(): void {
      if (aborted) return;
      aborted = true;
      for (const listener of [...listeners]) listener();
      listeners.clear();
    },
    async drain(): Promise<void> {
      while (operations.size > 0) {
        await Promise.all([...operations]);
      }
    },
    signal: {
      get aborted(): boolean {
        return aborted;
      },
      onAbort(listener: () => void): () => void {
        if (aborted) {
          listener();
          return () => {};
        }
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      track,
    },
    track,
  };
  return cancellation;
}

export class SmartCubeSession {
  private snapshot: SmartCubeSessionSnapshot = { ...INITIAL_SNAPSHOT };
  private readonly listeners = new Set<(snapshot: SmartCubeSessionSnapshot) => void>();
  private socket: SocketTaskLike | null = null;
  private socketOpen = false;
  private token = '';
  private socketGeneration = 0;
  private connectionGeneration = 0;
  private connection: CubeConnectionLike | null = null;
  private pendingConnection: BleCancellation | null = null;
  private hardwareCleanup: Promise<void> = Promise.resolve();
  private cancelPendingStart: (() => void) | null = null;

  subscribe(listener: (snapshot: SmartCubeSessionSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener({ ...this.snapshot });
    return () => this.listeners.delete(listener);
  }

  async start(token: string): Promise<void> {
    if (!SMART_CUBE_RELAY_TOKEN_PATTERN.test(token)) {
      throw new Error('连接凭证无效，请返回计时器重试');
    }
    if (this.socket && this.socketOpen && this.token === token) return;

    const socketGeneration = ++this.socketGeneration;
    ++this.connectionGeneration;
    const cancelPreviousStart = this.cancelPendingStart;
    this.cancelPendingStart = null;
    cancelPreviousStart?.();
    const previousSocket = this.socket;
    this.socket = null;
    this.socketOpen = false;
    previousSocket?.close({ code: 1000, reason: 'new relay session' });
    await this.disconnectHardware();
    if (socketGeneration !== this.socketGeneration) {
      throw new Error('计时器连接已被新的会话替代');
    }
    this.token = token;
    this.setSnapshot({ ...INITIAL_SNAPSHOT });

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const task = wx.connectSocket({ url: relayUrl() }) as unknown as SocketTaskLike;
      this.socket = task;
      let cancelStart: () => void;
      const clearPendingStart = (): void => {
        if (this.cancelPendingStart === cancelStart) this.cancelPendingStart = null;
      };
      const handshakeTimer = setTimeout(() => {
        if (settled || socketGeneration !== this.socketGeneration) return;
        settled = true;
        clearPendingStart();
        task.close({ code: 1008, reason: 'relay handshake timeout' });
        reject(new Error('计时器中继握手超时，请返回重试'));
      }, RELAY_HANDSHAKE_TIMEOUT_MS);

      const rejectHandshake = (message: string): void => {
        if (settled) return;
        settled = true;
        clearTimeout(handshakeTimer);
        clearPendingStart();
        task.close({ code: 1011, reason: 'relay handshake failed' });
        reject(new Error(message));
      };
      cancelStart = (): void => rejectHandshake('计时器连接已被新的会话替代');
      this.cancelPendingStart = cancelStart;

      task.onOpen(() => {
        if (socketGeneration !== this.socketGeneration) return;
        const hello: SmartCubeRelayHello = { type: 'hello', role: 'source', token };
        try {
          task.send({
            data: JSON.stringify(hello),
            fail: (error) => rejectHandshake(error.errMsg || '无法发送计时器中继握手'),
          });
        } catch (error) {
          rejectHandshake(errorMessage(error));
        }
      });
      task.onMessage((message) => {
        if (socketGeneration !== this.socketGeneration || typeof message.data !== 'string') return;
        let payload: unknown;
        try {
          payload = JSON.parse(message.data) as unknown;
        } catch {
          return;
        }
        if (isSmartCubeRelayReady(payload) && payload.role === 'source') {
          if (settled) return;
          settled = true;
          clearTimeout(handshakeTimer);
          clearPendingStart();
          this.socketOpen = true;
          resolve();
          return;
        }
        if (isSmartCubeRelayPayload(payload)
          && payload.type === 'command'
          && payload.command === 'disconnect') {
          void this.disconnect('计时器已断开智能魔方');
        }
      });
      task.onError((error) => {
        if (socketGeneration !== this.socketGeneration) return;
        if (!settled) {
          rejectHandshake(error.errMsg || '无法连接计时器中继');
        }
        this.socketOpen = false;
        ++this.connectionGeneration;
        this.setSnapshot({ phase: 'error', error: '计时器连接已中断，请返回重试' });
        void this.disconnectHardware();
      });
      task.onClose(() => {
        if (socketGeneration !== this.socketGeneration) return;
        this.socketOpen = false;
        if (!settled) {
          settled = true;
          clearTimeout(handshakeTimer);
          clearPendingStart();
          reject(new Error('计时器连接已关闭'));
        }
        ++this.connectionGeneration;
        if (this.snapshot.phase !== 'disconnected') {
          this.setSnapshot({ phase: 'error', error: '计时器连接已关闭，请返回重试' });
        }
        void this.disconnectHardware();
      });
    });
  }

  async connect(kind: SmartCubeDriverKind): Promise<void> {
    if (!this.socketOpen) throw new Error('请先从计时器打开连接页');
    if (this.snapshot.phase === 'scanning' || this.snapshot.phase === 'connecting') return;
    const deviceName = kind === 'gan-v4'
      ? 'GAN v2、v3、v4 协议设备'
      : kind === 'gocube'
        ? 'GoCube、Rubik’s Connected'
        : '开发者工具仿真魔方';
    this.publishStatus({
      type: 'status',
      phase: kind === 'simulator' ? 'connecting' : 'scanning',
      brand: kind,
      deviceName,
      hasGyro: kind !== 'simulator',
    });

    const generation = ++this.connectionGeneration;
    await this.disconnectHardware();
    if (generation !== this.connectionGeneration) return;
    const cancellation = createBleCancellation();
    this.pendingConnection = cancellation;

    let connection: CubeConnectionLike | null = null;
    try {
      if (kind === 'simulator') {
        connection = {
          deviceName,
          disconnect: async () => {},
          requestBattery: async () => 100,
        };
      } else if (kind === 'gan-v4') {
        const operation = connectGanV4({
          signal: cancellation.signal,
          onDisconnect: (message) => this.handleHardwareDisconnect(generation, kind, message),
          onMove: (move, deviceTs) => this.publishMove(generation, move, deviceTs),
          onState: (facelets) => this.publishFor(generation, { type: 'state', facelets }),
          onBattery: (level) => this.publishBattery(generation, level),
          onGyro: (quaternion, velocity) => this.publishFor(generation, {
            type: 'gyro', quaternion, velocity,
          }),
        });
        cancellation.track(operation);
        connection = await operation;
      } else {
        const operation = connectGoCube({
          signal: cancellation.signal,
          onDisconnect: (message) => this.handleHardwareDisconnect(generation, kind, message),
          onMove: (move) => this.publishMove(generation, move),
          onState: (facelets) => this.publishFor(generation, { type: 'state', facelets }),
          onBattery: (level) => this.publishBattery(generation, level),
          onGyro: (quaternion) => this.publishFor(generation, { type: 'gyro', quaternion }),
        });
        cancellation.track(operation);
        connection = await operation;
      }
      if (this.pendingConnection === cancellation) {
        this.pendingConnection = null;
      }
      if (generation !== this.connectionGeneration) {
        await connection.disconnect().catch(() => {});
        return;
      }
      this.connection = connection;
      const connectedName = connection.deviceName ?? deviceName;
      this.publishStatus({
        type: 'status',
        phase: 'connected',
        brand: kind,
        deviceName: connectedName,
        hasGyro: kind !== 'simulator',
      });
      void connection.requestBattery()
        .then((level) => {
          if (level !== null) this.publishBattery(generation, level);
        })
        .catch(() => {});
    } catch (error) {
      if (this.pendingConnection === cancellation) {
        this.pendingConnection = null;
      }
      if (generation !== this.connectionGeneration) return;
      const message = errorMessage(error);
      this.publishStatus({ type: 'status', phase: 'error', brand: kind, error: message });
      ++this.connectionGeneration;
      await this.disconnectHardware();
      throw error;
    }
  }

  simulateMove(move: string): void {
    if (this.snapshot.phase !== 'connected' || this.snapshot.brand !== 'simulator') return;
    this.publishMove(this.connectionGeneration, move, Date.now());
  }

  async disconnect(message = '已断开智能魔方'): Promise<void> {
    ++this.connectionGeneration;
    await this.disconnectHardware();
    this.publishStatus({ type: 'status', phase: 'disconnected' });
    this.setSnapshot({ error: '', deviceName: message, battery: null, lastMove: '' });
  }

  private async disconnectHardware(): Promise<void> {
    const cancellation = this.pendingConnection;
    this.pendingConnection = null;
    cancellation?.cancel();
    const connection = this.connection;
    this.connection = null;
    const cleanup = this.hardwareCleanup.then(async () => {
      await cancellation?.drain();
      if (connection) await connection.disconnect().catch(() => {});
    });
    this.hardwareCleanup = cleanup.catch(() => {});
    await cleanup;
  }

  private handleHardwareDisconnect(
    generation: number,
    brand: SmartCubeDriverKind,
    message: string,
  ): void {
    if (generation !== this.connectionGeneration) return;
    ++this.connectionGeneration;
    this.pendingConnection?.cancel();
    void this.disconnectHardware();
    this.publishStatus({ type: 'status', phase: 'disconnected', brand });
    this.setSnapshot({ battery: null, deviceName: message, error: '', lastMove: '' });
  }

  private publishMove(generation: number, move: string, deviceTs?: number): void {
    this.publishFor(generation, { type: 'move', move, deviceTs });
    if (generation === this.connectionGeneration) this.setSnapshot({ lastMove: move });
  }

  private publishBattery(generation: number, level: number): void {
    this.publishFor(generation, { type: 'battery', level });
    if (generation === this.connectionGeneration) this.setSnapshot({ battery: level });
  }

  private publishStatus(status: Extract<SmartCubeRelayEvent, { type: 'status' }>): void {
    this.send(status);
    this.setSnapshot({
      phase: status.phase === 'connecting' ? 'connecting' : status.phase,
      brand: (status.brand as SmartCubeDriverKind | undefined) ?? this.snapshot.brand,
      deviceName: status.deviceName ?? this.snapshot.deviceName,
      error: status.error ?? '',
    });
  }

  private publishFor(generation: number, event: SmartCubeRelayEvent): void {
    if (generation === this.connectionGeneration) this.send(event);
  }

  private send(payload: SmartCubeRelayEvent): void {
    if (!this.socketOpen || !this.socket) return;
    const socket = this.socket;
    try {
      socket.send({
        data: JSON.stringify(payload),
        fail: (error) => this.handleRelaySendFailure(socket, error.errMsg),
      });
    } catch (error) {
      this.handleRelaySendFailure(socket, errorMessage(error));
    }
  }

  private handleRelaySendFailure(socket: SocketTaskLike, message?: string): void {
    if (socket !== this.socket || !this.socketOpen) return;
    this.socketOpen = false;
    this.socket = null;
    ++this.socketGeneration;
    ++this.connectionGeneration;
    socket.close({ code: 1011, reason: 'relay send failed' });
    this.setSnapshot({
      phase: 'error',
      error: message || '无法向计时器发送智能魔方数据，请返回重试',
    });
    void this.disconnectHardware();
  }

  private setSnapshot(patch: Partial<SmartCubeSessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener({ ...this.snapshot });
  }
}

export const smartCubeSession = new SmartCubeSession();
