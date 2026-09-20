import {
  GAN_V2_NOTIFY_CHARACTERISTIC_UUID,
  GAN_V2_SERVICE_UUID,
  GAN_V2_WRITE_CHARACTERISTIC_UUID,
  createGanV2BatteryCommand,
  createGanV2Cipher,
  createGanV2FaceletsCommand,
  createGanV2HardwareInfoCommand,
} from '@cuberoot/shared/smart-cube/gan-v2';
import {
  GAN_V3_NOTIFY_CHARACTERISTIC_UUID,
  GAN_V3_SERVICE_UUID,
  GAN_V3_WRITE_CHARACTERISTIC_UUID,
  createGanV3BatteryCommand,
  createGanV3Cipher,
  createGanV3FaceletsCommand,
  createGanV3HardwareInfoCommand,
  createGanV3HistoryCommand,
} from '@cuberoot/shared/smart-cube/gan-v3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BleDeviceRef, BleServiceRef, BleTransport } from './transport';
import { GanCubeConnection } from './gan-cube';

const MAC = Uint8Array.of(0xab, 0xcd, 0xef, 0x01, 0x23, 0x45);
const SOLVED_CORNERS = [0, 1, 2, 3, 4, 5, 6];
const SOLVED_EDGES = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
const GAN_AXIS_MASKS = [2, 32, 8, 1, 16, 4];

type Protocol = 'v2' | 'v3';

interface WriteRecord {
  characteristic: string;
  service: string;
  value: Uint8Array;
}

interface FakeBle {
  disconnectRadio: () => void;
  emit: (plain: Uint8Array) => void;
  notification: () => ((value: DataView) => void) | null;
  service: string;
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

function writeCubieState(
  frame: Uint8Array,
  cornerPermutationStart: number,
  cornerOrientationStart: number,
  edgePermutationStart: number,
  edgeOrientationStart: number,
): void {
  for (let index = 0; index < 7; index++) {
    writeBits(frame, cornerPermutationStart + index * 3, 3, SOLVED_CORNERS[index]!);
    writeBits(frame, cornerOrientationStart + index * 2, 2, 0);
  }
  for (let index = 0; index < 11; index++) {
    writeBits(frame, edgePermutationStart + index * 4, 4, SOLVED_EDGES[index]! >> 1);
    writeBits(frame, edgeOrientationStart + index, 1, 0);
  }
}

function v2Facelets(counter: number): Uint8Array {
  const frame = new Uint8Array(20);
  writeBits(frame, 0, 4, 4);
  writeBits(frame, 4, 8, counter);
  writeCubieState(frame, 12, 33, 47, 91);
  return frame;
}

function v2Move(counter: number, code: number): Uint8Array {
  const frame = new Uint8Array(20);
  writeBits(frame, 0, 4, 2);
  writeBits(frame, 4, 8, counter);
  writeBits(frame, 12, 5, code);
  for (let index = 1; index < 7; index++) writeBits(frame, 12 + index * 5, 5, 0);
  return frame;
}

function v3Facelets(counter: number): Uint8Array {
  const frame = new Uint8Array(20);
  frame[0] = 0x55;
  frame[1] = 2;
  frame[2] = 0x10;
  frame[3] = counter & 0xff;
  frame[4] = (counter >>> 8) & 0xff;
  writeCubieState(frame, 40, 61, 77, 121);
  return frame;
}

function v3Move(counter: number, axis: number, power: number, timestamp: number): Uint8Array {
  const frame = new Uint8Array(20);
  frame[0] = 0x55;
  frame[1] = 1;
  frame[2] = 8;
  frame[3] = timestamp & 0xff;
  frame[4] = (timestamp >>> 8) & 0xff;
  frame[5] = (timestamp >>> 16) & 0xff;
  frame[6] = (timestamp >>> 24) & 0xff;
  frame[7] = counter & 0xff;
  frame[8] = (counter >>> 8) & 0xff;
  writeBits(frame, 72, 2, power);
  writeBits(frame, 74, 6, GAN_AXIS_MASKS[axis]!);
  return frame;
}

function v3History(
  startCounter: number,
  moves: ReadonlyArray<{ axis: number; power: number }>,
): Uint8Array {
  const frame = new Uint8Array(20);
  frame[0] = 0x55;
  frame[1] = 6;
  frame[2] = Math.ceil(moves.length / 2) + 1;
  frame[3] = startCounter & 0xff;
  for (let index = 0; index < moves.length; index++) {
    writeBits(frame, 32 + index * 4, 3, moves[index]!.axis);
    writeBits(frame, 35 + index * 4, 1, moves[index]!.power);
  }
  return frame;
}

function protocolDetails(protocol: Protocol): {
  device: BleDeviceRef;
  notify: string;
  service: string;
  write: string;
  cipher: ReturnType<typeof createGanV2Cipher> | ReturnType<typeof createGanV3Cipher>;
} {
  if (protocol === 'v2') {
    return {
      device: { id: 'AB:CD:EF:01:23:45', name: 'GAN356 i3' },
      notify: GAN_V2_NOTIFY_CHARACTERISTIC_UUID,
      service: GAN_V2_SERVICE_UUID,
      write: GAN_V2_WRITE_CHARACTERISTIC_UUID,
      cipher: createGanV2Cipher(MAC, 'GAN356 i3'),
    };
  }
  return {
    device: { id: 'AB:CD:EF:01:23:45', name: 'GAN356 i' },
    notify: GAN_V3_NOTIFY_CHARACTERISTIC_UUID,
    service: GAN_V3_SERVICE_UUID,
    write: GAN_V3_WRITE_CHARACTERISTIC_UUID,
    cipher: createGanV3Cipher(MAC),
  };
}

function fakeBle(protocol: Protocol): FakeBle {
  const details = protocolDetails(protocol);
  const services: BleServiceRef[] = [{
    uuid: details.service,
    characteristics: [
      { uuid: details.notify, properties: { notify: true } },
      { uuid: details.write, properties: { write: true } },
    ],
  }];
  const writes: WriteRecord[] = [];
  let notification: ((value: DataView) => void) | null = null;
  let disconnectRadio = (): void => {};
  const transport: BleTransport = {
    connect: vi.fn(async (_deviceId, onDisconnect) => { disconnectRadio = onDisconnect; }),
    disconnect: vi.fn(async () => undefined),
    getMtu: vi.fn(async () => 517),
    getServices: vi.fn(async () => services),
    initialize: vi.fn(async () => undefined),
    read: vi.fn(async () => new DataView(new ArrayBuffer(0))),
    requestDevice: vi.fn(async () => details.device),
    subscribe: vi.fn(async (_deviceId, service, characteristic, onValue) => {
      expect(service).toBe(details.service);
      expect(characteristic).toBe(details.notify);
      notification = onValue;
      return vi.fn(async () => undefined);
    }),
    write: vi.fn(async (_deviceId, service, characteristic, value) => {
      writes.push({ characteristic, service, value: Uint8Array.from(value) });
    }),
  };
  return {
    disconnectRadio: () => disconnectRadio(),
    emit(plain) {
      const encrypted = details.cipher.encrypt(plain);
      notification?.(new DataView(encrypted.buffer as ArrayBuffer));
    },
    notification: () => notification,
    service: details.service,
    transport,
    writes,
  };
}

function decodedCommands(protocol: Protocol, writes: readonly WriteRecord[]): Uint8Array[] {
  const details = protocolDetails(protocol);
  return writes.map((write) => details.cipher.decrypt(write.value));
}

describe('GanCubeConnection native service bridge', () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    ['v2', GAN_V2_SERVICE_UUID, GAN_V2_NOTIFY_CHARACTERISTIC_UUID, GAN_V2_WRITE_CHARACTERISTIC_UUID,
      [createGanV2HardwareInfoCommand(), createGanV2FaceletsCommand(), createGanV2BatteryCommand()]],
    ['v3', GAN_V3_SERVICE_UUID, GAN_V3_NOTIFY_CHARACTERISTIC_UUID, GAN_V3_WRITE_CHARACTERISTIC_UUID,
      [createGanV3HardwareInfoCommand(), createGanV3FaceletsCommand(), createGanV3BatteryCommand()]],
  ] as const)('selects the %s GATT service and sends its encrypted handshake', async (
    protocol,
    service,
    notify,
    write,
    expectedCommands,
  ) => {
    const fake = fakeBle(protocol);
    const connection = new GanCubeConnection(fake.transport, {
      onDisconnect: vi.fn(), onMove: vi.fn(), onProtocolError: vi.fn(),
    });
    await connection.connect(protocolDetails(protocol).device);

    expect(fake.transport.getServices).toHaveBeenCalledWith(protocolDetails(protocol).device.id);
    expect(connection.getProtocol()).toBe(protocol === 'v2' ? 'gan-v2' : 'gan-v3');
    expect(fake.writes.every((entry) => entry.service === service && entry.characteristic === write)).toBe(true);
    expect(fake.notification()).not.toBeNull();
    expect(decodedCommands(protocol, fake.writes)).toEqual(expectedCommands);
    expect(fake.transport.subscribe).toHaveBeenCalledWith(
      protocolDetails(protocol).device.id,
      service,
      notify,
      expect.any(Function),
    );

    await connection.disconnect();
    expect(connection.getProtocol()).toBeNull();
  });

  it('decrypts a GAN v2 state and move notification through the native bridge', async () => {
    const fake = fakeBle('v2');
    const onMove = vi.fn();
    const onState = vi.fn();
    const onStatus = vi.fn();
    const connection = new GanCubeConnection(fake.transport, {
      onDisconnect: vi.fn(), onMove, onProtocolError: vi.fn(), onState, onStatus,
    });
    await connection.connect(protocolDetails('v2').device);

    fake.emit(v2Facelets(40));
    fake.emit(v2Move(41, 2));

    expect(onState).toHaveBeenCalledWith('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
    expect(onMove).toHaveBeenCalledWith('R');
    expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({
      protocol: 'gan-v2', moveCounter: 41, stateReady: true,
    }));

    await connection.disconnect();
  });

  it('recovers a dropped GAN v3 move with the protocol history command', async () => {
    vi.useFakeTimers();
    const fake = fakeBle('v3');
    const onMove = vi.fn();
    const connection = new GanCubeConnection(fake.transport, {
      onDisconnect: vi.fn(), onMove, onProtocolError: vi.fn(),
    });
    await connection.connect(protocolDetails('v3').device);

    fake.emit(v3Facelets(10));
    fake.emit(v3Move(11, 0, 0, 500_000));
    fake.emit(v3Move(13, 2, 1, 500_120));
    await Promise.resolve();

    const commands = decodedCommands('v3', fake.writes);
    expect(commands.at(-1)).toEqual(createGanV3HistoryCommand(13, 2));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenLastCalledWith('U', 500_000);

    fake.emit(v3History(13, [
      { axis: 3, power: 1 },
      { axis: 5, power: 1 },
    ]));

    expect(onMove.mock.calls.map(([move, timestamp]) => [move, timestamp])).toEqual([
      ['U', 500_000],
      ["R'", 500_060],
      ["F'", 500_120],
    ]);

    await connection.disconnect();
  });

  it('ignores late notifications after a radio disconnect', async () => {
    const fake = fakeBle('v2');
    const onMove = vi.fn();
    const onDisconnect = vi.fn();
    const connection = new GanCubeConnection(fake.transport, {
      onDisconnect, onMove, onProtocolError: vi.fn(),
    });
    await connection.connect(protocolDetails('v2').device);
    fake.emit(v2Facelets(1));
    fake.disconnectRadio();
    fake.emit(v2Move(2, 2));

    expect(onDisconnect).toHaveBeenCalledOnce();
    expect(onMove).not.toHaveBeenCalled();
    await connection.disconnect();
  });

  it('fails closed on repeated invalid v3 frames and ignores later valid frames', async () => {
    const fake = fakeBle('v3');
    const onMove = vi.fn();
    const onProtocolError = vi.fn();
    const connection = new GanCubeConnection(fake.transport, {
      onDisconnect: vi.fn(), onMove, onProtocolError,
    });
    await connection.connect(protocolDetails('v3').device);
    const invalid = new Uint8Array(20);
    for (let index = 0; index < 6; index++) fake.emit(invalid);
    fake.emit(v3Facelets(1));
    fake.emit(v3Move(2, 2, 0, 10));

    expect(onProtocolError).toHaveBeenCalledOnce();
    expect(onMove).not.toHaveBeenCalled();
    await connection.disconnect();
  });
});
