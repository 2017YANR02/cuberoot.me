import {
  BleClient,
  type BleDevice,
  type BleService,
  type ConnectClientOptions,
  type DisplayStrings,
  type InitializeOptions,
  type RequestBleDeviceOptions,
  type ScanResult,
  type TimeoutOptions,
} from '@capacitor-community/bluetooth-le';

import type { BleDeviceRef, BleRequestOptions, BleTransport } from './transport';

export interface NativeBleClientPort {
  connect(deviceId: string, onDisconnect?: (deviceId: string) => void, options?: ConnectClientOptions): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  getMtu(deviceId: string): Promise<number>;
  getServices(deviceId: string): Promise<BleService[]>;
  initialize(options?: InitializeOptions): Promise<void>;
  read(deviceId: string, service: string, characteristic: string, options?: TimeoutOptions): Promise<DataView>;
  requestDevice(options?: RequestBleDeviceOptions): Promise<BleDevice>;
  requestLEScan(options: RequestBleDeviceOptions, callback: (result: ScanResult) => void): Promise<void>;
  setDisplayStrings(displayStrings: DisplayStrings): Promise<void>;
  startNotifications(
    deviceId: string,
    service: string,
    characteristic: string,
    callback: (value: DataView) => void,
    options?: TimeoutOptions,
  ): Promise<void>;
  stopNotifications(deviceId: string, service: string, characteristic: string): Promise<void>;
  stopLEScan(): Promise<void>;
  write(
    deviceId: string,
    service: string,
    characteristic: string,
    value: DataView,
    options?: TimeoutOptions,
  ): Promise<void>;
  writeWithoutResponse(
    deviceId: string,
    service: string,
    characteristic: string,
    value: DataView,
    options?: TimeoutOptions,
  ): Promise<void>;
}

function dataView(bytes: Uint8Array): DataView {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new DataView(copy.buffer);
}

function characteristicKey(service: string, characteristic: string): string {
  return `${service.toLowerCase()}/${characteristic.toLowerCase()}`;
}

function isMacAddress(value: string): boolean {
  return /^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/i.test(value);
}

function copyManufacturerData(
  source: ScanResult['manufacturerData'],
): ReadonlyMap<number, Uint8Array> | undefined {
  if (!source) return undefined;
  const entries = Object.entries(source).flatMap(([companyId, value]) => {
    const parsedId = Number(companyId);
    if (!Number.isInteger(parsedId) || parsedId < 0 || parsedId > 0xffff) return [];
    const bytes = new Uint8Array(value.byteLength);
    bytes.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    return [[parsedId, bytes] as const];
  });
  return entries.length > 0 ? new Map(entries) : undefined;
}

const ADVERTISEMENT_CAPTURE_TIMEOUT_MS = 3_000;

export class NativeBleTransport implements BleTransport {
  private readonly writeModes = new Map<string, 'response' | 'without-response'>();

  constructor(private readonly client: NativeBleClientPort = BleClient) {}

  async initialize(): Promise<void> {
    await this.client.initialize({ androidNeverForLocation: true });
  }

  async requestDevice(options: BleRequestOptions): Promise<BleDeviceRef> {
    await this.client.setDisplayStrings(options.pickerLabels);
    const device = await this.client.requestDevice({
      namePrefix: options.namePrefix,
      optionalServices: options.optionalServices,
    });
    const selected = { id: device.deviceId, name: device.name || options.namePrefix };
    if (!options.captureManufacturerData || isMacAddress(selected.id)) return selected;

    const manufacturerData = await new Promise<ReadonlyMap<number, Uint8Array> | undefined>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (value: ReadonlyMap<number, Uint8Array> | undefined) => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        void this.client.stopLEScan().catch(() => undefined).finally(() => resolve(value));
      };

      void this.client.requestLEScan({
        name: selected.name,
        optionalServices: options.optionalServices,
        allowDuplicates: true,
      }, (result) => {
        if (result.device.deviceId !== selected.id) return;
        const captured = copyManufacturerData(result.manufacturerData);
        if (captured) finish(captured);
      }).then(() => {
        if (!settled) timer = setTimeout(() => finish(undefined), ADVERTISEMENT_CAPTURE_TIMEOUT_MS);
      }).catch(() => finish(undefined));
    });

    return { ...selected, manufacturerData };
  }

  async connect(deviceId: string, onDisconnect: () => void): Promise<void> {
    await this.client.connect(deviceId, onDisconnect);
    const services = await this.client.getServices(deviceId);
    for (const service of services) {
      for (const characteristic of service.characteristics) {
        const mode = characteristic.properties.writeWithoutResponse && !characteristic.properties.write
          ? 'without-response'
          : 'response';
        this.writeModes.set(characteristicKey(service.uuid, characteristic.uuid), mode);
      }
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    try {
      await this.client.disconnect(deviceId);
    } finally {
      this.writeModes.clear();
    }
  }

  async getMtu(deviceId: string): Promise<number | null> {
    try {
      return await this.client.getMtu(deviceId);
    } catch {
      return null;
    }
  }

  read(deviceId: string, service: string, characteristic: string): Promise<DataView> {
    return this.client.read(deviceId, service, characteristic);
  }

  async write(
    deviceId: string,
    service: string,
    characteristic: string,
    value: Uint8Array,
  ): Promise<void> {
    const view = dataView(value);
    const mode = this.writeModes.get(characteristicKey(service, characteristic));
    if (mode === 'without-response') {
      await this.client.writeWithoutResponse(deviceId, service, characteristic, view);
      return;
    }
    await this.client.write(deviceId, service, characteristic, view);
  }

  async subscribe(
    deviceId: string,
    service: string,
    characteristic: string,
    onValue: (value: DataView) => void,
  ): Promise<() => Promise<void>> {
    await this.client.startNotifications(deviceId, service, characteristic, onValue);
    let active = true;
    return async () => {
      if (!active) return;
      active = false;
      await this.client.stopNotifications(deviceId, service, characteristic);
    };
  }
}
