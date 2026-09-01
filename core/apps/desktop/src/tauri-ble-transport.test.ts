import { afterEach, describe, expect, it, vi } from 'vitest';

const bleMocks = vi.hoisted(() => ({
  startScan: vi.fn(),
  stopScan: vi.fn(),
}));

vi.mock('@mnlphlp/plugin-blec', () => ({
  checkPermissions: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  getAdapterState: vi.fn(),
  getMtu: vi.fn(),
  read: vi.fn(),
  send: vi.fn(),
  startScan: bleMocks.startScan,
  stopScan: bleMocks.stopScan,
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

import { nearestNamedDevice, TauriBleTransport } from './tauri-ble-transport';

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
    expect(bleMocks.stopScan).toHaveBeenCalledOnce();
  });
});
