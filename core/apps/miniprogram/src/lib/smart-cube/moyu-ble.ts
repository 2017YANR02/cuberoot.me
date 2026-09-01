import { miniProgramApi } from '../platform';
import { tr } from '../i18n';
import {
  MOYU_GYRO_CHARACTERISTIC_UUID,
  MOYU_READ_CHARACTERISTIC_UUID,
  MOYU_SERVICE_UUID,
  MOYU_TURN_CHARACTERISTIC_UUID,
  createMoyuDecodeState,
  matchesMoyuName,
  parseMoyuTurnFrame,
} from '@cuberoot/shared/smart-cube/moyu';
import {
  beginBleResourceCleanup,
  bluetoothAdapterErrorMessage,
  claimBleResourceLease,
  getBleSubscriptionType,
  ignoreBleFailure,
  invokeBleCleanupForLease,
  invokeBleForLease,
  invokeBleWithLateCleanupForLease,
  normalizeBleUuid,
  raceBleAbort,
  raceBleAbortWithLateCleanup,
  safeBleCallback,
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

export type MoyuBleApi = MiniProgramBleApi;

export interface MoyuBleConnection {
  readonly deviceId: string;
  readonly deviceName?: string;
  disconnect(): Promise<void>;
  requestBattery(): Promise<null>;
}

export interface ConnectMoyuOptions {
  api?: MoyuBleApi;
  signal?: BleAbortSignal;
  onDisconnect?(message: string): void;
  onMove?(move: string): void;
  scanTimeoutMs?: number;
}

export class MoyuBleError extends Error {
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
    this.name = 'MoyuBleError';
  }
}

async function findMoyu(
  api: MoyuBleApi,
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
        && (matchesMoyuName(candidate.name) || matchesMoyuName(candidate.localName)));
      if (device) finish(device);
    };
    api.onBluetoothDeviceFound(onFound);
    offAbort = signal?.onAbort(() => finish(new BleOperationAbortedError())) ?? offAbort;
    if (settled) return;
    timer = setTimeout(() => finish(new MoyuBleError(
      'device-not-found',
      tr({ en: 'No MoYu AI smart cube using the legacy protocol was found', zh: '未发现 MoYu AI 旧协议智能魔方' }),
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
      : new MoyuBleError(
        'adapter-unavailable',
        error instanceof Error ? error.message : tr({ en: 'Unable to start searching for a smart cube', zh: '无法开始搜索智能魔方' }),
        { cause: error },
      )));
  });
}

export async function connectMoyu(
  options: ConnectMoyuOptions = {},
): Promise<MoyuBleConnection> {
  const api = options.api ?? (miniProgramApi() as unknown as MoyuBleApi);
  const scanTimeoutMs = options.scanTimeoutMs ?? 10_000;
  if (!Number.isFinite(scanTimeoutMs) || scanTimeoutMs < 1_000 || scanTimeoutMs > 30_000) {
    throw new RangeError('scanTimeoutMs must be between 1000 and 30000.');
  }
  const lease = claimBleResourceLease(api);
  const faceStatus = createMoyuDecodeState();
  let adapterOpen = false;
  let connectedDeviceId: string | null = null;
  let serviceId: string | null = null;
  let turnCharacteristicId: string | null = null;
  let readCharacteristicId: string | null = null;
  let gyroCharacteristicId: string | null = null;
  let turnSubscriptionType: BleSubscriptionType | null = null;
  let readSubscriptionType: BleSubscriptionType | null = null;
  let gyroSubscriptionType: BleSubscriptionType | null = null;
  let turnNotificationsEnabled = false;
  let readNotificationsEnabled = false;
  let gyroNotificationsEnabled = false;
  let valueListener: ((result: CharacteristicValueChange) => void) | null = null;
  let stateListener: ((result: BleConnectionStateChange) => void) | null = null;
  let active = false;
  let closing = false;
  let disconnectPromise: Promise<void> | null = null;

  const disconnect = (): Promise<void> => {
    if (disconnectPromise) return disconnectPromise;
    disconnectPromise = (async () => {
      const releaseCleanupBarrier = beginBleResourceCleanup(lease);
      closing = true;
      active = false;
      if (valueListener) api.offBLECharacteristicValueChange(valueListener);
      valueListener = null;
      if (stateListener) api.offBLEConnectionStateChange?.(stateListener);
      stateListener = null;
      try {
        const disable = async (
          enabled: boolean,
          characteristicId: string | null,
          subscriptionType: BleSubscriptionType | null,
        ): Promise<void> => {
          if (!enabled || !connectedDeviceId || !serviceId || !characteristicId || !subscriptionType) return;
          await ignoreBleFailure(() => invokeBleCleanupForLease(
            lease,
            (callbacks) => api.notifyBLECharacteristicValueChange({
              ...callbacks,
              characteristicId,
              deviceId: connectedDeviceId as string,
              serviceId: serviceId as string,
              state: false,
              type: subscriptionType,
            }),
          ));
        };
        await disable(turnNotificationsEnabled, turnCharacteristicId, turnSubscriptionType);
        await disable(readNotificationsEnabled, readCharacteristicId, readSubscriptionType);
        await disable(gyroNotificationsEnabled, gyroCharacteristicId, gyroSubscriptionType);
        turnNotificationsEnabled = false;
        readNotificationsEnabled = false;
        gyroNotificationsEnabled = false;
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
    })();
    return disconnectPromise;
  };

  const ensureConnected = (): void => {
    if (closing || !active) {
      throw new MoyuBleError('connection-failed', tr({ en: 'Smart cube disconnected', zh: '智能魔方连接已断开' }));
    }
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
      throw new MoyuBleError('adapter-unavailable', bluetoothAdapterErrorMessage(error), {
        cause: error,
      });
    }

    const device = await findMoyu(api, lease, scanTimeoutMs, options.signal);
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
      throw new MoyuBleError('connection-failed', tr({ en: 'Failed to connect to the smart cube', zh: '智能魔方连接失败' }), { cause: error });
    }
    active = true;
    stateListener = (result): void => {
      if (active && !closing && result.deviceId === connectedDeviceId && !result.connected) {
        safeBleCallback(options.onDisconnect
          ? () => options.onDisconnect?.(tr({ en: 'Smart cube disconnected', zh: '智能魔方连接已断开' }))
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
    ensureConnected();
    const service = services.services.find((candidate) =>
      normalizeBleUuid(candidate.uuid) === MOYU_SERVICE_UUID);
    if (!service) throw new MoyuBleError('gatt-unavailable', tr({ en: 'Smart cube communication service is unavailable', zh: '智能魔方通信服务不可用' }));
    serviceId = service.uuid;

    const characteristics = await raceBleAbort(
      invokeBleForLease<{ characteristics: BleCharacteristic[] }>(lease, (callbacks) =>
        api.getBLEDeviceCharacteristics({
          ...callbacks,
          deviceId: device.deviceId,
          serviceId: service.uuid,
        })),
      options.signal,
    );
    ensureConnected();
    const notifyCharacteristic = (uuid: string): BleCharacteristic | undefined => (
      characteristics.characteristics.find((candidate) =>
        normalizeBleUuid(candidate.uuid) === uuid
        && Boolean(getBleSubscriptionType(candidate)))
    );
    const turn = notifyCharacteristic(MOYU_TURN_CHARACTERISTIC_UUID);
    const selectedTurnSubscriptionType = turn ? getBleSubscriptionType(turn) : undefined;
    if (!turn || !selectedTurnSubscriptionType) throw new MoyuBleError('gatt-unavailable', tr({ en: 'Smart cube move characteristic is unavailable', zh: '智能魔方转动特征不可用' }));
    const read = notifyCharacteristic(MOYU_READ_CHARACTERISTIC_UUID);
    const gyro = notifyCharacteristic(MOYU_GYRO_CHARACTERISTIC_UUID);
    turnCharacteristicId = turn.uuid;
    readCharacteristicId = read?.uuid ?? null;
    gyroCharacteristicId = gyro?.uuid ?? null;
    turnSubscriptionType = selectedTurnSubscriptionType;
    readSubscriptionType = read ? getBleSubscriptionType(read) ?? null : null;
    gyroSubscriptionType = gyro ? getBleSubscriptionType(gyro) ?? null : null;

    valueListener = (result): void => {
      if (!active || result.deviceId !== connectedDeviceId
        || normalizeBleUuid(result.serviceId) !== MOYU_SERVICE_UUID
        || normalizeBleUuid(result.characteristicId) !== MOYU_TURN_CHARACTERISTIC_UUID) return;
      try {
        for (const move of parseMoyuTurnFrame(result.value, faceStatus)) {
          safeBleCallback(options.onMove ? () => options.onMove?.(move) : undefined);
        }
      } catch { /* Ignore malformed device frames. */ }
    };
    api.onBLECharacteristicValueChange(valueListener);
    await raceBleAbort(invokeBleForLease(lease, (callbacks) =>
      api.notifyBLECharacteristicValueChange({
        ...callbacks,
        characteristicId: turn.uuid,
        deviceId: device.deviceId,
        serviceId: service.uuid,
        state: true,
        type: selectedTurnSubscriptionType,
      })), options.signal);
    turnNotificationsEnabled = true;

    const subscribeOptional = async (
      characteristic: BleCharacteristic | undefined,
      subscriptionType: BleSubscriptionType | null,
    ): Promise<boolean> => {
      if (!characteristic || !subscriptionType) return false;
      try {
        await raceBleAbort(invokeBleForLease(lease, (callbacks) =>
          api.notifyBLECharacteristicValueChange({
            ...callbacks,
            characteristicId: characteristic.uuid,
            deviceId: device.deviceId,
            serviceId: service.uuid,
            state: true,
            type: subscriptionType,
          })), options.signal);
        ensureConnected();
        return true;
      } catch (error) {
        if (error instanceof BleOperationAbortedError) throw error;
        return false;
      }
    };
    readNotificationsEnabled = await subscribeOptional(read, readSubscriptionType);
    gyroNotificationsEnabled = await subscribeOptional(gyro, gyroSubscriptionType);

    return {
      deviceId: device.deviceId,
      deviceName: device.name || device.localName,
      disconnect,
      async requestBattery(): Promise<null> {
        return null;
      },
    };
  } catch (error) {
    await disconnect();
    throw error;
  }
}
