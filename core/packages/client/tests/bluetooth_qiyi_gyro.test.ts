import { describe, expect, it, vi } from 'vitest';
import { qiyiDriver } from '@/app/[lang]/timer/_lib/bluetooth/qiyi';
import { aesEcbEncrypt, expandKey } from '@/app/[lang]/timer/_lib/bluetooth/gan_crypto';
import { crc16Modbus } from '@/app/[lang]/timer/_lib/bluetooth/crc';
import { applyOrientation, sensorBasisForBrand } from '@cuberoot/shared/smart-cube/orientation';
import { makeFakeGatt } from './_fake_gatt';

// Real decoded sample in DCTimer-BLE QiyiCubeProtocolTest, including its CRC.
const SAMPLE = Uint8Array.from(Buffer.from('CC100004F663FDBCFE59FEA0FDACDEA1', 'hex'));
const KEY = expandKey(new Uint8Array([0x57, 0xb1, 0xf9, 0xab, 0xcd, 0x5a, 0xe8, 0xa7, 0x9c, 0xb9, 0x8c, 0xe7, 0x57, 0x8c, 0x51, 0x08]));
const CHAR = '0000fff6-0000-1000-8000-00805f9b34fb';

function withCrc(frame: Uint8Array): Uint8Array {
  const crc = crc16Modbus(frame.subarray(0, frame.length - 2));
  frame[frame.length - 2] = crc & 0xff;
  frame[frame.length - 1] = crc >> 8;
  return frame;
}

function stateFrame(ts: number, move: number, history: Array<[number, number]> = []) {
  const frame = new Uint8Array(93);
  frame[0] = 0xfe; frame[1] = 93; frame[2] = 3;
  const dv = new DataView(frame.buffer); dv.setUint32(3, ts, false);
  const solved = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
  for (let i = 0; i < 54; i++) frame[7 + (i >> 1)] |= 'LRDUFB'.indexOf(solved[i]) << ((i % 2) * 4);
  frame[34] = move; frame[35] = 80;
  history.forEach(([time, mv], i) => { dv.setUint32(36 + 5 * i, time, false); frame[40 + 5 * i] = mv; });
  return withCrc(frame);
}

describe('QiYi complete state history', () => {
  it('sorts sparse slots including the first and last, and deduplicates current moves', async () => {
    const r = await rig();
    try {
      const history: Array<[number, number]> = Array.from({ length: 11 }, () => [0xffffffff, 255]);
      history[0] = [320, 4]; history[1] = [160, 2]; history[10] = [480, 6];
      r.feed(stateFrame(480, 6, history));
      expect(r.onMove.mock.calls).toEqual([['L', 100], ['R', 200], ['D', 300]]);
      r.feed(stateFrame(480, 6, history));
      expect(r.onMove).toHaveBeenCalledTimes(3);
    } finally { r.session.cleanup(); }
  });

  it('applies future history after the snapshot and does not rewind or reapply it', async () => {
    const r = await rig();
    try {
      r.feed(stateFrame(160, 2, [[320, 4]]));
      expect(r.onMove.mock.calls).toEqual([['L', 100], ['R', 200, { futureHistory: true }]]);
      expect(r.onMove.mock.invocationCallOrder[0]).toBeLessThan(r.onState.mock.invocationCallOrder[0]);
      expect(r.onState.mock.invocationCallOrder[0]).toBeLessThan(r.onMove.mock.invocationCallOrder[1]);
      r.feed(stateFrame(160, 2));
      expect(r.onState).toHaveBeenCalledOnce();
      r.feed(stateFrame(320, 4));
      expect(r.onMove).toHaveBeenCalledTimes(2);
    } finally { r.session.cleanup(); }
  });
});

async function rig(name = 'XMD-TornadoV4-i-1-A1B2') {
  const gatt = makeFakeGatt(name, { [qiyiDriver.service]: [CHAR] });
  const onGyro = vi.fn(); const onMove = vi.fn(); const onState = vi.fn();
  const session = await qiyiDriver.start(gatt.asServer, onMove, { mac: 'CC:A3:00:00:A1:B2', onGyro, onState });
  const feed = (frame: Uint8Array) => {
    const padded = new Uint8Array(Math.ceil(frame.length / 16) * 16);
    padded.set(frame);
    gatt.char(qiyiDriver.service, CHAR).emit(aesEcbEncrypt(padded, KEY));
  };
  return { gatt, session, feed, onGyro, onMove, onState };
}

describe('QiYi / Tornado V4 gyroscope notifications', () => {
  it.each(['XMD-TornadoV4-i-1-A1B2', 'QY-QYSC-1-A1B2'])('decodes the DCTimer real sample without emitting a move or ACK: %s', async (name) => {
    const r = await rig(name);
    try {
      const writes = r.gatt.writes.length;
      r.feed(SAMPLE);
      expect(r.onGyro).toHaveBeenCalledOnce();
      const q = r.onGyro.mock.calls[0][0];
      const norm = Math.hypot(0.580, 0.423, 0.352, 0.596);
      expect(q.x).toBeCloseTo(-0.580 / norm, 6);
      expect(q.y).toBeCloseTo(-0.423 / norm, 6);
      expect(q.z).toBeCloseTo(-0.352 / norm, 6);
      expect(q.w).toBeCloseTo(-0.596 / norm, 6);
      expect(sensorBasisForBrand('qiyi')).toBe('identity');
      const oriented = applyOrientation(q, null, { basis: sensorBasisForBrand('qiyi') });
      for (const axis of ['w', 'x', 'y', 'z'] as const) expect(oriented[axis]).toBeCloseTo(q[axis], 12);
      expect(r.onMove).not.toHaveBeenCalled();
      expect(r.onState).not.toHaveBeenCalled();
      expect(await r.session.battery()).toBeNull();
      expect(r.gatt.writes).toHaveLength(writes);
      r.session.cleanup();
      r.feed(SAMPLE);
      expect(r.onGyro).toHaveBeenCalledOnce();
    } finally { r.session.cleanup(); }
  });

  it('drops corrupt, wrong-header, wrong-length and zero quaternions', async () => {
    const r = await rig();
    try {
      const corrupt = SAMPLE.slice(); corrupt[6] ^= 1;
      const header = SAMPLE.slice(); header[0] = 0xcb;
      const length = SAMPLE.slice(); length[1] = 15;
      const zero = new Uint8Array(16); zero[0] = 0xcc; zero[1] = 16;
      for (const frame of [corrupt, withCrc(header), withCrc(length), withCrc(zero)]) r.feed(frame);
      expect(r.onGyro).not.toHaveBeenCalled();
      r.feed(SAMPLE);
      expect(r.onGyro).toHaveBeenCalledOnce();
    } finally { r.session.cleanup(); }
  });

  it('keeps ordinary state, move, battery and ACK processing after gyro frames', async () => {
    const r = await rig();
    try {
      r.feed(SAMPLE);
      const frame = new Uint8Array(38);
      frame[0] = 0xfe; frame[1] = 38; frame[2] = 3;
      frame[5] = 6; frame[6] = 64; // 1600 ticks -> 1000 ms.
      const facelets = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
      for (let i = 0; i < 54; i++) frame[7 + (i >> 1)] |= 'LRDUFB'.indexOf(facelets[i]) << ((i % 2) * 4);
      frame[34] = 4; frame[35] = 73;
      r.feed(withCrc(frame));
      await Promise.resolve();
      expect(r.onMove).toHaveBeenCalledExactlyOnceWith('R', 1000);
      expect(r.onState).toHaveBeenCalledExactlyOnceWith(facelets);
      expect(await r.session.battery()).toBe(73);
      expect(r.gatt.writes).toHaveLength(2); // hello + ordinary state ACK
      expect(r.onGyro).toHaveBeenCalledOnce();
    } finally { r.session.cleanup(); }
  });
});
