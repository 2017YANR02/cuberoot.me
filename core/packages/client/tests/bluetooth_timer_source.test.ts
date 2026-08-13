// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBluetoothTimerSource } from '@/app/[lang]/timer/_lib/bluetooth/timer';

afterEach(() => {
  Object.defineProperty(navigator, 'bluetooth', {
    configurable: true,
    value: undefined,
  });
  vi.restoreAllMocks();
});

describe('Bluetooth smart-timer source', () => {
  it('offers both QiYi timer names and does not create a silent GATT connection after MAC cancellation', async () => {
    const gattConnect = vi.fn();
    const picked = {
      name: 'QY-Timer-V003',
      gatt: { connected: false, connect: gattConnect },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as BluetoothDevice;
    const requestDevice = vi.fn((_options: RequestDeviceOptions) => Promise.resolve(picked));
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: { requestDevice },
    });
    const onNeedMac = vi.fn(() => Promise.resolve(null));
    const source = createBluetoothTimerSource({ onNeedMac });

    await source.connect();

    expect(requestDevice).toHaveBeenCalledOnce();
    const options = requestDevice.mock.calls[0]?.[0] as RequestDeviceOptions;
    const prefixes = options.filters?.map(filter => filter.namePrefix);
    expect(prefixes).toContain('QY-Timer');
    expect(prefixes).toContain('QY-Adapter');
    expect(onNeedMac).toHaveBeenCalledWith('QY-Timer-V003', undefined);
    expect(gattConnect).not.toHaveBeenCalled();
    expect(source.connected).toBe(false);
  });

  it('asks the user to confirm a name-derived QiYi MAC instead of silently guessing', async () => {
    const gattConnect = vi.fn();
    const picked = {
      name: 'QY-Timer-x-8F2A',
      gatt: { connected: false, connect: gattConnect },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as BluetoothDevice;
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: { requestDevice: vi.fn(() => Promise.resolve(picked)) },
    });
    const onNeedMac = vi.fn(() => Promise.resolve(null));
    const source = createBluetoothTimerSource({ onNeedMac });

    await source.connect();

    expect(onNeedMac).toHaveBeenCalledWith('QY-Timer-x-8F2A', 'CC:A1:00:00:8F:2A');
    expect(gattConnect).not.toHaveBeenCalled();
    expect(source.connected).toBe(false);
  });
});
