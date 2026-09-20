import {
  buildQiyiPacket,
  createQiyiAckCommand,
  createQiyiCipher,
  createQiyiHelloCommand,
  QIYI_CHARACTERISTIC_UUID,
  QIYI_OP_HELLO,
  QIYI_OP_STATE,
  QIYI_SERVICE_UUID,
  QIYI_SOLVED_STATE,
  QIYI_WRITE_CHARACTERISTIC_UUID,
} from '@cuberoot/shared/smart-cube/qiyi';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BleDeviceRef, BleServiceRef, BleTransport } from './transport';
import { QiyiCubeConnection } from './qiyi-cube';

const ANDROID_DEVICE: BleDeviceRef = {
  id: '12:34:56:78:9A:BC',
  name: 'QY-QYSC-1-A1B2',
};
const ANDROID_MAC = Uint8Array.of(0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc);
const NAME_MAC = Uint8Array.of(0xcc, 0xa3, 0x00, 0x00, 0xa1, 0xb2);
const NAME_DERIVED_DEVICE: BleDeviceRef = {
  id: 'native-device-id',
  name: 'XMD-TornadoV4-i-1-A1B2',
};
const REAL_GYRO_SAMPLE = Uint8Array.of(
  0xcc, 0x10, 0x00, 0x04, 0xf6, 0x63, 0xfd, 0xbc,
  0xfe, 0x59, 0xfe, 0xa0, 0xfd, 0xac, 0xde, 0xa1,
);

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

function encodeFacelets(content: Uint8Array, facelets: string): void {
  for (let index = 0; index < facelets.length; index++) {
    content[5 + (index >> 1)] |= (
      'LRDUFB'.indexOf(facelets[index]!) << ((index & 1) * 4)
    );
  }
}

function notificationFrame(
  opcode: number,
  timestamp: number,
  move = 0,
  battery = 80,
  history: ReadonlyArray<{ timestamp: number; move: number }> = [],
): Uint8Array {
  const content = new Uint8Array(opcode === QIYI_OP_STATE ? 89 : 34);
  const view = new DataView(content.buffer);
  content[0] = opcode;
  view.setUint32(1, timestamp, false);
  encodeFacelets(content, QIYI_SOLVED_STATE);
  content[32] = move;
  content[33] = battery;
  if (opcode === QIYI_OP_STATE) {
    content.fill(0xff, 34);
    history.forEach((entry, index) => {
      const offset = 34 + index * 5;
      view.setUint32(offset, entry.timestamp, false);
      content[offset + 4] = entry.move;
    });
  }
  return buildQiyiPacket(Array.from(content));
}

function services(options: {
  fallbackWrite?: boolean;
  fullDuplexWrite?: boolean;
  notify?: boolean;
} = {}): BleServiceRef[] {
  const {
    fallbackWrite = true,
    fullDuplexWrite = true,
    notify = true,
  } = options;
  return [{
    uuid: QIYI_SERVICE_UUID,
    characteristics: [
      {
        uuid: QIYI_CHARACTERISTIC_UUID,
        properties: { notify, write: fullDuplexWrite },
      },
      ...(fallbackWrite ? [{
        uuid: QIYI_WRITE_CHARACTERISTIC_UUID,
        properties: { write: true },
      }] : []),
    ],
  }];
}

function fakeBle(
  device: BleDeviceRef,
  discoveredServices: BleServiceRef[] = services(),
): FakeBle {
  const cipher = createQiyiCipher();
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
      expect(service).toBe(QIYI_SERVICE_UUID);
      expect(characteristic).toBe(QIYI_CHARACTERISTIC_UUID);
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

async function flushWrites(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('QiyiCubeConnection native bridge', () => {
  afterEach(() => vi.useRealTimers());

  it('uses the Android address first, retries the name MAC, and prefers fff6 writes', async () => {
    vi.useFakeTimers();
    const fake = fakeBle(ANDROID_DEVICE);
    const onState = vi.fn();
    const connection = new QiyiCubeConnection(fake.transport, {
      onDisconnect: vi.fn(), onMove: vi.fn(), onProtocolError: vi.fn(), onState,
    });

    await connection.connect(ANDROID_DEVICE);
    expect(fake.decodedWrites()).toEqual([createQiyiHelloCommand(ANDROID_MAC)]);
    expect(fake.writes[0]).toMatchObject({
      characteristic: QIYI_CHARACTERISTIC_UUID,
      service: QIYI_SERVICE_UUID,
    });

    await vi.advanceTimersByTimeAsync(1_500);
    expect(fake.decodedWrites()).toEqual([
      createQiyiHelloCommand(ANDROID_MAC),
      createQiyiHelloCommand(NAME_MAC),
    ]);

    fake.emit(notificationFrame(QIYI_OP_HELLO, 160, 0, 91));
    await flushWrites();
    expect(fake.decodedWrites().at(-1)).toEqual(createQiyiAckCommand(QIYI_OP_HELLO, 160));
    expect(onState).toHaveBeenCalledWith(QIYI_SOLVED_STATE);
    const writesAfterHello = fake.writes.length;
    await vi.advanceTimersByTimeAsync(3_000);
    expect(fake.writes).toHaveLength(writesAfterHello);

    await connection.requestState();
    expect(fake.decodedWrites().at(-1)).toEqual(createQiyiHelloCommand(NAME_MAC));
    await connection.disconnect();
  });

  it('derives a name MAC and falls back to the fff5 write characteristic', async () => {
    const fake = fakeBle(NAME_DERIVED_DEVICE, services({ fullDuplexWrite: false }));
    const connection = new QiyiCubeConnection(fake.transport, {
      onDisconnect: vi.fn(), onMove: vi.fn(), onProtocolError: vi.fn(),
    });

    await connection.connect(NAME_DERIVED_DEVICE);

    expect(fake.decodedWrites()).toEqual([createQiyiHelloCommand(NAME_MAC)]);
    expect(fake.writes[0]).toMatchObject({
      characteristic: QIYI_WRITE_CHARACTERISTIC_UUID,
      service: QIYI_SERVICE_UUID,
    });
    await connection.disconnect();
  });

  it('applies current moves, then state, then future history and acknowledges the frame', async () => {
    const fake = fakeBle(ANDROID_DEVICE);
    const order: string[] = [];
    const onMove = vi.fn((move: string, _timestamp?: number, metadata?: { futureHistory?: boolean }) => {
      order.push(metadata?.futureHistory ? `future:${move}` : `move:${move}`);
    });
    const onState = vi.fn(() => { order.push('state'); });
    const onStatus = vi.fn();
    const connection = new QiyiCubeConnection(fake.transport, {
      onDisconnect: vi.fn(), onMove, onProtocolError: vi.fn(), onState, onStatus,
    });
    await connection.connect(ANDROID_DEVICE);

    fake.emit(notificationFrame(QIYI_OP_STATE, 160, 2, 83, [
      { timestamp: 320, move: 4 },
    ]));
    await flushWrites();

    expect(order).toEqual(['move:L', 'state', 'future:R']);
    expect(onMove.mock.calls).toEqual([
      ['L', 100],
      ['R', 200, { futureHistory: true }],
    ]);
    expect(onState).toHaveBeenCalledWith(QIYI_SOLVED_STATE);
    expect(onStatus).toHaveBeenLastCalledWith({
      protocol: 'qiyi',
      battery: 83,
      moveCounter: 320,
      pendingMoves: 0,
      badFrames: 0,
      stateReady: true,
    });
    expect(fake.decodedWrites().at(-1)).toEqual(createQiyiAckCommand(QIYI_OP_STATE, 160));

    fake.emit(notificationFrame(QIYI_OP_HELLO, 160, 0, 10));
    expect(onState).toHaveBeenCalledOnce();
    expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({
      battery: 83,
      moveCounter: 320,
    }));

    fake.emit(notificationFrame(QIYI_OP_STATE, 320, 4));
    expect(onMove).toHaveBeenCalledTimes(2);
    await connection.disconnect();
  });

  it('decodes the DCTimer gyro sample without sending an ACK', async () => {
    const fake = fakeBle(ANDROID_DEVICE);
    const onGyro = vi.fn();
    const connection = new QiyiCubeConnection(fake.transport, {
      onDisconnect: vi.fn(), onGyro, onMove: vi.fn(), onProtocolError: vi.fn(),
    });
    await connection.connect(ANDROID_DEVICE);
    const writesBeforeGyro = fake.writes.length;

    fake.emit(REAL_GYRO_SAMPLE);
    await flushWrites();

    const norm = Math.hypot(0.580, 0.423, 0.352, 0.596);
    expect(onGyro).toHaveBeenCalledWith({
      x: -0.580 / norm,
      y: -0.423 / norm,
      z: -0.352 / norm,
      w: -0.596 / norm,
    });
    expect(fake.writes).toHaveLength(writesBeforeGyro);
    await connection.disconnect();
  });

  it('fails closed after repeated invalid frames and ignores later valid data', async () => {
    const fake = fakeBle(ANDROID_DEVICE);
    const onMove = vi.fn();
    const onProtocolError = vi.fn();
    const onState = vi.fn();
    const connection = new QiyiCubeConnection(fake.transport, {
      onDisconnect: vi.fn(), onMove, onProtocolError, onState,
    });
    await connection.connect(ANDROID_DEVICE);

    for (let index = 0; index < 6; index++) fake.emit(new Uint8Array(16));
    fake.emit(notificationFrame(QIYI_OP_STATE, 160, 2));

    expect(onProtocolError).toHaveBeenCalledOnce();
    expect(onMove).not.toHaveBeenCalled();
    expect(onState).not.toHaveBeenCalled();
    await connection.disconnect();
  });

  it('isolates notifications that arrive after a radio disconnect', async () => {
    const fake = fakeBle(ANDROID_DEVICE);
    const onDisconnect = vi.fn();
    const onMove = vi.fn();
    const connection = new QiyiCubeConnection(fake.transport, {
      onDisconnect, onMove, onProtocolError: vi.fn(),
    });
    await connection.connect(ANDROID_DEVICE);

    fake.disconnectRadio();
    fake.emit(notificationFrame(QIYI_OP_STATE, 160, 2));

    expect(onDisconnect).toHaveBeenCalledOnce();
    expect(onMove).not.toHaveBeenCalled();
    await connection.disconnect();
  });

  it.each([
    ['notify', services({ notify: false })],
    ['write', services({ fallbackWrite: false, fullDuplexWrite: false })],
  ] as const)('rejects a service missing the required %s capability', async (_capability, discoveredServices) => {
    const fake = fakeBle(ANDROID_DEVICE, discoveredServices);
    const connection = new QiyiCubeConnection(fake.transport, {
      onDisconnect: vi.fn(), onMove: vi.fn(), onProtocolError: vi.fn(),
    });

    await expect(connection.connect(ANDROID_DEVICE)).rejects.toThrow(/QiYi (notify|write) characteristic unavailable/);
    await connection.disconnect();
    expect(fake.transport.subscribe).not.toHaveBeenCalled();
    expect(fake.transport.disconnect).toHaveBeenCalledWith(ANDROID_DEVICE.id);
  });
});