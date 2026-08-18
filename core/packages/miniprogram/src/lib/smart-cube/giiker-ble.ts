import {
  GIIKER_COMMAND_BATTERY,
  GIIKER_DATA_SERVICE_UUID,
  GIIKER_NOTIFY_CHARACTERISTIC_UUID,
  GIIKER_READ_CHARACTERISTIC_UUID,
  GIIKER_RW_SERVICE_UUID,
  GIIKER_WRITE_CHARACTERISTIC_UUID,
  matchesGiikerName,
  parseGiikerFrame,
} from '@cuberoot/shared/smart-cube/giiker';
import {
  beginBleResourceCleanup,
  claimBleResourceLease,
  createBleNativeOperationQueue,
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
  type CharacteristicValueChange,
  type DiscoveredDevice,
  type MiniProgramBleApi,
} from './ble-api';

export type GiikerBleApi = MiniProgramBleApi;

export interface GiikerBleConnection {
  readonly deviceId: string;
  readonly deviceName?: string;
  disconnect(): Promise<void>;
  requestBattery(): Promise<number | null>;
}

export interface ConnectGiikerOptions {
  api?: GiikerBleApi;
  signal?: BleAbortSignal;
  onBattery?(level: number): void;
  onDisconnect?(message: string): void;
  onMove?(move: string): void;
  onState?(facelets: string): void;
  scanTimeoutMs?: number;
}

export class GiikerBleError extends Error {
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
    this.name = 'GiikerBleError';
  }
}

async function findGiiker(
  api: GiikerBleApi,
  lease: BleResourceLease,
  timeoutMs: number,
  signal?: BleAbortSignal,
): Promise<DiscoveredDevice> {
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
      void ignoreBleFailure(() => invokeBleCleanupForLease(
        lease,
        (callbacks) => api.stopBluetoothDevicesDiscovery(callbacks),
      ));
      if (result instanceof Error) reject(result);
      else resolve(result);
    };
    const onFound = (result: { devices: DiscoveredDevice[] }): void => {
      const device = result.devices.find((candidate) => Boolean(candidate.deviceId)
        && (matchesGiikerName(candidate.name) || matchesGiikerName(candidate.localName)));
      if (device) finish(device);
    };
    api.onBluetoothDeviceFound(onFound);
    offAbort = signal?.onAbort(() => finish(new BleOperationAbortedError())) ?? offAbort;
    if (settled) return;
    timer = setTimeout(() => finish(new GiikerBleError(
      'device-not-found',
      '未发现 Giiker 或米家智能魔方',
    )), timeoutMs);

    const stop = (): Promise<unknown> => invokeBleCleanupForLease(
      lease,
      (callbacks) => api.stopBluetoothDevicesDiscovery(callbacks),
    );
    void raceBleAbortWithLateCleanup(
      invokeBleWithLateCleanupForLease(
        lease,
        (callbacks) => api.startBluetoothDevicesDiscovery({
          ...callbacks,
          allowDuplicatesKey: false,
        }),
        stop,
      ),
      signal,
      stop,
    ).catch((error: unknown) => finish(error instanceof BleOperationAbortedError
      ? error
      : new GiikerBleError(
        'adapter-unavailable',
        error instanceof Error ? error.message : '无法开始搜索智能魔方',
        { cause: error },
      )));
  });
}

export async function connectGiiker(
  options: ConnectGiikerOptions = {},
): Promise<GiikerBleConnection> {
  const api = options.api ?? (wx as unknown as GiikerBleApi);
  const scanTimeoutMs = options.scanTimeoutMs ?? 10_000;
  if (!Number.isFinite(scanTimeoutMs) || scanTimeoutMs < 1_000 || scanTimeoutMs > 30_000) {
    throw new RangeError('scanTimeoutMs must be between 1000 and 30000.');
  }
  const lease = claimBleResourceLease(api);
  const writeQueue = createBleNativeOperationQueue(lease);
  const batteryWaiters = new Set<(level: number | null) => void>();
  let adapterOpen = false;
  let connectedDeviceId: string | null = null;
  let dataServiceId: string | null = null;
  let dataCharacteristicId: string | null = null;
  let batteryServiceId: string | null = null;
  let batteryReadId: string | null = null;
  let batteryWriteId: string | null = null;
  let dataNotificationsEnabled = false;
  let batteryNotificationsEnabled = false;
  let listener: ((result: CharacteristicValueChange) => void) | null = null;
  let stateListener: ((result: BleConnectionStateChange) => void) | null = null;
  let previousHistory: number[] | null = null;
  let lastBattery: number | null = null;
  let active = false;
  let closing = false;
  let disconnectPromise: Promise<void> | null = null;

  const writeBatteryRequest = (): Promise<void> => writeQueue.enqueue(() => {
    if (closing || !active || !connectedDeviceId || !batteryServiceId || !batteryWriteId) {
      throw new GiikerBleError('gatt-unavailable', '该魔方不支持电量读取');
    }
    return invokeBleForLease(lease, (callbacks) => api.writeBLECharacteristicValue({
      ...callbacks,
      characteristicId: batteryWriteId as string,
      deviceId: connectedDeviceId as string,
      serviceId: batteryServiceId as string,
      value: new Uint8Array([GIIKER_COMMAND_BATTERY]).buffer,
    })).then(() => undefined);
  }, options.signal);

  const disconnect = (): Promise<void> => {
    if (disconnectPromise) return disconnectPromise;
    disconnectPromise = (async () => {
      const releaseCleanupBarrier = beginBleResourceCleanup(lease);
      closing = true;
      active = false;
      const pendingWrites = writeQueue.drain();
      for (const resolve of batteryWaiters) resolve(lastBattery);
      batteryWaiters.clear();
      if (listener) api.offBLECharacteristicValueChange(listener);
      listener = null;
      if (stateListener) api.offBLEConnectionStateChange?.(stateListener);
      stateListener = null;

      const finishCleanup = async (): Promise<void> => {
        try {
          await pendingWrites;
          const disable = async (
            enabled: boolean,
            serviceId: string | null,
            characteristicId: string | null,
          ): Promise<void> => {
            if (!enabled || !connectedDeviceId || !serviceId || !characteristicId) return;
            await ignoreBleFailure(() => invokeBleCleanupForLease(
              lease,
              (callbacks) => api.notifyBLECharacteristicValueChange({
                ...callbacks,
                characteristicId,
                deviceId: connectedDeviceId as string,
                serviceId,
                state: false,
              }),
            ));
          };
          await disable(dataNotificationsEnabled, dataServiceId, dataCharacteristicId);
          await disable(batteryNotificationsEnabled, batteryServiceId, batteryReadId);
          dataNotificationsEnabled = false;
          batteryNotificationsEnabled = false;
          if (connectedDeviceId) {
            await ignoreBleFailure(() => invokeBleCleanupForLease(
              lease,
              (callbacks) => api.closeBLEConnection({
                ...callbacks,
                deviceId: connectedDeviceId as string,
              }),
            ));
            connectedDeviceId = null;
          }
          if (adapterOpen) {
            await ignoreBleFailure(() => invokeBleCleanupForLease(
              lease,
              (callbacks) => api.closeBluetoothAdapter(callbacks),
            ));
            adapterOpen = false;
          }
        } finally {
          releaseCleanupBarrier();
        }
      };
      const cleanup = finishCleanup();
      if (await waitForBleCleanupDrain(pendingWrites)) await cleanup;
      else void cleanup.catch(() => {});
    })();
    return disconnectPromise;
  };

  try {
    try {
      const closeAdapter = (): Promise<unknown> => invokeBleCleanupForLease(
        lease,
        (callbacks) => api.closeBluetoothAdapter(callbacks),
      );
      await raceBleAbortWithLateCleanup(
        invokeBleWithLateCleanupForLease(
          lease,
          (callbacks) => api.openBluetoothAdapter(callbacks),
          closeAdapter,
        ),
        options.signal,
        closeAdapter,
      );
      adapterOpen = true;
    } catch (error) {
      if (error instanceof BleOperationAbortedError) throw error;
      throw new GiikerBleError('adapter-unavailable', '蓝牙不可用，请开启系统蓝牙后重试', {
        cause: error,
      });
    }

    const device = await findGiiker(api, lease, scanTimeoutMs, options.signal);
    connectedDeviceId = device.deviceId;
    try {
      const closeConnection = (): Promise<unknown> => invokeBleCleanupForLease(
        lease,
        (callbacks) => api.closeBLEConnection({ ...callbacks, deviceId: device.deviceId }),
      );
      await raceBleAbortWithLateCleanup(
        invokeBleWithLateCleanupForLease(
          lease,
          (callbacks) => api.createBLEConnection({
            ...callbacks,
            deviceId: device.deviceId,
            timeout: 10_000,
          }),
          closeConnection,
        ),
        options.signal,
        closeConnection,
      );
    } catch (error) {
      if (error instanceof BleOperationAbortedError) throw error;
      throw new GiikerBleError('connection-failed', '智能魔方连接失败', { cause: error });
    }
    active = true;
    stateListener = (result): void => {
      if (active && !closing && result.deviceId === connectedDeviceId && !result.connected) {
        safeBleCallback(options.onDisconnect
          ? () => options.onDisconnect?.('智能魔方连接已断开')
          : undefined);
        void disconnect();
      }
    };
    api.onBLEConnectionStateChange?.(stateListener);

    const services = await raceBleAbort(
      invokeBleForLease<{ services: BleService[] }>(lease, (callbacks) =>
        api.getBLEDeviceServices({ ...callbacks, deviceId: device.deviceId })),
      options.signal,
    );
    const dataService = services.services.find((candidate) =>
      normalizeBleUuid(candidate.uuid) === GIIKER_DATA_SERVICE_UUID);
    if (!dataService) throw new GiikerBleError('gatt-unavailable', '智能魔方通信服务不可用');
    dataServiceId = dataService.uuid;
    const dataCharacteristics = await raceBleAbort(
      invokeBleForLease<{ characteristics: BleCharacteristic[] }>(lease, (callbacks) =>
        api.getBLEDeviceCharacteristics({
          ...callbacks,
          deviceId: device.deviceId,
          serviceId: dataService.uuid,
        })),
      options.signal,
    );
    const dataCharacteristic = dataCharacteristics.characteristics.find((candidate) =>
      normalizeBleUuid(candidate.uuid) === GIIKER_NOTIFY_CHARACTERISTIC_UUID
      && Boolean(candidate.properties?.notify || candidate.properties?.indicate));
    if (!dataCharacteristic) {
      throw new GiikerBleError('gatt-unavailable', '智能魔方通信特征不可用');
    }
    dataCharacteristicId = dataCharacteristic.uuid;

    const rwService = services.services.find((candidate) =>
      normalizeBleUuid(candidate.uuid) === GIIKER_RW_SERVICE_UUID);
    if (rwService) {
      const rwCharacteristics = await raceBleAbort(
        invokeBleForLease<{ characteristics: BleCharacteristic[] }>(lease, (callbacks) =>
          api.getBLEDeviceCharacteristics({
            ...callbacks,
            deviceId: device.deviceId,
            serviceId: rwService.uuid,
          })),
        options.signal,
      );
      const read = rwCharacteristics.characteristics.find((candidate) =>
        normalizeBleUuid(candidate.uuid) === GIIKER_READ_CHARACTERISTIC_UUID
        && Boolean(candidate.properties?.notify || candidate.properties?.indicate));
      const write = rwCharacteristics.characteristics.find((candidate) =>
        normalizeBleUuid(candidate.uuid) === GIIKER_WRITE_CHARACTERISTIC_UUID
        && Boolean(candidate.properties?.write || candidate.properties?.writeNoResponse));
      if (read && write) {
        batteryServiceId = rwService.uuid;
        batteryReadId = read.uuid;
        batteryWriteId = write.uuid;
      }
    }

    listener = (result): void => {
      if (!active || result.deviceId !== connectedDeviceId) return;
      if (dataServiceId && dataCharacteristicId
        && normalizeBleUuid(result.serviceId) === normalizeBleUuid(dataServiceId)
        && normalizeBleUuid(result.characteristicId) === normalizeBleUuid(dataCharacteristicId)) {
        try {
          const frame = parseGiikerFrame(result.value, previousHistory);
          if (!frame) return;
          previousHistory = frame.history;
          for (const move of frame.moves) {
            safeBleCallback(options.onMove ? () => options.onMove?.(move) : undefined);
          }
          if (frame.facelets) {
            safeBleCallback(options.onState ? () => options.onState?.(frame.facelets as string) : undefined);
          }
        } catch { /* Ignore malformed device frames. */ }
        return;
      }
      if (batteryServiceId && batteryReadId
        && normalizeBleUuid(result.serviceId) === normalizeBleUuid(batteryServiceId)
        && normalizeBleUuid(result.characteristicId) === normalizeBleUuid(batteryReadId)) {
        const value = new DataView(result.value);
        const level = value.byteLength >= 2 ? value.getUint8(1) : -1;
        if (level < 0 || level > 100) return;
        lastBattery = level;
        safeBleCallback(options.onBattery ? () => options.onBattery?.(level) : undefined);
        for (const resolve of batteryWaiters) resolve(level);
        batteryWaiters.clear();
      }
    };
    api.onBLECharacteristicValueChange(listener);
    await raceBleAbort(invokeBleForLease(lease, (callbacks) =>
      api.notifyBLECharacteristicValueChange({
        ...callbacks,
        characteristicId: dataCharacteristic.uuid,
        deviceId: device.deviceId,
        serviceId: dataService.uuid,
        state: true,
      })), options.signal);
    dataNotificationsEnabled = true;
    if (api.readBLECharacteristicValue) {
      await ignoreBleFailure(() => raceBleAbort(
        invokeBleForLease(lease, (callbacks) => api.readBLECharacteristicValue?.({
          ...callbacks,
          characteristicId: dataCharacteristic.uuid,
          deviceId: device.deviceId,
          serviceId: dataService.uuid,
        })),
        options.signal,
      ));
    }

    return {
      deviceId: device.deviceId,
      deviceName: device.name || device.localName,
      disconnect,
      async requestBattery(): Promise<number | null> {
        if (!batteryServiceId || !batteryReadId || !batteryWriteId) return lastBattery;
        if (!batteryNotificationsEnabled) {
          await raceBleAbort(invokeBleForLease(lease, (callbacks) =>
            api.notifyBLECharacteristicValueChange({
              ...callbacks,
              characteristicId: batteryReadId as string,
              deviceId: connectedDeviceId as string,
              serviceId: batteryServiceId as string,
              state: true,
            })), options.signal);
          batteryNotificationsEnabled = true;
        }
        let finish: (level: number | null) => void = () => {};
        const response = new Promise<number | null>((resolve) => {
          let finished = false;
          finish = (level): void => {
            if (finished) return;
            finished = true;
            batteryWaiters.delete(finish);
            resolve(level);
          };
          batteryWaiters.add(finish);
          setTimeout(() => finish(lastBattery), 1_500);
        });
        try {
          await writeBatteryRequest();
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
