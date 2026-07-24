/**
 * Fake Web Bluetooth GATT stack for driver tests.
 *
 * Lets `driver.start(server, onMove, ctx)` run COMPLETELY UNMODIFIED against a
 * scripted device: no driver source is touched to make it testable.
 *
 * Implements only the surface `app/[lang]/timer/_lib/bluetooth/driver.ts`
 * declares: getPrimaryService(s) / getCharacteristic(s) / startNotifications /
 * writeValue{,WithResponse,WithoutResponse} / readValue and the
 * `characteristicvaluechanged` event (a real `EventTarget`, so `ev.target` and
 * listener removal behave like the browser).
 */

export interface FakeWrite {
  uuid: string;
  kind: 'withResponse' | 'withoutResponse' | 'plain';
  bytes: number[];
}

export class FakeCharacteristic extends EventTarget {
  readonly uuid: string;
  value?: DataView;
  notifying = false;
  service!: FakeService;
  /** Every host -> cube write, in order. */
  readonly writes: FakeWrite[];
  /** Bytes `readValue()` should hand back (battery reads, etc.). */
  readBytes: number[] | null = null;
  /** Force writes to reject (exercises driver error paths). */
  failWrites = false;

  constructor(uuid: string, writes: FakeWrite[]) {
    super();
    this.uuid = uuid;
    this.writes = writes;
  }

  async startNotifications(): Promise<FakeCharacteristic> {
    this.notifying = true;
    return this;
  }

  async stopNotifications(): Promise<FakeCharacteristic> {
    this.notifying = false;
    return this;
  }

  async readValue(): Promise<DataView> {
    const src = this.readBytes ?? [];
    const ab = new ArrayBuffer(src.length);
    new Uint8Array(ab).set(Uint8Array.from(src));
    return new DataView(ab);
  }

  private record(kind: FakeWrite['kind'], value: BufferSource): void {
    if (this.failWrites) throw new Error('fake write failure');
    const u8 = value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(
          (value as ArrayBufferView).buffer,
          (value as ArrayBufferView).byteOffset,
          (value as ArrayBufferView).byteLength,
        );
    this.writes.push({ uuid: this.uuid, kind, bytes: Array.from(u8) });
  }

  async writeValue(value: BufferSource): Promise<void> { this.record('plain', value); }
  async writeValueWithResponse(value: BufferSource): Promise<void> { this.record('withResponse', value); }
  async writeValueWithoutResponse(value: BufferSource): Promise<void> { this.record('withoutResponse', value); }

  /** Simulate a notification: set `.value` and fire `characteristicvaluechanged`. */
  emit(bytes: ArrayLike<number>): void {
    const ab = new ArrayBuffer(bytes.length);
    const u8 = new Uint8Array(ab);
    for (let i = 0; i < bytes.length; i++) u8[i] = Number(bytes[i]) & 0xff;
    this.value = new DataView(ab);
    this.dispatchEvent(new Event('characteristicvaluechanged'));
  }
}

export class FakeService {
  readonly uuid: string;
  readonly device: FakeDevice;
  private readonly chars = new Map<string, FakeCharacteristic>();

  constructor(uuid: string, charUuids: string[], device: FakeDevice, writes: FakeWrite[]) {
    this.uuid = uuid;
    this.device = device;
    for (const cu of charUuids) {
      const c = new FakeCharacteristic(cu, writes);
      c.service = this;
      this.chars.set(cu.toLowerCase(), c);
    }
  }

  async getCharacteristic(uuid: string | number): Promise<FakeCharacteristic> {
    const c = this.chars.get(normalizeUuid(uuid));
    if (!c) throw new Error(`FakeService(${this.uuid}): no characteristic ${uuid}`);
    return c;
  }

  async getCharacteristics(): Promise<FakeCharacteristic[]> {
    return [...this.chars.values()];
  }
}

export class FakeDevice extends EventTarget {
  readonly id: string;
  readonly name?: string;
  gatt!: FakeGattServer;

  constructor(name?: string) {
    super();
    this.name = name;
    this.id = `fake-${name ?? 'anon'}`;
  }

  async watchAdvertisements(): Promise<void> { /* no advertisements in tests */ }
}

export class FakeGattServer {
  readonly device: FakeDevice;
  connected = true;
  /** Every write on every characteristic of this server, chronologically. */
  readonly writes: FakeWrite[] = [];
  private readonly services = new Map<string, FakeService>();

  constructor(device: FakeDevice, serviceMap: Record<string, string[]>) {
    this.device = device;
    for (const [su, cus] of Object.entries(serviceMap)) {
      this.services.set(normalizeUuid(su), new FakeService(su, cus, device, this.writes));
    }
    device.gatt = this;
  }

  async connect(): Promise<FakeGattServer> { this.connected = true; return this; }
  disconnect(): void { this.connected = false; }

  async getPrimaryService(uuid: string | number): Promise<FakeService> {
    const s = this.services.get(normalizeUuid(uuid));
    if (!s) throw new Error(`FakeGattServer: no service ${uuid}`);
    return s;
  }

  async getPrimaryServices(): Promise<FakeService[]> {
    return [...this.services.values()];
  }

  /** Convenience: reach a characteristic without awaiting the GATT dance. */
  char(serviceUuid: string, charUuid: string): FakeCharacteristic {
    const s = this.services.get(normalizeUuid(serviceUuid));
    if (!s) throw new Error(`FakeGattServer: no service ${serviceUuid}`);
    // getCharacteristic is async but the map lookup is not — reuse it.
    const found = [...(s as unknown as { chars: Map<string, FakeCharacteristic> }).chars.values()]
      .find((c) => c.uuid.toLowerCase() === String(charUuid).toLowerCase());
    if (!found) throw new Error(`FakeGattServer: no characteristic ${charUuid}`);
    return found;
  }
}

/**
 * Web Bluetooth accepts both 128-bit strings and 16-bit numeric aliases
 * (0x180f). Normalize both to the lower-case 128-bit form so lookups match.
 */
function normalizeUuid(uuid: string | number): string {
  if (typeof uuid === 'number') {
    return `0000${uuid.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`;
  }
  const s = uuid.toLowerCase();
  if (/^[0-9a-f]{4}$/.test(s)) return `0000${s}-0000-1000-8000-00805f9b34fb`;
  return s;
}

export interface FakeGattHandle {
  device: FakeDevice;
  server: FakeGattServer;
  /** Typed as the driver expects; identical object. */
  asServer: BluetoothRemoteGATTServer;
  writes: FakeWrite[];
  char(serviceUuid: string, charUuid: string): FakeCharacteristic;
}

/** Build a fake device + GATT server with the given service/characteristic map. */
export function makeFakeGatt(
  deviceName: string,
  serviceMap: Record<string, string[]>,
): FakeGattHandle {
  const device = new FakeDevice(deviceName);
  const server = new FakeGattServer(device, serviceMap);
  return {
    device,
    server,
    asServer: server as unknown as BluetoothRemoteGATTServer,
    writes: server.writes,
    char: (s, c) => server.char(s, c),
  };
}
