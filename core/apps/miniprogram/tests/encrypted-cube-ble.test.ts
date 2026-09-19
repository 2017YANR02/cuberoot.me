import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MOYU32_NOTIFY_CHARACTERISTIC_UUID,
  MOYU32_SERVICE_UUID,
  MOYU32_WRITE_CHARACTERISTIC_UUID,
  createMoyu32Cipher,
} from '@cuberoot/shared/smart-cube/moyu32';
import {
  QIYI_CHARACTERISTIC_UUID,
  QIYI_SERVICE_UUID,
  QIYI_WRITE_CHARACTERISTIC_UUID,
  buildQiyiPacket,
  createQiyiCipher,
} from '@cuberoot/shared/smart-cube/qiyi';
import type {
  CharacteristicValueChange,
  MiniProgramBleApi,
} from '../src/lib/smart-cube/ble-api';
import { connectMoyu32 } from '../src/lib/smart-cube/moyu32-ble';
import { connectQiyi } from '../src/lib/smart-cube/qiyi-ble';

type ValueListener = Parameters<MiniProgramBleApi['onBLECharacteristicValueChange']>[0];

afterEach(() => {
  vi.useRealTimers();
});

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

function writeBits(frame: Uint8Array, offset: number, length: number, value: number): void {
  for (let index = 0; index < length; index++) {
    const bit = (value >>> (length - 1 - index)) & 1;
    const absolute = offset + index;
    frame[absolute >> 3] |= bit << (7 - (absolute & 7));
  }
}

function solvedMoyu32StateFrame(moveCount: number): Uint8Array {
  const frame = new Uint8Array(20);
  const alphabet = 'FBUDLR';
  const readOrder = [2, 5, 0, 3, 4, 1];
  frame[0] = 0xa3;
  frame[19] = moveCount & 0xff;
  for (let outputFace = 0; outputFace < 6; outputFace++) {
    const wireFace = readOrder[outputFace];
    const colour = alphabet.indexOf('URFDLB'[outputFace]);
    for (let sticker = 0; sticker < 8; sticker++) {
      writeBits(frame, 8 + wireFace * 24 + sticker * 3, 3, colour);
    }
  }
  return frame;
}

function createApi(options: {
  characteristics?: Array<{
    properties?: { notify?: boolean; write?: boolean; writeNoResponse?: boolean };
    uuid: string;
  }>;
  notifyCharacteristicUuid: string;
  deviceId?: string;
  failWrites?: number;
  onWrite?(write: {
    characteristicId: string;
    value: Uint8Array;
    writeType?: 'write' | 'writeNoResponse';
  }, emit: (value: Uint8Array) => void): void;
  serviceUuid: string;
  writeCharacteristicUuid: string;
}) {
  let valueListener: ValueListener | undefined;
  const mtuRequests: number[] = [];
  let remainingWriteFailures = options.failWrites ?? 0;
  const emit = (value: Uint8Array): void => {
    const event: CharacteristicValueChange = {
      characteristicId: options.notifyCharacteristicUuid,
      deviceId: options.deviceId ?? 'ios-device-uuid',
      serviceId: options.serviceUuid,
      value: toArrayBuffer(value),
    };
    valueListener?.(event);
  };
  const api: MiniProgramBleApi = {
    openBluetoothAdapter(callbacks) { callbacks.success?.({}); },
    closeBluetoothAdapter(callbacks) { callbacks.success?.({}); },
    startBluetoothDevicesDiscovery(callbacks) { callbacks.success?.({}); },
    stopBluetoothDevicesDiscovery(callbacks) { callbacks.success?.({}); },
    onBluetoothDeviceFound() {},
    offBluetoothDeviceFound() {},
    createBLEConnection(callbacks) { callbacks.success?.({}); },
    closeBLEConnection(callbacks) { callbacks.success?.({}); },
    getBLEDeviceServices(callbacks) {
      callbacks.success?.({ services: [{ uuid: options.serviceUuid }] });
    },
    getBLEDeviceCharacteristics(callbacks) {
      callbacks.success?.({
        characteristics: options.characteristics ?? [
          { uuid: options.writeCharacteristicUuid, properties: { write: true } },
          { uuid: options.notifyCharacteristicUuid, properties: { notify: true } },
        ],
      });
    },
    notifyBLECharacteristicValueChange(callbacks) { callbacks.success?.({}); },
    onBLECharacteristicValueChange(listener) { valueListener = listener; },
    offBLECharacteristicValueChange(listener) {
      if (valueListener === listener) valueListener = undefined;
    },
    writeBLECharacteristicValue(callbacks) {
      if (remainingWriteFailures > 0) {
        remainingWriteFailures--;
        callbacks.fail?.({ errCode: 10008, errMsg: 'system error' });
        return;
      }
      options.onWrite?.({
        characteristicId: callbacks.characteristicId,
        value: new Uint8Array(callbacks.value),
        writeType: (callbacks as typeof callbacks & {
          writeType?: 'write' | 'writeNoResponse';
        }).writeType,
      }, emit);
      callbacks.success?.({});
    },
    setBLEMTU(callbacks) {
      mtuRequests.push(callbacks.mtu);
      callbacks.success?.({});
    },
  };
  return { api, emit, mtuRequests };
}

describe('encrypted smart-cube mini program transport', () => {
  it('uses the advertised MoYu32 MAC so state seeds the move counter', async () => {
    const mac = Uint8Array.from([0xcf, 0x30, 0x16, 0x00, 0x12, 0x34]);
    const cipher = createMoyu32Cipher(mac);
    const rig = createApi({
      characteristics: [
        { uuid: MOYU32_WRITE_CHARACTERISTIC_UUID, properties: { writeNoResponse: true } },
        { uuid: MOYU32_NOTIFY_CHARACTERISTIC_UUID, properties: { notify: true } },
      ],
      notifyCharacteristicUuid: MOYU32_NOTIFY_CHARACTERISTIC_UUID,
      onWrite(write, emit) {
        if (write.writeType !== 'writeNoResponse') return;
        const request = cipher.decrypt(write.value);
        if (request[0] !== 0xa3) return;
        emit(cipher.encrypt(solvedMoyu32StateFrame(5)));
      },
      serviceUuid: MOYU32_SERVICE_UUID,
      writeCharacteristicUuid: MOYU32_WRITE_CHARACTERISTIC_UUID,
    });
    const moves: string[] = [];
    const connection = await connectMoyu32({
      api: rig.api,
      device: {
        advertisData: Uint8Array.from([0x00, 0x01, 0x34, 0x12, 0x00, 0x16, 0x30, 0xcf]).buffer,
        deviceId: 'ios-device-uuid',
        name: 'WCU_MY32_A1B2',
      },
      onMove: (move) => moves.push(move),
    });

    const move = new Uint8Array(20);
    move[0] = 0xa5;
    move[11] = 6;
    writeBits(move, 8, 16, 16);
    writeBits(move, 96, 5, 0);
    rig.emit(cipher.encrypt(move));

    expect(moves).toEqual(['F']);
    await connection.disconnect();
  });

  it('never uses a MAC-shaped Mini Program deviceId as the MoYu32 protocol MAC', async () => {
    const mac = Uint8Array.from([0xcf, 0x30, 0x16, 0x00, 0x12, 0x34]);
    const cipher = createMoyu32Cipher(mac);
    const rig = createApi({
      characteristics: [
        { uuid: MOYU32_WRITE_CHARACTERISTIC_UUID, properties: { writeNoResponse: true } },
        { uuid: MOYU32_NOTIFY_CHARACTERISTIC_UUID, properties: { notify: true } },
      ],
      deviceId: 'AA:BB:CC:DD:EE:FF',
      notifyCharacteristicUuid: MOYU32_NOTIFY_CHARACTERISTIC_UUID,
      onWrite(write, emit) {
        const request = cipher.decrypt(write.value);
        if (request[0] === 0xa3) emit(cipher.encrypt(solvedMoyu32StateFrame(5)));
      },
      serviceUuid: MOYU32_SERVICE_UUID,
      writeCharacteristicUuid: MOYU32_WRITE_CHARACTERISTIC_UUID,
    });

    const connection = await connectMoyu32({
      api: rig.api,
      device: {
        deviceId: 'AA:BB:CC:DD:EE:FF',
        name: 'WCU_MY32_1234',
      },
    });

    await connection.disconnect();
  });

  it('uses the advertised QiYi MAC in hello and requests an MTU for state frames', async () => {
    const cipher = createQiyiCipher();
    const advertisedMac = [0x34, 0x12, 0x00, 0x00, 0xa3, 0xcc];
    const rig = createApi({
      characteristics: [
        {
          uuid: QIYI_CHARACTERISTIC_UUID,
          properties: { notify: true, writeNoResponse: true },
        },
        { uuid: QIYI_WRITE_CHARACTERISTIC_UUID, properties: { write: true } },
      ],
      notifyCharacteristicUuid: QIYI_CHARACTERISTIC_UUID,
      serviceUuid: QIYI_SERVICE_UUID,
      writeCharacteristicUuid: QIYI_WRITE_CHARACTERISTIC_UUID,
      onWrite(write, emit) {
        if (write.characteristicId !== QIYI_CHARACTERISTIC_UUID
          || write.writeType !== 'writeNoResponse') return;
        const hello = cipher.decrypt(write.value);
        if (!advertisedMac.every((part, index) => hello[13 + index] === part)) return;
        const content = new Array<number>(34).fill(0);
        content[0] = 0x03;
        content[4] = 160;
        content[32] = 10;
        content[33] = 80;
        emit(cipher.encrypt(buildQiyiPacket(content)));
      },
    });
    const moves: string[] = [];
    const connection = await connectQiyi({
      api: rig.api,
      device: {
        advertisData: Uint8Array.from([0x04, 0x05, ...advertisedMac]).buffer,
        deviceId: 'ios-device-uuid',
        name: 'QY-QYSC-2-A1B2',
      },
      onMove: (move) => moves.push(move),
    });

    expect(rig.mtuRequests).toEqual([64]);
    expect(moves).toEqual(['F']);
    await connection.disconnect();
  });

  it('never uses a MAC-shaped Mini Program deviceId as the QiYi hello MAC', async () => {
    const cipher = createQiyiCipher();
    const expectedHelloMac = [0x34, 0x12, 0x00, 0x00, 0xa3, 0xcc];
    const rig = createApi({
      characteristics: [{
        uuid: QIYI_CHARACTERISTIC_UUID,
        properties: { notify: true, writeNoResponse: true },
      }],
      deviceId: 'AA:BB:CC:DD:EE:FF',
      notifyCharacteristicUuid: QIYI_CHARACTERISTIC_UUID,
      serviceUuid: QIYI_SERVICE_UUID,
      writeCharacteristicUuid: QIYI_WRITE_CHARACTERISTIC_UUID,
      onWrite(write, emit) {
        const hello = cipher.decrypt(write.value);
        if (!expectedHelloMac.every((part, index) => hello[13 + index] === part)) return;
        const content = new Array<number>(34).fill(0);
        content[0] = 0x02;
        content[33] = 80;
        emit(cipher.encrypt(buildQiyiPacket(content)));
      },
    });

    const connection = await connectQiyi({
      api: rig.api,
      device: {
        deviceId: 'AA:BB:CC:DD:EE:FF',
        name: 'QY-QYSC-2-1234',
      },
    });

    await connection.disconnect();
  });

  it('does not report a QiYi connection before the protocol answers', async () => {
    vi.useFakeTimers();
    let writes = 0;
    const rig = createApi({
      characteristics: [
        {
          uuid: QIYI_CHARACTERISTIC_UUID,
          properties: { notify: true, writeNoResponse: true },
        },
      ],
      notifyCharacteristicUuid: QIYI_CHARACTERISTIC_UUID,
      serviceUuid: QIYI_SERVICE_UUID,
      writeCharacteristicUuid: QIYI_WRITE_CHARACTERISTIC_UUID,
      onWrite() { writes++; },
    });
    const connection = connectQiyi({
      api: rig.api,
      device: {
        advertisData: Uint8Array.from([0x04, 0x05, 0x34, 0x12, 0x00, 0x00, 0xa3, 0xcc]).buffer,
        deviceId: 'ios-device-uuid',
        name: 'QY-QYSC-2-A1B2',
      },
    });
    const rejection = expect(connection).rejects.toThrow('智能魔方协议未响应');

    await vi.advanceTimersByTimeAsync(5_000);

    await rejection;
    expect(writes).toBe(2);
  });

  it('does not accept an invalid MoYu32 state frame as a completed handshake', async () => {
    vi.useFakeTimers();
    const mac = Uint8Array.from([0xcf, 0x30, 0x16, 0x00, 0x12, 0x34]);
    const cipher = createMoyu32Cipher(mac);
    const rig = createApi({
      characteristics: [
        { uuid: MOYU32_WRITE_CHARACTERISTIC_UUID, properties: { writeNoResponse: true } },
        { uuid: MOYU32_NOTIFY_CHARACTERISTIC_UUID, properties: { notify: true } },
      ],
      notifyCharacteristicUuid: MOYU32_NOTIFY_CHARACTERISTIC_UUID,
      serviceUuid: MOYU32_SERVICE_UUID,
      writeCharacteristicUuid: MOYU32_WRITE_CHARACTERISTIC_UUID,
      onWrite(write, emit) {
        const request = cipher.decrypt(write.value);
        if (request[0] !== 0xa3) return;
        const invalidState = new Uint8Array(20);
        invalidState[0] = 0xa3;
        invalidState[1] = 0xff;
        emit(cipher.encrypt(invalidState));
      },
    });
    const connection = connectMoyu32({
      api: rig.api,
      device: {
        advertisData: Uint8Array.from([0x00, 0x01, 0x34, 0x12, 0x00, 0x16, 0x30, 0xcf]).buffer,
        deviceId: 'ios-device-uuid',
        name: 'WCU_MY32_A1B2',
      },
    });
    const rejection = expect(connection).rejects.toThrow('智能魔方协议未响应');

    await vi.advanceTimersByTimeAsync(4_000);

    await rejection;
  });

  it('retries QiYi initialization after the Android post-notify write race', async () => {
    vi.useFakeTimers();
    const cipher = createQiyiCipher();
    const advertisedMac = [0x34, 0x12, 0x00, 0x00, 0xa3, 0xcc];
    const rig = createApi({
      characteristics: [{
        uuid: QIYI_CHARACTERISTIC_UUID,
        properties: { notify: true, writeNoResponse: true },
      }],
      failWrites: 1,
      notifyCharacteristicUuid: QIYI_CHARACTERISTIC_UUID,
      serviceUuid: QIYI_SERVICE_UUID,
      writeCharacteristicUuid: QIYI_WRITE_CHARACTERISTIC_UUID,
      onWrite(write, emit) {
        const hello = cipher.decrypt(write.value);
        if (!advertisedMac.every((part, index) => hello[13 + index] === part)) return;
        const content = new Array<number>(34).fill(0);
        content[0] = 0x02;
        content[33] = 80;
        emit(cipher.encrypt(buildQiyiPacket(content)));
      },
    });
    const connection = connectQiyi({
      api: rig.api,
      device: {
        advertisData: Uint8Array.from([0x04, 0x05, ...advertisedMac]).buffer,
        deviceId: 'ios-device-uuid',
        name: 'QY-QYSC-2-A1B2',
      },
    });

    await vi.advanceTimersByTimeAsync(1_500);
    const connected = await connection;

    await connected.disconnect();
  });
});
