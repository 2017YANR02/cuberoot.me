import { INSTALLED_BLE_OPEN, type InstalledBleMessage, type InstalledBleRequest } from '@cuberoot/shared/mobile-embed';
import { extractMacFromManufacturerData, macAdvSpecsForDevice } from '@/app/[lang]/timer/_lib/bluetooth/mac';
import { normalizeMac } from '@cuberoot/shared/timer/external/mac';
import { tr } from '@/i18n/tr';
import type {} from '@/app/[lang]/timer/_lib/bluetooth/driver';

let parentOrigin: string | null = null;
const connections = new Set<() => void>();
const listeners = new Set<() => void>();
export function subscribeInstalledBleBridge(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
const nativeMacs = new WeakMap<BluetoothDevice, string>();
export function installedBleAvailable(): boolean { return parentOrigin !== null; }
export function installedBleDeviceMac(device: BluetoothDevice): string | null { return nativeMacs.get(device) ?? null; }
export function setInstalledBleBridge(origin: string | null): void {
  if (origin === parentOrigin) return;
  for (const close of connections) close();
  parentOrigin = origin;
  for (const listener of listeners) listener();
}
interface Service { uuid: string; characteristics: { uuid: string; properties: { write?: boolean; writeWithoutResponse?: boolean } }[] }
const uuid = (value: string | number): string => typeof value === 'number'
  ? `${value.toString(16).padStart(8, '0')}-0000-1000-8000-00805f9b34fb` : value.toLowerCase();

/** A narrow GATT facade; all existing Web protocol drivers remain the consumers. */
export async function requestInstalledBleDevice(options: RequestDeviceOptions): Promise<BluetoothDevice> {
  if (!parentOrigin) throw new Error('Native Bluetooth unavailable');
  const channel = new MessageChannel();
  const port = channel.port1;
  let nextId = 0;
  let closed = false;
  let connected = false;
  let generation = 0;
  const device = new EventTarget() as BluetoothDevice;
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timeout: ReturnType<typeof setTimeout> }>();
  const characteristics = new Map<string, BluetoothRemoteGATTCharacteristic>();
  const values = new Map<string, DataView>();
  const rejectPending = () => {
    for (const p of pending.values()) { clearTimeout(p.timeout); p.reject(new Error('Native Bluetooth disconnected')); }
    pending.clear();
  };
  const close = () => {
    if (closed) return;
    closed = true;
    generation++;
    port.postMessage({ dispose: true });
    port.close();
    connections.delete(close);
    window.removeEventListener('pagehide', close);
    rejectPending();
    connected = false;
    device.dispatchEvent(new Event('gattserverdisconnected'));
  };
  connections.add(close);
  window.addEventListener('pagehide', close);
  const call = (request: Omit<InstalledBleRequest, 'id'>): Promise<unknown> => {
    if (closed) return Promise.reject(new Error('Native Bluetooth disconnected'));
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(close, request.op === 'pick' ? 60_000 : 15_000);
      pending.set(id, { resolve, reject, timeout });
      port.postMessage({ ...request, id });
    });
  };
  port.onmessage = ({ data }: MessageEvent<InstalledBleMessage>) => {
    if (closed || !data || typeof data !== 'object') return;
    if ('event' in data) {
      if (data.event === 'closed') { close(); return; }
      if (data.event === 'disconnected') {
        generation++;
        connected = false;
        rejectPending();
        device.dispatchEvent(new Event('gattserverdisconnected'));
        return;
      }
      const key = `${data.service}/${data.characteristic}`;
      const characteristic = characteristics.get(key);
      if (!characteristic) return;
      values.set(key, new DataView(Uint8Array.from(data.bytes).buffer));
      characteristic.dispatchEvent(new Event('characteristicvaluechanged'));
      return;
    }
    const p = pending.get(data.id);
    if (!p) return;
    pending.delete(data.id); clearTimeout(p.timeout);
    if (data.ok) p.resolve(data.value); else p.reject(new Error(data.error));
  };
  window.parent.postMessage({ type: INSTALLED_BLE_OPEN }, parentOrigin, [channel.port2]);
  try {
    const prefixes = options.filters?.flatMap(f => f.namePrefix ? [f.namePrefix] : f.name ? [f.name] : []) ?? [];
    const selected = await call({ op: 'pick', options: {
      namePrefix: prefixes[0] ?? '', namePrefixes: prefixes,
      services: prefixes.length ? undefined : options.filters?.flatMap(f => f.services?.map(uuid) ?? []),
      optionalServices: options.optionalServices?.map(uuid), captureManufacturerData: true,
      pickerLabels: {
        availableDevices: tr({ en: 'Available devices', zh: '可用设备' }), cancel: tr({ en: 'Cancel', zh: '取消' }),
        noDeviceFound: tr({ en: 'No device found', zh: '未发现设备' }), scanning: tr({ en: 'Scanning', zh: '正在搜索' }),
      },
    } }) as { id: string; name: string; macAddress?: string; manufacturerData: [number, number[]][] };
    Object.defineProperties(device, { id: { value: selected.id }, name: { value: selected.name } });
    const manufacturerData = new Map((selected.manufacturerData ?? []).map(([id, bytes]) =>
      [id, new DataView(Uint8Array.from(bytes).buffer)]));
    const mac = normalizeMac(selected.macAddress) ?? normalizeMac(selected.id)
      ?? extractMacFromManufacturerData(manufacturerData, macAdvSpecsForDevice(selected.name));
    if (mac && mac !== '00:00:00:00:00:00') nativeMacs.set(device, mac);
    let services: BluetoothRemoteGATTService[] = [];
    const server: BluetoothRemoteGATTServer = {
      device,
      get connected() { return connected; },
      async connect() {
        if (connected) return server;
        const attempt = ++generation;
        await call({ op: 'connect' });
        if (closed || attempt !== generation) throw new Error('Native Bluetooth disconnected');
        const discovered = await call({ op: 'services' }) as Service[];
        if (closed || attempt !== generation) throw new Error('Native Bluetooth disconnected');
        services = discovered.map(description => {
          const service: BluetoothRemoteGATTService = {
            uuid: description.uuid.toLowerCase(), device,
            async getCharacteristic(id) {
              const result = await service.getCharacteristics(id);
              if (!result[0]) throw new Error('Bluetooth characteristic unavailable');
              return result[0];
            },
            async getCharacteristics(id) {
              return description.characteristics.filter(c => id === undefined || c.uuid.toLowerCase() === uuid(id)).map(c => {
                const characteristicId = c.uuid.toLowerCase();
                const key = `${service.uuid}/${characteristicId}`;
                const existing = characteristics.get(key);
                if (existing) return existing;
                const characteristic = new EventTarget() as BluetoothRemoteGATTCharacteristic;
                const params = { service: service.uuid, characteristic: characteristicId };
                const write = async (value: BufferSource) => {
                  const bytes = ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : new Uint8Array(value);
                  await call({ op: 'write', ...params, bytes: Array.from(bytes) });
                };
                Object.defineProperties(characteristic, {
                  uuid: { value: characteristicId }, service: { value: service }, properties: { value: c.properties },
                  value: { get: () => values.get(key) },
                });
                Object.assign(characteristic, {
                  async readValue() { const bytes = await call({ op: 'read', ...params }) as number[]; return new DataView(Uint8Array.from(bytes).buffer); },
                  writeValue: write, writeValueWithResponse: write, writeValueWithoutResponse: write,
                  async startNotifications() { await call({ op: 'subscribe', ...params }); return characteristic; },
                  async stopNotifications() { if (!closed) await call({ op: 'unsubscribe', ...params }); return characteristic; },
                });
                characteristics.set(key, characteristic);
                return characteristic;
              });
            },
          };
          return service;
        });
        connected = true;
        return server;
      },
      disconnect() {
        if (closed) return;
        generation++;
        connected = false;
        rejectPending();
        void call({ op: 'disconnect' }).catch(close);
        device.dispatchEvent(new Event('gattserverdisconnected'));
      },
      async getPrimaryService(id) {
        const service = services.find(s => s.uuid === uuid(id));
        if (!service) throw new Error('Bluetooth service unavailable');
        return service;
      },
      async getPrimaryServices(id) { return id === undefined ? services : services.filter(s => s.uuid === uuid(id)); },
    };
    Object.defineProperty(device, 'gatt', { value: server });
    return device;
  } catch (error) { close(); throw error; }
}
