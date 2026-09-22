import {
  checkPermissions,
  connect as bleConnect,
  disconnect as bleDisconnect,
  getAdapterState,
  getMtu,
  listServices,
  read,
  send,
  startScan,
  stopScan,
  subscribe,
  unsubscribe,
  type BleDevice,
  type BleService,
} from '@mnlphlp/plugin-blec';
import type {
  BleDeviceRef,
  BleRequestOptions,
  BleServiceRef,
  BleTransport,
} from '@cuberoot/app-ui';

const SCAN_TIMEOUT_MS = 8_000;
const CHAR_READ = 0x02;
const CHAR_WRITE_WITHOUT_RESPONSE = 0x04;
const CHAR_WRITE = 0x08;
const CHAR_NOTIFY = 0x10;
const CHAR_INDICATE = 0x20;

function namePrefixes(options: BleRequestOptions): readonly string[] {
  return options.namePrefixes?.length ? options.namePrefixes : [options.namePrefix];
}

function toDeviceRef(device: BleDevice): BleDeviceRef {
  return {
    id: device.address,
    name: device.name,
    rssi: device.rssi,
    manufacturerData: new Map(Object.entries(device.manufacturerData)
      .map(([companyId, value]) => [Number(companyId), Uint8Array.from(value)])),
  };
}

function characteristicKey(service: string, characteristic: string): string {
  return `${service.toLowerCase()}/${characteristic.toLowerCase()}`;
}

function mapServices(services: BleService[]): BleServiceRef[] {
  return services.map((service) => ({
    uuid: service.uuid,
    characteristics: service.characteristics.map((characteristic) => ({
      uuid: characteristic.uuid,
      properties: {
        indicate: Boolean(characteristic.properties & CHAR_INDICATE),
        notify: Boolean(characteristic.properties & CHAR_NOTIFY),
        read: Boolean(characteristic.properties & CHAR_READ),
        write: Boolean(characteristic.properties & CHAR_WRITE),
        writeWithoutResponse: Boolean(characteristic.properties & CHAR_WRITE_WITHOUT_RESPONSE),
      },
    })),
  }));
}

export function namedDevices(devices: BleDevice[], prefixes: readonly string[]): BleDevice[] {
  const normalized = prefixes.map((prefix) => prefix.toLocaleLowerCase());
  const byAddress = new Map<string, BleDevice>();
  for (const device of devices) {
    const name = device.name.trim();
    if (!name || !normalized.some((prefix) => name.toLocaleLowerCase().startsWith(prefix))) continue;
    const previous = byAddress.get(device.address);
    if (!previous || device.rssi > previous.rssi) byAddress.set(device.address, { ...device, name });
  }
  return [...byAddress.values()].sort((left, right) => right.rssi - left.rssi);
}

export function nearestNamedDevice(devices: BleDevice[], namePrefix: string): BleDevice | undefined {
  return namedDevices(devices, [namePrefix])[0];
}

export class TauriBleTransport implements BleTransport {
  private readonly serviceCache = new Map<string, BleServiceRef[]>();
  private readonly writeModes = new Map<string, Map<string, 'withResponse' | 'withoutResponse'>>();

  async initialize(): Promise<void> {
    if (!await checkPermissions(true)) throw new Error('Bluetooth permission denied');
    if (await getAdapterState() !== 'On') throw new Error('Bluetooth unavailable');
  }

  async scanDevices(
    options: BleRequestOptions,
    onDevices: (devices: readonly BleDeviceRef[]) => void,
  ): Promise<() => Promise<void>> {
    await stopScan().catch(() => undefined);
    let active = true;
    await startScan((devices) => {
      if (!active) return;
      onDevices(namedDevices(devices, namePrefixes(options)).map(toDeviceRef));
    }, SCAN_TIMEOUT_MS);
    return async () => {
      if (!active) return;
      active = false;
      await stopScan();
    };
  }

  async requestDevice(options: BleRequestOptions): Promise<BleDeviceRef> {
    let selected: BleDeviceRef | undefined;
    const stop = await this.scanDevices(options, (devices) => {
      const next = devices[0];
      if (!next || selected && (next.rssi ?? Number.NEGATIVE_INFINITY)
        <= (selected.rssi ?? Number.NEGATIVE_INFINITY)) return;
      selected = next;
    });
    try {
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, SCAN_TIMEOUT_MS));
    } finally {
      await stop().catch(() => undefined);
    }
    if (!selected) throw new Error(options.pickerLabels.noDeviceFound);
    return selected;
  }

  async connect(deviceId: string, onDisconnect: () => void): Promise<void> {
    await bleConnect(deviceId, onDisconnect);
    const services = await this.loadServices(deviceId);
    const modes = new Map<string, 'withResponse' | 'withoutResponse'>();
    for (const service of services) {
      for (const characteristic of service.characteristics) {
        const mode = characteristic.properties.writeWithoutResponse && !characteristic.properties.write
          ? 'withoutResponse'
          : 'withResponse';
        modes.set(characteristicKey(service.uuid, characteristic.uuid), mode);
      }
    }
    this.writeModes.set(deviceId, modes);
  }

  async disconnect(deviceId: string): Promise<void> {
    try {
      await bleDisconnect();
    } finally {
      this.serviceCache.delete(deviceId);
      this.writeModes.delete(deviceId);
    }
  }

  async getServices(deviceId: string): Promise<BleServiceRef[]> {
    return this.serviceCache.get(deviceId) ?? this.loadServices(deviceId);
  }

  private async loadServices(deviceId: string): Promise<BleServiceRef[]> {
    const result = await listServices(deviceId);
    if (typeof result === 'string') throw new Error(result);
    const services = mapServices(result);
    this.serviceCache.set(deviceId, services);
    return services;
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
    let active = true;
    return async () => {
      if (!active) return;
      active = false;
      await unsubscribe(characteristic, service);
    };
  }

  write(
    deviceId: string,
    service: string,
    characteristic: string,
    value: Uint8Array,
  ): Promise<void> {
    const mode = this.writeModes.get(deviceId)?.get(characteristicKey(service, characteristic))
      ?? 'withResponse';
    return send(characteristic, Array.from(value), mode, service);
  }
}
