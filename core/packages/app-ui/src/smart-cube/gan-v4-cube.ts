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
  decodeGanV4Frame,
  extractGanV4MacFromAdvertisement,
  matchesGanV4Name,
} from '@cuberoot/shared/smart-cube/gan-v4';

import type { BleDeviceRef, BleTransport } from './transport';

export interface GanV4CubeCallbacks {
  onDisconnect(): void;
  onMove(move: string, deviceTimestamp?: number): void;
  onProtocolError(): void;
  onState?(facelets: string): void;
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

  constructor(
    private readonly transport: BleTransport,
    private readonly callbacks: GanV4CubeCallbacks,
  ) {}

  async connect(device: BleDeviceRef): Promise<void> {
    if (!matchesGanV4Name(device.name)) throw new Error('unsupported GAN protocol');
    const mac = macBytesFromDevice(device);
    if (!mac) throw new Error('GAN MAC unavailable');

    this.deviceId = device.id;
    await this.transport.connect(device.id, () => {
      this.deviceId = null;
      this.stopNotifications = null;
      this.callbacks.onDisconnect();
    });

    const cipher = createGanV4Cipher(mac);
    let protocolErrorReported = false;
    const sendCommand = (command: Uint8Array): Promise<void> => {
      const encrypted = cipher.encrypt(command);
      const task = this.writeTail.then(() => this.transport.write(
        device.id,
        GAN_V4_SERVICE_UUID,
        GAN_V4_WRITE_CHARACTERISTIC_UUID,
        encrypted,
      ));
      this.writeTail = task.catch(() => undefined);
      return task;
    };
    const decodeState = createGanV4DecodeState({
      requestHistory: (startMoveCounter, numberOfMoves) => {
        void sendCommand(createGanV4HistoryCommand(startMoveCounter, numberOfMoves));
      },
      onWedged: () => {
        decodeState.sync.reset();
        void sendCommand(createGanV4FaceletsCommand());
      },
      onState: this.callbacks.onState,
    });

    this.stopNotifications = await this.transport.subscribe(
      device.id,
      GAN_V4_SERVICE_UUID,
      GAN_V4_NOTIFY_CHARACTERISTIC_UUID,
      (value) => {
        let plain: Uint8Array;
        try {
          plain = cipher.decrypt(bytesFromView(value));
        } catch {
          return;
        }
        const moves = decodeGanV4Frame(plain, decodeState);
        for (const move of moves) this.callbacks.onMove(move.mv, move.ts);
        if (!protocolErrorReported && decodeState.badFrames >= 6) {
          protocolErrorReported = true;
          this.callbacks.onProtocolError();
        }
      },
    );

    await sendCommand(createGanV4HardwareInfoCommand());
    await sendCommand(createGanV4FaceletsCommand());
    await sendCommand(createGanV4BatteryCommand());
  }

  async disconnect(): Promise<void> {
    const deviceId = this.deviceId;
    this.deviceId = null;
    const stop = this.stopNotifications;
    this.stopNotifications = null;
    await stop?.().catch(() => undefined);
    if (deviceId) await this.transport.disconnect(deviceId).catch(() => undefined);
  }
}
