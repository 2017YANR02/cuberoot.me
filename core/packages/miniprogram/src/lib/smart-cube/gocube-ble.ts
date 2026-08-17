import {
  GOCUBE_COMMAND_BATTERY,
  GOCUBE_COMMAND_STATE,
  GOCUBE_NOTIFY_CHARACTERISTIC_UUID,
  GOCUBE_SERVICE_UUID,
  GOCUBE_STATE_REACK_AFTER_MOVES,
  GOCUBE_WRITE_CHARACTERISTIC_UUID,
  createGoCubeCommand,
  matchesGoCubeName,
  parseGoCubeNotification,
  type GoCubeQuaternion,
} from '@cuberoot/shared/smart-cube/gocube';

interface BleFailure {
  errCode?: number;
  errMsg?: string;
}

interface BleCallbacks<T> {
  success?(result: T): void;
  fail?(error: BleFailure): void;
}

interface DiscoveredDevice {
  deviceId: string;
  localName?: string;
  name?: string;
}

interface BleService {
  isPrimary?: boolean;
  uuid: string;
}

interface BleCharacteristic {
  properties?: {
    indicate?: boolean;
    notify?: boolean;
    write?: boolean;
    writeNoResponse?: boolean;
  };
  uuid: string;
}

interface CharacteristicValueChange {
  characteristicId: string;
  deviceId: string;
  serviceId: string;
  value: ArrayBuffer;
}

export interface GoCubeBleApi {
  closeBLEConnection(options: { deviceId: string } & BleCallbacks<BleFailure>): void;
  closeBluetoothAdapter(options: BleCallbacks<BleFailure>): void;
  createBLEConnection(options: {
    deviceId: string;
    timeout?: number;
  } & BleCallbacks<BleFailure>): void;
  getBLEDeviceCharacteristics(options: {
    deviceId: string;
    serviceId: string;
  } & BleCallbacks<{ characteristics: BleCharacteristic[] }>): void;
  getBLEDeviceServices(options: {
    deviceId: string;
  } & BleCallbacks<{ services: BleService[] }>): void;
  notifyBLECharacteristicValueChange(options: {
    characteristicId: string;
    deviceId: string;
    serviceId: string;
    state: boolean;
  } & BleCallbacks<BleFailure>): void;
  offBLECharacteristicValueChange(listener: (result: CharacteristicValueChange) => void): void;
  offBluetoothDeviceFound(listener: (result: { devices: DiscoveredDevice[] }) => void): void;
  onBLECharacteristicValueChange(listener: (result: CharacteristicValueChange) => void): void;
  onBluetoothDeviceFound(listener: (result: { devices: DiscoveredDevice[] }) => void): void;
  openBluetoothAdapter(options: BleCallbacks<BleFailure>): void;
  startBluetoothDevicesDiscovery(options: {
    allowDuplicatesKey: boolean;
    services: string[];
  } & BleCallbacks<BleFailure>): void;
  stopBluetoothDevicesDiscovery(options: BleCallbacks<BleFailure>): void;
  writeBLECharacteristicValue(options: {
    characteristicId: string;
    deviceId: string;
    serviceId: string;
    value: ArrayBuffer;
  } & BleCallbacks<BleFailure>): void;
}

export interface GoCubeBleConnection {
  readonly deviceId: string;
  disconnect(): Promise<void>;
  requestBattery(): Promise<number | null>;
}

export interface ConnectGoCubeOptions {
  api?: GoCubeBleApi;
  onBattery?(level: number): void;
  onGyro?(quaternion: GoCubeQuaternion): void;
  onMove?(move: string): void;
  onState?(facelets: string): void;
  scanTimeoutMs?: number;
}

export class GoCubeBleError extends Error {
  constructor(
    public readonly code:
      | 'adapter-unavailable'
      | 'connection-failed'
      | 'device-not-found'
      | 'gatt-unavailable',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'GoCubeBleError';
  }
}

function invoke<T>(start: (callbacks: BleCallbacks<T>) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    try {
      start({
        success: resolve,
        fail: (error) => reject(new Error(error.errMsg ?? '微信蓝牙接口调用失败')),
      });
    } catch (error) {
      reject(error);
    }
  });
}

function normalizeUuid(uuid: string): string {
  return uuid.toLowerCase();
}

function safeCallback(callback: (() => void) | undefined): void {
  try {
    callback?.();
  } catch {
    // Consumer callbacks must not break the BLE transport loop.
  }
}

async function ignoreFailure(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch {
    // Cleanup is best-effort and idempotent.
  }
}

async function findGoCube(api: GoCubeBleApi, timeoutMs: number): Promise<DiscoveredDevice> {
  return new Promise<DiscoveredDevice>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: DiscoveredDevice | Error): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      api.offBluetoothDeviceFound(onFound);
      void ignoreFailure(() => invoke((callbacks) => api.stopBluetoothDevicesDiscovery(callbacks)));
      if (result instanceof Error) reject(result);
      else resolve(result);
    };

    const onFound = (result: { devices: DiscoveredDevice[] }): void => {
      const device = result.devices.find((candidate) =>
        Boolean(candidate.deviceId)
        && matchesGoCubeName(candidate.name ?? candidate.localName));
      if (device) finish(device);
    };

    api.onBluetoothDeviceFound(onFound);
    timer = setTimeout(() => {
      finish(new GoCubeBleError('device-not-found', '未发现 GoCube 或 Rubik’s Connected'));
    }, timeoutMs);

    try {
      api.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: false,
        services: [GOCUBE_SERVICE_UUID],
        success: () => {},
        fail: (error) => finish(new GoCubeBleError(
          'adapter-unavailable',
          error.errMsg ?? '无法开始搜索智能魔方',
        )),
      });
    } catch (error) {
      finish(new GoCubeBleError('adapter-unavailable', '无法开始搜索智能魔方', {
        cause: error,
      }));
    }
  });
}

export async function connectGoCube(
  options: ConnectGoCubeOptions = {},
): Promise<GoCubeBleConnection> {
  const api = options.api ?? (wx as unknown as GoCubeBleApi);
  const scanTimeoutMs = options.scanTimeoutMs ?? 10_000;
  if (!Number.isFinite(scanTimeoutMs) || scanTimeoutMs < 1_000 || scanTimeoutMs > 30_000) {
    throw new RangeError('scanTimeoutMs must be between 1000 and 30000.');
  }

  let adapterOpen = false;
  let connectedDeviceId: string | null = null;
  let serviceId: string | null = null;
  let writeCharacteristicId: string | null = null;
  let notifyCharacteristicId: string | null = null;
  let notificationListener: ((result: CharacteristicValueChange) => void) | null = null;
  let notificationsEnabled = false;
  let active = false;
  let lastBattery: number | null = null;
  let movesSinceAck = 0;
  let disconnectPromise: Promise<void> | null = null;
  const batteryWaiters = new Set<(level: number | null) => void>();

  const writeCommand = async (command: number): Promise<void> => {
    if (!active || !connectedDeviceId || !serviceId || !writeCharacteristicId) {
      throw new GoCubeBleError('connection-failed', '智能魔方连接已断开');
    }
    const deviceId = connectedDeviceId;
    const currentServiceId = serviceId;
    const characteristicId = writeCharacteristicId;
    await invoke((callbacks) => api.writeBLECharacteristicValue({
      ...callbacks,
      characteristicId,
      deviceId,
      serviceId: currentServiceId,
      value: createGoCubeCommand(command),
    }));
  };

  const disconnect = (): Promise<void> => {
    if (disconnectPromise) return disconnectPromise;
    disconnectPromise = (async () => {
      active = false;
      for (const resolve of batteryWaiters) resolve(lastBattery);
      batteryWaiters.clear();

      if (notificationListener) {
        api.offBLECharacteristicValueChange(notificationListener);
        notificationListener = null;
      }
      if (notificationsEnabled && connectedDeviceId && serviceId && notifyCharacteristicId) {
        await ignoreFailure(() => invoke((callbacks) => api.notifyBLECharacteristicValueChange({
          ...callbacks,
          characteristicId: notifyCharacteristicId as string,
          deviceId: connectedDeviceId as string,
          serviceId: serviceId as string,
          state: false,
        })));
        notificationsEnabled = false;
      }
      if (connectedDeviceId) {
        await ignoreFailure(() => invoke((callbacks) => api.closeBLEConnection({
          ...callbacks,
          deviceId: connectedDeviceId as string,
        })));
        connectedDeviceId = null;
      }
      if (adapterOpen) {
        await ignoreFailure(() => invoke((callbacks) => api.closeBluetoothAdapter(callbacks)));
        adapterOpen = false;
      }
    })();
    return disconnectPromise;
  };

  try {
    try {
      await invoke((callbacks) => api.openBluetoothAdapter(callbacks));
      adapterOpen = true;
    } catch (error) {
      throw new GoCubeBleError('adapter-unavailable', '蓝牙不可用，请开启系统蓝牙后重试', {
        cause: error,
      });
    }

    const device = await findGoCube(api, scanTimeoutMs);
    connectedDeviceId = device.deviceId;
    try {
      await invoke((callbacks) => api.createBLEConnection({
        ...callbacks,
        deviceId: device.deviceId,
        timeout: 10_000,
      }));
    } catch (error) {
      throw new GoCubeBleError('connection-failed', '智能魔方连接失败', { cause: error });
    }

    const services = await invoke<{ services: BleService[] }>((callbacks) =>
      api.getBLEDeviceServices({ ...callbacks, deviceId: device.deviceId }));
    const service = services.services.find((candidate) =>
      normalizeUuid(candidate.uuid) === GOCUBE_SERVICE_UUID);
    if (!service) {
      throw new GoCubeBleError('gatt-unavailable', '智能魔方通信服务不可用');
    }
    serviceId = service.uuid;

    const characteristics = await invoke<{ characteristics: BleCharacteristic[] }>((callbacks) =>
      api.getBLEDeviceCharacteristics({
        ...callbacks,
        deviceId: device.deviceId,
        serviceId: service.uuid,
      }));
    const writeCharacteristic = characteristics.characteristics.find((candidate) =>
      normalizeUuid(candidate.uuid) === GOCUBE_WRITE_CHARACTERISTIC_UUID
      && Boolean(candidate.properties?.write || candidate.properties?.writeNoResponse));
    const notifyCharacteristic = characteristics.characteristics.find((candidate) =>
      normalizeUuid(candidate.uuid) === GOCUBE_NOTIFY_CHARACTERISTIC_UUID
      && Boolean(candidate.properties?.notify || candidate.properties?.indicate));
    if (!writeCharacteristic || !notifyCharacteristic) {
      throw new GoCubeBleError('gatt-unavailable', '智能魔方通信特征不可用');
    }
    writeCharacteristicId = writeCharacteristic.uuid;
    notifyCharacteristicId = notifyCharacteristic.uuid;
    active = true;

    notificationListener = (result): void => {
      if (!active
        || result.deviceId !== connectedDeviceId
        || normalizeUuid(result.serviceId) !== normalizeUuid(serviceId as string)
        || normalizeUuid(result.characteristicId) !== normalizeUuid(notifyCharacteristicId as string)) {
        return;
      }

      const notification = parseGoCubeNotification(result.value);
      if (!notification) return;
      if (notification.type === 'moves') {
        for (const move of notification.moves) {
          safeCallback(options.onMove ? () => options.onMove?.(move) : undefined);
          movesSinceAck++;
        }
        if (movesSinceAck > GOCUBE_STATE_REACK_AFTER_MOVES) {
          movesSinceAck = 0;
          void writeCommand(GOCUBE_COMMAND_STATE).catch(() => {});
        }
      } else if (notification.type === 'state') {
        safeCallback(options.onState ? () => options.onState?.(notification.facelets) : undefined);
      } else if (notification.type === 'orientation') {
        safeCallback(options.onGyro ? () => options.onGyro?.(notification.quaternion) : undefined);
      } else if (notification.type === 'battery') {
        lastBattery = notification.level;
        safeCallback(options.onBattery ? () => options.onBattery?.(notification.level) : undefined);
        for (const resolve of batteryWaiters) resolve(notification.level);
        batteryWaiters.clear();
      }
    };
    api.onBLECharacteristicValueChange(notificationListener);
    await invoke((callbacks) => api.notifyBLECharacteristicValueChange({
      ...callbacks,
      characteristicId: notifyCharacteristic.uuid,
      deviceId: device.deviceId,
      serviceId: service.uuid,
      state: true,
    }));
    notificationsEnabled = true;
    await writeCommand(GOCUBE_COMMAND_STATE);

    return {
      deviceId: device.deviceId,
      disconnect,
      async requestBattery(): Promise<number | null> {
        let finish: (level: number | null) => void = () => {};
        const response = new Promise<number | null>((resolve) => {
          let finished = false;
          finish = (level: number | null): void => {
            if (finished) return;
            finished = true;
            batteryWaiters.delete(finish);
            resolve(level);
          };
          batteryWaiters.add(finish);
          setTimeout(() => finish(lastBattery), 1_000);
        });
        try {
          await writeCommand(GOCUBE_COMMAND_BATTERY);
        } catch (error) {
          finish(lastBattery);
          throw error;
        }
        return response;
      },
    };
  } catch (error) {
    await disconnect();
    throw error;
  }
}
