import { describe, expect, it, vi } from 'vitest';
import { qiyiDriver } from '@/app/[lang]/timer/_lib/bluetooth/qiyi';
import { moyu32Driver, MOYU32_KEY_BASE, MOYU32_IV_BASE, decodeMoyu32Quaternion } from '@/app/[lang]/timer/_lib/bluetooth/moyu32';
import { aesEcbDecrypt, aesEcbEncrypt, deriveKeyFromMac, expandKey, encryptFrame, decryptFrame } from '@/app/[lang]/timer/_lib/bluetooth/gan_crypto';
import { crc16Modbus } from '@/app/[lang]/timer/_lib/bluetooth/crc';
import { applyOrientation, sensorBasisForBrand } from '@cuberoot/shared/smart-cube/orientation';
import { createDeviceStateReset } from '@/app/[lang]/timer/_lib/bluetooth/device_reset';
import { makeFakeGatt } from './_fake_gatt';
import { packBits } from './_bt_frame_fixtures';
import { cubeMove } from '@cuberoot/puzzle-solvers/timer-333-cube';

const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
const QY_CHAR = '0000fff6-0000-1000-8000-00805f9b34fb';
const MY_READ = '0783b03e-7735-b5a0-1760-a305d2795cb1';
const MY_WRITE = '0783b03e-7735-b5a0-1760-a305d2795cb2';
const MY_RESET = Uint8Array.from(Buffer.from('A20000002492494924926DB6DB924924B6DB6D00', 'hex'));
const QY_STICKERS = Uint8Array.from(Buffer.from('333333331311111111444444442422222222000000005055555555', 'hex'));
const qyKey = expandKey(new Uint8Array([0x57,0xb1,0xf9,0xab,0xcd,0x5a,0xe8,0xa7,0x9c,0xb9,0x8c,0xe7,0x57,0x8c,0x51,0x08]));
const myMac = new Uint8Array([0xcf,0x30,0x16,0,0xa1,0xb2]);
const myKey = expandKey(deriveKeyFromMac(MOYU32_KEY_BASE, myMac));
const myIv = deriveKeyFromMac(MOYU32_IV_BASE, myMac);

function qyReply(op: number, ts: number) {
  const frame = new Uint8Array(48);
  frame.set([0xfe, 38, op]);
  new DataView(frame.buffer).setUint32(3, ts, false);
  frame.set(QY_STICKERS, 7); frame[35] = 80;
  const crc = crc16Modbus(frame.subarray(0, 36)); frame[36] = crc & 255; frame[37] = crc >> 8;
  return aesEcbEncrypt(frame, qyKey);
}

function myState(facelets: string, counter: number) {
  const bits: Array<[number, number, number]> = [[0, 8, 0xa3], [152, 8, counter]];
  [2, 5, 0, 3, 4, 1].forEach((wireFace, face) => {
    let sticker = 0;
    for (let i = 0; i < 9; i++) {
      if (i !== 4) bits.push([8 + wireFace * 24 + sticker++ * 3, 3, 'FBUDLR'.indexOf(facelets[face * 9 + i])]);
    }
  });
  return Uint8Array.from(packBits(20, bits));
}

describe('MoYu32 renderer axes', () => {
  it('matches DCTimer once instead of rotating the decoded axes a second time', () => {
    const q = decodeMoyu32Quaternion(Uint8Array.from(Buffer.from('AB47882CFFF873493FA2B87509ECB43AFF000000', 'hex')));
    const rendered = applyOrientation(q, null, { basis: sensorBasisForBrand('moyu32') });
    const norm = Math.hypot(-13858745, 1061778424, -12929812, -158709922);
    expect(rendered.w).toBeCloseTo(-13858745 / norm, 10);
    expect(rendered.x).toBeCloseTo(1061778424 / norm, 10);
    expect(rendered.y).toBeCloseTo(-12929812 / norm, 10);
    expect(rendered.z).toBeCloseTo(-158709922 / norm, 10);
  });
});

describe('automatic state-write confirmations', () => {
  it('ignores pre-write replies and waits for write success even if confirmation arrives first', async () => {
    let begin!: () => boolean; let finishWrite!: () => void;
    const requestSnapshot = vi.fn(async () => {});
    const reset = createDeviceStateReset({ automaticReply: true, prepareSnapshot() {}, requestSnapshot,
      sendReset: callback => { begin = callback!; return new Promise(resolve => { finishWrite = resolve; }); },
    });
    let done = false;
    const result = reset.run().then(() => { done = true; });
    reset.observe(SOLVED);
    expect(reset.waiting).toBe(false);
    expect(begin()).toBe(true);
    reset.observe('old unsolved snapshot');
    reset.observe(SOLVED);
    await Promise.resolve();
    expect(done).toBe(false);
    finishWrite(); await result;
    expect(done).toBe(true);
    expect(requestSnapshot).not.toHaveBeenCalled();
    reset.dispose();
  });

  it('does not hide a write failure behind an early solved reply', async () => {
    const reset = createDeviceStateReset({ automaticReply: true, prepareSnapshot() {}, requestSnapshot: async () => {},
      sendReset: async begin => { begin!(); reset.observe(SOLVED); throw new Error('write failed'); },
    });
    await expect(reset.run()).rejects.toThrow('write failed');
    reset.dispose();
  });

  it('writes the verified MoYu32 A2 payload, ignores duplicate old moves and replays newer ones', async () => {
    const gatt = makeFakeGatt('WCU_MY32_A1B2', { [moyu32Driver.service]: [MY_READ, MY_WRITE] });
    const notify = gatt.char(moyu32Driver.service, MY_READ);
    const feed = (frame: Uint8Array) => notify.emit(encryptFrame(frame, myKey, myIv));
    const onMove = vi.fn(); const onState = vi.fn();
    const session = await moyu32Driver.start(gatt.asServer, onMove, { mac: 'CF:30:16:00:A1:B2', onState });
    const initial = MY_RESET.slice(); initial[0] = 0xa3; initial[19] = 10;
    feed(initial); onState.mockClear();
    const writer = gatt.char(moyu32Driver.service, MY_WRITE);
    const original = writer.writeValue.bind(writer);
    vi.spyOn(writer, 'writeValue').mockImplementation(async bytes => {
      await original(bytes);
      const plain = decryptFrame(new Uint8Array(bytes as ArrayBuffer), myKey, myIv);
      if (plain[0] !== 0xa2) return;
      expect(plain).toEqual(MY_RESET);
      // Reply before writeValue resolves, with both stale and new MOVE records.
      feed(myState(cubeMove(SOLVED, 'R'), 9));
      expect(onState).not.toHaveBeenCalled();
      feed(Uint8Array.from(packBits(20, [[0,8,0xa5],[88,8,10]])));
      const ack = initial.slice(); ack[19] = 50; feed(ack);
      feed(Uint8Array.from(packBits(20, [[0,8,0xa5],[8,16,40],[88,8,51],[96,5,10]])));
    });
    try {
      const before = gatt.writes.length;
      await session.resetDeviceState!();
      expect(gatt.writes.length).toBe(before + 1); // no extra A3 request
      expect(onState).toHaveBeenCalledExactlyOnceWith(SOLVED);
      expect(onMove).toHaveBeenCalledExactlyOnceWith('R', 40);
    } finally { session.cleanup(); }
  });

  it('writes QiYi encoded solved facelets and accepts only the 04 confirmation', async () => {
    const gatt = makeFakeGatt('QY-QYSC-1-A1B2', { [qiyiDriver.service]: [QY_CHAR] });
    const notify = gatt.char(qiyiDriver.service, QY_CHAR);
    const onState = vi.fn(); const onMove = vi.fn();
    const session = await qiyiDriver.start(gatt.asServer, onMove, { mac: 'CC:A3:00:00:A1:B2', onState });
    const writer = notify; const original = writer.writeValue.bind(writer);
    vi.spyOn(writer, 'writeValue').mockImplementation(async bytes => {
      await original(bytes);
      const plain = aesEcbDecrypt(new Uint8Array(bytes as ArrayBuffer), qyKey);
      if (plain[2] !== 4) return; // ordinary state ACK queued during reset
      expect(plain[0]).toBe(0xfe); expect(plain[1]).toBe(38);
      expect(crc16Modbus(plain.subarray(0, 38))).toBe(0);
      expect([...plain.subarray(2, 36)]).toEqual([4,0x17,0x88,0x8b,0x31,...QY_STICKERS,0,0]);
      notify.emit(qyReply(3, 1000));
      expect(onState).not.toHaveBeenCalled();
      notify.emit(qyReply(4, 2000));
    });
    try {
      await session.resetDeviceState!();
      expect(onState).toHaveBeenCalledExactlyOnceWith(SOLVED);
      expect(onMove).not.toHaveBeenCalled();
    } finally { session.cleanup(); }
  });
});
