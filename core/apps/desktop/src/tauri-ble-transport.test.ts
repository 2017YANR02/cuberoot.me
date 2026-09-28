import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const bleMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  listServices: vi.fn(),
  send: vi.fn(),
  startScan: vi.fn(),
  stopScan: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: bleMocks.invoke,
  Channel: class { onmessage = (_value: number[]) => {}; },
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
  bleMocks.invoke.mockResolvedValue(undefined);
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
  it('reports IPC failure once and waits for native cleanup before reconnecting', async () => {
    const transport = new TauriBleTransport();
    const lost = vi.fn();
    await transport.connect('cube', lost);
    await transport.subscribe('cube', 'service', 'notify', vi.fn());
    const channel = bleMocks.invoke.mock.calls[0][1].onError;
    let finish!: () => void;
    bleMocks.disconnect.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
    channel.onmessage();
    channel.onmessage();
    expect(lost).toHaveBeenCalledTimes(1);
    expect(bleMocks.disconnect).toHaveBeenCalledTimes(1);
    const reconnect = transport.connect('cube', vi.fn());
    await Promise.resolve();
    expect(bleMocks.connect).toHaveBeenCalledTimes(1);
    finish();
    await reconnect;
    expect(bleMocks.connect).toHaveBeenCalledTimes(2);
    channel.onmessage();
    expect(bleMocks.disconnect).toHaveBeenCalledTimes(1);
  });

  it('ignores an old subscription error after a new connection owns the transport', async () => {
    const transport = new TauriBleTransport();
    const oldLost = vi.fn();
    const newLost = vi.fn();
    await transport.connect('cube', oldLost);
    await transport.subscribe('cube', 'service', 'notify', vi.fn());
    const oldError = bleMocks.invoke.mock.calls[0][1].onError;
    await transport.disconnect('cube');
    await transport.connect('cube', newLost);
    oldError.onmessage();
    expect(oldLost).not.toHaveBeenCalled();
    expect(newLost).not.toHaveBeenCalled();
    expect(bleMocks.disconnect).toHaveBeenCalledTimes(1);
  });

  it('forwards a burst through the native IPC subscription in order and ignores stopped callbacks', async () => {
    const transport = new TauriBleTransport();
    const received: number[] = [];
    const stop = await transport.subscribe('cube', 'service', 'notify', (value) => {
      received.push(value.getUint16(0));
    });
    expect(bleMocks.subscribe).not.toHaveBeenCalled();
    expect(bleMocks.invoke).toHaveBeenCalledWith('ble_subscribe', expect.objectContaining({
      service: 'service', characteristic: 'notify',
    }));
    const channel = bleMocks.invoke.mock.calls[0][1].onData;
    for (let index = 0; index < 4096; index++) channel.onmessage([index >> 8, index & 255]);
    expect(received).toEqual(Array.from({ length: 4096 }, (_, index) => index));
    await stop();
    channel.onmessage([255, 255]);
    await stop();
    expect(received).toHaveLength(4096);
    expect(bleMocks.unsubscribe).toHaveBeenCalledTimes(1);
  });
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
