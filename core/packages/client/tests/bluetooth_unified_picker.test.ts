// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classifyUnifiedBluetoothDevice,
  GAN_V1_DEVICE_INFORMATION_SERVICE,
  requestUnifiedBluetoothDevice,
  unifiedBluetoothPickerOptions,
} from '@/app/[lang]/timer/_lib/bluetooth/unified_picker';
import {
  BLUETOOTH_TIMER_DRIVERS,
  GAN_TIMER_SERVICE,
} from '@/app/[lang]/timer/_lib/bluetooth/timer';

function fakeDevice(
  name: string,
  serviceUuids: string[] = [],
  options: { rejectEnumeration?: boolean } = {},
) {
  const disconnect = vi.fn();
  const server = {
    connected: true,
    connect: vi.fn(async () => server),
    disconnect,
    getPrimaryService: vi.fn(async (uuid: string | number) => {
      const matched = serviceUuids.find((serviceUuid) => serviceUuid === uuid);
      if (matched) return { uuid: matched };
      throw new DOMException(`Service ${String(uuid)} was not found.`, 'NotFoundError');
    }),
    getPrimaryServices: vi.fn(async () => {
      if (options.rejectEnumeration) {
        throw new DOMException('Service enumeration is unavailable.', 'NotSupportedError');
      }
      return serviceUuids.map((uuid) => ({ uuid }));
    }),
  } as unknown as BluetoothRemoteGATTServer;
  const device = { name, gatt: server } as unknown as BluetoothDevice;
  return { device, server, disconnect };
}

afterEach(() => {
  Object.defineProperty(navigator, 'bluetooth', {
    configurable: true,
    value: undefined,
  });
  vi.restoreAllMocks();
});

describe('unified Bluetooth picker', () => {
  it('offers every smart-timer prefix and authorises every timer service', () => {
    const options = unifiedBluetoothPickerOptions();
    const prefixes = new Set(options.filters?.map((filter) => filter.namePrefix));
    const services = new Set(options.optionalServices);

    for (const driver of BLUETOOTH_TIMER_DRIVERS) {
      for (const prefix of driver.namePrefixes) expect(prefixes).toContain(prefix);
      expect(services).toContain(driver.service);
    }
    expect(services).toContain(GAN_V1_DEVICE_INFORMATION_SERVICE);
  });

  it('keeps the Bluefy picker name-only while retaining timer permissions', () => {
    const options = unifiedBluetoothPickerOptions(true);
    expect(options.filters?.every((filter) => typeof filter.namePrefix === 'string')).toBe(true);
    expect(options.optionalServices).toContain(GAN_TIMER_SERVICE);
  });

  it('opens one chooser for both device categories', async () => {
    const selected = fakeDevice('QY-Timer-V003').device;
    const requestDevice = vi.fn(async (_options: RequestDeviceOptions) => selected);
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: { requestDevice },
    });

    await expect(requestUnifiedBluetoothDevice()).resolves.toBe(selected);
    expect(requestDevice).toHaveBeenCalledOnce();
    const options = requestDevice.mock.calls[0]?.[0] as RequestDeviceOptions;
    const prefixes = options.filters?.map((filter) => filter.namePrefix);
    expect(prefixes).toContain('GAN');
    expect(prefixes).toContain('QY-Timer');
  });

  it('routes an unambiguous QiYi timer without opening GATT during classification', async () => {
    const { device, server } = fakeDevice('QY-Timer-V003');
    await expect(classifyUnifiedBluetoothDevice(device)).resolves.toBe('smart-timer');
    expect(server.connect).not.toHaveBeenCalled();
  });

  it('uses the primary service to distinguish a GAN timer from GAN cubes', async () => {
    const timer = fakeDevice('GAN-Timer', [GAN_TIMER_SERVICE]);
    await expect(classifyUnifiedBluetoothDevice(timer.device)).resolves.toBe('smart-timer');
    expect(timer.server.connect).toHaveBeenCalledOnce();
    expect(timer.disconnect).not.toHaveBeenCalled();

    const cube = fakeDevice('GAN16ui_C296', ['6e400001-b5a3-f393-e0a9-e50e24dc4179']);
    await expect(classifyUnifiedBluetoothDevice(cube.device)).resolves.toBe('smart-cube');
    expect(cube.server.connect).toHaveBeenCalledOnce();
    expect(cube.disconnect).toHaveBeenCalledOnce();
  });

  it('routes a GAN timer when the Bluetooth bridge cannot enumerate services', async () => {
    const timer = fakeDevice('GAN-Timer', [GAN_TIMER_SERVICE], { rejectEnumeration: true });

    await expect(classifyUnifiedBluetoothDevice(timer.device)).resolves.toBe('smart-timer');
    expect(timer.server.getPrimaryService).toHaveBeenCalledWith(GAN_TIMER_SERVICE);
    expect(timer.server.getPrimaryServices).not.toHaveBeenCalled();
    expect(timer.disconnect).not.toHaveBeenCalled();
  });

  it('does not misroute a legacy GAN v1 cube with FFF0 + 180A as a GAN timer', async () => {
    const cube = fakeDevice(
      'GAN-i',
      [GAN_TIMER_SERVICE, GAN_V1_DEVICE_INFORMATION_SERVICE],
      { rejectEnumeration: true },
    );

    await expect(classifyUnifiedBluetoothDevice(cube.device)).resolves.toBe('smart-cube');
    expect(cube.server.getPrimaryService).toHaveBeenCalledWith(
      GAN_V1_DEVICE_INFORMATION_SERVICE,
    );
    expect(cube.server.getPrimaryService).not.toHaveBeenCalledWith(GAN_TIMER_SERVICE);
    expect(cube.server.getPrimaryServices).not.toHaveBeenCalled();
    expect(cube.disconnect).toHaveBeenCalledOnce();
  });
});
