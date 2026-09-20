import {
  createQiyiAckCommand,
  createQiyiCipher,
  createQiyiHelloCommand,
  decodeQiyiNotification,
  matchesQiyiName,
  QIYI_CHARACTERISTIC_UUID,
  QIYI_OP_HELLO,
  QIYI_OP_STATE,
  QIYI_SERVICE_UUID,
  QIYI_WRITE_CHARACTERISTIC_UUID,
  qiyiDefaultMac,
} from '@cuberoot/shared/smart-cube/qiyi';
import type { GyroSink } from '@cuberoot/shared/smart-cube/gan-crypto';

import type { BleDeviceRef, BleServiceRef, BleTransport } from './transport';

const BAD_FRAME_THRESHOLD = 6;
const FALLBACK_HELLO_DELAY_MS = 1_500;
const HELLO_RETRY_DELAY_MS = 3_000;
const MAX_HELLO_ATTEMPTS = 2;

export interface QiyiCubeMoveMetadata {
  futureHistory?: boolean;
}

export interface QiyiCubeStatus {
  protocol: 'qiyi';
  battery: number | null;
  moveCounter: number;
  pendingMoves: number;
  badFrames: number;
  stateReady: boolean;
}

export interface QiyiCubeCallbacks {
  onDisconnect(): void;
  onMove(move: string, deviceTimestamp?: number, metadata?: QiyiCubeMoveMetadata): void;
  onProtocolError(): void;
  onState?(facelets: string): void;
  onGyro?: GyroSink;
  onStatus?(status: QiyiCubeStatus): void;
}

function bytesFromView(view: DataView): Uint8Array {
  const bytes = new Uint8Array(view.byteLength);
  bytes.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return bytes;
}

function macBytesFromString(value: string | null | undefined): Uint8Array | null {
  const pairs = value?.match(/^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/i)?.[0].split(':');
  if (!pairs) return null;
  return Uint8Array.from(pairs.map((pair) => Number.parseInt(pair, 16)));
}

function sameMac(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function characteristicFor(
  services: ReadonlyArray<BleServiceRef>,
  characteristicUuid: string,
): BleServiceRef['characteristics'][number] | null {
  const service = services.find((item) => item.uuid.toLowerCase() === QIYI_SERVICE_UUID.toLowerCase());
  return service?.characteristics.find((item) => (
    item.uuid.toLowerCase() === characteristicUuid.toLowerCase()
  )) ?? null;
}

function canNotify(characteristic: BleServiceRef['characteristics'][number]): boolean {
  return Boolean(characteristic.properties.notify || characteristic.properties.indicate);
}

function canWrite(characteristic: BleServiceRef['characteristics'][number]): boolean {
  return Boolean(characteristic.properties.write || characteristic.properties.writeWithoutResponse);
}

export class QiyiCubeConnection {
  private deviceId: string | null = null;
  private stopNotifications: (() => Promise<void>) | null = null;
  private requestStateCommand: (() => Promise<void>) | null = null;
  private disposeTimers: (() => void) | null = null;
  private generation = 0;
  private setupDone: Promise<void> = Promise.resolve();

  constructor(
    private readonly transport: BleTransport,
    private readonly callbacks: QiyiCubeCallbacks,
  ) {}

  connect(device: BleDeviceRef): Promise<void> {
    const setup = this.connectDevice(device);
    this.setupDone = setup.then(() => undefined, () => undefined);
    return setup;
  }

  private async connectDevice(device: BleDeviceRef): Promise<void> {
    if (!matchesQiyiName(device.name)) throw new Error('unsupported QiYi protocol');
    const deviceMac = macBytesFromString(device.id);
    const nameMac = macBytesFromString(qiyiDefaultMac(device.name));
    const initialMac = deviceMac ?? nameMac;
    if (!initialMac) throw new Error('QiYi MAC unavailable');
    const fallbackMac = nameMac && !sameMac(nameMac, initialMac) ? nameMac : null;

    this.deviceId = device.id;
    const generation = ++this.generation;
    const current = () => this.generation === generation && this.deviceId === device.id;
    const onDisconnect = () => {
      if (!current()) return;
      this.generation++;
      this.deviceId = null;
      this.stopNotifications = null;
      this.requestStateCommand = null;
      this.disposeTimers?.();
      this.disposeTimers = null;
      this.callbacks.onDisconnect();
    };

    await this.transport.connect(device.id, onDisconnect);
    if (!current()) throw new Error('smart cube connection closed');

    const services = await this.transport.getServices?.(device.id);
    if (!services) throw new Error('QiYi service discovery unavailable');
    const notifyCharacteristic = characteristicFor(services, QIYI_CHARACTERISTIC_UUID);
    if (!notifyCharacteristic || !canNotify(notifyCharacteristic)) {
      throw new Error('QiYi notify characteristic unavailable');
    }
    const fallbackWriteCharacteristic = characteristicFor(services, QIYI_WRITE_CHARACTERISTIC_UUID);
    const writeCharacteristic = canWrite(notifyCharacteristic)
      ? notifyCharacteristic
      : fallbackWriteCharacteristic && canWrite(fallbackWriteCharacteristic)
        ? fallbackWriteCharacteristic
        : null;
    if (!writeCharacteristic) throw new Error('QiYi write characteristic unavailable');

    const cipher = createQiyiCipher();
    let writeTail: Promise<void> = Promise.resolve();
    const send = (command: Uint8Array, strict = true): Promise<void> => {
      const encrypted = cipher.encrypt(command);
      const task = writeTail.then(() => {
        if (!current()) throw new Error('smart cube connection closed');
        return this.transport.write(
          device.id,
          QIYI_SERVICE_UUID,
          writeCharacteristic.uuid,
          encrypted,
        );
      });
      writeTail = task.catch(() => undefined);
      return strict ? task : task.catch(() => undefined);
    };

    let activeMac = initialMac;
    let battery: number | null = null;
    let badFrames = 0;
    let helloAttempts = 0;
    let lastTimestamp = 0;
    let protocolReady = false;
    let protocolError = false;
    let stateReady = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const clearHelloTimers = () => {
      if (fallbackTimer !== undefined) clearTimeout(fallbackTimer);
      if (retryTimer !== undefined) clearTimeout(retryTimer);
      fallbackTimer = undefined;
      retryTimer = undefined;
    };
    this.disposeTimers = clearHelloTimers;

    const emitStatus = () => {
      this.callbacks.onStatus?.({
        protocol: 'qiyi',
        battery,
        moveCounter: lastTimestamp,
        pendingMoves: 0,
        badFrames,
        stateReady,
      });
    };
    const reportProtocolError = () => {
      if (protocolError || !current()) return;
      protocolError = true;
      clearHelloTimers();
      this.callbacks.onProtocolError();
    };
    const recordBadFrame = () => {
      badFrames++;
      emitStatus();
      if (badFrames >= BAD_FRAME_THRESHOLD) reportProtocolError();
    };
    const sendHello = (mac: Uint8Array, strict: boolean) => {
      activeMac = mac;
      helloAttempts++;
      return send(createQiyiHelloCommand(mac), strict);
    };
    const markProtocolReady = () => {
      if (protocolReady) return;
      protocolReady = true;
      clearHelloTimers();
    };

    const stopNotifications = await this.transport.subscribe(
      device.id,
      QIYI_SERVICE_UUID,
      QIYI_CHARACTERISTIC_UUID,
      (value) => {
        if (!current() || protocolError) return;
        if (value.byteLength === 0 || value.byteLength % 16 !== 0) {
          recordBadFrame();
          return;
        }
        const plain = cipher.decrypt(bytesFromView(value));
        const notification = decodeQiyiNotification(plain, lastTimestamp);
        if (!notification.gyro && notification.opcode === null) {
          recordBadFrame();
          return;
        }

        badFrames = 0;
        if (notification.opcode === QIYI_OP_HELLO || notification.opcode === QIYI_OP_STATE) {
          markProtocolReady();
          if (notification.timestamp !== null) {
            void send(createQiyiAckCommand(notification.opcode, notification.timestamp), false);
          }
        }
        for (const move of notification.moves) this.callbacks.onMove(move.mv, move.ts);
        if (notification.state) {
          stateReady = true;
          this.callbacks.onState?.(notification.state);
        }
        for (const move of notification.futureMoves) {
          this.callbacks.onMove(move.mv, move.ts, { futureHistory: true });
        }
        if (notification.gyro) this.callbacks.onGyro?.(notification.gyro);
        if (notification.battery !== null) battery = notification.battery;
        if (notification.latestTimestamp !== null) {
          lastTimestamp = Math.max(lastTimestamp, notification.latestTimestamp);
        }
        emitStatus();
      },
    );
    if (!current()) {
      await stopNotifications().catch(() => undefined);
      throw new Error('smart cube connection closed');
    }
    this.stopNotifications = stopNotifications;
    this.requestStateCommand = () => send(createQiyiHelloCommand(activeMac));

    await sendHello(initialMac, true);
    if (!protocolReady && fallbackMac) {
      fallbackTimer = setTimeout(() => {
        if (!current() || protocolReady || helloAttempts >= MAX_HELLO_ATTEMPTS) return;
        void sendHello(fallbackMac, false);
      }, FALLBACK_HELLO_DELAY_MS);
    }
    if (!protocolReady) {
      retryTimer = setTimeout(() => {
        if (!current() || protocolReady || helloAttempts >= MAX_HELLO_ATTEMPTS) return;
        void sendHello(activeMac, false);
      }, HELLO_RETRY_DELAY_MS);
    }
  }

  async requestState(): Promise<void> {
    if (!this.requestStateCommand) throw new Error('smart cube is not connected');
    await this.requestStateCommand();
  }

  async disconnect(): Promise<void> {
    const deviceId = this.deviceId;
    this.deviceId = null;
    this.generation++;
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
