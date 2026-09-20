import {
  GAN_V2_NOTIFY_CHARACTERISTIC_UUID,
  GAN_V2_SERVICE_UUID,
  GAN_V2_WRITE_CHARACTERISTIC_UUID,
  createGanV2BatteryCommand,
  createGanV2Cipher,
  createGanV2DecodeState,
  createGanV2FaceletsCommand,
  createGanV2HardwareInfoCommand,
  decodeGanV2Frame,
  matchesGanV2Name,
} from '@cuberoot/shared/smart-cube/gan-v2';
import {
  GAN_V3_NOTIFY_CHARACTERISTIC_UUID,
  GAN_V3_SERVICE_UUID,
  GAN_V3_WRITE_CHARACTERISTIC_UUID,
  createGanV3BatteryCommand,
  createGanV3Cipher,
  createGanV3DecodeState,
  createGanV3FaceletsCommand,
  createGanV3HardwareInfoCommand,
  createGanV3HistoryCommand,
  decodeGanV3Frame,
  matchesGanV3Name,
} from '@cuberoot/shared/smart-cube/gan-v3';
import {
  GAN_V4_MANUFACTURER_DATA_CICS,
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
  extractGanV4MacFromAdvertisement,
  matchesGanV4Name,
} from '@cuberoot/shared/smart-cube/gan-v4';
import type { GyroSink } from '@cuberoot/shared/smart-cube/gan-crypto';

import type { BleDeviceRef, BleServiceRef, BleTransport } from './transport';

export type GanCubeProtocol = 'gan-v2' | 'gan-v3' | 'gan-v4';

export interface GanCubeStatus {
  protocol: GanCubeProtocol;
  battery: number | null;
  moveCounter: number;
  pendingMoves: number;
  badFrames: number;
  stateReady: boolean;
}

export interface GanCubeCallbacks {
  onDisconnect(): void;
  onMove(move: string, deviceTimestamp?: number): void;
  onProtocolError(): void;
  onState?(facelets: string): void;
  onGyro?: GyroSink;
  onStatus?(status: GanCubeStatus): void;
}

function bytesFromView(view: DataView): Uint8Array {
  const bytes = new Uint8Array(view.byteLength);
  bytes.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return bytes;
}

function macBytesFromAndroidDeviceId(deviceId: string): Uint8Array | null {
  const pairs = deviceId.match(/^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/i)?.[0].split(':');
  if (!pairs) return null;
  return Uint8Array.from(pairs.map((pair) => Number.parseInt(pair, 16)));
}

function macBytesFromName(name: string): Uint8Array | null {
  const match = /([0-9a-f]{12})$/i.exec(name);
  if (!match) return null;
  return Uint8Array.from({ length: 6 }, (_value, index) => Number.parseInt(
    match[1].slice(index * 2, index * 2 + 2),
    16,
  ));
}

function macBytesFromDevice(device: BleDeviceRef): Uint8Array | null {
  const androidMac = macBytesFromAndroidDeviceId(device.id);
  if (androidMac) return androidMac;
  for (const companyId of GAN_V4_MANUFACTURER_DATA_CICS) {
    const mac = extractGanV4MacFromAdvertisement(device.manufacturerData?.get(companyId));
    if (mac) return mac;
  }
  return macBytesFromName(device.name);
}

function hasService(services: ReadonlyArray<BleServiceRef>, uuid: string): boolean {
  return services.some((service) => service.uuid.toLowerCase() === uuid.toLowerCase());
}

function protocolForService(services: ReadonlyArray<BleServiceRef>): GanCubeProtocol | null {
  // Prefer the newest service if a firmware exposes stale compatibility services.
  if (hasService(services, GAN_V4_SERVICE_UUID)) return 'gan-v4';
  if (hasService(services, GAN_V3_SERVICE_UUID)) return 'gan-v3';
  if (hasService(services, GAN_V2_SERVICE_UUID)) return 'gan-v2';
  return null;
}

export class GanCubeConnection {
  private deviceId: string | null = null;
  private protocol: GanCubeProtocol | null = null;
  private stopNotifications: (() => Promise<void>) | null = null;
  private sendCommand: ((command: Uint8Array) => Promise<void>) | null = null;
  private requestStateCommand: (() => Promise<void>) | null = null;
  private disposeTimers: (() => void) | null = null;
  private generation = 0;
  private setupDone: Promise<void> = Promise.resolve();

  constructor(
    private readonly transport: BleTransport,
    private readonly callbacks: GanCubeCallbacks,
    private readonly forcedProtocol?: GanCubeProtocol,
  ) {}

  connect(device: BleDeviceRef): Promise<void> {
    const setup = this.connectDevice(device);
    // Disconnect must also wait for a subscription that has not returned its
    // stop handle yet; otherwise that late handle can tear down a new session.
    this.setupDone = setup.then(() => undefined, () => undefined);
    return setup;
  }

  private async connectDevice(device: BleDeviceRef): Promise<void> {
    const namedProtocol = this.protocolForName(device.name);
    if (this.forcedProtocol && namedProtocol !== this.forcedProtocol) {
      throw new Error('unsupported GAN protocol');
    }
    if (!this.forcedProtocol && !namedProtocol) throw new Error('unsupported GAN protocol');

    const mac = macBytesFromDevice(device);
    if (!mac) throw new Error('GAN MAC unavailable');

    this.deviceId = device.id;
    const generation = ++this.generation;
    const current = () => this.generation === generation && this.deviceId === device.id;
    const onDisconnect = () => {
      if (!current()) return;
      this.generation++;
      this.deviceId = null;
      this.protocol = null;
      this.stopNotifications = null;
      this.sendCommand = null;
      this.requestStateCommand = null;
      this.disposeTimers?.();
      this.disposeTimers = null;
      this.callbacks.onDisconnect();
    };

    await this.transport.connect(device.id, onDisconnect);
    if (!current()) throw new Error('smart cube connection closed');

    const protocol = this.forcedProtocol ?? await this.detectProtocol(device, namedProtocol);
    this.protocol = protocol;
    if (protocol === 'gan-v2') {
      await this.startV2(device, mac, current);
    } else if (protocol === 'gan-v3') {
      await this.startV3(device, mac, current);
    } else {
      await this.startV4(device, mac, current);
    }
  }

  private protocolForName(name: string): GanCubeProtocol | null {
    if (matchesGanV4Name(name)) return 'gan-v4';
    if (matchesGanV3Name(name)) return 'gan-v3';
    if (matchesGanV2Name(name)) return 'gan-v2';
    return null;
  }

  private async detectProtocol(
    device: BleDeviceRef,
    namedProtocol: GanCubeProtocol | null,
  ): Promise<GanCubeProtocol> {
    const services = await this.transport.getServices?.(device.id);
    const discovered = services ? protocolForService(services) : null;
    // Native hosts are expected to expose discovery. Name fallback keeps older
    // test/host adapters usable and mirrors Web's family-name fallback.
    return discovered ?? namedProtocol ?? (() => { throw new Error('unsupported GAN protocol service'); })();
  }

  private createSender(
    device: BleDeviceRef,
    current: () => boolean,
    service: string,
    characteristic: string,
    cipher: { encrypt(command: Uint8Array): Uint8Array },
  ): (command: Uint8Array, strict?: boolean) => Promise<void> {
    let writeTail: Promise<void> = Promise.resolve();
    return (command, strict = true) => {
      const encrypted = cipher.encrypt(command);
      const task = writeTail.then(() => {
        if (!current()) throw new Error('smart cube connection closed');
        return this.transport.write(device.id, service, characteristic, encrypted);
      });
      writeTail = task.catch(() => undefined);
      return strict ? task : task.catch(() => undefined);
    };
  }

  private async subscribe(
    device: BleDeviceRef,
    current: () => boolean,
    service: string,
    characteristic: string,
    onValue: (value: DataView) => void,
  ): Promise<void> {
    const stop = await this.transport.subscribe(device.id, service, characteristic, onValue);
    if (!current()) {
      await stop().catch(() => undefined);
      throw new Error('smart cube connection closed');
    }
    this.stopNotifications = stop;
  }

  private reportProtocolError(current: () => boolean, reported: { value: boolean }): void {
    if (reported.value || !current()) return;
    reported.value = true;
    this.disposeTimers?.();
    this.disposeTimers = null;
    this.callbacks.onProtocolError();
  }

  private emitStatus(
    protocol: GanCubeProtocol,
    battery: number | null,
    moveCounter: number,
    pendingMoves: number,
    badFrames: number,
    stateReady: boolean,
  ): void {
    this.callbacks.onStatus?.({ protocol, battery, moveCounter, pendingMoves, badFrames, stateReady });
  }

  private async startV2(
    device: BleDeviceRef,
    mac: Uint8Array,
    current: () => boolean,
  ): Promise<void> {
    const cipher = createGanV2Cipher(mac, device.name);
    const send = this.createSender(
      device, current, GAN_V2_SERVICE_UUID, GAN_V2_WRITE_CHARACTERISTIC_UUID, cipher,
    );
    this.sendCommand = (command) => send(command);
    let stateReady = false;
    const decodeState = createGanV2DecodeState({
      onState: (facelets) => {
        stateReady = true;
        this.callbacks.onState?.(facelets);
      },
    });
    const protocolError = { value: false };
    await this.subscribe(device, current, GAN_V2_SERVICE_UUID, GAN_V2_NOTIFY_CHARACTERISTIC_UUID, (value) => {
      if (!current() || protocolError.value) return;
      let plain: Uint8Array;
      try {
        plain = cipher.decrypt(bytesFromView(value));
      } catch {
        return;
      }
      for (const move of decodeGanV2Frame(plain, decodeState, this.callbacks.onGyro)) {
        this.callbacks.onMove(move);
      }
      this.emitStatus(
        'gan-v2', decodeState.battery, decodeState.prevMoveCnt, 0,
        decodeState.badFrames, stateReady,
      );
      if (decodeState.badFrames >= 3) this.reportProtocolError(current, protocolError);
    });
    this.requestStateCommand = async () => {
      await send(createGanV2FaceletsCommand());
      await send(createGanV2BatteryCommand());
    };
    await send(createGanV2HardwareInfoCommand());
    await send(createGanV2FaceletsCommand());
    await send(createGanV2BatteryCommand());
  }

  private async startV3(
    device: BleDeviceRef,
    mac: Uint8Array,
    current: () => boolean,
  ): Promise<void> {
    const cipher = createGanV3Cipher(mac);
    const send = this.createSender(
      device, current, GAN_V3_SERVICE_UUID, GAN_V3_WRITE_CHARACTERISTIC_UUID, cipher,
    );
    this.sendCommand = (command) => send(command);
    let stateReady = false;
    let protocolError = { value: false };
    const decodeState = createGanV3DecodeState({
      requestHistory: (startMoveCounter, numberOfMoves) => {
        void send(createGanV3HistoryCommand(startMoveCounter, numberOfMoves), false);
      },
      onWedged: () => {
        decodeState.sync.reset();
        void send(createGanV3FaceletsCommand(), false);
      },
      onState: (facelets) => {
        stateReady = true;
        this.callbacks.onState?.(facelets);
      },
    });
    const idleChecks = createGanV4IdleStateChecks({
      schedule: (callback, delay) => setTimeout(callback, delay),
      cancel: (handle) => clearTimeout(handle),
      requestState: () => { void send(createGanV3FaceletsCommand(), false); },
    });
    this.disposeTimers = () => idleChecks.dispose();
    await this.subscribe(device, current, GAN_V3_SERVICE_UUID, GAN_V3_NOTIFY_CHARACTERISTIC_UUID, (value) => {
      if (!current() || protocolError.value) return;
      let plain: Uint8Array;
      try {
        plain = cipher.decrypt(bytesFromView(value));
      } catch {
        return;
      }
      const moves = decodeGanV3Frame(plain, decodeState);
      for (const move of moves) this.callbacks.onMove(move.mv, move.ts);
      if (moves.length > 0) idleChecks.afterMoves();
      this.emitStatus(
        'gan-v3', decodeState.battery, decodeState.sync.counter, decodeState.sync.pending,
        decodeState.badFrames, stateReady,
      );
      if (decodeState.badFrames >= 6) this.reportProtocolError(current, protocolError);
    });
    this.requestStateCommand = async () => {
      await send(createGanV3FaceletsCommand());
      await send(createGanV3BatteryCommand());
    };
    await send(createGanV3HardwareInfoCommand());
    await send(createGanV3FaceletsCommand());
    await send(createGanV3BatteryCommand());
  }

  private async startV4(
    device: BleDeviceRef,
    mac: Uint8Array,
    current: () => boolean,
  ): Promise<void> {
    const cipher = createGanV4Cipher(mac);
    const send = this.createSender(
      device, current, GAN_V4_SERVICE_UUID, GAN_V4_WRITE_CHARACTERISTIC_UUID, cipher,
    );
    this.sendCommand = (command) => send(command);
    let stateReady = false;
    const protocolError = { value: false };
    const decodeState = createGanV4DecodeState({
      requestHistory: (startMoveCounter, numberOfMoves) => {
        void send(createGanV4HistoryCommand(startMoveCounter, numberOfMoves), false);
      },
      onWedged: () => {
        decodeState.sync.reset();
        stateReady = false;
        void send(createGanV4FaceletsCommand(), false);
      },
      onState: (facelets) => {
        stateReady = true;
        this.callbacks.onState?.(facelets);
      },
    });
    const idleChecks = createGanV4IdleStateChecks({
      schedule: (callback, delay) => setTimeout(callback, delay),
      cancel: (handle) => clearTimeout(handle),
      requestState: () => { void send(createGanV4FaceletsCommand(), false); },
    });
    this.disposeTimers = () => idleChecks.dispose();
    await this.subscribe(device, current, GAN_V4_SERVICE_UUID, GAN_V4_NOTIFY_CHARACTERISTIC_UUID, (value) => {
      if (!current() || protocolError.value) return;
      let plain: Uint8Array;
      try {
        plain = cipher.decrypt(bytesFromView(value));
      } catch {
        return;
      }
      const moves = decodeGanV4Frame(plain, decodeState, this.callbacks.onGyro);
      for (const move of moves) this.callbacks.onMove(move.mv, move.ts);
      if (moves.length > 0) idleChecks.afterMoves();
      this.emitStatus(
        'gan-v4', decodeState.battery, decodeState.sync.counter, decodeState.sync.pending,
        decodeState.badFrames, stateReady,
      );
      if (decodeState.badFrames >= 6) this.reportProtocolError(current, protocolError);
    });
    this.requestStateCommand = async () => {
      await send(createGanV4FaceletsCommand());
      await send(createGanV4BatteryCommand());
    };
    await send(createGanV4HardwareInfoCommand());
    await send(createGanV4FaceletsCommand());
    await send(createGanV4BatteryCommand());
  }

  getProtocol(): GanCubeProtocol | null {
    return this.protocol;
  }

  async requestState(): Promise<void> {
    if (!this.requestStateCommand) throw new Error('smart cube is not connected');
    await this.requestStateCommand();
  }

  async disconnect(): Promise<void> {
    const deviceId = this.deviceId;
    this.deviceId = null;
    this.protocol = null;
    this.generation++;
    this.sendCommand = null;
    this.requestStateCommand = null;
    this.disposeTimers?.();
    this.disposeTimers = null;
    const stop = this.stopNotifications;
    this.stopNotifications = null;
    await stop?.().catch(() => undefined);
    await this.setupDone;
    if (deviceId) await this.transport.disconnect(deviceId).catch(() => undefined);
  }
}
