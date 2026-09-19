import { miniProgramApi } from '../platform';
import { tr } from '../i18n';
import {
  beginBleResourceCleanup,
  bluetoothAdapterErrorMessage,
  claimBleResourceLease,
  createBleNativeOperationQueue,
  getBleSubscriptionType,
  ignoreBleFailure,
  invokeBleCleanupForLease,
  invokeBleForLease,
  invokeBleWithLateCleanupForLease,
  normalizeBleUuid,
  raceBleAbort,
  raceBleAbortWithLateCleanup,
  safeBleCallback,
  waitForBleCleanupDrain,
  BleOperationAbortedError,
  type BleAbortSignal,
  type BleCharacteristic,
  type BleConnectionStateChange,
  type BleResourceLease,
  type BleService,
  type BleSubscriptionType,
  type CharacteristicValueChange,
  type DiscoveredDevice,
  type MiniProgramBleApi,
} from './ble-api';

export interface EncryptedBleConnection {
  readonly deviceId: string;
  readonly deviceName?: string;
  disconnect(): Promise<void>;
  requestBattery(): Promise<number | null>;
}

export interface EncryptedBleOptions {
  api?: MiniProgramBleApi;
  device?: DiscoveredDevice;
  signal?: BleAbortSignal;
  scanTimeoutMs?: number;
  serviceUuid: string;
  notifyCharacteristicUuid?: string;
  characteristicUuid: string;
  writeCharacteristicUuid?: string;
  matches(device: DiscoveredDevice): boolean;
  resolveMac(device: DiscoveredDevice): string | null;
  createCipher(mac: Uint8Array): {
    decrypt(frame: Uint8Array): Uint8Array;
    encrypt(frame: Uint8Array): Uint8Array;
  };
  onFrame(frame: Uint8Array, write: (value: Uint8Array) => Promise<void>): number | null | void;
  initialFrames?: Uint8Array[] | ((mac: Uint8Array) => Uint8Array[]);
  onBattery?(level: number): void;
  onDisconnect?(message: string): void;
  onMove?(move: string, timestamp?: number): void;
  onState?(facelets: string): void;
  onGyro?(quaternion: { w: number; x: number; y: number; z: number }): void;
}

async function findDevice(
  api: MiniProgramBleApi,
  lease: BleResourceLease,
  timeoutMs: number,
  signal: BleAbortSignal | undefined,
  options: EncryptedBleOptions,
): Promise<DiscoveredDevice> {
  if (options.device) return options.device;
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let offAbort = (): void => {};
    const finish = (result: DiscoveredDevice | Error): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      offAbort();
      api.offBluetoothDeviceFound(onFound);
      void ignoreBleFailure(() => invokeBleCleanupForLease(lease, (callbacks) => {
        api.stopBluetoothDevicesDiscovery(callbacks);
      }));
      if (result instanceof Error) reject(result); else resolve(result);
    };
    const onFound = (result: { devices: DiscoveredDevice[] }): void => {
      const device = result.devices.find((candidate) => Boolean(candidate.deviceId) && options.matches(candidate));
      if (device) finish(device);
    };
    api.onBluetoothDeviceFound(onFound);
    offAbort = signal?.onAbort(() => finish(new BleOperationAbortedError())) ?? offAbort;
    if (settled) return;
    timer = setTimeout(() => finish(new Error(tr({ en: 'No compatible smart cube found', zh: '未发现兼容的智能魔方' }))), timeoutMs);
    const stop = (): Promise<unknown> => invokeBleCleanupForLease(lease, (callbacks) => api.stopBluetoothDevicesDiscovery(callbacks));
    void raceBleAbortWithLateCleanup(
      invokeBleWithLateCleanupForLease(lease, (callbacks) => api.startBluetoothDevicesDiscovery({
        ...callbacks,
        allowDuplicatesKey: false,
      }), stop),
      signal,
      stop,
    ).catch((error: unknown) => finish(error instanceof BleOperationAbortedError
      ? error
      : new Error(tr({ en: 'Unable to search for the smart cube', zh: '无法搜索智能魔方' }), { cause: error })));
  });
}

export async function connectEncryptedBle(options: EncryptedBleOptions): Promise<EncryptedBleConnection> {
  const api = options.api ?? (miniProgramApi() as unknown as MiniProgramBleApi);
  const timeoutMs = options.scanTimeoutMs ?? 10_000;
  const lease = claimBleResourceLease(api);
  let adapterOpen = false;
  let active = false;
  let closing = false;
  let connectedDeviceId: string | null = null;
  let serviceId: string | null = null;
  let characteristicId: string | null = null;
  let notifyCharacteristicId: string | null = null;
  let subscriptionType: BleSubscriptionType | null = null;
  let notificationsEnabled = false;
  let listener: ((result: CharacteristicValueChange) => void) | null = null;
  let stateListener: ((result: BleConnectionStateChange) => void) | null = null;
  let disconnectPromise: Promise<void> | null = null;
  let lastBattery: number | null = null;
  const writeQueue = createBleNativeOperationQueue(lease);

  const disconnect = (): Promise<void> => {
    if (disconnectPromise) return disconnectPromise;
    disconnectPromise = (async () => {
      const release = beginBleResourceCleanup(lease);
      closing = true;
      active = false;
      const pendingWrites = writeQueue.drain();
      if (listener) api.offBLECharacteristicValueChange(listener);
      listener = null;
      if (stateListener) api.offBLEConnectionStateChange?.(stateListener);
      stateListener = null;
      const cleanup = async (): Promise<void> => {
        try {
          await pendingWrites;
          if (notificationsEnabled && connectedDeviceId && serviceId && notifyCharacteristicId && subscriptionType) {
            await ignoreBleFailure(() => invokeBleCleanupForLease(lease, (callbacks) => api.notifyBLECharacteristicValueChange({
              ...callbacks, characteristicId: notifyCharacteristicId as string, deviceId: connectedDeviceId as string,
              serviceId: serviceId as string, state: false, type: subscriptionType as BleSubscriptionType,
            })));
          }
          if (connectedDeviceId) await ignoreBleFailure(() => invokeBleCleanupForLease(lease, (callbacks) => api.closeBLEConnection({
            ...callbacks, deviceId: connectedDeviceId as string,
          })));
          if (adapterOpen) await ignoreBleFailure(() => invokeBleCleanupForLease(lease, (callbacks) => api.closeBluetoothAdapter(callbacks)));
        } finally {
          release();
        }
      };
      if (await waitForBleCleanupDrain(pendingWrites)) await cleanup(); else void cleanup();
    })();
    return disconnectPromise;
  };

  try {
    const closeAdapter = (): Promise<unknown> => invokeBleCleanupForLease(lease, (callbacks) => api.closeBluetoothAdapter(callbacks));
    await raceBleAbortWithLateCleanup(
      invokeBleWithLateCleanupForLease(lease, (callbacks) => api.openBluetoothAdapter(callbacks), closeAdapter),
      options.signal,
      closeAdapter,
    );
    adapterOpen = true;
    const device = await findDevice(api, lease, timeoutMs, options.signal, options);
    const mac = options.resolveMac(device);
    if (!mac) throw new Error(tr({ en: 'The cube address could not be read. Wake it and scan again.', zh: '未读取到魔方地址，请唤醒魔方后重新扫描' }));
    connectedDeviceId = device.deviceId;
    const closeConnection = (): Promise<unknown> => invokeBleCleanupForLease(lease, (callbacks) => api.closeBLEConnection({ ...callbacks, deviceId: device.deviceId }));
    await raceBleAbortWithLateCleanup(
      invokeBleWithLateCleanupForLease(lease, (callbacks) => api.createBLEConnection({ ...callbacks, deviceId: device.deviceId, timeout: 10_000 }), closeConnection),
      options.signal,
      closeConnection,
    );
    active = true;
    stateListener = (result): void => {
      if (result.deviceId === connectedDeviceId && !result.connected && !closing) {
        safeBleCallback(options.onDisconnect ? () => options.onDisconnect?.(tr({ en: 'Smart cube disconnected', zh: '智能魔方连接已断开' })) : undefined);
        void disconnect();
      }
    };
    api.onBLEConnectionStateChange?.(stateListener);
    const services = await raceBleAbort(invokeBleForLease<{ services: BleService[] }>(lease, (callbacks) => api.getBLEDeviceServices({ ...callbacks, deviceId: device.deviceId })), options.signal);
    const service = services.services.find((candidate) => normalizeBleUuid(candidate.uuid) === normalizeBleUuid(options.serviceUuid));
    if (!service) throw new Error(tr({ en: 'Smart cube communication service is unavailable', zh: '智能魔方通信服务不可用' }));
    serviceId = service.uuid;
    const characteristics = await raceBleAbort(invokeBleForLease<{ characteristics: BleCharacteristic[] }>(lease, (callbacks) => api.getBLEDeviceCharacteristics({
      ...callbacks, deviceId: device.deviceId, serviceId: service.uuid,
    })), options.signal);
    const characteristic = characteristics.characteristics.find((candidate) => normalizeBleUuid(candidate.uuid) === normalizeBleUuid(options.writeCharacteristicUuid ?? options.characteristicUuid)
      && Boolean(candidate.properties?.write || candidate.properties?.writeNoResponse));
    const notifyCharacteristic = characteristics.characteristics.find((candidate) => normalizeBleUuid(candidate.uuid)
      === normalizeBleUuid(options.notifyCharacteristicUuid ?? options.characteristicUuid) && Boolean(getBleSubscriptionType(candidate)));
    subscriptionType = notifyCharacteristic ? getBleSubscriptionType(notifyCharacteristic) ?? null : null;
    if (!characteristic || !notifyCharacteristic || !subscriptionType) throw new Error(tr({ en: 'Smart cube communication characteristic is unavailable', zh: '智能魔方通信特征不可用' }));
    characteristicId = characteristic.uuid;
    notifyCharacteristicId = notifyCharacteristic.uuid;
    const cipher = options.createCipher(parseMac(mac));
    const write = (value: Uint8Array): Promise<void> => writeQueue.enqueue(() => {
      if (closing || !active || !connectedDeviceId || !serviceId || !characteristicId) throw new Error(tr({ en: 'Smart cube disconnected', zh: '智能魔方连接已断开' }));
      return invokeBleForLease(lease, (callbacks) => api.writeBLECharacteristicValue({
        ...callbacks, characteristicId: characteristicId as string, deviceId: connectedDeviceId as string,
        serviceId: serviceId as string, value: toArrayBuffer(cipher.encrypt(value)),
      })).then(() => undefined);
    }, options.signal);
    listener = (result): void => {
      if (!active || result.deviceId !== connectedDeviceId || normalizeBleUuid(result.serviceId) !== normalizeBleUuid(serviceId as string)
        || normalizeBleUuid(result.characteristicId) !== normalizeBleUuid(notifyCharacteristicId as string)) return;
      try {
        const battery = options.onFrame(cipher.decrypt(new Uint8Array(result.value)), write);
        if (typeof battery === 'number' && battery !== lastBattery) {
          lastBattery = battery;
          options.onBattery?.(battery);
        }
      } catch { /* Ignore malformed protocol frames. */ }
    };
    api.onBLECharacteristicValueChange(listener);
    await raceBleAbort(invokeBleForLease(lease, (callbacks) => api.notifyBLECharacteristicValueChange({
      ...callbacks, characteristicId: notifyCharacteristic.uuid, deviceId: device.deviceId, serviceId: service.uuid,
      state: true, type: subscriptionType as BleSubscriptionType,
    })), options.signal);
    notificationsEnabled = true;
    const initialFrames = typeof options.initialFrames === 'function'
      ? options.initialFrames(parseMac(mac))
      : options.initialFrames ?? [];
    for (const frame of initialFrames) await write(frame);
    return {
      deviceId: device.deviceId,
      deviceName: device.name ?? device.localName,
      disconnect,
      requestBattery: async () => lastBattery,
    };
  } catch (error) {
    await disconnect();
    throw error;
  }
}

function parseMac(value: string): Uint8Array {
  return Uint8Array.from(value.split(':').map((part) => Number.parseInt(part, 16)));
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}
