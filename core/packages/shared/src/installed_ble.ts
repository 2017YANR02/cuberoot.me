/** Structured-clone contract for the canonical Tools frame and its native host. */
export const INSTALLED_BLE_OPEN = 'cuberoot:mobile:ble-open';
export type InstalledBleOperation = 'pick' | 'connect' | 'services' | 'read' | 'write' | 'subscribe' | 'unsubscribe' | 'disconnect';
export interface InstalledBleRequest {
  id: number;
  op: InstalledBleOperation;
  service?: string;
  characteristic?: string;
  bytes?: number[];
  options?: {
    namePrefix: string;
    namePrefixes?: string[];
    services?: string[];
    optionalServices?: string[];
    captureManufacturerData: boolean;
    pickerLabels: { availableDevices: string; cancel: string; noDeviceFound: string; scanning: string };
  };
}
export type InstalledBleMessage =
  | { id: number; ok: true; value?: unknown }
  | { id: number; ok: false; error: string }
  | { event: 'disconnected' }
  | { event: 'closed' }
  | { event: 'value'; service: string; characteristic: string; bytes: number[] };
const operations = new Set<InstalledBleOperation>(['pick', 'connect', 'services', 'read', 'write', 'subscribe', 'unsubscribe', 'disconnect']);
const uuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 64 && v.every(s => typeof s === 'string' && s.length <= 128);
export function decodeInstalledBleRequest(value: unknown): InstalledBleRequest | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as InstalledBleRequest;
  if (!Number.isSafeInteger(r.id) || r.id < 1 || !operations.has(r.op)) return null;
  if (['read', 'write', 'subscribe', 'unsubscribe'].includes(r.op) && (!uuid(r.service) || !uuid(r.characteristic))) return null;
  if (r.op === 'write' && (!Array.isArray(r.bytes) || r.bytes.length > 512 || !r.bytes.every(n => Number.isInteger(n) && n >= 0 && n <= 255))) return null;
  if (r.op === 'pick') {
    const o = r.options;
    if (!o || typeof o.namePrefix !== 'string' || o.namePrefix.length > 128 || o.captureManufacturerData !== true) return null;
    if (o.namePrefixes !== undefined && !strings(o.namePrefixes)) return null;
    for (const list of [o.services, o.optionalServices]) if (list !== undefined && (!strings(list) || !list.every(uuid))) return null;
    if (!o.pickerLabels || !['availableDevices', 'cancel', 'noDeviceFound', 'scanning'].every(k => {
      const s = o.pickerLabels[k as keyof typeof o.pickerLabels];
      return typeof s === 'string' && s.length <= 200;
    })) return null;
  }
  return r;
}
