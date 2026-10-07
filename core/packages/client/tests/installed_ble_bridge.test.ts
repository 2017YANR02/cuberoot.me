// @vitest-environment jsdom
import { MessageChannel } from 'node:worker_threads';
import { afterEach, expect, it, vi } from 'vitest';
import { installedBleDeviceMac, requestInstalledBleDevice, setInstalledBleBridge } from '@/lib/installed-ble-bridge';
import type { InstalledBleMessage, InstalledBleRequest } from '@cuberoot/shared/mobile-embed';
const service = '0000180f-0000-1000-8000-00805f9b34fb';
const characteristic = '00002a19-0000-1000-8000-00805f9b34fb';
afterEach(() => { setInstalledBleBridge(null); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('routes existing GATT consumers through the native port, preserves notifications and reconnects', async () => {
  vi.stubGlobal('MessageChannel', MessageChannel);
  const calls: InstalledBleRequest[] = [];
  let post!: (message: InstalledBleMessage) => void;
  vi.spyOn(window.parent, 'postMessage').mockImplementation(((_message: unknown, _origin: unknown, transfer?: Transferable[]) => {
    const port = (transfer as unknown as import('node:worker_threads').MessagePort[])[0];
    post = message => port.postMessage(message);
    port.on('message', (r: InstalledBleRequest & { dispose?: boolean }) => {
      if (r.dispose) { port.close(); return; }
      calls.push(r);
      const value = r.op === 'pick' ? { id: 'AA:BB:CC:DD:EE:FF', name: 'GAN test', manufacturerData: [] }
        : r.op === 'services' ? [{ uuid: service, characteristics: [{ uuid: characteristic, properties: { write: true } }] }]
        : r.op === 'read' ? [83] : undefined;
      post({ id: r.id, ok: true, value });
    });
  }) as typeof window.postMessage);
  setInstalledBleBridge('capacitor://localhost');
  const device = await requestInstalledBleDevice({ filters: [{ namePrefix: 'GAN' }], optionalServices: [service] });
  expect(installedBleDeviceMac(device)?.toLowerCase()).toBe('aa:bb:cc:dd:ee:ff');
  const server = await device.gatt!.connect();
  const c = await (await server.getPrimaryService(0x180f)).getCharacteristic(0x2a19);
  expect((await c.readValue()).getUint8(0)).toBe(83);
  await c.writeValue(new Uint8Array([7, 42, 9]).subarray(1, 2));
  expect(calls.at(-1)?.bytes).toEqual([42]);
  const notified = new Promise<number>(resolve => c.addEventListener('characteristicvaluechanged', () => resolve(c.value!.getUint8(0))));
  await c.startNotifications(); post({ event: 'value', service, characteristic, bytes: [64] });
  expect(await notified).toBe(64);
  const lost = new Promise<void>(resolve => device.addEventListener('gattserverdisconnected', () => resolve()));
  post({ event: 'disconnected' }); await lost;
  expect(server.connected).toBe(false);
  await server.connect(); expect(server.connected).toBe(true);
  expect(calls.filter(r => r.op === 'connect')).toHaveLength(2);
  server.disconnect();
  await server.connect(); expect(server.connected).toBe(true);
  setInstalledBleBridge(null);
  await expect(server.connect()).rejects.toThrow('disconnected');
});
