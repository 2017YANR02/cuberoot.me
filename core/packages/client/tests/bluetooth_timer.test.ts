/**
 * BLE smart-TIMER protocol tests — GAN Smart Timer + QiYi Timer / Adapter.
 *
 * WE HAVE NO PHYSICAL SMART TIMER, so nothing here is a capture from real
 * hardware. What it does pin down:
 *
 *   1. The two CRCs against the published CRC-catalogue check values, so the
 *      checksum layer is verified against something outside this repo.
 *   2. AES-128 against the FIPS-197 appendix C.1 vector, so the ECB core the
 *      QiYi framing rides on is verified against the standard itself.
 *   3. Frame fixtures hand-built to the byte layout documented in csTimer's
 *      `src/js/hardware/{gantimer,qiyitimer}.js`, with their CRCs produced by
 *      an INDEPENDENT generator (see the header of each fixture) rather than
 *      by the code under test.
 *   4. The QiYi encode -> fragment -> decrypt -> reassemble -> parse loop,
 *      which is the part most likely to rot when someone touches the framing.
 *
 * Deliberate deviation under test: csTimer's GAN driver logs an invalid frame
 * and then processes it anyway (gantimer.js:80-83, the `if` has no `return`).
 * We DROP invalid frames; `drops a frame whose CRC does not match` is the
 * regression guard for that, so do NOT "fix" it to match upstream.
 */

import { describe, it, expect } from 'vitest';
import {
  crc16CcittFalse,
  crc16Modbus,
  GAN_TIMER_STATES,
  parseGanTimerFrame,
  validateGanTimerFrame,
  QIYI_TIMER_STATES,
  buildQiyiHelloContent,
  buildQiyiTimerMessage,
  createQiyiTimerReassembler,
  decodeQiyiTimerPayload,
  encodeQiyiTimerPackets,
  parseQiyiTimerFrame,
  extractQiyiTimerMac,
  qiyiTimerMacFromName,
  normalizeTimerMac,
} from '@/app/[lang]/timer/_lib/bluetooth/timer';
import {
  aesDecryptBlock,
  aesEncryptBlock,
  expandKey,
} from '@/app/[lang]/timer/_lib/bluetooth/timer/aes128';

const ascii = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0));
const hex = (b: Uint8Array): string => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');

/* ================================================================== */
/*  1. CRCs — published catalogue check values                         */
/* ================================================================== */

describe('CRC-16/CCITT-FALSE (GAN timer)', () => {
  it('matches the catalogue check value for "123456789"', () => {
    expect(crc16CcittFalse(ascii('123456789'))).toBe(0x29b1);
  });

  it('is 0xFFFF over the empty message (init value, no xorout)', () => {
    expect(crc16CcittFalse(new Uint8Array(0))).toBe(0xffff);
  });

  it('matches a single zero byte', () => {
    expect(crc16CcittFalse(Uint8Array.of(0x00))).toBe(0xe1f0);
  });

  it('stays inside 16 bits over a long message', () => {
    const long = new Uint8Array(4096).fill(0xa5);
    const c = crc16CcittFalse(long);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(0xffff);
  });
});

describe('CRC-16/MODBUS (QiYi timer)', () => {
  it('matches the catalogue check value for "123456789"', () => {
    expect(crc16Modbus(ascii('123456789'))).toBe(0x4b37);
  });

  it('is 0xFFFF over the empty message', () => {
    expect(crc16Modbus(new Uint8Array(0))).toBe(0xffff);
  });

  it('matches a single zero byte', () => {
    expect(crc16Modbus(Uint8Array.of(0x00))).toBe(0x40bf);
  });

  it('has residue 0 when its own CRC is appended little-endian', () => {
    // This self-checking property is exactly what parseQiyiTimerFrame relies
    // on — and why the verifier has to swap the two big-endian wire bytes.
    const msg = ascii('QiYi');
    const c = crc16Modbus(msg);
    const withCrc = Uint8Array.of(...msg, c & 0xff, (c >>> 8) & 0xff);
    expect(crc16Modbus(withCrc)).toBe(0);
  });
});

/* ================================================================== */
/*  2. AES-128 — FIPS-197 appendix C.1                                 */
/* ================================================================== */

describe('AES-128-ECB core', () => {
  const key = Uint8Array.from([
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
    0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
  ]);
  const plain = Uint8Array.from([
    0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
    0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff,
  ]);
  const cipher = '69c4e0d86a7b0430d8cdb78070b4c55a';

  it('encrypts the FIPS-197 C.1 vector', () => {
    expect(hex(aesEncryptBlock(plain, expandKey(key)))).toBe(cipher);
  });

  it('decrypts the FIPS-197 C.1 vector', () => {
    const ct = Uint8Array.from(cipher.match(/../g)!.map((h) => parseInt(h, 16)));
    expect(hex(aesDecryptBlock(ct, expandKey(key)))).toBe(hex(plain));
  });

  it('round-trips under the QiYi timer key (sixteen 0x77 bytes)', () => {
    const w = expandKey(new Uint8Array(16).fill(0x77));
    const block = Uint8Array.from({ length: 16 }, (_v, i) => (i * 37) & 0xff);
    expect(hex(aesDecryptBlock(aesEncryptBlock(block, w), w))).toBe(hex(block));
  });
});

/* ================================================================== */
/*  3. GAN Smart Timer frames                                          */
/* ================================================================== */

/**
 * Build a GAN frame to the documented layout. The CRC here comes from
 * `crc16CcittFalse`, which the block above pins to the catalogue value, so it
 * is not circular with `parseGanTimerFrame`.
 */
function ganFrame(
  stateIdx: number,
  opts: { min?: number; sec?: number; msec?: number; length?: number } = {},
): DataView {
  const len = opts.length ?? 20;
  const b = new Uint8Array(len);
  b[0] = 0xfe;
  b[1] = len - 2;
  b[2] = 0x05;
  b[3] = stateIdx;
  if (len >= 8) {
    b[4] = opts.min ?? 0;
    b[5] = opts.sec ?? 0;
    b[6] = (opts.msec ?? 0) & 0xff;
    b[7] = ((opts.msec ?? 0) >>> 8) & 0xff;
  }
  for (let i = 8; i < len - 2; i++) b[i] = i;
  const crc = crc16CcittFalse(b.subarray(2, len - 2));
  b[len - 2] = crc & 0xff;
  b[len - 1] = (crc >>> 8) & 0xff;
  return new DataView(b.buffer);
}

describe('GAN Smart Timer frame decoding', () => {
  /**
   * Fully literal 20-byte STOPPED frame for 1:23.456. Bytes and CRC were
   * produced by a standalone CRC-16/CCITT-FALSE implementation written from
   * the catalogue definition, not by the code under test.
   */
  const LITERAL_STOPPED = Uint8Array.from([
    0xfe, 0x12, 0x05, 0x04, 0x01, 0x17, 0xc8, 0x01, 0x08, 0x09,
    0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0xc6, 0x3d,
  ]);

  it('accepts the literal STOPPED fixture and reads 1:23.456', () => {
    const dv = new DataView(LITERAL_STOPPED.buffer);
    expect(validateGanTimerFrame(dv)).toBe(true);
    expect(parseGanTimerFrame(dv)).toEqual({
      state: 'STOPPED',
      solveTime: 60_000 * 1 + 1_000 * 23 + 456,
    });
  });

  it('maps every state-table index to csTimer’s vocabulary', () => {
    // Order is load-bearing: gantimer.js:30-39.
    expect(GAN_TIMER_STATES).toEqual([
      'DISCONNECT', 'GET_SET', 'HANDS_OFF', 'RUNNING',
      'STOPPED', 'GAN_RESET', 'HANDS_ON', 'FINISHED',
    ]);
    for (let i = 0; i < GAN_TIMER_STATES.length; i++) {
      const parsed = parseGanTimerFrame(ganFrame(i, { min: 0, sec: 1, msec: 500 }));
      expect(parsed?.state).toBe(GAN_TIMER_STATES[i]);
    }
  });

  it('only attaches solveTime on STOPPED', () => {
    expect(parseGanTimerFrame(ganFrame(3, { sec: 9, msec: 990 }))).toEqual({ state: 'RUNNING' });
    expect(parseGanTimerFrame(ganFrame(1))).toEqual({ state: 'GET_SET' });
  });

  it('sums minutes, seconds and the little-endian millis word', () => {
    expect(parseGanTimerFrame(ganFrame(4, { min: 2, sec: 5, msec: 7 }))?.solveTime)
      .toBe(125_007);
    expect(parseGanTimerFrame(ganFrame(4, { min: 0, sec: 0, msec: 999 }))?.solveTime)
      .toBe(999);
    expect(parseGanTimerFrame(ganFrame(4, { min: 9, sec: 59, msec: 999 }))?.solveTime)
      .toBe(599_999);
  });

  it('drops a frame whose CRC does not match', () => {
    // csTimer logs this case and then decodes it anyway — that is the upstream
    // bug we intentionally do not reproduce.
    const bad = Uint8Array.from(LITERAL_STOPPED);
    bad[5] ^= 0xff; // corrupt the seconds byte, leave the CRC alone
    const dv = new DataView(bad.buffer);
    expect(validateGanTimerFrame(dv)).toBe(false);
    expect(parseGanTimerFrame(dv)).toBeNull();
  });

  it('drops a frame with the wrong magic byte', () => {
    const bad = Uint8Array.from(LITERAL_STOPPED);
    bad[0] = 0xfd;
    expect(parseGanTimerFrame(new DataView(bad.buffer))).toBeNull();
  });

  it('drops an unknown state index instead of faking DISCONNECT', () => {
    expect(parseGanTimerFrame(ganFrame(8))).toBeNull();
    expect(parseGanTimerFrame(ganFrame(0xff))).toBeNull();
  });

  it('drops truncated frames', () => {
    expect(parseGanTimerFrame(new DataView(new ArrayBuffer(0)))).toBeNull();
    expect(parseGanTimerFrame(new DataView(LITERAL_STOPPED.buffer, 0, 4))).toBeNull();
    // Valid CRC but no room for min/sec/millis behind a STOPPED state.
    expect(parseGanTimerFrame(ganFrame(4, { length: 8 }))).toBeNull();
  });

  it('honours a DataView that does not start at offset 0', () => {
    // csTimer CRCs `data.buffer.slice(...)`, which ignores byteOffset. Ours
    // does not, so a view into a larger buffer still validates.
    const backing = new Uint8Array(3 + LITERAL_STOPPED.length + 5);
    backing.set(LITERAL_STOPPED, 3);
    const dv = new DataView(backing.buffer, 3, LITERAL_STOPPED.length);
    expect(parseGanTimerFrame(dv)).toEqual({ state: 'STOPPED', solveTime: 83_456 });
  });
});

/* ================================================================== */
/*  4. QiYi Timer / Adapter                                            */
/* ================================================================== */

/** Push all packets through a fresh reassembler and return the last result. */
function reassemble(packets: Uint8Array[]): Uint8Array | null {
  const r = createQiyiTimerReassembler();
  let out: Uint8Array | null = null;
  for (const p of packets) out = r.push(p) ?? out;
  return out;
}

describe('QiYi timer message framing', () => {
  /**
   * Literal plaintext message: cmd 0x1003, dpId 4 / dpType 4 state frame,
   * state index 3 (RUNNING), solveTime 12345 ms, sendSN 7, ackSN 2. CRC from
   * the same standalone MODBUS generator used for the GAN fixture.
   */
  const LITERAL_STATE_MSG = Uint8Array.from([
    0x00, 0x00, 0x00, 0x07, // sendSN
    0x00, 0x00, 0x00, 0x02, // ackSN
    0x10, 0x03,             // cmd
    0x00, 0x09,             // len
    0x04, 0x04, 0x00, 0x05, 0x03, 0x00, 0x00, 0x30, 0x39, // data
    0x63, 0xe0,             // CRC-16/MODBUS, big-endian on the wire
  ]);
  const STATE_DATA = [0x04, 0x04, 0x00, 0x05, 0x03, 0x00, 0x00, 0x30, 0x39];

  it('builds a message byte-identical to the literal fixture', () => {
    expect(hex(buildQiyiTimerMessage(7, 2, 0x1003, STATE_DATA)))
      .toBe(hex(LITERAL_STATE_MSG));
  });

  it('parses the literal fixture into its header fields', () => {
    const frame = parseQiyiTimerFrame(LITERAL_STATE_MSG);
    expect(frame).not.toBeNull();
    expect(frame!.sendSN).toBe(7);
    expect(frame!.ackSN).toBe(2);
    expect(frame!.cmd).toBe(0x1003);
    expect(Array.from(frame!.data)).toEqual(STATE_DATA);
  });

  it('rejects a message whose CRC does not match', () => {
    const bad = Uint8Array.from(LITERAL_STATE_MSG);
    bad[16] ^= 0x01; // flip the state index, leave the CRC
    expect(parseQiyiTimerFrame(bad)).toBeNull();
  });

  it('rejects a message shorter than its own declared length', () => {
    expect(parseQiyiTimerFrame(LITERAL_STATE_MSG.subarray(0, 18))).toBeNull();
    expect(parseQiyiTimerFrame(new Uint8Array(4))).toBeNull();
  });

  it('round-trips encode -> encrypt -> fragment -> decrypt -> reassemble', () => {
    const packets = encodeQiyiTimerPackets(7, 2, 0x1003, STATE_DATA);
    // 23-byte message -> 2 blocks -> [4+16, 1+16] bytes on the wire.
    expect(packets.map((p) => p.length)).toEqual([20, 17]);
    expect(packets[0][0]).toBe(0x00);
    expect(packets[0][1]).toBe(LITERAL_STATE_MSG.length + 2);
    expect(packets[0][2]).toBe(0x40);
    expect(packets[1][0]).toBe(0x01);
    // The payload really is encrypted, not passed through in the clear.
    expect(hex(packets[0].subarray(4))).not.toBe(hex(LITERAL_STATE_MSG.subarray(0, 16)));

    expect(hex(reassemble(packets)!)).toBe(hex(LITERAL_STATE_MSG));
  });

  it('round-trips a single-fragment message', () => {
    // 2 bytes of data -> 16-byte message -> exactly one block.
    const packets = encodeQiyiTimerPackets(1, 0, 0x1003, [0x04, 0x04]);
    expect(packets).toHaveLength(1);
    const msg = reassemble(packets);
    expect(msg).not.toBeNull();
    expect(parseQiyiTimerFrame(msg!)?.cmd).toBe(0x1003);
  });

  it('round-trips a hello message', () => {
    const hello = buildQiyiHelloContent('CC:A1:00:00:8F:2A')!;
    expect(hello).toHaveLength(17);
    const packets = encodeQiyiTimerPackets(1, 0, 1, hello);
    // 12 header + 17 data + 2 CRC = 31 bytes -> 2 blocks.
    expect(packets.map((p) => p.length)).toEqual([20, 17]);
    expect(packets[0][1]).toBe(33);
    const frame = parseQiyiTimerFrame(reassemble(packets)!);
    expect(frame!.sendSN).toBe(1);
    expect(frame!.ackSN).toBe(0);
    expect(frame!.cmd).toBe(1);
    expect(Array.from(frame!.data)).toEqual(hello);
  });

  it('drops an out-of-sequence fragment and recovers on the next message', () => {
    const packets = encodeQiyiTimerPackets(7, 2, 0x1003, STATE_DATA);
    const r = createQiyiTimerReassembler();
    expect(r.push(packets[1])).toBeNull();   // tail without a head
    expect(r.push(packets[0])).toBeNull();   // fresh head, still incomplete
    expect(hex(r.push(packets[1])!)).toBe(hex(LITERAL_STATE_MSG));
  });

  it('drops fragments that are not whole 16-byte blocks', () => {
    const packets = encodeQiyiTimerPackets(7, 2, 0x1003, STATE_DATA);
    const r = createQiyiTimerReassembler();
    expect(r.push(packets[0].subarray(0, 15))).toBeNull();
    expect(r.push(new Uint8Array(0))).toBeNull();
  });

  it('builds the hello payload with the MAC reversed', () => {
    expect(buildQiyiHelloContent('CC:A1:00:00:8F:2A')).toEqual([
      0, 0, 0, 0, 0, 33, 8, 0, 1, 5, 90,
      0x2a, 0x8f, 0x00, 0x00, 0xa1, 0xcc,
    ]);
    expect(buildQiyiHelloContent('not-a-mac')).toBeNull();
  });
});

describe('QiYi timer payload decoding', () => {
  it('maps every state-table index to csTimer’s vocabulary', () => {
    // Order is load-bearing: qiyitimer.js:153-161.
    expect(QIYI_TIMER_STATES).toEqual([
      'IDLE', 'INSPECTION', 'GET_SET', 'RUNNING',
      'FINISHED', 'STOPPED', 'DISCONNECT',
    ]);
    for (let i = 0; i < QIYI_TIMER_STATES.length; i++) {
      const data = Uint8Array.from([4, 4, 0x00, 0x05, i, 0x00, 0x00, 0x00, 0x00]);
      expect(decodeQiyiTimerPayload(data)?.event.state).toBe(QIYI_TIMER_STATES[i]);
    }
  });

  it('reads the big-endian solveTime out of a state frame', () => {
    const frame = parseQiyiTimerFrame(
      buildQiyiTimerMessage(7, 2, 0x1003, [0x04, 0x04, 0x00, 0x05, 0x03, 0x00, 0x00, 0x30, 0x39]),
    )!;
    expect(decodeQiyiTimerPayload(frame.data)).toEqual({
      event: { state: 'RUNNING', solveTime: 12_345 },
      needsAck: false,
    });
  });

  it('decodes a result frame into STOPPED with solve + inspection times', () => {
    // dpId 1 / dpType 1: solveTime at data[8..11], inspectTime at data[12..15].
    const data = Uint8Array.from([
      0x01, 0x01, 0x00, 0x0c,             // dpId, dpType, dpLen
      0x00, 0x00, 0x00, 0x00,             // reserved
      0x00, 0x00, 0x26, 0x94,             // solveTime   = 9876 ms
      0x00, 0x00, 0x1f, 0xbb,             // inspectTime = 8123 ms
    ]);
    expect(decodeQiyiTimerPayload(data)).toEqual({
      event: { state: 'STOPPED', solveTime: 9_876, inspectTime: 8_123 },
      needsAck: true,
    });
  });

  it('survives the full pipeline for a result frame', () => {
    const data = [
      0x01, 0x01, 0x00, 0x0c,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x01, 0x86, 0xa0, // 100000 ms
      0x00, 0x00, 0x3a, 0x98, // 15000 ms
    ];
    const packets = encodeQiyiTimerPackets(9, 4, 0x1003, data);
    const frame = parseQiyiTimerFrame(reassemble(packets)!)!;
    expect(frame.cmd).toBe(0x1003);
    expect(decodeQiyiTimerPayload(frame.data)).toEqual({
      event: { state: 'STOPPED', solveTime: 100_000, inspectTime: 15_000 },
      needsAck: true,
    });
  });

  it('reads a full-range unsigned 32-bit time without sign wrap', () => {
    const data = Uint8Array.from([
      0x01, 0x01, 0x00, 0x0c,
      0x00, 0x00, 0x00, 0x00,
      0xff, 0xff, 0xff, 0xff,
      0x80, 0x00, 0x00, 0x00,
    ]);
    const decoded = decodeQiyiTimerPayload(data)!;
    expect(decoded.event.solveTime).toBe(0xffffffff);
    expect(decoded.event.inspectTime).toBe(0x80000000);
  });

  it('ignores datapoints it does not understand, and short payloads', () => {
    expect(decodeQiyiTimerPayload(Uint8Array.from([2, 2, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(decodeQiyiTimerPayload(Uint8Array.from([4, 4, 0, 5, 9, 0, 0, 0, 0]))).toBeNull(); // idx 9
    expect(decodeQiyiTimerPayload(Uint8Array.from([4, 4, 0, 5]))).toBeNull();                // truncated
    expect(decodeQiyiTimerPayload(Uint8Array.from([1, 1, 0, 12, 0, 0, 0, 0]))).toBeNull();   // truncated
    expect(decodeQiyiTimerPayload(new Uint8Array(0))).toBeNull();
  });
});

describe('QiYi timer MAC discovery', () => {
  it('derives the fallback MAC from the device name', () => {
    expect(qiyiTimerMacFromName('QY-Timer-x-8F2A')).toBe('CC:A1:00:00:8F:2A');
    expect(qiyiTimerMacFromName('QY-Adapter-y-01AB')).toBe('CC:A8:00:00:01:AB');
    expect(qiyiTimerMacFromName('QY-QYSC-1-8F2A')).toBeNull();   // that is a cube
    expect(qiyiTimerMacFromName('QY-Timer-lowercase-8f2a')).toBeNull();
    expect(qiyiTimerMacFromName(null)).toBeNull();
  });

  it('reads the FIRST six manufacturer bytes reversed (not the last six)', () => {
    // qiyitimer.js:199-203 walks i = 5..0 from index 0. The cube drivers walk
    // the tail instead; mixing them up yields a wrong-but-plausible MAC.
    const payload = Uint8Array.from([0x2a, 0x8f, 0x00, 0x00, 0xa1, 0xcc, 0xde, 0xad, 0xbe]);
    const mfData = new Map<number, DataView>([[0x0504, new DataView(payload.buffer)]]);
    expect(extractQiyiTimerMac(mfData)).toBe('CC:A1:00:00:8F:2A');
  });

  it('handles Bluefy’s bare DataView, which keeps the 2-byte company prefix', () => {
    const raw = Uint8Array.from([0x04, 0x05, 0x2a, 0x8f, 0x00, 0x00, 0xa1, 0xcc]);
    expect(extractQiyiTimerMac(new DataView(raw.buffer))).toBe('CC:A1:00:00:8F:2A');
  });

  it('returns null when there is no usable manufacturer data', () => {
    expect(extractQiyiTimerMac(new Map<number, DataView>())).toBeNull();
    expect(extractQiyiTimerMac(new Map<number, DataView>([
      [0x0504, new DataView(new Uint8Array(3).buffer)],
    ]))).toBeNull();
    expect(extractQiyiTimerMac(new DataView(new Uint8Array(4).buffer))).toBeNull();
  });

  it('normalises MAC strings and rejects junk', () => {
    expect(normalizeTimerMac('cc:a1:00:00:8f:2a')).toBe('CC:A1:00:00:8F:2A');
    expect(normalizeTimerMac('CC-A1-00-00-8F-2A')).toBe('CC:A1:00:00:8F:2A');
    expect(normalizeTimerMac('CCA100008F2A')).toBeNull();
    expect(normalizeTimerMac('')).toBeNull();
    expect(normalizeTimerMac(undefined)).toBeNull();
  });
});
