import {
  createMoyu32Cipher,
  createMoyu32Command,
  createMoyu32DecodeState,
  decodeMoyu32Notification,
  matchesMoyu32Name,
  MOYU32_MESSAGE_BATTERY,
  MOYU32_MESSAGE_GYRO_SWITCH,
  MOYU32_MESSAGE_INFO,
  MOYU32_MESSAGE_STATE,
  MOYU32_NOTIFY_CHARACTERISTIC_UUID,
  MOYU32_SERVICE_UUID,
  MOYU32_WRITE_CHARACTERISTIC_UUID,
} from '@cuberoot/shared/smart-cube/moyu32';
import type { GyroSink } from '@cuberoot/shared/smart-cube/gan-crypto';

import { resolveCubeMac } from './mac';

import type { BleDeviceRef, BleTransport } from './transport';

const KEY_ERROR_THRESHOLD = 6;

export interface Moyu32CubeStatus {
  protocol: 'moyu32';
  battery: number | null;
  moveCounter: number;
  pendingMoves: number;
  badFrames: number;
  stateReady: boolean;
}

export interface Moyu32CubeCallbacks {
  onDisconnect(): void;
  onNeedMac?(deviceName: string): Promise<string | null>;
  onMove(move: string, deviceTimestamp?: number): void;
  onProtocolError(): void;
  onState?(facelets: string): void;
  onGyro?: GyroSink;
  onStatus?(status: Moyu32CubeStatus): void;
}

function bytesFromView(view: DataView): Uint8Array {
  const bytes = new Uint8Array(view.byteLength);
  bytes.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return bytes;
}

function hasCharacteristic(
  deviceServices: Awaited<ReturnType<NonNullable<BleTransport['getServices']>>>,
  serviceUuid: string,
  characteristicUuid: string,
): boolean {
  const service = deviceServices.find((item) => item.uuid.toLowerCase() === serviceUuid.toLowerCase());
  return service?.characteristics.some((characteristic) => (
    characteristic.uuid.toLowerCase() === characteristicUuid.toLowerCase()
  )) ?? false;
}

export class Moyu32CubeConnection {
  private deviceId: string | null = null;
  private stopNotifications: (() => Promise<void>) | null = null;
  private sendCommand: ((command: Uint8Array, strict?: boolean) => Promise<void>) | null = null;
  private requestStateCommand: (() => Promise<void>) | null = null;
  private generation = 0;
  private setupDone: Promise<void> = Promise.resolve();
  private gyroEnabled = false;

  constructor(
    private readonly transport: BleTransport,
    private readonly callbacks: Moyu32CubeCallbacks,
  ) {}

  connect(device: BleDeviceRef): Promise<void> {
    const setup = this.connectDevice(device);
    this.setupDone = setup.then(() => undefined, () => undefined);
    return setup;
  }

  private async connectDevice(device: BleDeviceRef): Promise<void> {
    if (!matchesMoyu32Name(device.name)) throw new Error('unsupported MoYu32 protocol');
    const generation = ++this.generation;
    const mac = await resolveCubeMac(device, 'moyu32', this.callbacks.onNeedMac);
    if (generation !== this.generation) throw new Error('smart cube connection closed');

    this.deviceId = device.id;
    const current = () => this.generation === generation && this.deviceId === device.id;
    const onDisconnect = () => {
      if (!current()) return;
      this.generation++;
      this.deviceId = null;
      this.stopNotifications = null;
      this.sendCommand = null;
      this.requestStateCommand = null;
      this.gyroEnabled = false;
      this.callbacks.onDisconnect();
    };

    await this.transport.connect(device.id, onDisconnect);
    if (!current()) throw new Error('smart cube connection closed');

    const services = await this.transport.getServices?.(device.id);
    if (services && (!hasCharacteristic(
      services, MOYU32_SERVICE_UUID, MOYU32_NOTIFY_CHARACTERISTIC_UUID,
    ) || !hasCharacteristic(
      services, MOYU32_SERVICE_UUID, MOYU32_WRITE_CHARACTERISTIC_UUID,
    ))) {
      throw new Error('MoYu32 service or characteristic unavailable');
    }

    const cipher = createMoyu32Cipher(mac);
    let writeTail: Promise<void> = Promise.resolve();
    const send = (command: Uint8Array, strict = true): Promise<void> => {
      const encrypted = cipher.encrypt(command);
      const task = writeTail.then(() => {
        if (!current()) throw new Error('smart cube connection closed');
        return this.transport.write(
          device.id,
          MOYU32_SERVICE_UUID,
          MOYU32_WRITE_CHARACTERISTIC_UUID,
          encrypted,
        );
      });
      writeTail = task.catch(() => undefined);
      return strict ? task : task.catch(() => undefined);
    };
    this.sendCommand = send;

    let stateReady = false;
    const protocolError = { value: false };
    const decodeState = createMoyu32DecodeState();
    const reportProtocolError = () => {
      if (protocolError.value || !current()) return;
      protocolError.value = true;
      this.callbacks.onProtocolError();
    };

    const stopNotifications = await this.transport.subscribe(
      device.id,
      MOYU32_SERVICE_UUID,
      MOYU32_NOTIFY_CHARACTERISTIC_UUID,
      (value) => {
        if (!current() || protocolError.value) return;
        let plain: Uint8Array;
        try {
          plain = cipher.decrypt(bytesFromView(value));
        } catch {
          return;
        }
        const notification = decodeMoyu32Notification(plain, decodeState);
        if (notification.state) {
          stateReady = true;
          this.callbacks.onState?.(notification.state);
        }
        for (const move of notification.moves) this.callbacks.onMove(move.mv, move.ts);
        if (notification.gyro) this.callbacks.onGyro?.(notification.gyro);
        this.callbacks.onStatus?.({
          protocol: 'moyu32',
          battery: decodeState.battery,
          moveCounter: decodeState.prevMoveCount,
          pendingMoves: 0,
          badFrames: decodeState.badFrames,
          stateReady,
        });
        if (decodeState.badFrames >= KEY_ERROR_THRESHOLD) reportProtocolError();
      },
    );
    if (!current()) {
      await stopNotifications().catch(() => undefined);
      throw new Error('smart cube connection closed');
    }
    this.stopNotifications = stopNotifications;

    this.requestStateCommand = async () => {
      await send(createMoyu32Command(MOYU32_MESSAGE_STATE));
      await send(createMoyu32Command(MOYU32_MESSAGE_BATTERY));
    };

    await send(createMoyu32Command(MOYU32_MESSAGE_INFO));
    await send(createMoyu32Command(MOYU32_MESSAGE_STATE));
    await send(createMoyu32Command(MOYU32_MESSAGE_BATTERY));
    if (this.callbacks.onGyro) {
      await send(createMoyu32Command(MOYU32_MESSAGE_GYRO_SWITCH, 0x00, 0x01));
      this.gyroEnabled = true;
    }
  }

  async requestState(): Promise<void> {
    if (!this.requestStateCommand) throw new Error('smart cube is not connected');
    await this.requestStateCommand();
  }

  async disconnect(): Promise<void> {
    const deviceId = this.deviceId;
    const disableGyro = this.gyroEnabled && this.sendCommand;
    if (disableGyro) await disableGyro(
      createMoyu32Command(MOYU32_MESSAGE_GYRO_SWITCH, 0x00, 0x00),
      false,
    );

    this.deviceId = null;
    this.generation++;
    this.sendCommand = null;
    this.requestStateCommand = null;
    this.gyroEnabled = false;
    const stop = this.stopNotifications;
    this.stopNotifications = null;
    await stop?.().catch(() => undefined);
    await this.setupDone;
    if (deviceId) await this.transport.disconnect(deviceId).catch(() => undefined);
  }
}
