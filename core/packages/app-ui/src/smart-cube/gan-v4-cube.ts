import {
  GAN_V4_NOTIFY_CHARACTERISTIC_UUID,
  GAN_V4_SERVICE_UUID,
  GAN_V4_WRITE_CHARACTERISTIC_UUID,
  GAN_V4_MANUFACTURER_DATA_CICS,
  createGanV4BatteryCommand,
  createGanV4Cipher,
  createGanV4DecodeState,
  createGanV4FaceletsCommand,
  createGanV4HardwareInfoCommand,
  createGanV4HistoryCommand,
  createGanV4IdleStateChecks,
  decodeGanV4Frame,
  extractGanV4MacFromAdvertisement,
  matchesGanV4Name,
} from '@cuberoot/shared/smart-cube/gan-v4';
import type { GyroSink } from '@cuberoot/shared/smart-cube/gan-crypto';

import type { BleDeviceRef, BleTransport } from './transport';

export interface GanV4CubeCallbacks {
  onDisconnect(): void;
  onMove(move: string, deviceTimestamp?: number): void;
  onProtocolError(): void;
  onState?(facelets: string): void;
  onGyro?: GyroSink;
  onStatus?(status: GanV4CubeStatus): void;
}

export interface GanV4CubeStatus {
  protocol: 'gan-v4';
  battery: number | null;
  moveCounter: number;
  pendingMoves: number;
  badFrames: number;
  stateReady: boolean;
}

function macBytesFromAndroidDeviceId(deviceId: string): Uint8Array | null {
  const pairs = deviceId.match(/^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/i)?.[0].split(':');
  if (!pairs) return null;
  return Uint8Array.from(pairs.map((pair) => Number.parseInt(pair, 16)));
}

function macBytesFromDevice(device: BleDeviceRef): Uint8Array | null {
  const androidMac = macBytesFromAndroidDeviceId(device.id);
  if (androidMac) return androidMac;
  for (const companyId of GAN_V4_MANUFACTURER_DATA_CICS) {
    const payload = device.manufacturerData?.get(companyId);
    const mac = extractGanV4MacFromAdvertisement(payload);
    if (mac) return mac;
  }
  return null;
}

function bytesFromView(view: DataView): Uint8Array {
  const bytes = new Uint8Array(view.byteLength);
  bytes.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return bytes;
}

export class GanV4CubeConnection {
  private deviceId: string | null = null;
  private stopNotifications: (() => Promise<void>) | null = null;
  private writeTail: Promise<void> = Promise.resolve();
  private generation = 0;
  private idleStateChecks: ReturnType<typeof createGanV4IdleStateChecks> | null = null;
  private sendCommand: ((command: Uint8Array) => Promise<void>) | null = null;
  private setupDone: Promise<void> = Promise.resolve();

  constructor(
    private readonly transport: BleTransport,
    private readonly callbacks: GanV4CubeCallbacks,
  ) {}

  connect(device: BleDeviceRef): Promise<void> {
    const setup = this.connectDevice(device);
    // Disconnect must also wait for a subscription that has not returned its
    // stop handle yet; otherwise that late handle can tear down a new session.
    this.setupDone = setup.then(() => undefined, () => undefined);
    return setup;
  }

  private async connectDevice(device: BleDeviceRef): Promise<void> {
    if (!matchesGanV4Name(device.name)) throw new Error('unsupported GAN protocol');
    const mac = macBytesFromDevice(device);
    if (!mac) throw new Error('GAN MAC unavailable');

    this.deviceId = device.id;
    const generation = ++this.generation;
    const current = () => this.generation === generation && this.deviceId === device.id;
    await this.transport.connect(device.id, () => {
      if (!current()) return;
      this.generation++;
      this.deviceId = null;
      this.stopNotifications = null;
      this.sendCommand = null;
      this.idleStateChecks?.dispose();
      this.idleStateChecks = null;
      this.callbacks.onDisconnect();
    });
    if (!current()) throw new Error('smart cube connection closed');

    const cipher = createGanV4Cipher(mac);
    let protocolErrorReported = false;
    const sendCommand = (command: Uint8Array): Promise<void> => {
      const encrypted = cipher.encrypt(command);
      const task = this.writeTail.then(() => {
        if (!current()) throw new Error('smart cube connection closed');
        return this.transport.write(device.id, GAN_V4_SERVICE_UUID, GAN_V4_WRITE_CHARACTERISTIC_UUID, encrypted);
      });
      this.writeTail = task.catch(() => undefined);
      return task;
    };
    this.sendCommand = sendCommand;
    const sendRecoveryCommand = (command: Uint8Array) => {
      void sendCommand(command).catch(() => {
        if (current() && !protocolErrorReported) {
          protocolErrorReported = true;
          this.idleStateChecks?.dispose();
          this.callbacks.onProtocolError();
        }
      });
    };
    let stateReady = false;
    const decodeState = createGanV4DecodeState({
      requestHistory: (startMoveCounter, numberOfMoves) => {
        sendRecoveryCommand(createGanV4HistoryCommand(startMoveCounter, numberOfMoves));
      },
      onWedged: () => {
        decodeState.sync.reset();
        stateReady = false;
        sendRecoveryCommand(createGanV4FaceletsCommand());
      },
      onState: (facelets) => { stateReady = true; this.callbacks.onState?.(facelets); },
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
        const moves = decodeGanV4Frame(plain, decodeState, this.callbacks.onGyro);
        for (const move of moves) this.callbacks.onMove(move.mv, move.ts);
        if (moves.length > 0) this.idleStateChecks?.afterMoves();
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

  async disconnect(): Promise<void> {
    const deviceId = this.deviceId;
    this.deviceId = null;
    this.generation++;
    this.sendCommand = null;
    this.idleStateChecks?.dispose();
    this.idleStateChecks = null;
    const stop = this.stopNotifications;
    this.stopNotifications = null;
    await stop?.().catch(() => undefined);
    await this.setupDone;
    if (deviceId) await this.transport.disconnect(deviceId).catch(() => undefined);
  }
}
