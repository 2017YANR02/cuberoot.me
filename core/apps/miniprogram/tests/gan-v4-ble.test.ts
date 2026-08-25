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
  GAN_V2_NOTIFY_CHARACTERISTIC_UUID,
  GAN_V2_SERVICE_UUID,
  GAN_V2_WRITE_CHARACTERISTIC_UUID,
  createGanV2Cipher,
} from '@cuberoot/shared/smart-cube/gan-v2';
import {
  GAN_V3_NOTIFY_CHARACTERISTIC_UUID,
  GAN_V3_SERVICE_UUID,
  GAN_V3_WRITE_CHARACTERISTIC_UUID,
  createGanV3Cipher,
} from '@cuberoot/shared/smart-cube/gan-v3';
import {
  GanV4BleError,
  connectGanV4,
} from '../src/lib/smart-cube/gan-v4-ble';
import { BLE_OPERATION_TIMEOUT_MS } from '../src/lib/smart-cube/ble-api';
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

type GanProtocolFamily = 'v2' | 'v3' | 'v4';

const GAN_PROTOCOLS = {
  v2: {
    notifyCharacteristicUuid: GAN_V2_NOTIFY_CHARACTERISTIC_UUID,
    serviceUuid: GAN_V2_SERVICE_UUID,
    writeCharacteristicUuid: GAN_V2_WRITE_CHARACTERISTIC_UUID,
    createCipher: (deviceName: string) => createGanV2Cipher(GAN_MAC, deviceName),
    deviceName: 'GAN356 i',
  },
  v3: {
    notifyCharacteristicUuid: GAN_V3_NOTIFY_CHARACTERISTIC_UUID,
    serviceUuid: GAN_V3_SERVICE_UUID,
    writeCharacteristicUuid: GAN_V3_WRITE_CHARACTERISTIC_UUID,
    createCipher: () => createGanV3Cipher(GAN_MAC),
    deviceName: 'GAN356 i3',
  },
  v4: {
    notifyCharacteristicUuid: GAN_V4_NOTIFY_CHARACTERISTIC_UUID,
    serviceUuid: GAN_V4_SERVICE_UUID,
    writeCharacteristicUuid: GAN_V4_WRITE_CHARACTERISTIC_UUID,
    createCipher: () => createGanV4Cipher(GAN_MAC),
    deviceName: 'GAN16ui',
  },
} as const;

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
  advertisementBatches?: Array<ArrayBuffer[]>;
  advertisements?: ArrayBuffer[];
  characteristics?: Array<{
    properties?: { indicate?: boolean; notify?: boolean; write?: boolean; writeNoResponse?: boolean };
    uuid: string;
  }>;
  deviceId?: string;
  deviceName?: string;
  protocol?: GanProtocolFamily;
} = {}) {
  const protocol = GAN_PROTOCOLS[options.protocol ?? 'v4'];
  const deviceName = options.deviceName ?? protocol.deviceName;
  const cipher = protocol.createCipher(deviceName);
  const commandHeaders: Array<[number, number]> = [];
  const commandOpcodes: number[] = [];
  const discoveryServices: Array<string[] | undefined> = [];
  const events: string[] = [];
  const pendingWriteCompletions: Array<() => void> = [];
  let holdWrites = false;
  let activeWrites = 0;
  let maxConcurrentWrites = 0;
  let deviceListener: DeviceListener | undefined;
  let stateListener: StateListener | undefined;
  let valueListener: ValueListener | undefined;
  const deviceId = options.deviceId ?? 'ios-device-uuid';
  const characteristics = options.characteristics ?? [
    { uuid: protocol.writeCharacteristicUuid.toUpperCase(), properties: { write: true } },
    { uuid: protocol.notifyCharacteristicUuid.toUpperCase(), properties: { notify: true } },
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
      const advertisementBatches = options.advertisementBatches
        ?? (options.advertisements ?? [options.advertisement ?? GAN_ADVERTISEMENT])
          .map((advertisData) => [advertisData]);
      for (const batch of advertisementBatches) {
        void Promise.resolve().then(() => deviceListener?.({
          devices: batch.map((advertisData) => ({
            advertisData,
            deviceId,
            name: deviceName,
          })),
        }));
      }
    },
    stopBluetoothDevicesDiscovery(callbacks) {
      events.push('scan:stop');
      callbacks.success?.({});
    },
    onBluetoothDeviceFound(listener) {
      deviceListener = listener;
    },
    offBluetoothDeviceFound(listener) {
      if (deviceListener === listener) {
        events.push('scan-listener:off');
        deviceListener = undefined;
      }
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
        services: [{ uuid: protocol.serviceUuid.toUpperCase(), isPrimary: true }],
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
      const plain = cipher.decrypt(new Uint8Array(callbacks.value));
      commandOpcodes.push(plain[0]);
      commandHeaders.push([plain[0], plain[1]]);
      activeWrites++;
      maxConcurrentWrites = Math.max(maxConcurrentWrites, activeWrites);
      const complete = (): void => {
        activeWrites--;
        callbacks.success?.({});
      };
      if (holdWrites) pendingWriteCompletions.push(complete);
      else complete();
    },
  };

  return {
    api,
    commandHeaders,
    commandOpcodes,
    discoveryServices,
    events,
    holdWrites() {
      holdWrites = true;
    },
    maxConcurrentWrites() {
      return maxConcurrentWrites;
    },
    pendingWriteCount() {
      return pendingWriteCompletions.length;
    },
    releaseNextWrite() {
      const complete = pendingWriteCompletions.shift();
      if (!complete) throw new Error('No pending GAN write to release.');
      complete();
    },
    emit(plain: Uint8Array) {
      const encrypted = cipher.encrypt(plain);
      const event: CharacteristicValueChange = {
        characteristicId: protocol.notifyCharacteristicUuid.toUpperCase(),
        deviceId,
        serviceId: protocol.serviceUuid.toUpperCase(),
        value: new Uint8Array(encrypted).buffer,
      };
      valueListener?.(event);
    },
    emitDisconnect() {
      stateListener?.({ connected: false, deviceId });
    },
  };
}

describe('WeChat GAN BLE transport', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('recognizes GAN 16 ui and extracts its reversed advertisement MAC', () => {
    expect(matchesGanV4Name('GAN16ui')).toBe(true);
    expect(matchesGanV4Name('GAN16ui_C2AF')).toBe(true);
    expect(matchesGanV4Name('GAN-16 ui')).toBe(true);
    expect(matchesGanV4Name('GAN17 prototype')).toBe(true);
    expect(matchesGanV4Name('GAN356 i3')).toBe(false);
    expect(extractGanV4MacFromAdvertisement(GAN_ADVERTISEMENT)).toEqual(GAN_MAC);
  });

  it('extracts a GAN MAC from WeChat manufacturer data with its company identifier', () => {
    const manufacturerData = Uint8Array.from([
      0x01, 0xa7,
      0xa3, 0xb4, 0xc5, 6, 5, 4, 3, 2, 1,
    ]);

    expect(extractGanV4MacFromAdvertisement(manufacturerData)).toEqual(GAN_MAC);
  });

  it('extracts the GAN MAC from the canonical prefix of longer GAN16 ui manufacturer data', () => {
    const manufacturerData = Uint8Array.from([
      0x01, 0xa7,
      0xa3, 0xb4, 0xc5, 6, 5, 4, 3, 2, 1,
      0xd6, 0xe7, 0xf8, 0x10, 0x20,
    ]);

    expect(extractGanV4MacFromAdvertisement(manufacturerData)).toEqual(GAN_MAC);
  });

  it('extracts a GAN MAC from a complete manufacturer advertisement', () => {
    const completeAdvertisement = Uint8Array.from([
      2, 0x01, 0x06,
      9, 0xff, 0x01, 0x00, 6, 5, 4, 3, 2, 1,
    ]);

    expect(extractGanV4MacFromAdvertisement(completeAdvertisement, 'full-ad')).toEqual(GAN_MAC);
  });

  it('extracts a GAN MAC from the canonical prefix of a longer complete advertisement', () => {
    const completeAdvertisement = Uint8Array.from([
      2, 0x01, 0x06,
      17, 0xff, 0x01, 0x00,
      0xa3, 0xb4, 0xc5, 6, 5, 4, 3, 2, 1,
      0xd6, 0xe7, 0xf8, 0x10, 0x20,
    ]);

    expect(extractGanV4MacFromAdvertisement(completeAdvertisement, 'full-ad')).toEqual(GAN_MAC);
  });

  it('connects when WeChat returns the complete advertisement shape', async () => {
    const completeAdvertisement = Uint8Array.from([
      2, 0x01, 0x06,
      17, 0xff, 0x01, 0x00,
      0xa3, 0xb4, 0xc5, 6, 5, 4, 3, 2, 1,
      0xd6, 0xe7, 0xf8, 0x10, 0x20,
    ]).buffer;
    const rig = createBleRig({
      advertisements: [completeAdvertisement],
      deviceName: 'GAN16ui_C2AF',
    });

    const connection = await connectGanV4({ api: rig.api });

    expect(connection.deviceName).toBe('GAN16ui_C2AF');
    expect(rig.events.filter((event) => event === 'connection:open')).toHaveLength(1);
    expect(rig.commandHeaders).toEqual([
      [0xdf, 0x03],
      [0xdd, 0x04],
      [0xdd, 0x04],
    ]);
    await connection.disconnect();
  });

  it('does not treat a complete advertisement without ManufacturerData as a MAC', () => {
    const nameOnlyAdvertisement = Uint8Array.from([
      2, 0x01, 0x06,
      4, 0x09, 0x47, 0x41, 0x4e,
    ]);

    expect(extractGanV4MacFromAdvertisement(nameOnlyAdvertisement, 'full-ad')).toBeNull();
  });

  it('rejects a big-endian GAN company identifier in ManufacturerData', () => {
    const manufacturerData = Uint8Array.from([
      0xa7, 0x01,
      0xa3, 0xb4, 0xc5, 6, 5, 4, 3, 2, 1,
    ]);

    expect(extractGanV4MacFromAdvertisement(manufacturerData)).toBeNull();
  });

  it('waits for a later long GAN16 ui advertisement before connecting', async () => {
    const rig = createBleRig({
      advertisements: [
        new Uint8Array(6).buffer,
        Uint8Array.from([
          0x01, 0xa7,
          0xa3, 0xb4, 0xc5, 0xd6, 0xe7, 0xf8, 0x10, 0x20,
          6, 5, 4, 3, 2, 1,
        ]).buffer,
        Uint8Array.from([
          0x01, 0xa7,
          0xa3, 0xb4, 0xc5, 0xd6, 0xe7, 0xf8, 0x10, 0x20,
          6, 5, 4, 3, 2, 1,
        ]).buffer,
      ],
      deviceName: 'GAN16ui_C2AF',
    });

    const connection = await connectGanV4({ api: rig.api });

    expect(connection.deviceName).toBe('GAN16ui_C2AF');
    expect(rig.events.filter((event) => event === 'connection:open')).toHaveLength(1);
    expect(rig.events.filter((event) => event === 'scan:stop')).toHaveLength(1);
    expect(rig.events.filter((event) => event === 'scan-listener:off')).toHaveLength(1);
    await connection.disconnect();
  });

  it('connects only once when duplicate valid GAN16 ui advertisements share a callback', async () => {
    const advertisement = Uint8Array.from([
      0x01, 0xa7,
      0xa3, 0xb4, 0xc5, 6, 5, 4, 3, 2, 1,
    ]).buffer;
    const rig = createBleRig({
      advertisementBatches: [[advertisement, advertisement]],
      deviceName: 'GAN16ui_C2AF',
    });

    const connection = await connectGanV4({ api: rig.api });

    expect(rig.events.filter((event) => event === 'connection:open')).toHaveLength(1);
    expect(rig.events.filter((event) => event === 'scan:stop')).toHaveLength(1);
    expect(rig.events.filter((event) => event === 'scan-listener:off')).toHaveLength(1);
    await connection.disconnect();
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

  it('selects GAN v3 GATT and sends the v3 setup sequence', async () => {
    const rig = createBleRig({ protocol: 'v3' });
    const connection = await connectGanV4({ api: rig.api });

    expect(connection.deviceName).toBe('GAN356 i3');
    expect(rig.commandHeaders).toEqual([
      [0x68, 4],
      [0x68, 1],
      [0x68, 7],
    ]);

    await connection.disconnect();
  });

  it('selects GAN v2 GATT and sends the v2 setup sequence', async () => {
    const rig = createBleRig({ protocol: 'v2' });
    const connection = await connectGanV4({ api: rig.api });

    expect(connection.deviceName).toBe('GAN356 i');
    expect(rig.commandHeaders).toEqual([
      [5, 0],
      [4, 0],
      [9, 0],
    ]);

    await connection.disconnect();
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

  it('serializes native writes and waits for an in-flight write before closing BLE', async () => {
    const rig = createBleRig();
    const connection = await connectGanV4({ api: rig.api });
    rig.holdWrites();

    const firstBattery = connection.requestBattery();
    const secondBattery = connection.requestBattery();
    await vi.waitFor(() => expect(rig.pendingWriteCount()).toBe(1));
    expect(rig.maxConcurrentWrites()).toBe(1);

    rig.releaseNextWrite();
    await vi.waitFor(() => expect(rig.pendingWriteCount()).toBe(1));
    expect(rig.maxConcurrentWrites()).toBe(1);

    const disconnecting = connection.disconnect();
    await Promise.resolve();
    expect(rig.events).not.toContain('notify:off');
    expect(rig.events).not.toContain('connection:close');
    expect(rig.events).not.toContain('adapter:close');

    rig.releaseNextWrite();
    await disconnecting;
    await expect(firstBattery).resolves.toBeNull();
    await expect(secondBattery).resolves.toBeNull();
    expect(rig.events).toContain('notify:off');
    expect(rig.events).toContain('connection:close');
    expect(rig.events).toContain('adapter:close');
  });

  it('defers cleanup when a native write remains pending after its public timeout', async () => {
    vi.useFakeTimers();
    const rig = createBleRig();
    const connection = await connectGanV4({ api: rig.api });
    rig.holdWrites();

    const batteryRequest = connection.requestBattery();
    const rejection = expect(batteryRequest).rejects.toBeInstanceOf(Error);
    await vi.waitFor(() => expect(rig.pendingWriteCount()).toBe(1));
    const disconnecting = connection.disconnect();

    await vi.advanceTimersByTimeAsync(BLE_OPERATION_TIMEOUT_MS);
    await rejection;
    await disconnecting;
    expect(rig.events).not.toContain('notify:off');
    expect(rig.events).not.toContain('connection:close');
    expect(rig.events).not.toContain('adapter:close');

    rig.releaseNextWrite();
    await vi.waitFor(() => {
      expect(rig.events).toContain('notify:off');
      expect(rig.events).toContain('connection:close');
      expect(rig.events).toContain('adapter:close');
    });
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
