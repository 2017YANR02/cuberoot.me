import {
  createMoyu32Cipher,
  createMoyu32Command,
  MOYU32_MESSAGE_BATTERY,
  MOYU32_MESSAGE_GYRO,
  MOYU32_MESSAGE_GYRO_SWITCH,
  MOYU32_MESSAGE_INFO,
  MOYU32_MESSAGE_MOVE,
  MOYU32_MESSAGE_STATE,
  MOYU32_NOTIFY_CHARACTERISTIC_UUID,
  MOYU32_SERVICE_UUID,
  MOYU32_SOLVED_STATE,
  MOYU32_WRITE_CHARACTERISTIC_UUID,
} from '@cuberoot/shared/smart-cube/moyu32';
import { describe, expect, it, vi } from 'vitest';

import type { BleDeviceRef, BleServiceRef, BleTransport } from './transport';
import { Moyu32CubeConnection } from './moyu32-cube';

const ANDROID_DEVICE: BleDeviceRef = {
  id: 'AB:CD:EF:01:23:45',
  name: 'WCU_MY32_A1B2',
};
const ANDROID_MAC = Uint8Array.of(0xab, 0xcd, 0xef, 0x01, 0x23, 0x45);
const NAME_DERIVED_DEVICE: BleDeviceRef = {
  id: 'native-device-id',
  name: 'WCU_MY32_A1B2',
};
const NAME_DERIVED_MAC = Uint8Array.of(0xcf, 0x30, 0x16, 0x00, 0xa1, 0xb2);

interface WriteRecord {
  characteristic: string;
  service: string;
  value: Uint8Array;
}

interface FakeBle {
  decodedWrites(): Uint8Array[];
  disconnectRadio(): void;
  emit(plain: Uint8Array): void;
  stopNotifications: ReturnType<typeof vi.fn<() => Promise<void>>>;
  transport: BleTransport;
  writes: WriteRecord[];
}

function writeBits(frame: Uint8Array, start: number, length: number, value: number): void {
  for (let index = 0; index < length; index++) {
    const bit = (value >>> (length - index - 1)) & 1;
    const offset = start + index;
    frame[offset >> 3] |= bit << (7 - (offset & 7));
  }
}

function stateFrame(facelets: string, moveCounter: number): Uint8Array {
  const frame = createMoyu32Command(MOYU32_MESSAGE_STATE);
  const alphabet = 'FBUDLR';
  const readOrder = [2, 5, 0, 3, 4, 1];
  for (let outputFace = 0; outputFace < readOrder.length; outputFace++) {
    const wireFace = readOrder[outputFace]!;
    const face = facelets.slice(outputFace * 9, outputFace * 9 + 9);
    const stickers = `${face.slice(0, 4)}${face.slice(5)}`;
    for (let index = 0; index < stickers.length; index++) {
      writeBits(frame, 8 + wireFace * 24 + index * 3, 3, alphabet.indexOf(stickers[index]!));
    }
  }
  writeBits(frame, 152, 8, moveCounter & 0xff);
  return frame;
}

function moveFrame(
  moveCounter: number,
  codes: readonly number[],
  gaps: readonly number[],
): Uint8Array {
  const frame = createMoyu32Command(MOYU32_MESSAGE_MOVE);
  writeBits(frame, 88, 8, moveCounter & 0xff);
  for (let index = 0; index < 5; index++) {
    writeBits(frame, 96 + index * 5, 5, codes[index] ?? 0);
    writeBits(frame, 8 + index * 16, 16, gaps[index] ?? 0);
  }
  return frame;
}

function batteryFrame(level: number): Uint8Array {
  return createMoyu32Command(MOYU32_MESSAGE_BATTERY, level);
}

function gyroFrame(w: number, x: number, negZ: number, y: number): Uint8Array {
  const frame = createMoyu32Command(MOYU32_MESSAGE_GYRO);
  const view = new DataView(frame.buffer);
  view.setInt32(1, w, true);
  view.setInt32(5, x, true);
  view.setInt32(9, negZ, true);
  view.setInt32(13, y, true);
  return frame;
}

function services(): BleServiceRef[] {
  return [{
    uuid: MOYU32_SERVICE_UUID,
    characteristics: [
      { uuid: MOYU32_NOTIFY_CHARACTERISTIC_UUID, properties: { notify: true } },
      { uuid: MOYU32_WRITE_CHARACTERISTIC_UUID, properties: { write: true } },
    ],
  }];
}

function fakeBle(
  device: BleDeviceRef,
  mac: Uint8Array,
  discoveredServices: BleServiceRef[] = services(),
): FakeBle {
  const cipher = createMoyu32Cipher(mac);
  const writes: WriteRecord[] = [];
  const stopNotifications = vi.fn(async () => undefined);
  let notification: ((value: DataView) => void) | null = null;
  let radioDisconnect = (): void => undefined;
  const transport: BleTransport = {
    connect: vi.fn(async (_deviceId, onDisconnect) => { radioDisconnect = onDisconnect; }),
    disconnect: vi.fn(async () => undefined),
    getMtu: vi.fn(async () => 517),
    getServices: vi.fn(async () => discoveredServices),
    initialize: vi.fn(async () => undefined),
    read: vi.fn(async () => new DataView(new ArrayBuffer(0))),
    requestDevice: vi.fn(async () => device),
    subscribe: vi.fn(async (_deviceId, service, characteristic, onValue) => {
      expect(service).toBe(MOYU32_SERVICE_UUID);
      expect(characteristic).toBe(MOYU32_NOTIFY_CHARACTERISTIC_UUID);
      notification = onValue;
      return stopNotifications;
    }),
    write: vi.fn(async (_deviceId, service, characteristic, value) => {
      writes.push({ characteristic, service, value: Uint8Array.from(value) });
    }),
  };
  return {
    decodedWrites: () => writes.map((write) => cipher.decrypt(write.value)),
    disconnectRadio: () => radioDisconnect(),
    emit(plain) {
      if (!notification) throw new Error('notification subscription is not active');
      const encrypted = cipher.encrypt(plain);
      notification(new DataView(
        encrypted.buffer as ArrayBuffer,
        encrypted.byteOffset,
        encrypted.byteLength,
      ));
    },
    stopNotifications,
    transport,
    writes,
  };
}

describe('Moyu32CubeConnection native bridge', () => {
  it('derives the fallback MAC from the device name and sequences encrypted commands', async () => {
    const fake = fakeBle(NAME_DERIVED_DEVICE, NAME_DERIVED_MAC);
    const connection = new Moyu32CubeConnection(fake.transport, {
      onDisconnect: vi.fn(),
      onGyro: vi.fn(),
      onMove: vi.fn(),
      onProtocolError: vi.fn(),
    });

    await connection.connect(NAME_DERIVED_DEVICE);
    expect(fake.transport.getServices).toHaveBeenCalledWith(NAME_DERIVED_DEVICE.id);
    expect(fake.transport.subscribe).toHaveBeenCalledWith(
      NAME_DERIVED_DEVICE.id,
      MOYU32_SERVICE_UUID,
      MOYU32_NOTIFY_CHARACTERISTIC_UUID,
      expect.any(Function),
    );
    expect(fake.writes.every((write) => (
      write.service === MOYU32_SERVICE_UUID
      && write.characteristic === MOYU32_WRITE_CHARACTERISTIC_UUID
    ))).toBe(true);
    expect(fake.decodedWrites().map((command) => [command[0], command[1], command[2]])).toEqual([
      [MOYU32_MESSAGE_INFO, 0, 0],
      [MOYU32_MESSAGE_STATE, 0, 0],
      [MOYU32_MESSAGE_BATTERY, 0, 0],
      [MOYU32_MESSAGE_GYRO_SWITCH, 0, 1],
    ]);

    await connection.requestState();
    expect(fake.decodedWrites().slice(-2).map((command) => command[0])).toEqual([
      MOYU32_MESSAGE_STATE,
      MOYU32_MESSAGE_BATTERY,
    ]);

    await connection.disconnect();
    expect(fake.decodedWrites().at(-1)?.slice(0, 3)).toEqual(
      createMoyu32Command(MOYU32_MESSAGE_GYRO_SWITCH, 0, 0).slice(0, 3),
    );
    expect(fake.stopNotifications).toHaveBeenCalledOnce();
    expect(fake.transport.disconnect).toHaveBeenCalledWith(NAME_DERIVED_DEVICE.id);
  });

  it('decodes state, battery, gyro and accumulated device timestamps', async () => {
    const fake = fakeBle(ANDROID_DEVICE, ANDROID_MAC);
    const onGyro = vi.fn();
    const onMove = vi.fn();
    const onProtocolError = vi.fn();
    const onState = vi.fn();
    const onStatus = vi.fn();
    const connection = new Moyu32CubeConnection(fake.transport, {
      onDisconnect: vi.fn(), onGyro, onMove, onProtocolError, onState, onStatus,
    });
    await connection.connect(ANDROID_DEVICE);

    fake.emit(stateFrame(MOYU32_SOLVED_STATE, 10));
    fake.emit(createMoyu32Command(MOYU32_MESSAGE_INFO));
    fake.emit(createMoyu32Command(MOYU32_MESSAGE_GYRO_SWITCH, 0, 1));
    fake.emit(batteryFrame(87));
    fake.emit(moveFrame(12, [0, 4], [900, 120]));
    fake.emit(gyroFrame(1073741824, 0, 0, 0));

    expect(onState).toHaveBeenCalledWith(MOYU32_SOLVED_STATE);
    expect(onMove.mock.calls).toEqual([
      ['U', 120],
      ['F', 1020],
    ]);
    expect(onGyro).toHaveBeenCalledWith({ w: 1, x: 0, y: 0, z: -0 });
    expect(onStatus).toHaveBeenLastCalledWith({
      protocol: 'moyu32',
      battery: 87,
      moveCounter: 12,
      pendingMoves: 0,
      badFrames: 0,
      stateReady: true,
    });
    expect(onProtocolError).not.toHaveBeenCalled();

    await connection.disconnect();
  });

  it('fails closed after repeated bad-key frames and ignores later valid data', async () => {
    const fake = fakeBle(ANDROID_DEVICE, ANDROID_MAC);
    const onMove = vi.fn();
    const onProtocolError = vi.fn();
    const onState = vi.fn();
    const connection = new Moyu32CubeConnection(fake.transport, {
      onDisconnect: vi.fn(), onMove, onProtocolError, onState,
    });
    await connection.connect(ANDROID_DEVICE);

    const invalid = new Uint8Array(20);
    invalid[0] = 0x37;
    for (let index = 0; index < 6; index++) fake.emit(invalid);
    fake.emit(stateFrame(MOYU32_SOLVED_STATE, 1));
    fake.emit(moveFrame(2, [0], [50]));

    expect(onProtocolError).toHaveBeenCalledOnce();
    expect(onState).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();

    await connection.disconnect();
  });

  it('isolates notifications that arrive after a radio disconnect', async () => {
    const fake = fakeBle(ANDROID_DEVICE, ANDROID_MAC);
    const onDisconnect = vi.fn();
    const onMove = vi.fn();
    const connection = new Moyu32CubeConnection(fake.transport, {
      onDisconnect, onMove, onProtocolError: vi.fn(),
    });
    await connection.connect(ANDROID_DEVICE);
    fake.emit(stateFrame(MOYU32_SOLVED_STATE, 1));

    fake.disconnectRadio();
    fake.emit(moveFrame(2, [0], [50]));

    expect(onDisconnect).toHaveBeenCalledOnce();
    expect(onMove).not.toHaveBeenCalled();
    await connection.disconnect();
  });

  it('rejects a discovered service that is missing a required characteristic', async () => {
    const fake = fakeBle(ANDROID_DEVICE, ANDROID_MAC, [{
      uuid: MOYU32_SERVICE_UUID,
      characteristics: [
        { uuid: MOYU32_NOTIFY_CHARACTERISTIC_UUID, properties: { notify: true } },
      ],
    }]);
    const connection = new Moyu32CubeConnection(fake.transport, {
      onDisconnect: vi.fn(), onMove: vi.fn(), onProtocolError: vi.fn(),
    });

    await expect(connection.connect(ANDROID_DEVICE)).rejects.toThrow(
      'MoYu32 service or characteristic unavailable',
    );
    await connection.disconnect();
    expect(fake.transport.subscribe).not.toHaveBeenCalled();
    expect(fake.transport.disconnect).toHaveBeenCalledWith(ANDROID_DEVICE.id);
  });
});