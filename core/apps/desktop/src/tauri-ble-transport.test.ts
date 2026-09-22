import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const bleMocks = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  listServices: vi.fn(),
  send: vi.fn(),
  startScan: vi.fn(),
  stopScan: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('@mnlphlp/plugin-blec', () => ({
  checkPermissions: vi.fn(),
  connect: bleMocks.connect,
  disconnect: bleMocks.disconnect,
  getAdapterState: vi.fn(),
  getMtu: vi.fn(),
  read: vi.fn(),
  listServices: bleMocks.listServices,
  send: bleMocks.send,
  startScan: bleMocks.startScan,
  stopScan: bleMocks.stopScan,
  subscribe: bleMocks.subscribe,
  unsubscribe: bleMocks.unsubscribe,
}));

import { namedDevices, nearestNamedDevice, TauriBleTransport } from './tauri-ble-transport';

beforeEach(() => {
  bleMocks.connect.mockResolvedValue(undefined);
  bleMocks.disconnect.mockResolvedValue(undefined);
  bleMocks.listServices.mockResolvedValue([]);
  bleMocks.send.mockResolvedValue(undefined);
  bleMocks.startScan.mockResolvedValue(undefined);
  bleMocks.stopScan.mockResolvedValue(undefined);
  bleMocks.subscribe.mockResolvedValue(undefined);
  bleMocks.unsubscribe.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('nearestNamedDevice', () => {
  it('selects the strongest matching GAN advertisement', () => {
    const device = nearestNamedDevice([
      { address: '1', name: 'Other', rssi: -1, isConnected: false, isBonded: false, services: [], manufacturerData: {}, serviceData: {} },
      { address: '2', name: 'GAN-A', rssi: -70, isConnected: false, isBonded: false, services: [], manufacturerData: {}, serviceData: {} },
      { address: '3', name: 'GAN-B', rssi: -40, isConnected: false, isBonded: false, services: [], manufacturerData: {}, serviceData: {} },
    ], 'GAN');

    expect(device?.address).toBe('3');
  });

  it('filters all supported prefixes case-insensitively, deduplicates addresses, and sorts by signal', () => {
    const devices = namedDevices([
      { address: 'gan', name: 'gan16ui', rssi: -65, isConnected: false, isBonded: false, services: [], manufacturerData: {}, serviceData: {} },
      { address: 'mg', name: 'MG-A1B2', rssi: -45, isConnected: false, isBonded: false, services: [], manufacturerData: {}, serviceData: {} },
      { address: 'aicube', name: 'AiCube-A1B2', rssi: -47, isConnected: false, isBonded: false, services: [], manufacturerData: {}, serviceData: {} },
      { address: 'gi', name: 'GiS-A1B2', rssi: -48, isConnected: false, isBonded: false, services: [], manufacturerData: {}, serviceData: {} },
      { address: 'moyu', name: 'WCU_MY32_A1B2', rssi: -72, isConnected: false, isBonded: false, services: [], manufacturerData: {}, serviceData: {} },
      { address: 'moyu', name: 'WCU_MY32_A1B2', rssi: -38, isConnected: false, isBonded: false, services: [], manufacturerData: {}, serviceData: {} },
      { address: 'qiyi', name: 'XMD-TornadoV4-i-1-A1B2', rssi: -50, isConnected: false, isBonded: false, services: [], manufacturerData: {}, serviceData: {} },
      { address: 'other', name: 'Other', rssi: -1, isConnected: false, isBonded: false, services: [], manufacturerData: {}, serviceData: {} },
    ], ['GAN', 'MG', 'AiCube', 'Gi', 'WCU_MY3', 'QY-QYSC', 'XMD-TornadoV4-i']);

    expect(devices.map((device) => device.address)).toEqual([
      'moyu', 'mg', 'aicube', 'gi', 'qiyi', 'gan',
    ]);
  });

  it('waits for delayed scan callbacks before selecting a device', async () => {
    vi.useFakeTimers();
    bleMocks.startScan.mockImplementation(async (handler: (devices: Array<Record<string, unknown>>) => void) => {
      globalThis.setTimeout(() => handler([{
        address: 'gan-16',
        name: 'GAN16ui',
        rssi: -35,
        isConnected: false,
        isBonded: false,
        services: [],
        manufacturerData: {},
        serviceData: {},
      }]), 100);
    });
    bleMocks.stopScan.mockResolvedValue(undefined);

    const pending = new TauriBleTransport().requestDevice({
      namePrefix: 'GAN',
      pickerLabels: {
        availableDevices: 'Available devices',
        cancel: 'Cancel',
        noDeviceFound: 'not found',
        scanning: 'Scanning',
      },
    });
    await vi.advanceTimersByTimeAsync(8_000);

    await expect(pending).resolves.toMatchObject({ id: 'gan-16', name: 'GAN16ui' });
    expect(bleMocks.stopScan).toHaveBeenCalledTimes(2);
  });

  it('streams a selectable multi-brand list and stops the scan idempotently', async () => {
    bleMocks.startScan.mockImplementation(async (handler) => {
      handler([
        { address: 'moyu', name: 'WCU_MY32_A1B2', rssi: -42, isConnected: false, isBonded: false, services: [], manufacturerData: {}, serviceData: {} },
        { address: 'gan', name: 'GAN16ui', rssi: -55, isConnected: false, isBonded: false, services: [], manufacturerData: {}, serviceData: {} },
      ]);
    });
    const updates: Array<readonly { id: string; name: string }[]> = [];
    const transport = new TauriBleTransport();
    const stop = await transport.scanDevices({
      namePrefix: 'GAN',
      namePrefixes: ['GAN', 'WCU_MY3'],
      pickerLabels: {
        availableDevices: 'Available devices', cancel: 'Cancel',
        noDeviceFound: 'not found', scanning: 'Scanning',
      },
    }, (devices) => updates.push(devices));

    expect(updates.at(-1)?.map((device) => device.name)).toEqual(['WCU_MY32_A1B2', 'GAN16ui']);
    await stop();
    await stop();
    expect(bleMocks.stopScan).toHaveBeenCalledTimes(2);
  });

  it('maps GATT properties and uses write without response when required', async () => {
    bleMocks.listServices.mockResolvedValue([{
      uuid: 'service',
      characteristics: [{ uuid: 'write', descriptors: [], properties: 0x14 }],
    }]);
    const transport = new TauriBleTransport();

    await transport.connect('moyu', vi.fn());
    await expect(transport.getServices('moyu')).resolves.toEqual([{
      uuid: 'service',
      characteristics: [{
        uuid: 'write',
        properties: {
          indicate: false, notify: true, read: false, write: false, writeWithoutResponse: true,
        },
      }],
    }]);
    await transport.write('moyu', 'service', 'write', Uint8Array.of(1, 2));

    expect(bleMocks.send).toHaveBeenCalledWith('write', [1, 2], 'withoutResponse', 'service');
  });
});
