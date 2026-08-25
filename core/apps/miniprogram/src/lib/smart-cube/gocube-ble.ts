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
  type CharacteristicValueChange,
  type BleConnectionStateChange,
  type DiscoveredDevice,
  type MiniProgramBleApi,
  type BleResourceLease,
} from './ble-api';

export type GoCubeBleApi = MiniProgramBleApi;

export interface GoCubeBleConnection {
  readonly deviceId: string;
  disconnect(): Promise<void>;
  requestBattery(): Promise<number | null>;
}

export interface ConnectGoCubeOptions {
  api?: GoCubeBleApi;
  signal?: BleAbortSignal;
  onBattery?(level: number): void;
  onDisconnect?(message: string): void;
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

async function findGoCube(
  api: GoCubeBleApi,
  lease: BleResourceLease,
  timeoutMs: number,
  signal: BleAbortSignal | undefined,
): Promise<DiscoveredDevice> {
  return new Promise<DiscoveredDevice>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let offAbort = (): void => {};

    const finish = (result: DiscoveredDevice | Error): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      offAbort();
      api.offBluetoothDeviceFound(onFound);
      void ignoreBleFailure(
        () => invokeBleCleanupForLease(lease, (callbacks) => {
          api.stopBluetoothDevicesDiscovery(callbacks);
        }),
      );
      if (result instanceof Error) reject(result);
      else resolve(result);
    };

    const onFound = (result: { devices: DiscoveredDevice[] }): void => {
      const device = result.devices.find((candidate) =>
        Boolean(candidate.deviceId)
        && (matchesGoCubeName(candidate.name) || matchesGoCubeName(candidate.localName)));
      if (device) finish(device);
    };

    api.onBluetoothDeviceFound(onFound);
    offAbort = signal?.onAbort(() => finish(new BleOperationAbortedError())) ?? offAbort;
    if (settled) return;
    timer = setTimeout(() => {
      finish(new GoCubeBleError('device-not-found', '未发现 GoCube 或 Rubik’s Connected'));
    }, timeoutMs);

    const stopDiscovery = (): Promise<unknown> => invokeBleCleanupForLease(
      lease,
      (callbacks) => api.stopBluetoothDevicesDiscovery(callbacks),
    );
    const startDiscovery = invokeBleWithLateCleanupForLease(
      lease,
      (callbacks) => api.startBluetoothDevicesDiscovery({
        ...callbacks,
        allowDuplicatesKey: false,
      }),
      stopDiscovery,
    );
    void raceBleAbortWithLateCleanup(
      startDiscovery,
      signal,
      stopDiscovery,
    ).catch((error: unknown) => {
      if (error instanceof BleOperationAbortedError) {
        finish(error);
        return;
      }
      finish(new GoCubeBleError(
        'adapter-unavailable',
        error instanceof Error ? error.message : '无法开始搜索智能魔方',
        { cause: error },
      ));
    });
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
  const lease = claimBleResourceLease(api);

  let adapterOpen = false;
  let connectedDeviceId: string | null = null;
  let serviceId: string | null = null;
  let writeCharacteristicId: string | null = null;
  let notifyCharacteristicId: string | null = null;
  let notificationListener: ((result: CharacteristicValueChange) => void) | null = null;
  let connectionStateListener: ((result: BleConnectionStateChange) => void) | null = null;
  let notificationsEnabled = false;
  let active = false;
  let lastBattery: number | null = null;
  let movesSinceAck = 0;
  let disconnectPromise: Promise<void> | null = null;
  let closing = false;
  const writeQueue = createBleNativeOperationQueue(lease);
  const batteryWaiters = new Set<(level: number | null) => void>();

  const writeCommand = (command: number): Promise<void> => {
    return writeQueue.enqueue(() => {
      if (closing || !active || !connectedDeviceId || !serviceId || !writeCharacteristicId) {
        throw new GoCubeBleError('connection-failed', '智能魔方连接已断开');
      }
      const deviceId = connectedDeviceId;
      const currentServiceId = serviceId;
      const characteristicId = writeCharacteristicId;
      return invokeBleForLease(lease, (callbacks) => api.writeBLECharacteristicValue({
        ...callbacks,
        characteristicId,
        deviceId,
        serviceId: currentServiceId,
        value: createGoCubeCommand(command),
      })).then(() => undefined);
    }, options.signal);
  };

  const disconnect = (): Promise<void> => {
    if (disconnectPromise) return disconnectPromise;
    disconnectPromise = (async () => {
      const releaseCleanupBarrier = beginBleResourceCleanup(lease);
      closing = true;
      active = false;
      const pendingWrites = writeQueue.drain();
      for (const resolve of batteryWaiters) resolve(lastBattery);
      batteryWaiters.clear();

      if (notificationListener) {
        api.offBLECharacteristicValueChange(notificationListener);
        notificationListener = null;
      }
      if (connectionStateListener) {
        api.offBLEConnectionStateChange?.(connectionStateListener);
        connectionStateListener = null;
      }
      const finishCleanup = async (): Promise<void> => {
        try {
          await pendingWrites;
          if (notificationsEnabled && connectedDeviceId && serviceId && notifyCharacteristicId) {
            await ignoreBleFailure(
              () => invokeBleCleanupForLease(lease, (callbacks) => api.notifyBLECharacteristicValueChange({
                ...callbacks,
                characteristicId: notifyCharacteristicId as string,
                deviceId: connectedDeviceId as string,
                serviceId: serviceId as string,
                state: false,
              })),
            );
            notificationsEnabled = false;
          }
          if (connectedDeviceId) {
            await ignoreBleFailure(() => invokeBleCleanupForLease(lease, (callbacks) => api.closeBLEConnection({
              ...callbacks,
              deviceId: connectedDeviceId as string,
            })));
            connectedDeviceId = null;
          }
          if (adapterOpen) {
            await ignoreBleFailure(
              () => invokeBleCleanupForLease(lease, (callbacks) => api.closeBluetoothAdapter(callbacks)),
            );
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

  const reportUnexpectedDisconnect = (message: string): void => {
    if (!active || closing) return;
    safeBleCallback(options.onDisconnect ? () => options.onDisconnect?.(message) : undefined);
    void disconnect();
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
      throw new GoCubeBleError('adapter-unavailable', '蓝牙不可用，请开启系统蓝牙后重试', {
        cause: error,
      });
    }

    const device = await findGoCube(api, lease, scanTimeoutMs, options.signal);
    connectedDeviceId = device.deviceId;
    try {
      const closeConnection = (): Promise<unknown> => invokeBleCleanupForLease(
        lease,
        (callbacks) => api.closeBLEConnection({
          ...callbacks,
          deviceId: device.deviceId,
        }),
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
      throw new GoCubeBleError('connection-failed', '智能魔方连接失败', { cause: error });
    }
    active = true;
    connectionStateListener = (result): void => {
      if (result.deviceId === connectedDeviceId && !result.connected) {
        reportUnexpectedDisconnect('智能魔方连接已断开');
      }
    };
    api.onBLEConnectionStateChange?.(connectionStateListener);

    const services = await raceBleAbort(
      invokeBleForLease<{ services: import('./ble-api').BleService[] }>(lease, (callbacks) =>
        api.getBLEDeviceServices({ ...callbacks, deviceId: device.deviceId })),
      options.signal,
    );
    const service = services.services.find((candidate) =>
      normalizeBleUuid(candidate.uuid) === GOCUBE_SERVICE_UUID);
    if (!service) {
      throw new GoCubeBleError('gatt-unavailable', '智能魔方通信服务不可用');
    }
    serviceId = service.uuid;

    const characteristics = await raceBleAbort(
      invokeBleForLease<{ characteristics: import('./ble-api').BleCharacteristic[] }>(lease, (callbacks) =>
        api.getBLEDeviceCharacteristics({
          ...callbacks,
          deviceId: device.deviceId,
          serviceId: service.uuid,
        })),
      options.signal,
    );
    const writeCharacteristic = characteristics.characteristics.find((candidate) =>
      normalizeBleUuid(candidate.uuid) === GOCUBE_WRITE_CHARACTERISTIC_UUID
      && Boolean(candidate.properties?.write || candidate.properties?.writeNoResponse));
    const notifyCharacteristic = characteristics.characteristics.find((candidate) =>
      normalizeBleUuid(candidate.uuid) === GOCUBE_NOTIFY_CHARACTERISTIC_UUID
      && Boolean(candidate.properties?.notify || candidate.properties?.indicate));
    if (!writeCharacteristic || !notifyCharacteristic) {
      throw new GoCubeBleError('gatt-unavailable', '智能魔方通信特征不可用');
    }
    writeCharacteristicId = writeCharacteristic.uuid;
    notifyCharacteristicId = notifyCharacteristic.uuid;
    notificationListener = (result): void => {
      if (!active
        || result.deviceId !== connectedDeviceId
        || normalizeBleUuid(result.serviceId) !== normalizeBleUuid(serviceId as string)
        || normalizeBleUuid(result.characteristicId) !== normalizeBleUuid(notifyCharacteristicId as string)) {
        return;
      }

      const notification = parseGoCubeNotification(result.value);
      if (!notification) return;
      if (notification.type === 'moves') {
        for (const move of notification.moves) {
          safeBleCallback(options.onMove ? () => options.onMove?.(move) : undefined);
          movesSinceAck++;
        }
        if (movesSinceAck > GOCUBE_STATE_REACK_AFTER_MOVES) {
          movesSinceAck = 0;
          void writeCommand(GOCUBE_COMMAND_STATE).catch(() => {});
        }
      } else if (notification.type === 'state') {
        safeBleCallback(options.onState ? () => options.onState?.(notification.facelets) : undefined);
      } else if (notification.type === 'orientation') {
        safeBleCallback(options.onGyro ? () => options.onGyro?.(notification.quaternion) : undefined);
      } else if (notification.type === 'battery') {
        lastBattery = notification.level;
        safeBleCallback(options.onBattery ? () => options.onBattery?.(notification.level) : undefined);
        for (const resolve of batteryWaiters) resolve(notification.level);
        batteryWaiters.clear();
      }
    };
    api.onBLECharacteristicValueChange(notificationListener);
    await raceBleAbort(invokeBleForLease(lease, (callbacks) => api.notifyBLECharacteristicValueChange({
      ...callbacks,
      characteristicId: notifyCharacteristic.uuid,
      deviceId: device.deviceId,
      serviceId: service.uuid,
      state: true,
    })), options.signal);
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
