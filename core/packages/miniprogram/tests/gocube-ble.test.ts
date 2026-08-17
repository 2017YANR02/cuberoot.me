import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  GOCUBE_COMMAND_BATTERY,
  GOCUBE_COMMAND_STATE,
  GOCUBE_NOTIFY_CHARACTERISTIC_UUID,
  GOCUBE_SERVICE_UUID,
  GOCUBE_WRITE_CHARACTERISTIC_UUID,
} from '@cuberoot/shared/smart-cube/gocube';
import {
  GoCubeBleError,
  connectGoCube,
  type GoCubeBleApi,
} from '../src/lib/smart-cube/gocube-ble';

type DeviceListener = Parameters<GoCubeBleApi['onBluetoothDeviceFound']>[0];
type ValueListener = Parameters<GoCubeBleApi['onBLECharacteristicValueChange']>[0];

function frame(opcode: number, payload: number[] | string): ArrayBuffer {
  const body = typeof payload === 'string'
    ? Array.from(payload, (character) => character.charCodeAt(0))
    : payload;
  return Uint8Array.from([
    0x2a,
    body.length + 4,
    opcode,
    ...body,
    0,
    0x0d,
    0x0a,
  ]).buffer;
}

function createBleRig(options: {
  adapterError?: string;
  characteristics?: Array<{
    properties?: { indicate?: boolean; notify?: boolean; write?: boolean; writeNoResponse?: boolean };
    uuid: string;
  }>;
  deviceName?: string;
  services?: Array<{ isPrimary?: boolean; uuid: string }>;
} = {}) {
  let deviceListener: DeviceListener | undefined;
  let valueListener: ValueListener | undefined;
  const writes: number[] = [];
  const events: string[] = [];
  const characteristics = options.characteristics ?? [
    { uuid: GOCUBE_WRITE_CHARACTERISTIC_UUID.toUpperCase(), properties: { write: true } },
    { uuid: GOCUBE_NOTIFY_CHARACTERISTIC_UUID.toUpperCase(), properties: { notify: true } },
  ];
  const services = options.services ?? [
    { uuid: GOCUBE_SERVICE_UUID.toUpperCase(), isPrimary: true },
  ];

  const api: GoCubeBleApi = {
    openBluetoothAdapter(callbacks) {
      events.push('adapter:open');
      if (options.adapterError) callbacks.fail?.({ errMsg: options.adapterError });
      else callbacks.success?.({});
    },
    closeBluetoothAdapter(callbacks) {
      events.push('adapter:close');
      callbacks.success?.({});
    },
    startBluetoothDevicesDiscovery(callbacks) {
      events.push('scan:start');
      callbacks.success?.({});
      void Promise.resolve().then(() => deviceListener?.({
        devices: [{ deviceId: 'cube-1', name: options.deviceName ?? 'GoCube Edge' }],
      }));
    },
    stopBluetoothDevicesDiscovery(callbacks) {
      events.push('scan:stop');
      callbacks.success?.({});
    },
    onBluetoothDeviceFound(listener) {
      deviceListener = listener;
    },
    offBluetoothDeviceFound(listener) {
      if (deviceListener === listener) deviceListener = undefined;
    },
    createBLEConnection(callbacks) {
      events.push('connection:open');
      callbacks.success?.({});
    },
    closeBLEConnection(callbacks) {
      events.push('connection:close');
      callbacks.success?.({});
    },
    getBLEDeviceServices(callbacks) {
      callbacks.success?.({ services });
    },
    getBLEDeviceCharacteristics(callbacks) {
      callbacks.success?.({ characteristics });
    },
    notifyBLECharacteristicValueChange(callbacks) {
      events.push(callbacks.state ? 'notify:on' : 'notify:off');
      callbacks.success?.({});
    },
    onBLECharacteristicValueChange(listener) {
      valueListener = listener;
    },
    offBLECharacteristicValueChange(listener) {
      if (valueListener === listener) valueListener = undefined;
    },
    writeBLECharacteristicValue(callbacks) {
      writes.push(new Uint8Array(callbacks.value)[0] ?? -1);
      callbacks.success?.({});
    },
  };

  return {
    api,
    events,
    writes,
    emit(value: ArrayBuffer) {
      valueListener?.({
        characteristicId: GOCUBE_NOTIFY_CHARACTERISTIC_UUID.toUpperCase(),
        deviceId: 'cube-1',
        serviceId: GOCUBE_SERVICE_UUID.toUpperCase(),
        value,
      });
    },
  };
}

describe('WeChat GoCube BLE transport', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('connects, streams moves, gets battery and disconnects idempotently', async () => {
    const rig = createBleRig();
    const moves: string[] = [];
    const batteryLevels: number[] = [];
    const connection = await connectGoCube({
      api: rig.api,
      onBattery: (level) => batteryLevels.push(level),
      onMove: (move) => moves.push(move),
    });

    expect(connection.deviceId).toBe('cube-1');
    expect(rig.writes).toEqual([GOCUBE_COMMAND_STATE]);
    rig.emit(frame(0x01, [0, 1, 3, 2]));
    expect(moves).toEqual(['B', "F'"]);

    const battery = connection.requestBattery();
    expect(rig.writes).toEqual([GOCUBE_COMMAND_STATE, GOCUBE_COMMAND_BATTERY]);
    rig.emit(frame(0x05, [83]));
    await expect(battery).resolves.toBe(83);
    expect(batteryLevels).toEqual([83]);

    await connection.disconnect();
    await connection.disconnect();
    rig.emit(frame(0x01, [0, 3]));
    expect(moves).toEqual(['B', "F'"]);
    expect(rig.events.filter((event) => event === 'connection:close')).toHaveLength(1);
    expect(rig.events.filter((event) => event === 'adapter:close')).toHaveLength(1);
  });

  it('re-requests state after more than twenty moves', async () => {
    const rig = createBleRig();
    const connection = await connectGoCube({ api: rig.api });
    const payload = Array.from({ length: 42 }, (_, index) => index % 2 === 0 ? 0 : 1);

    rig.emit(frame(0x01, payload));
    await Promise.resolve();

    expect(rig.writes).toEqual([GOCUBE_COMMAND_STATE, GOCUBE_COMMAND_STATE]);
    await connection.disconnect();
  });

  it('registers the battery waiter before writing the request command', async () => {
    const rig = createBleRig();
    const originalWrite = rig.api.writeBLECharacteristicValue.bind(rig.api);
    rig.api.writeBLECharacteristicValue = (callbacks) => {
      originalWrite(callbacks);
      if (new Uint8Array(callbacks.value)[0] === GOCUBE_COMMAND_BATTERY) {
        rig.emit(frame(0x05, [76]));
      }
    };
    const connection = await connectGoCube({ api: rig.api });

    await expect(connection.requestBattery()).resolves.toBe(76);
    await connection.disconnect();
  });

  it('isolates consumer callback failures from later notifications', async () => {
    const rig = createBleRig();
    const moves: string[] = [];
    const connection = await connectGoCube({
      api: rig.api,
      onMove(move) {
        moves.push(move);
        if (moves.length === 1) throw new Error('consumer failed');
      },
    });

    expect(() => rig.emit(frame(0x01, [0, 1, 3, 2]))).not.toThrow();
    expect(moves).toEqual(['B', "F'"]);
    await connection.disconnect();
  });

  it('maps adapter failures to an actionable error', async () => {
    const rig = createBleRig({ adapterError: 'bluetooth is off' });

    await expect(connectGoCube({ api: rig.api })).rejects.toMatchObject({
      code: 'adapter-unavailable',
    });
    expect(rig.events).toEqual(['adapter:open']);
  });

  it('cleans up when the expected GATT characteristics are missing', async () => {
    const rig = createBleRig({ characteristics: [] });

    await expect(connectGoCube({ api: rig.api })).rejects.toMatchObject({
      code: 'gatt-unavailable',
    });
    expect(rig.events).toContain('connection:close');
    expect(rig.events).toContain('adapter:close');
  });

  it('times out discovery and closes the adapter', async () => {
    vi.useFakeTimers();
    const rig = createBleRig({ deviceName: 'Unknown cube' });
    const pending = connectGoCube({ api: rig.api, scanTimeoutMs: 1_000 });
    const rejection = expect(pending).rejects.toMatchObject({ code: 'device-not-found' });

    await vi.advanceTimersByTimeAsync(1_000);
    await rejection;
    expect(rig.events).toContain('scan:stop');
    expect(rig.events).toContain('adapter:close');
  });

  it('rejects invalid scan timeouts before touching the platform API', async () => {
    const rig = createBleRig();

    await expect(connectGoCube({ api: rig.api, scanTimeoutMs: 999 }))
      .rejects.toBeInstanceOf(RangeError);
    expect(rig.events).toEqual([]);
  });

  it('exports a typed BLE error for callers to branch on', () => {
    const error = new GoCubeBleError('connection-failed', 'failed');
    expect(error.name).toBe('GoCubeBleError');
    expect(error.code).toBe('connection-failed');
  });
});
