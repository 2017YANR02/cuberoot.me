import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  GAN_V4_NOTIFY_CHARACTERISTIC_UUID,
  GAN_V4_SERVICE_UUID,
  GAN_V4_WRITE_CHARACTERISTIC_UUID,
  createGanV4Cipher,
  extractGanV4MacFromAdvertisement,
  matchesGanV4Name,
} from '@cuberoot/shared/smart-cube/gan-v4';
import {
  GanV4BleError,
  connectGanV4,
} from '../src/lib/smart-cube/gan-v4-ble';
import type {
  BleConnectionStateChange,
  CharacteristicValueChange,
  MiniProgramBleApi,
} from '../src/lib/smart-cube/ble-api';

type DeviceListener = Parameters<MiniProgramBleApi['onBluetoothDeviceFound']>[0];
type ValueListener = Parameters<MiniProgramBleApi['onBLECharacteristicValueChange']>[0];
type StateListener = (result: BleConnectionStateChange) => void;

const GAN_MAC = Uint8Array.from([1, 2, 3, 4, 5, 6]);
const GAN_ADVERTISEMENT = Uint8Array.from([6, 5, 4, 3, 2, 1]).buffer;
const SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

function ganFrame(mode: number): Uint8Array {
  const value = new Uint8Array(20);
  value[0] = mode;
  return value;
}

function writeBits(frame: Uint8Array, offset: number, length: number, value: number): void {
  for (let index = 0; index < length; index++) {
    const bit = (value >>> (length - 1 - index)) & 1;
    const absolute = offset + index;
    frame[absolute >> 3] |= bit << (7 - (absolute & 7));
  }
}

function solvedFaceletFrame(): Uint8Array {
  const frame = ganFrame(0xed);
  frame[1] = 0x10;
  for (let index = 0; index < 7; index++) {
    writeBits(frame, 32 + index * 3, 3, index);
  }
  for (let index = 0; index < 11; index++) {
    writeBits(frame, 69 + index * 4, 4, index);
  }
  return frame;
}

function createBleRig(options: {
  advertisement?: ArrayBuffer;
  characteristics?: Array<{
    properties?: { indicate?: boolean; notify?: boolean; write?: boolean; writeNoResponse?: boolean };
    uuid: string;
  }>;
  deviceId?: string;
  deviceName?: string;
} = {}) {
  const cipher = createGanV4Cipher(GAN_MAC);
  const commandOpcodes: number[] = [];
  const discoveryServices: Array<string[] | undefined> = [];
  const events: string[] = [];
  let deviceListener: DeviceListener | undefined;
  let stateListener: StateListener | undefined;
  let valueListener: ValueListener | undefined;
  const deviceId = options.deviceId ?? 'ios-device-uuid';
  const characteristics = options.characteristics ?? [
    { uuid: GAN_V4_WRITE_CHARACTERISTIC_UUID.toUpperCase(), properties: { write: true } },
    { uuid: GAN_V4_NOTIFY_CHARACTERISTIC_UUID.toUpperCase(), properties: { notify: true } },
  ];

  const api: MiniProgramBleApi = {
    openBluetoothAdapter(callbacks) {
      events.push('adapter:open');
      callbacks.success?.({});
    },
    closeBluetoothAdapter(callbacks) {
      events.push('adapter:close');
      callbacks.success?.({});
    },
    startBluetoothDevicesDiscovery(callbacks) {
      events.push('scan:start');
      discoveryServices.push(callbacks.services);
      callbacks.success?.({});
      void Promise.resolve().then(() => deviceListener?.({
        devices: [{
          advertisData: options.advertisement ?? GAN_ADVERTISEMENT,
          deviceId,
          name: options.deviceName ?? 'GAN16ui',
        }],
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
    onBLEConnectionStateChange(listener) {
      stateListener = listener;
    },
    offBLEConnectionStateChange(listener) {
      if (stateListener === listener) stateListener = undefined;
    },
    getBLEDeviceServices(callbacks) {
      callbacks.success?.({
        services: [{ uuid: GAN_V4_SERVICE_UUID.toUpperCase(), isPrimary: true }],
      });
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
      commandOpcodes.push(cipher.decrypt(new Uint8Array(callbacks.value))[0]);
      callbacks.success?.({});
    },
  };

  return {
    api,
    commandOpcodes,
    discoveryServices,
    events,
    emit(plain: Uint8Array) {
      const encrypted = cipher.encrypt(plain);
      const event: CharacteristicValueChange = {
        characteristicId: GAN_V4_NOTIFY_CHARACTERISTIC_UUID.toUpperCase(),
        deviceId,
        serviceId: GAN_V4_SERVICE_UUID.toUpperCase(),
        value: new Uint8Array(encrypted).buffer,
      };
      valueListener?.(event);
    },
    emitDisconnect() {
      stateListener?.({ connected: false, deviceId });
    },
  };
}

describe('WeChat GAN v4 BLE transport', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('recognizes GAN 16 ui and extracts its reversed advertisement MAC', () => {
    expect(matchesGanV4Name('GAN16ui')).toBe(true);
    expect(matchesGanV4Name('GAN-16 ui')).toBe(true);
    expect(matchesGanV4Name('GAN17 prototype')).toBe(true);
    expect(matchesGanV4Name('GAN356 i3')).toBe(false);
    expect(extractGanV4MacFromAdvertisement(GAN_ADVERTISEMENT)).toEqual(GAN_MAC);
  });

  it('extracts a GAN MAC from a complete manufacturer advertisement', () => {
    const completeAdvertisement = Uint8Array.from([
      2, 0x01, 0x06,
      9, 0xff, 0x01, 0x00, 6, 5, 4, 3, 2, 1,
    ]);

    expect(extractGanV4MacFromAdvertisement(completeAdvertisement)).toEqual(GAN_MAC);
  });

  it('connects, decrypts moves and battery, then disconnects idempotently', async () => {
    const rig = createBleRig();
    const moves: string[] = [];
    const batteryLevels: number[] = [];
    const states: string[] = [];
    const connection = await connectGanV4({
      api: rig.api,
      onBattery: (level) => batteryLevels.push(level),
      onMove: (move) => moves.push(move),
      onState: (facelets) => states.push(facelets),
    });

    expect(connection.deviceName).toBe('GAN16ui');
    expect(rig.discoveryServices).toEqual([undefined]);
    expect(rig.commandOpcodes).toEqual([0xdf, 0xdd, 0xdd]);

    const seed = solvedFaceletFrame();
    rig.emit(seed);
    expect(states).toEqual([SOLVED_FACELETS]);
    const move = ganFrame(0x01);
    move[2] = 123;
    move[6] = 1;
    move[8] = 2;
    rig.emit(move);
    expect(moves).toEqual(['U']);

    const batteryPromise = connection.requestBattery();
    const battery = ganFrame(0xef);
    battery[1] = 1;
    battery[2] = 91;
    rig.emit(battery);
    await expect(batteryPromise).resolves.toBe(91);
    expect(batteryLevels).toEqual([91]);

    await connection.disconnect();
    await connection.disconnect();
    expect(rig.events.filter((event) => event === 'connection:close')).toHaveLength(1);
    expect(rig.events.filter((event) => event === 'adapter:close')).toHaveLength(1);
  });

  it('reports a discovered GAN without a usable MAC', async () => {
    vi.useFakeTimers();
    const rig = createBleRig({ advertisement: new Uint8Array(6).buffer });
    const pending = connectGanV4({ api: rig.api, scanTimeoutMs: 1_000 });
    const rejection = expect(pending).rejects.toMatchObject({ code: 'mac-unavailable' });

    await vi.advanceTimersByTimeAsync(1_000);
    await rejection;
    expect(rig.events).toContain('adapter:close');
  });

  it('never mistakes an iOS peripheral UUID for the GAN encryption MAC', async () => {
    vi.useFakeTimers();
    const rig = createBleRig({
      advertisement: new Uint8Array(6).buffer,
      deviceId: '550e8400-e29b-41d4-a716-446655440000',
    });
    const pending = connectGanV4({ api: rig.api, scanTimeoutMs: 1_000 });
    const rejection = expect(pending).rejects.toMatchObject({ code: 'mac-unavailable' });

    await vi.advanceTimersByTimeAsync(1_000);
    await rejection;
    expect(rig.events).not.toContain('connection:open');
    expect(rig.events).toContain('adapter:close');
  });

  it('reports a physical BLE disconnect once and performs cleanup', async () => {
    const rig = createBleRig();
    const onDisconnect = vi.fn();
    const connection = await connectGanV4({ api: rig.api, onDisconnect });

    rig.emitDisconnect();
    rig.emitDisconnect();

    await vi.waitFor(() => expect(onDisconnect).toHaveBeenCalledOnce());
    await vi.waitFor(() => {
      expect(rig.events.filter((event) => event === 'connection:close')).toHaveLength(1);
      expect(rig.events.filter((event) => event === 'adapter:close')).toHaveLength(1);
    });
    await connection.disconnect();
    expect(onDisconnect).toHaveBeenCalledWith('GAN 智能魔方连接已断开');
  });

  it('cleans up when GAN GATT characteristics are unavailable', async () => {
    const rig = createBleRig({ characteristics: [] });

    await expect(connectGanV4({ api: rig.api })).rejects.toMatchObject({
      code: 'gatt-unavailable',
    });
    expect(rig.events).toContain('connection:close');
    expect(rig.events).toContain('adapter:close');
  });

  it('exports a typed error for session-level recovery', () => {
    const error = new GanV4BleError('connection-failed', 'failed');
    expect(error.name).toBe('GanV4BleError');
    expect(error.code).toBe('connection-failed');
  });
});
