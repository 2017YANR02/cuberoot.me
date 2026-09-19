import { miniProgramApi } from '../platform';
import { tr } from '../i18n';
import {
  beginBleResourceCleanup,
  bleBytesToHex,
  bleRuntimeInfo,
  bluetoothAdapterErrorMessage,
  claimBleResourceLease,
  createBleDiagnostic,
  describeBleDevice,
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
  type BleDiagnostic,
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

export interface ResolvedBleMac {
  source: string;
  value: string;
}

export interface EncryptedBleOptions {
  api?: MiniProgramBleApi;
  device?: DiscoveredDevice;
  signal?: BleAbortSignal;
  scanTimeoutMs?: number;
  mtu?: number;
  serviceUuid: string;
  notifyCharacteristicUuid?: string;
  characteristicUuid: string;
  writeCharacteristicUuid?: string;
  preferNotifyCharacteristicForWrite?: boolean;
  preferWriteNoResponse?: boolean;
  readyTimeoutMs?: number;
  retryInitialFramesAfterMs?: number;
  diagnosticLabel: string;
  matches(device: DiscoveredDevice): boolean;
  resolveMac(device: DiscoveredDevice): ResolvedBleMac | null;
  createCipher(mac: Uint8Array): {
    decrypt(frame: Uint8Array): Uint8Array;
    encrypt(frame: Uint8Array): Uint8Array;
  };
  onFrame(
    frame: Uint8Array,
    write: (value: Uint8Array) => Promise<void>,
    diagnostic: BleDiagnostic,
  ): number | null | void;
  isReadyFrame?(frame: Uint8Array): boolean;
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
  const diagnostic = createBleDiagnostic(options.diagnosticLabel);
  diagnostic.info('connect-start', { runtime: bleRuntimeInfo() });
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
  let notificationCount = 0;
  let writeCount = 0;
  let ready = !options.isReadyFrame;
  let resolveReady = (): void => {};
  const readyPromise = new Promise<void>((resolve) => { resolveReady = resolve; });
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
    diagnostic.info('device-selected', describeBleDevice(device));
    const resolvedMac = options.resolveMac(device);
    diagnostic.info('mac-resolution', resolvedMac
      ? { source: resolvedMac.source, mac: resolvedMac.value }
      : { source: null, mac: null });
    if (!resolvedMac) throw new Error(tr({ en: 'The cube address could not be read. Wake it and scan again.', zh: '未读取到魔方地址，请唤醒魔方后重新扫描' }));
    const mac = resolvedMac.value;
    connectedDeviceId = device.deviceId;
    const closeConnection = (): Promise<unknown> => invokeBleCleanupForLease(lease, (callbacks) => api.closeBLEConnection({ ...callbacks, deviceId: device.deviceId }));
    await raceBleAbortWithLateCleanup(
      invokeBleWithLateCleanupForLease(lease, (callbacks) => api.createBLEConnection({ ...callbacks, deviceId: device.deviceId, timeout: 10_000 }), closeConnection),
      options.signal,
      closeConnection,
    );
    active = true;
    diagnostic.info('gatt-connected', { deviceId: device.deviceId });
    const setBleMtu = api.setBLEMTU;
    if (options.mtu && setBleMtu) {
      try {
        await raceBleAbort(invokeBleForLease(lease, (callbacks) => setBleMtu({
          ...callbacks,
          deviceId: device.deviceId,
          mtu: options.mtu as number,
        })), options.signal);
        diagnostic.info('mtu-ready', { mtu: options.mtu });
      } catch (error) {
        if (error instanceof BleOperationAbortedError) throw error;
        diagnostic.warn('mtu-failed', { mtu: options.mtu, error: error instanceof Error ? error.message : String(error) });
      }
    }
    stateListener = (result): void => {
      if (result.deviceId === connectedDeviceId && !result.connected && !closing) {
        diagnostic.warn('gatt-disconnected', { deviceId: result.deviceId });
        safeBleCallback(options.onDisconnect ? () => options.onDisconnect?.(tr({ en: 'Smart cube disconnected', zh: '智能魔方连接已断开' })) : undefined);
        void disconnect();
      }
    };
    api.onBLEConnectionStateChange?.(stateListener);
    const services = await raceBleAbort(invokeBleForLease<{ services: BleService[] }>(lease, (callbacks) => api.getBLEDeviceServices({ ...callbacks, deviceId: device.deviceId })), options.signal);
    diagnostic.info('services', { services: services.services.map((candidate) => candidate.uuid) });
    const service = services.services.find((candidate) => normalizeBleUuid(candidate.uuid) === normalizeBleUuid(options.serviceUuid));
    if (!service) throw new Error(tr({ en: 'Smart cube communication service is unavailable', zh: '智能魔方通信服务不可用' }));
    serviceId = service.uuid;
    const characteristics = await raceBleAbort(invokeBleForLease<{ characteristics: BleCharacteristic[] }>(lease, (callbacks) => api.getBLEDeviceCharacteristics({
      ...callbacks, deviceId: device.deviceId, serviceId: service.uuid,
    })), options.signal);
    diagnostic.info('characteristics', {
      characteristics: characteristics.characteristics.map((candidate) => ({
        uuid: candidate.uuid,
        properties: candidate.properties ?? {},
      })),
    });
    const notifyCharacteristic = characteristics.characteristics.find((candidate) => normalizeBleUuid(candidate.uuid)
      === normalizeBleUuid(options.notifyCharacteristicUuid ?? options.characteristicUuid) && Boolean(getBleSubscriptionType(candidate)));
    const supportsWrite = (candidate: BleCharacteristic | undefined): candidate is BleCharacteristic => Boolean(
      candidate?.properties?.write || candidate?.properties?.writeNoResponse,
    );
    const fallbackWriteCharacteristic = characteristics.characteristics.find((candidate) => normalizeBleUuid(candidate.uuid)
      === normalizeBleUuid(options.writeCharacteristicUuid ?? options.characteristicUuid) && supportsWrite(candidate));
    const characteristic = options.preferNotifyCharacteristicForWrite && supportsWrite(notifyCharacteristic)
      ? notifyCharacteristic
      : fallbackWriteCharacteristic;
    subscriptionType = notifyCharacteristic ? getBleSubscriptionType(notifyCharacteristic) ?? null : null;
    if (!characteristic || !notifyCharacteristic || !subscriptionType) throw new Error(tr({ en: 'Smart cube communication characteristic is unavailable', zh: '智能魔方通信特征不可用' }));
    characteristicId = characteristic.uuid;
    notifyCharacteristicId = notifyCharacteristic.uuid;
    const writeType = options.preferWriteNoResponse && characteristic.properties?.writeNoResponse
      ? 'writeNoResponse'
      : characteristic.properties?.write
        ? 'write'
        : 'writeNoResponse';
    diagnostic.info('channels-selected', {
      serviceId,
      notifyCharacteristicId,
      writeCharacteristicId: characteristicId,
      subscriptionType,
      writeType,
    });
    const cipher = options.createCipher(parseMac(mac));
    const write = (value: Uint8Array): Promise<void> => writeQueue.enqueue(() => {
      if (closing || !active || !connectedDeviceId || !serviceId || !characteristicId) throw new Error(tr({ en: 'Smart cube disconnected', zh: '智能魔方连接已断开' }));
      const encrypted = cipher.encrypt(value);
      const sequence = ++writeCount;
      diagnostic.info('write-start', {
        sequence,
        characteristicId,
        writeType,
        plaintext: bleBytesToHex(value),
        encrypted: bleBytesToHex(encrypted),
      });
      return invokeBleForLease(lease, (callbacks) => api.writeBLECharacteristicValue({
        ...callbacks, characteristicId: characteristicId as string, deviceId: connectedDeviceId as string,
        serviceId: serviceId as string, value: toArrayBuffer(encrypted), writeType,
      })).then(() => {
        diagnostic.info('write-success', { sequence });
      }, (error: unknown) => {
        diagnostic.error('write-failed', { sequence, error: error instanceof Error ? error.message : String(error) });
        throw error;
      });
    }, options.signal);
    listener = (result): void => {
      if (!active || result.deviceId !== connectedDeviceId || normalizeBleUuid(result.serviceId) !== normalizeBleUuid(serviceId as string)
        || normalizeBleUuid(result.characteristicId) !== normalizeBleUuid(notifyCharacteristicId as string)) return;
      try {
        const raw = new Uint8Array(result.value);
        const frame = cipher.decrypt(raw);
        const sequence = ++notificationCount;
        if (sequence <= 40 || sequence % 50 === 0) {
          diagnostic.info('notification', {
            sequence,
            characteristicId: result.characteristicId,
            raw: bleBytesToHex(raw),
            decrypted: bleBytesToHex(frame),
          });
        }
        const battery = options.onFrame(frame, write, diagnostic);
        if (!ready && options.isReadyFrame?.(frame)) {
          ready = true;
          diagnostic.info('protocol-ready', { notificationCount, writeCount });
          resolveReady();
        }
        if (typeof battery === 'number' && battery !== lastBattery) {
          lastBattery = battery;
          options.onBattery?.(battery);
        }
      } catch (error) {
        diagnostic.warn('notification-rejected', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };
    api.onBLECharacteristicValueChange(listener);
    await raceBleAbort(invokeBleForLease(lease, (callbacks) => api.notifyBLECharacteristicValueChange({
      ...callbacks, characteristicId: notifyCharacteristic.uuid, deviceId: device.deviceId, serviceId: service.uuid,
      state: true, type: subscriptionType as BleSubscriptionType,
    })), options.signal);
    notificationsEnabled = true;
    diagnostic.info('notifications-enabled', {
      characteristicId: notifyCharacteristic.uuid,
      subscriptionType,
    });
    const initialFrames = typeof options.initialFrames === 'function'
      ? options.initialFrames(parseMac(mac))
      : options.initialFrames ?? [];
    const writeInitialFrames = async (): Promise<void> => {
      for (const frame of initialFrames) await write(frame);
    };
    try {
      await writeInitialFrames();
    } catch (error) {
      if (options.retryInitialFramesAfterMs === undefined) throw error;
    }
    if (!ready) {
      const retryDelayMs = options.retryInitialFramesAfterMs;
      let retryTimer: ReturnType<typeof setTimeout> | undefined;
      if (retryDelayMs !== undefined && retryDelayMs >= 0) {
        retryTimer = setTimeout(() => {
          if (ready || closing) return;
          diagnostic.warn('initial-write-retry', { retryDelayMs });
          void writeInitialFrames().catch(() => {});
        }, retryDelayMs);
      }
      const readyTimeoutMs = options.readyTimeoutMs ?? 4_000;
      diagnostic.info('protocol-wait', { readyTimeoutMs });
      try {
        await raceBleAbort(new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(tr({
            en: 'The smart cube protocol did not respond. Wake the cube and try again.',
            zh: '智能魔方协议未响应，请转动唤醒魔方后重试',
          }))), readyTimeoutMs);
          void readyPromise.then(() => {
            clearTimeout(timer);
            resolve();
          });
        }), options.signal);
      } finally {
        if (retryTimer !== undefined) clearTimeout(retryTimer);
      }
    }
    diagnostic.info('connect-ready', { notificationCount, writeCount, macSource: resolvedMac.source });
    return {
      deviceId: device.deviceId,
      deviceName: device.name ?? device.localName,
      disconnect,
      requestBattery: async () => lastBattery,
    };
  } catch (error) {
    diagnostic.error('connect-failed', {
      error: error instanceof Error ? error.message : String(error),
      notificationCount,
      writeCount,
    });
    await disconnect();
    throw error;
  }
}

function parseMac(value: string): Uint8Array {
  return Uint8Array.from(value.split(':').map((part) => Number.parseInt(part, 16)));
}

export function normalizeBleMac(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/-/g, ':').toUpperCase() ?? '';
  if (!/^[0-9A-F]{2}(?::[0-9A-F]{2}){5}$/.test(normalized)) return null;
  return normalized === '00:00:00:00:00:00' || normalized === 'FF:FF:FF:FF:FF:FF'
    ? null
    : normalized;
}

export function extractBleMacFromAdvertisement(
  advertisement: ArrayBuffer | undefined,
  options: {
    companyIds: readonly number[];
    layout: 'first6-reversed' | 'last6-reversed';
  },
): string | null {
  if (!advertisement) return null;
  const bytes = new Uint8Array(advertisement);
  const companyIds = new Set(options.companyIds);
  const decode = (payload: Uint8Array): string | null => {
    if (payload.length < 6) return null;
    const start = options.layout === 'first6-reversed' ? 0 : payload.length - 6;
    const parts: string[] = [];
    for (let index = 0; index < 6; index++) {
      parts.push(payload[start + 5 - index].toString(16).padStart(2, '0'));
    }
    return normalizeBleMac(parts.join(':'));
  };

  if (bytes.length < 8) return null;
  const companyId = bytes[0] | (bytes[1] << 8);
  return companyIds.has(companyId) ? decode(bytes.subarray(2)) : null;
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}
