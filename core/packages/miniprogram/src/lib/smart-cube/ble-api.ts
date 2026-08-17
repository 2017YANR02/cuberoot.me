export interface BleFailure {
  errCode?: number;
  errMsg?: string;
}

export interface BleCallbacks<T> {
  success?(result: T): void;
  fail?(error: BleFailure): void;
}

export interface DiscoveredDevice {
  advertisData?: ArrayBuffer;
  deviceId: string;
  localName?: string;
  name?: string;
  RSSI?: number;
}

export interface BleService {
  isPrimary?: boolean;
  uuid: string;
}

export interface BleCharacteristic {
  properties?: {
    indicate?: boolean;
    notify?: boolean;
    read?: boolean;
    write?: boolean;
    writeNoResponse?: boolean;
  };
  uuid: string;
}

export interface CharacteristicValueChange {
  characteristicId: string;
  deviceId: string;
  serviceId: string;
  value: ArrayBuffer;
}

export interface BleConnectionStateChange {
  connected: boolean;
  deviceId: string;
}

export interface BleAbortSignal {
  readonly aborted: boolean;
  onAbort(listener: () => void): () => void;
  track?(operation: Promise<unknown>): void;
}

export interface BleResourceLease {
  isCurrent(): boolean;
}

interface BleResourceState {
  owner?: symbol;
  pendingNativeOperations: number;
}

const BLE_RESOURCE_STATES = new WeakMap<object, BleResourceState>();
const BLE_RESOURCE_LEASE_STATES = new WeakMap<BleResourceLease, BleResourceState>();

export class BleResourceBusyError extends Error {
  constructor() {
    super('蓝牙资源仍在清理，请稍后重试；若持续无响应，请重启小程序');
    this.name = 'BleResourceBusyError';
  }
}

export function claimBleResourceLease(api: object): BleResourceLease {
  const state = BLE_RESOURCE_STATES.get(api) ?? {
    pendingNativeOperations: 0,
  };
  BLE_RESOURCE_STATES.set(api, state);
  if (state.pendingNativeOperations > 0) throw new BleResourceBusyError();

  const owner = Symbol('ble-resource-owner');
  state.owner = owner;
  const lease: BleResourceLease = {
    isCurrent: () => state.owner === owner,
  };
  BLE_RESOURCE_LEASE_STATES.set(lease, state);
  return lease;
}

export interface MiniProgramBleApi {
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
  offBLEConnectionStateChange?(listener: (result: BleConnectionStateChange) => void): void;
  offBLECharacteristicValueChange(listener: (result: CharacteristicValueChange) => void): void;
  offBluetoothDeviceFound(listener: (result: { devices: DiscoveredDevice[] }) => void): void;
  onBLECharacteristicValueChange(listener: (result: CharacteristicValueChange) => void): void;
  onBLEConnectionStateChange?(listener: (result: BleConnectionStateChange) => void): void;
  onBluetoothDeviceFound(listener: (result: { devices: DiscoveredDevice[] }) => void): void;
  openBluetoothAdapter(options: BleCallbacks<BleFailure>): void;
  startBluetoothDevicesDiscovery(options: {
    allowDuplicatesKey: boolean;
    services?: string[];
  } & BleCallbacks<BleFailure>): void;
  stopBluetoothDevicesDiscovery(options: BleCallbacks<BleFailure>): void;
  writeBLECharacteristicValue(options: {
    characteristicId: string;
    deviceId: string;
    serviceId: string;
    value: ArrayBuffer;
  } & BleCallbacks<BleFailure>): void;
}

export class BleOperationAbortedError extends Error {
  constructor() {
    super('蓝牙连接已取消');
    this.name = 'BleOperationAbortedError';
  }
}

export const BLE_OPERATION_TIMEOUT_MS = 12_000;
export const BLE_CLEANUP_TIMEOUT_MS = 2_000;

export class BleOperationTimeoutError extends Error {
  constructor() {
    super('微信蓝牙接口响应超时，请重试');
    this.name = 'BleOperationTimeoutError';
  }
}

export function invokeBle<T>(
  start: (callbacks: BleCallbacks<T>) => void,
  timeoutMs = BLE_OPERATION_TIMEOUT_MS,
  onLateSuccess?: (value: T) => unknown,
): Promise<T> {
  return invokeBleInternal(start, timeoutMs, onLateSuccess);
}

function invokeBleInternal<T>(
  start: (callbacks: BleCallbacks<T>) => void,
  timeoutMs: number,
  onLateSuccess: ((value: T) => unknown) | undefined,
  onNativeSettled?: () => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let outcome: 'failure' | 'pending' | 'success' | 'timeout' = 'pending';
    let nativeSettled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settleNative = (): void => {
      if (nativeSettled) return;
      nativeSettled = true;
      onNativeSettled?.();
    };
    const settle = (
      nextOutcome: Exclude<typeof outcome, 'pending'>,
      finish: () => void,
    ): void => {
      if (outcome !== 'pending') return;
      outcome = nextOutcome;
      if (timer !== undefined) clearTimeout(timer);
      finish();
    };
    const cleanLateSuccess = (value: T): void => {
      if (!onLateSuccess || outcome === 'success' || outcome === 'pending') return;
      try {
        void Promise.resolve(onLateSuccess(value)).catch(() => {});
      } catch {
        // A late native success must never surface an unhandled cleanup error.
      }
    };
    const effectiveTimeout = Number.isFinite(timeoutMs) && timeoutMs >= 0
      ? timeoutMs
      : BLE_OPERATION_TIMEOUT_MS;
    timer = setTimeout(() => {
      settle('timeout', () => reject(new BleOperationTimeoutError()));
    }, effectiveTimeout);
    try {
      start({
        success: (value) => {
          settleNative();
          if (outcome !== 'pending') {
            cleanLateSuccess(value);
            return;
          }
          settle('success', () => resolve(value));
        },
        fail: (error) => {
          settleNative();
          settle(
            'failure',
            () => reject(new Error(error.errMsg ?? '微信蓝牙接口调用失败')),
          );
        },
      });
    } catch (error) {
      settleNative();
      settle('failure', () => reject(error));
    }
  });
}

export function invokeBleForLease<T>(
  lease: BleResourceLease,
  start: (callbacks: BleCallbacks<T>) => void,
  timeoutMs = BLE_OPERATION_TIMEOUT_MS,
  onLateSuccess?: (value: T) => unknown,
): Promise<T> {
  if (!lease.isCurrent()) return Promise.reject(new BleOperationAbortedError());
  const state = BLE_RESOURCE_LEASE_STATES.get(lease);
  if (!state) return Promise.reject(new BleOperationAbortedError());

  state.pendingNativeOperations++;
  return invokeBleInternal(start, timeoutMs, onLateSuccess, () => {
    state.pendingNativeOperations = Math.max(0, state.pendingNativeOperations - 1);
  });
}

export function invokeBleCleanup<T>(start: (callbacks: BleCallbacks<T>) => void): Promise<T> {
  return invokeBle(start, BLE_CLEANUP_TIMEOUT_MS);
}

export function invokeBleCleanupForLease<T>(
  lease: BleResourceLease,
  start: (callbacks: BleCallbacks<T>) => void,
): Promise<T | undefined> {
  if (!lease.isCurrent()) return Promise.resolve(undefined);
  return invokeBleForLease(lease, start, BLE_CLEANUP_TIMEOUT_MS);
}

export function invokeBleWithLateCleanup<T>(
  start: (callbacks: BleCallbacks<T>) => void,
  cleanup: () => Promise<unknown>,
  timeoutMs = BLE_OPERATION_TIMEOUT_MS,
): Promise<T> {
  return invokeBle(start, timeoutMs, cleanup);
}

export function invokeBleWithLateCleanupForLease<T>(
  lease: BleResourceLease,
  start: (callbacks: BleCallbacks<T>) => void,
  cleanup: () => Promise<unknown>,
  timeoutMs = BLE_OPERATION_TIMEOUT_MS,
): Promise<T> {
  return invokeBleForLease(lease, start, timeoutMs, cleanup);
}

export function raceBleAbort<T>(
  operation: Promise<T>,
  signal: BleAbortSignal | undefined,
): Promise<T> {
  if (!signal) return operation;
  signal.track?.(operation);
  if (signal.aborted) {
    void operation.catch(() => {});
    return Promise.reject(new BleOperationAbortedError());
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const offAbort = signal.onAbort(() => {
      if (settled) return;
      settled = true;
      reject(new BleOperationAbortedError());
    });
    operation.then(
      (value) => {
        if (settled) return;
        settled = true;
        offAbort();
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        offAbort();
        reject(error);
      },
    );
  });
}

export function raceBleAbortWithLateCleanup<T>(
  operation: Promise<T>,
  signal: BleAbortSignal | undefined,
  cleanup: () => Promise<unknown>,
): Promise<T> {
  if (!signal) return operation;

  let aborted = signal.aborted;
  const offAbort = signal.onAbort(() => {
    aborted = true;
  });
  const trackedOperation = operation.then(
    async (value) => {
      offAbort();
      if (aborted) await ignoreBleFailure(cleanup);
      return value;
    },
    (error: unknown) => {
      offAbort();
      throw error;
    },
  );
  return raceBleAbort(trackedOperation, signal);
}

export function normalizeBleUuid(uuid: string): string {
  return uuid.toLowerCase();
}

export function safeBleCallback(callback: (() => void) | undefined): void {
  try {
    callback?.();
  } catch {
    // Consumer callbacks must not break the BLE transport loop.
  }
}

export async function ignoreBleFailure(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch {
    // Cleanup is best-effort and idempotent.
  }
}
