import { describe, expect, it, vi } from 'vitest';
import {
  classifySmartCubeDriver,
  discoverSmartCubeDriver,
} from '../src/lib/smart-cube/discover-driver';
import type {
  DiscoveredDevice,
  MiniProgramBleApi,
} from '../src/lib/smart-cube/ble-api';

describe('classifySmartCubeDriver', () => {
  it.each([
    ['GAN16ui_C2AF', 'gan-v4'],
    ['GAN356 i Carry 2', 'gan-v4'],
    ['GoCube Edge', 'gocube'],
    ["Rubik's Connected", 'gocube'],
    ['MHC Cube', 'moyu'],
    ['Mi Smart Magic Cube', 'giiker'],
    ['Unknown Cube', null],
  ] as const)('maps %s to %s', (name, expected) => {
    expect(classifySmartCubeDriver(name)).toBe(expected);
  });

  it('falls back to the advertised local name when the display name is generic', () => {
    expect(classifySmartCubeDriver({
      deviceId: 'cube-1',
      localName: 'GAN16ui_C2AF',
      name: 'Bluetooth Device',
    })).toBe('gan-v4');
  });
});

describe('discoverSmartCubeDriver', () => {
  it('stops discovery and closes the adapter after identifying a cube', async () => {
    let deviceListener: ((result: { devices: DiscoveredDevice[] }) => void) | null = null;
    const stopBluetoothDevicesDiscovery = vi.fn((options: {
      success?(): void;
    }) => options.success?.());
    const closeBluetoothAdapter = vi.fn((options: {
      success?(): void;
    }) => options.success?.());
    const offBluetoothDeviceFound = vi.fn((listener: typeof deviceListener) => {
      if (deviceListener === listener) deviceListener = null;
    });
    const api = {
      closeBluetoothAdapter,
      offBluetoothDeviceFound,
      onBluetoothDeviceFound: vi.fn((listener: typeof deviceListener) => {
        deviceListener = listener;
      }),
      openBluetoothAdapter: vi.fn((options: { success?(result: object): void }) => {
        options.success?.({});
      }),
      startBluetoothDevicesDiscovery: vi.fn((options: {
        success?(result: object): void;
      }) => {
        options.success?.({});
        void Promise.resolve().then(() => deviceListener?.({
          devices: [{
            deviceId: 'cube-1',
            localName: 'GAN16ui_C2AF',
            name: 'Bluetooth Device',
          }],
        }));
      }),
      stopBluetoothDevicesDiscovery,
    } as unknown as MiniProgramBleApi;

    await expect(discoverSmartCubeDriver({ api, scanTimeoutMs: 1_000 }))
      .resolves.toBe('gan-v4');

    expect(offBluetoothDeviceFound).toHaveBeenCalledOnce();
    expect(stopBluetoothDevicesDiscovery).toHaveBeenCalledOnce();
    expect(closeBluetoothAdapter).toHaveBeenCalledOnce();
  });

  it('rejects invalid scan timeouts before opening Bluetooth', async () => {
    const openBluetoothAdapter = vi.fn();
    const api = { openBluetoothAdapter } as unknown as MiniProgramBleApi;

    await expect(discoverSmartCubeDriver({ api, scanTimeoutMs: 999 }))
      .rejects.toThrow('scanTimeoutMs must be between 1000 and 30000');
    expect(openBluetoothAdapter).not.toHaveBeenCalled();
  });

  it('explains a missing Douyin Bluetooth privacy authorization', async () => {
    const api = {
      openBluetoothAdapter(options: { fail?(error: object): void }) {
        options.fail?.({
          errMsg: 'openBluetoothAdapter:fail privacy permission is not authorized',
          errorCode: '186680',
        });
      },
    } as unknown as MiniProgramBleApi;

    await expect(discoverSmartCubeDriver({ api, scanTimeoutMs: 1_000 }))
      .rejects.toThrow('蓝牙隐私权限尚未授权，请授权后重试');
  });
});
