import type {
  BleDeviceRef,
  BleServiceRef,
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
  rssi: number;
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

function deviceRef(selected: NativeBleDevice): BleDeviceRef {
  const manufacturerData = new Map(selected.manufacturerData.map(
    entry => [entry.companyId, Uint8Array.from(entry.value)] as const,
  ));
  return {
    id: selected.id,
    name: selected.name,
    rssi: selected.rssi,
    manufacturerData: manufacturerData.size ? manufacturerData : undefined,
  };
}

interface ConnectionLease {
  transport: HarmonyBleTransport;
  deviceId: string;
}

let connectionOwner: ConnectionLease | undefined;

export class HarmonyBleTransport implements BleTransport {
  initialize(): Promise<void> {
    return bridgeCall<void>(nativeBridge().bleInitialize());
  }

  async requestDevice(options: BleRequestOptions): Promise<BleDeviceRef> {
    const selected = await bridgeCall<NativeBleDevice>(
      nativeBridge().bleRequestDevice(JSON.stringify(options.namePrefixes ?? [options.namePrefix])),
    );
    return deviceRef(selected);
  }

  async scanDevices(options: BleRequestOptions, onDevices: (devices: readonly BleDeviceRef[]) => void): Promise<() => Promise<void>> {
    const id = crypto.randomUUID();
    const found = new Map<string, BleDeviceRef>();
    const onScan = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; devices: NativeBleDevice[] }>).detail;
      if (detail?.id !== id) return;
      for (const entry of detail.devices) {
        const device = deviceRef(entry);
        device.manufacturerData ??= found.get(device.id)?.manufacturerData;
        found.set(device.id, device);
      }
      onDevices([...found.values()]);
    };
    window.addEventListener('cuberoot:ble-scan', onScan);
    try {
      const prefixes = options.namePrefixes ?? (options.namePrefix ? [options.namePrefix] : []);
      await bridgeCall<void>(nativeBridge().bleStartScan(id, JSON.stringify(prefixes), JSON.stringify(options.services ?? [])));
    } catch (error) {
      window.removeEventListener('cuberoot:ble-scan', onScan);
      throw error;
    }
    return async () => {
      window.removeEventListener('cuberoot:ble-scan', onScan);
      await bridgeCall<void>(nativeBridge().bleStopScan(id));
    };
  }

  async connect(deviceId: string, onDisconnect: () => void): Promise<void> {
    if (connectionOwner) throw new Error('Bluetooth connection already active');
    const lease = { transport: this, deviceId };
    connectionOwner = lease;
    disconnectListeners.set(deviceId, () => {
      if (connectionOwner !== lease) return;
      connectionOwner = undefined;
      onDisconnect();
    });
    try {
      await bridgeCall<void>(nativeBridge().bleConnect(deviceId));
    } catch (error) {
      if (connectionOwner === lease) {
        connectionOwner = undefined;
        disconnectListeners.delete(deviceId);
      }
      throw error;
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    const lease = connectionOwner;
    if (lease?.transport !== this || lease.deviceId !== deviceId) return;
    clearDeviceListeners(deviceId);
    try {
      await bridgeCall<void>(nativeBridge().bleDisconnect(deviceId));
    } finally {
      if (connectionOwner === lease) connectionOwner = undefined;
    }
  }

  private requireConnection(deviceId: string): void {
    if (connectionOwner?.transport !== this || connectionOwner.deviceId !== deviceId) {
      throw new Error('No active Bluetooth connection');
    }
  }

  getServices(deviceId: string): Promise<BleServiceRef[]> {
    this.requireConnection(deviceId);
    return bridgeCall<BleServiceRef[]>(nativeBridge().bleGetServices(deviceId));
  }

  getMtu(deviceId: string): Promise<number | null> {
    this.requireConnection(deviceId);
    return bridgeCall<number | null>(nativeBridge().bleGetMtu(deviceId));
  }

  async read(deviceId: string, service: string, characteristic: string): Promise<DataView> {
    this.requireConnection(deviceId);
    return dataView(await bridgeCall<number[]>(nativeBridge().bleRead(deviceId, service, characteristic)));
  }

  async write(
    deviceId: string,
    service: string,
    characteristic: string,
    value: Uint8Array,
  ): Promise<void> {
    this.requireConnection(deviceId);
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
    this.requireConnection(deviceId);
    const lease = connectionOwner;
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
      if (listeners.size || valueListeners.get(key) !== listeners || connectionOwner !== lease) return;
      valueListeners.delete(key);
      await bridgeCall<void>(nativeBridge().bleUnsubscribe(deviceId, service, characteristic));
    };
  }
}
