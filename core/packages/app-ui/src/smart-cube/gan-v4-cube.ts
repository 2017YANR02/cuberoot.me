import { createDeviceStateReset } from '@cuberoot/shared/smart-cube/device-reset';
import { createGanV4ResetCommand } from '@cuberoot/shared/smart-cube/gan-v4';
import {
  GAN_V4_NOTIFY_CHARACTERISTIC_UUID,
  GAN_V4_SERVICE_UUID,
  GAN_V4_WRITE_CHARACTERISTIC_UUID,
  createGanV4BatteryCommand,
  createGanV4Cipher,
  createGanV4DecodeState,
  createGanV4FaceletsCommand,
  createGanV4HardwareInfoCommand,
  createGanV4HistoryCommand,
  createGanV4IdleStateChecks,
  decodeGanV4Frame,
  matchesGanV4Name,
} from '@cuberoot/shared/smart-cube/gan-v4';
import type { GyroSink } from '@cuberoot/shared/smart-cube/gan-crypto';

import { resolveCubeMac } from './mac';

import type { BleDeviceRef, BleTransport } from './transport';

export interface GanV4CubeCallbacks {
  onDisconnect(): void;
  onNeedMac?(deviceName: string): Promise<string | null>;
  onMove(move: string, deviceTimestamp?: number, metadata?: { delayed?: boolean; estimatedTime?: boolean }): void;
  onProtocolError(): void;
  onState?(facelets: string): void;
  onGyro?: GyroSink;
  onStatus?(status: GanV4CubeStatus): void;
  /** Optional bounded host diagnostics; no gyro stream or identifying handshake data. */
  onDiagnostic?(event: Record<string, unknown>): void;
}

export interface GanV4CubeStatus {
  protocol: 'gan-v2' | 'gan-v3' | 'gan-v4';
  battery: number | null;
  moveCounter: number;
  pendingMoves: number;
  badFrames: number;
  stateReady: boolean;
}

function bytesFromView(view: DataView): Uint8Array {
  const bytes = new Uint8Array(view.byteLength);
  bytes.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return bytes;
}

export class GanV4CubeConnection {
  private calibration: ReturnType<typeof createDeviceStateReset> | null = null;
  private deviceId: string | null = null;
  private stopNotifications: (() => Promise<void>) | null = null;
  private writeTail: Promise<void> = Promise.resolve();
  private generation = 0;
  private idleStateChecks: ReturnType<typeof createGanV4IdleStateChecks> | null = null;
  private sendCommand: ((command: Uint8Array) => Promise<void>) | null = null;
  private setupDone: Promise<void> = Promise.resolve();
  private recoveryTimeout: ReturnType<typeof setTimeout> | null = null;

  private clearRecoveryTimeout(): void {
    if (this.recoveryTimeout !== null) clearTimeout(this.recoveryTimeout);
    this.recoveryTimeout = null;
  }

  constructor(
    private readonly transport: BleTransport,
    private readonly callbacks: GanV4CubeCallbacks,
    private readonly serviceVerified = false,
  ) {}

  connect(device: BleDeviceRef): Promise<void> {
    const setup = this.connectDevice(device);
    // Disconnect must also wait for a subscription that has not returned its
    // stop handle yet; otherwise that late handle can tear down a new session.
    this.setupDone = setup.then(() => undefined, () => undefined);
    return setup;
  }

  private async connectDevice(device: BleDeviceRef): Promise<void> {
    if (!this.serviceVerified && !matchesGanV4Name(device.name)) throw new Error('unsupported GAN protocol');
    const generation = ++this.generation;
    const mac = await resolveCubeMac(device, 'gan', this.callbacks.onNeedMac);
    if (generation !== this.generation) throw new Error('smart cube connection closed');

    this.deviceId = device.id;
    const current = () => this.generation === generation && this.deviceId === device.id;
    await this.transport.connect(device.id, () => {
      if (!current()) return;
      this.calibration?.dispose();
      this.calibration = null;
      this.generation++;
      this.deviceId = null;
      this.stopNotifications = null;
      this.sendCommand = null;
      this.idleStateChecks?.dispose();
      this.idleStateChecks = null;
      this.clearRecoveryTimeout();
      this.callbacks.onDisconnect();
    });
    if (!current()) throw new Error('smart cube connection closed');

    const cipher = createGanV4Cipher(mac);
    let protocolErrorReported = false;
    const sendCommand = (command: Uint8Array, begin?: () => boolean): Promise<void> => {
      const task = this.writeTail.then(() => {
        if (!current()) throw new Error('smart cube connection closed');
        if (begin && !begin()) return;
        const encrypted = cipher.encrypt(command);
        return this.transport.write(device.id, GAN_V4_SERVICE_UUID, GAN_V4_WRITE_CHARACTERISTIC_UUID, encrypted);
      });
      this.writeTail = task.catch(() => undefined);
      return task;
    };
    this.sendCommand = sendCommand;
    const queuedRecovery = new Set<string>();
    const sendRecoveryCommand = (command: Uint8Array, needed = () => true) => {
      const key = Array.from(command).join(',');
      if (queuedRecovery.has(key)) return;
      queuedRecovery.add(key);
      void sendCommand(command, needed).catch(() => {
        if (current() && !protocolErrorReported) {
          protocolErrorReported = true;
          this.idleStateChecks?.dispose();
          this.callbacks.onProtocolError();
        }
      }).finally(() => queuedRecovery.delete(key));
    };
    let stateReady = false;
    let recoveryCounter: number | null = null;
    const decodeState = createGanV4DecodeState({
      requestHistory: (startMoveCounter, numberOfMoves) => {
        // An unrecoverable gap must not leave an untouchable running timer or
        // let a later 8-bit counter cycle masquerade as the missing moves.
        if (this.recoveryTimeout === null || recoveryCounter !== decodeState.sync.counter) {
          this.clearRecoveryTimeout();
          recoveryCounter = decodeState.sync.counter;
          this.recoveryTimeout = setTimeout(() => {
            this.recoveryTimeout = null;
            if (!current() || protocolErrorReported) return;
            protocolErrorReported = true;
            this.callbacks.onDiagnostic?.({ event: 'recovery-timeout', counter: decodeState.sync.counter });
            this.idleStateChecks?.dispose();
            this.callbacks.onProtocolError();
          }, 15000);
        }
        this.callbacks.onDiagnostic?.({ event: 'history-request', startMoveCounter, numberOfMoves });
        const counter = decodeState.sync.counter;
        sendRecoveryCommand(createGanV4HistoryCommand(startMoveCounter, numberOfMoves),
          () => decodeState.sync.counter === counter);
      },
      onWedged: () => {
        this.callbacks.onDiagnostic?.({ event: 'pending-burst', counter: decodeState.sync.counter, pending: decodeState.sync.pending });
        // Beyond half the serial space a later counter cycle is ambiguous.
        if (decodeState.sync.pending >= 128) {
          protocolErrorReported = true;
          this.clearRecoveryTimeout();
          this.idleStateChecks?.dispose();
          this.callbacks.onProtocolError();
          return;
        }
        // Same recovery as the mini-program: retain the missing window and
        // queued turns until history arrives. Reseeding from a solved snapshot
        // silently discards the recording and can falsely finish an OK solve.
        sendRecoveryCommand(createGanV4FaceletsCommand(), () => decodeState.sync.pending > 0);
      },
      onState: (facelets) => { stateReady = true; this.calibration?.observe(facelets); this.callbacks.onState?.(facelets); },
    });
    this.calibration = createDeviceStateReset({
      sendReset: begin => sendCommand(createGanV4ResetCommand(), begin),
      prepareSnapshot: () => { this.clearRecoveryTimeout(); recoveryCounter = null; decodeState.sync.reset(); },
      requestSnapshot: () => sendCommand(createGanV4FaceletsCommand()),
    });
    this.idleStateChecks = createGanV4IdleStateChecks({
      schedule: (callback, delay) => setTimeout(callback, delay),
      cancel: (handle) => clearTimeout(handle),
      requestState: () => sendRecoveryCommand(createGanV4FaceletsCommand()),
    });

    const stopNotifications = await this.transport.subscribe(
      device.id,
      GAN_V4_SERVICE_UUID,
      GAN_V4_NOTIFY_CHARACTERISTIC_UUID,
      (value) => {
        if (!current() || protocolErrorReported) return;
        let plain: Uint8Array;
        try {
          plain = cipher.decrypt(bytesFromView(value));
        } catch {
          return;
        }
        const delayed = plain[0] === 0xd1 || decodeState.sync.pending > 0;
        const moves = decodeGanV4Frame(plain, decodeState, this.callbacks.onGyro);
        if (moves.length > 0 && decodeState.sync.pending === 0) this.clearRecoveryTimeout();
        if (plain[0] === 0x01 || plain[0] === 0xd1 || plain[0] === 0xed) {
          this.callbacks.onDiagnostic?.({ event: 'frame', bytes: Array.from(plain.subarray(0, 128)),
            emitted: moves.length, counter: decodeState.sync.counter, pending: decodeState.sync.pending });
        }
        for (const move of moves) {
          if (delayed) this.callbacks.onMove(move.mv, move.ts, { delayed: true, ...(move.estimatedTime ? { estimatedTime: true } : {}) });
          else this.callbacks.onMove(move.mv, move.ts);
        }
        // Retry a missing FIRST turn too: queued live frames still prove activity.
        if (moves.length > 0 || plain[0] === 0x01) this.idleStateChecks?.afterMoves();
        this.callbacks.onStatus?.({
          protocol: 'gan-v4', battery: decodeState.battery, moveCounter: decodeState.sync.counter,
          pendingMoves: decodeState.sync.pending, badFrames: decodeState.badFrames, stateReady,
        });
        if (!protocolErrorReported && decodeState.badFrames >= 6) {
          protocolErrorReported = true;
          this.idleStateChecks?.dispose();
          this.callbacks.onProtocolError();
        }
      },
    );
    if (!current()) {
      await stopNotifications().catch(() => undefined);
      throw new Error('smart cube connection closed');
    }
    this.stopNotifications = stopNotifications;

    await sendCommand(createGanV4HardwareInfoCommand());
    await sendCommand(createGanV4FaceletsCommand());
    await sendCommand(createGanV4BatteryCommand());
  }

  async requestState(): Promise<void> {
    if (!this.sendCommand) throw new Error('smart cube is not connected');
    await this.sendCommand(createGanV4FaceletsCommand());
    await this.sendCommand(createGanV4BatteryCommand());
  }

  async resetDeviceState(): Promise<void> {
    if (!this.calibration) throw new Error('smart cube is not connected');
    await this.calibration.run();
  }

  async disconnect(): Promise<void> {
    this.calibration?.dispose();
    this.calibration = null;
    const deviceId = this.deviceId;
    this.deviceId = null;
    this.generation++;
    this.sendCommand = null;
    this.idleStateChecks?.dispose();
    this.idleStateChecks = null;
    this.clearRecoveryTimeout();
    const stop = this.stopNotifications;
    this.stopNotifications = null;
    await stop?.().catch(() => undefined);
    await this.setupDone;
    if (deviceId) await this.transport.disconnect(deviceId).catch(() => undefined);
  }
}
