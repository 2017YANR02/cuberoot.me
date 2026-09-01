import {
  checkPermissions,
  connect,
  disconnect,
  getAdapterState,
  getMtu,
  read,
  send,
  startScan,
  stopScan,
  subscribe,
  unsubscribe,
  type BleDevice,
} from '@mnlphlp/plugin-blec';
import type {
  BleDeviceRef,
  BleRequestOptions,
  BleTransport,
} from '@cuberoot/app-ui';

export function nearestNamedDevice(devices: BleDevice[], namePrefix: string): BleDevice | undefined {
  return devices
    .filter((device) => device.name.startsWith(namePrefix))
    .sort((left, right) => right.rssi - left.rssi)[0];
}

export class TauriBleTransport implements BleTransport {
  async initialize(): Promise<void> {
    if (!await checkPermissions(true)) throw new Error('Bluetooth permission denied');
    if (await getAdapterState() !== 'On') throw new Error('Bluetooth unavailable');
  }

  async requestDevice(options: BleRequestOptions): Promise<BleDeviceRef> {
    let selected: BleDevice | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = globalThis.setTimeout(resolve, 8_000);
        void startScan((devices) => {
          // ponytail: nearest-device choice avoids a second picker UI; add a shared chooser if multi-cube use is observed.
          const next = nearestNamedDevice(devices, options.namePrefix);
          if (next && (!selected || next.rssi > selected.rssi)) selected = next;
        }, 8_000).catch((error: unknown) => {
          globalThis.clearTimeout(timeout);
          reject(error);
        });
      });
    } finally {
      await stopScan().catch(() => undefined);
    }
    if (!selected) throw new Error(options.pickerLabels.noDeviceFound);
    return {
      id: selected.address,
      name: selected.name,
      manufacturerData: new Map(Object.entries(selected.manufacturerData)
        .map(([companyId, value]) => [Number(companyId), Uint8Array.from(value)])),
    };
  }

  connect(deviceId: string, onDisconnect: () => void): Promise<void> {
    return connect(deviceId, onDisconnect);
  }

  disconnect(): Promise<void> {
    return disconnect();
  }

  getMtu(): Promise<number> {
    return getMtu();
  }

  async read(_deviceId: string, service: string, characteristic: string): Promise<DataView> {
    const bytes = Uint8Array.from(await read(characteristic, service));
    return new DataView(bytes.buffer);
  }

  async subscribe(
    _deviceId: string,
    service: string,
    characteristic: string,
    onValue: (value: DataView) => void,
  ): Promise<() => Promise<void>> {
    await subscribe(characteristic, service, (value) => {
      const bytes = Uint8Array.from(value);
      onValue(new DataView(bytes.buffer));
    });
    return () => unsubscribe(characteristic, service);
  }

  write(
    _deviceId: string,
    service: string,
    characteristic: string,
    value: Uint8Array,
  ): Promise<void> {
    return send(characteristic, Array.from(value), 'withResponse', service);
  }
}
