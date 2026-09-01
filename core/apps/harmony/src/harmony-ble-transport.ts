import type {
  BleDeviceRef,
  BleRequestOptions,
  BleTransport,
} from '@cuberoot/app-ui';

import { bridgeCall, nativeBridge } from './harmony-native';

interface NativeManufacturerData {
  companyId: number;
  value: number[];
}

interface NativeBleDevice {
  id: string;
  manufacturerData: NativeManufacturerData[];
  name: string;
}

interface NativeBleValueEvent {
  characteristic: string;
  deviceId: string;
  service: string;
  value: number[];
}

const disconnectListeners = new Map<string, () => void>();
const valueListeners = new Map<string, Set<(value: DataView) => void>>();

function characteristicKey(deviceId: string, service: string, characteristic: string): string {
  return `${deviceId}/${service.toLowerCase()}/${characteristic.toLowerCase()}`;
}

function dataView(value: number[]): DataView {
  const bytes = Uint8Array.from(value);
  return new DataView(bytes.buffer);
}

function clearDeviceListeners(deviceId: string): void {
  disconnectListeners.delete(deviceId);
  const prefix = `${deviceId}/`;
  for (const key of valueListeners.keys()) {
    if (key.startsWith(prefix)) valueListeners.delete(key);
  }
}

window.addEventListener('cuberoot:ble-disconnect', (event) => {
  const deviceId = (event as CustomEvent<unknown>).detail;
  if (typeof deviceId !== 'string') return;
  const listener = disconnectListeners.get(deviceId);
  clearDeviceListeners(deviceId);
  listener?.();
});

window.addEventListener('cuberoot:ble-value', (event) => {
  const detail = (event as CustomEvent<Partial<NativeBleValueEvent>>).detail;
  if (typeof detail.deviceId !== 'string'
    || typeof detail.service !== 'string'
    || typeof detail.characteristic !== 'string'
    || !Array.isArray(detail.value)) return;
  valueListeners.get(characteristicKey(detail.deviceId, detail.service, detail.characteristic))
    ?.forEach((listener) => listener(dataView(detail.value!)));
});

export class HarmonyBleTransport implements BleTransport {
  initialize(): Promise<void> {
    return bridgeCall<void>(nativeBridge().bleInitialize());
  }

  async requestDevice(options: BleRequestOptions): Promise<BleDeviceRef> {
    const selected = await bridgeCall<NativeBleDevice>(
      nativeBridge().bleRequestDevice(options.namePrefix),
    );
    const manufacturerData = new Map<number, Uint8Array>();
    for (const entry of selected.manufacturerData) {
      manufacturerData.set(entry.companyId, Uint8Array.from(entry.value));
    }
    return {
      id: selected.id,
      manufacturerData: manufacturerData.size > 0 ? manufacturerData : undefined,
      name: selected.name,
    };
  }

  async connect(deviceId: string, onDisconnect: () => void): Promise<void> {
    disconnectListeners.set(deviceId, onDisconnect);
    try {
      await bridgeCall<void>(nativeBridge().bleConnect(deviceId));
    } catch (error) {
      disconnectListeners.delete(deviceId);
      throw error;
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    clearDeviceListeners(deviceId);
    await bridgeCall<void>(nativeBridge().bleDisconnect(deviceId));
  }

  getMtu(deviceId: string): Promise<number | null> {
    return bridgeCall<number | null>(nativeBridge().bleGetMtu(deviceId));
  }

  async read(deviceId: string, service: string, characteristic: string): Promise<DataView> {
    return dataView(await bridgeCall<number[]>(nativeBridge().bleRead(deviceId, service, characteristic)));
  }

  async write(
    deviceId: string,
    service: string,
    characteristic: string,
    value: Uint8Array,
  ): Promise<void> {
    await bridgeCall<void>(nativeBridge().bleWrite(
      deviceId,
      service,
      characteristic,
      JSON.stringify(Array.from(value)),
    ));
  }

  async subscribe(
    deviceId: string,
    service: string,
    characteristic: string,
    onValue: (value: DataView) => void,
  ): Promise<() => Promise<void>> {
    const key = characteristicKey(deviceId, service, characteristic);
    const listeners = valueListeners.get(key) ?? new Set<(value: DataView) => void>();
    listeners.add(onValue);
    valueListeners.set(key, listeners);
    try {
      await bridgeCall<void>(nativeBridge().bleSubscribe(deviceId, service, characteristic));
    } catch (error) {
      listeners.delete(onValue);
      if (listeners.size === 0) valueListeners.delete(key);
      throw error;
    }
    let active = true;
    return async () => {
      if (!active) return;
      active = false;
      listeners.delete(onValue);
      if (listeners.size === 0) valueListeners.delete(key);
      await bridgeCall<void>(nativeBridge().bleUnsubscribe(deviceId, service, characteristic));
    };
  }
}
