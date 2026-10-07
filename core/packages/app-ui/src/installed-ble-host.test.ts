import { describe, expect, it, vi } from 'vitest';
import { decodeInstalledBleRequest, type InstalledBleMessage } from '@cuberoot/shared/mobile-embed';
import { InstalledBleHost, installedBleRequestPort } from './installed-ble-host';
import { pickInstalledBleDevice, type InstalledBlePicker } from './installed-ble-picker';
import type { BleDeviceRef, BleTransport } from './smart-cube/transport';
const service = '0000180f-0000-1000-8000-00805f9b34fb';
const characteristic = '00002a19-0000-1000-8000-00805f9b34fb';
const options = { namePrefix: 'GAN', captureManufacturerData: true as const, pickerLabels: { availableDevices: 'Devices', cancel: 'Cancel', noDeviceFound: 'None', scanning: 'Scanning' } };
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
function transport(): BleTransport {
  return { initialize: vi.fn(async () => {}), requestDevice: vi.fn(async () => ({ id: 'cube', name: 'GAN' })),
    connect: vi.fn(async () => {}), disconnect: vi.fn(async () => {}), getMtu: vi.fn(async () => 23),
    getServices: vi.fn(async () => []), read: vi.fn(async () => new DataView(Uint8Array.from([9, 80, 8]).buffer, 1, 1)),
    write: vi.fn(async () => {}), subscribe: vi.fn(async () => vi.fn(async () => {})) };
}
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
describe('installed Tools Bluetooth lease', () => {
  it('accepts only the current Tools window at the canonical origin with one transferred port', () => {
    const frame = {} as Window; const port = {} as MessagePort;
    const event = { origin: 'https://cuberoot.me', source: frame, data: { type: 'cuberoot:mobile:ble-open' }, ports: [port] } as unknown as MessageEvent;
    expect(installedBleRequestPort(event, frame, event.origin)).toBe(port);
    expect(installedBleRequestPort(event, {} as Window, event.origin)).toBeNull();
    expect(installedBleRequestPort(event, frame, 'https://attacker.invalid')).toBeNull();
    expect(installedBleRequestPort(event, null, event.origin)).toBeNull();
    expect(installedBleRequestPort({ ...event, ports: [] } as unknown as MessageEvent, frame, event.origin)).toBeNull();
  });
  it('rejects malformed commands and binary payloads', () => {
    expect(decodeInstalledBleRequest({ id: 1, op: 'write', service, characteristic, bytes: [256] })).toBeNull();
    expect(decodeInstalledBleRequest({ id: 1, op: 'read', service: 'invalid', characteristic })).toBeNull();
    expect(decodeInstalledBleRequest({ id: 1, op: 'pick', options: { ...options, optionalServices: ['invalid'] } })).toBeNull();
  });
  it('serializes GATT work, preserves DataView offsets and ignores duplicate requests', async () => {
    const native = transport(); const messages: InstalledBleMessage[] = [];
    const host = new InstalledBleHost(native, value => messages.push(value));
    host.receive({ id: 1, op: 'pick', options }); host.receive({ id: 2, op: 'connect' });
    host.receive({ id: 3, op: 'read', service, characteristic }); host.receive({ id: 3, op: 'read', service, characteristic });
    await flush();
    expect(native.read).toHaveBeenCalledOnce();
    expect(messages).toContainEqual({ id: 3, ok: true, value: [80] });
    await host.dispose();
    expect(native.disconnect).toHaveBeenCalledWith('cube');
  });
  it('cleans a late picker without publishing it or connecting after revocation', async () => {
    const native = transport(); const pick = deferred<BleDeviceRef>();
    native.requestDevice = vi.fn(() => pick.promise);
    const send = vi.fn(); const host = new InstalledBleHost(native, send);
    host.receive({ id: 1, op: 'pick', options }); await flush();
    const drain = host.dispose();
    host.receive({ id: 2, op: 'connect' });
    pick.resolve({ id: 'late', name: 'GAN' }); await drain;
    expect(send.mock.calls).toEqual([[{ event: 'closed' }]]);
    expect(native.connect).not.toHaveBeenCalled();
    expect(native.disconnect).toHaveBeenCalledWith('late');
  });
  it('cleans late notification registration and supports reconnect subscriptions', async () => {
    const native = transport(); const registration = deferred<() => Promise<void>>(); const stop = vi.fn(async () => {});
    native.subscribe = vi.fn(() => registration.promise);
    const host = new InstalledBleHost(native, vi.fn());
    host.receive({ id: 1, op: 'pick', options }); host.receive({ id: 2, op: 'subscribe', service, characteristic });
    await flush(); const drain = host.dispose(); registration.resolve(stop); await drain;
    expect(stop).toHaveBeenCalledOnce();
    expect(native.disconnect).toHaveBeenCalledOnce();
  });
  it('uses explicit selection rather than strongest RSSI and cancels cleanly', async () => {
    const native = transport(); const stop = vi.fn(async () => {});
    native.scanDevices = vi.fn(async (_options, update) => { update([{ id: 'near', name: 'GAN A', rssi: -20 }, { id: 'chosen', name: 'GAN B', rssi: -80 }]); return stop; });
    let picker: InstalledBlePicker | null = null;
    const abort = new AbortController();
    const promise = pickInstalledBleDevice(native, options, abort.signal, value => { picker = value; });
    await flush();
    (picker as InstalledBlePicker | null)?.select('chosen');
    expect((await promise).id).toBe('chosen'); expect(stop).toHaveBeenCalledOnce(); expect(native.requestDevice).not.toHaveBeenCalled();
    const pending = pickInstalledBleDevice(native, options, abort.signal, value => { picker = value; });
    await flush();
    abort.abort(); await expect(pending).rejects.toThrow('canceled');
    expect(picker).toBeNull(); expect(stop).toHaveBeenCalledTimes(2);
  });
});
