import { miniProgramApi } from '../platform';
import { tr } from '../i18n';
import { matchesGanV2Name } from '@cuberoot/shared/smart-cube/gan-v2';
import { matchesGanV3Name } from '@cuberoot/shared/smart-cube/gan-v3';
import { matchesGanV4Name } from '@cuberoot/shared/smart-cube/gan-v4';
import { matchesGiikerName } from '@cuberoot/shared/smart-cube/giiker';
import { matchesGoCubeName } from '@cuberoot/shared/smart-cube/gocube';
import { matchesMoyuName } from '@cuberoot/shared/smart-cube/moyu';
import {
  beginBleResourceCleanup,
  bluetoothAdapterErrorMessage,
  claimBleResourceLease,
  ignoreBleFailure,
  invokeBleCleanupForLease,
  invokeBleWithLateCleanupForLease,
  raceBleAbortWithLateCleanup,
  waitForBleCleanupDrain,
  waitForBleNativeOperations,
  BleOperationAbortedError,
  type BleAbortSignal,
  type DiscoveredDevice,
  type MiniProgramBleApi,
} from './ble-api';

export type DetectableSmartCubeDriver = 'gan-v4' | 'giiker' | 'gocube' | 'moyu';

const DEFAULT_SCAN_TIMEOUT_MS = 6_000;

export function classifySmartCubeDriver(
  device: DiscoveredDevice | string,
): DetectableSmartCubeDriver | null {
  const names = (typeof device === 'string'
    ? [device]
    : [device.name, device.localName])
    .map((name) => name?.trim() ?? '')
    .filter(Boolean);
  const matches = (matcher: (name: string) => boolean): boolean => names.some(matcher);
  if (names.length === 0) return null;

  if (matches(matchesGoCubeName)) return 'gocube';
  if (matches(matchesMoyuName)) return 'moyu';
  if (matches(matchesGanV4Name) || matches(matchesGanV3Name)) return 'gan-v4';
  if (matches(matchesGiikerName)) return 'giiker';
  if (matches(matchesGanV2Name)) return 'gan-v4';
  return null;
}

export async function discoverSmartCubeDriver(options: {
  api?: MiniProgramBleApi;
  scanTimeoutMs?: number;
  signal?: BleAbortSignal;
} = {}): Promise<DetectableSmartCubeDriver> {
  const api = options.api ?? (miniProgramApi() as unknown as MiniProgramBleApi);
  const scanTimeoutMs = options.scanTimeoutMs ?? DEFAULT_SCAN_TIMEOUT_MS;
  if (!Number.isFinite(scanTimeoutMs) || scanTimeoutMs < 1_000 || scanTimeoutMs > 30_000) {
    throw new RangeError('scanTimeoutMs must be between 1000 and 30000.');
  }

  const lease = claimBleResourceLease(api);
  let adapterOpen = false;
  let discoveryStarted = false;
  let listener: ((result: { devices: DiscoveredDevice[] }) => void) | null = null;
  const stopDiscovery = (): Promise<unknown> => invokeBleCleanupForLease(
    lease,
    (callbacks) => api.stopBluetoothDevicesDiscovery(callbacks),
  );
  const closeAdapter = (): Promise<unknown> => invokeBleCleanupForLease(
    lease,
    (callbacks) => api.closeBluetoothAdapter(callbacks),
  );

  try {
    try {
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
      throw new Error(bluetoothAdapterErrorMessage(error), { cause: error });
    }

    return await new Promise<DetectableSmartCubeDriver>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let offAbort = (): void => {};
      const finish = (result: DetectableSmartCubeDriver | Error): void => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        offAbort();
        if (result instanceof Error) reject(result);
        else resolve(result);
      };

      listener = (result): void => {
        for (const device of result.devices) {
          const driver = classifySmartCubeDriver(device);
          if (driver) {
            finish(driver);
            return;
          }
        }
      };
      api.onBluetoothDeviceFound(listener);
      offAbort = options.signal?.onAbort(() => finish(new BleOperationAbortedError())) ?? offAbort;
      if (settled) return;

      timer = setTimeout(() => finish(new Error(tr({
        en: 'No smart cube found. Turn the cube to wake it up and try again.',
        zh: '未发现智能魔方，请转动魔方将它唤醒后重试',
      }))), scanTimeoutMs);

      const startDiscovery = invokeBleWithLateCleanupForLease(
        lease,
        (callbacks) => api.startBluetoothDevicesDiscovery({
          ...callbacks,
          allowDuplicatesKey: true,
        }),
        stopDiscovery,
      );
      void raceBleAbortWithLateCleanup(
        startDiscovery,
        options.signal,
        stopDiscovery,
      ).then(() => {
        discoveryStarted = true;
      }).catch((error: unknown) => {
        finish(error instanceof BleOperationAbortedError
          ? error
          : new Error(tr({
            en: 'Unable to search for nearby smart cubes',
            zh: '无法搜索附近的智能魔方',
          }), { cause: error }));
      });
    });
  } finally {
    if (listener) api.offBluetoothDeviceFound(listener);
    const releaseCleanupBarrier = beginBleResourceCleanup(lease);
    try {
      if (discoveryStarted || adapterOpen) await ignoreBleFailure(stopDiscovery);
      await waitForBleCleanupDrain(waitForBleNativeOperations(lease));
      if (adapterOpen) await ignoreBleFailure(closeAdapter);
      await waitForBleCleanupDrain(waitForBleNativeOperations(lease));
    } finally {
      releaseCleanupBarrier();
    }
  }
}
