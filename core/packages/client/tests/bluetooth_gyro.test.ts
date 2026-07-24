/**
 * Orientation (gyroscope) decode tests for the smart-cube drivers.
 *
 * WE OWN NO SMART CUBE. Nothing here has been, or can be, checked against
 * hardware — these tests pin the DECODE against the published wire formats,
 * which is the only falsifiable claim available to us. Provenance per brand:
 *
 *   GoCube  — csTimer's `gocube.js` leaves `msgType == 3` empty. Layout from
 *             oddpetersson/gocube-protocol ("x#y#z#w", ASCII) and cubing.js
 *             `smart-puzzle/gocube.ts` (`.split("#").map(s => parseInt(s,10)
 *             / 16384)`), which agree.
 *   GAN g2/g4 — csTimer leaves BOTH gyro branches empty (`if (mode == 1) { }`
 *             and `else if (mode == 0xEC) { }`). Layout from
 *             afedotov/gan-web-bluetooth `src/gan-cube-protocol.ts`.
 *   MoYu32  — csTimer has the branch commented out entirely
 *             (`// } else if (msgType == 171) { // gyro`). Layout from
 *             lukeburong/weilong-v10-ai-protocol, whose worked example packet
 *             is reproduced verbatim below as a golden vector.
 *   GAN g3  — no orientation message exists in the protocol; nothing to test.
 *   QiYi    — undocumented; deliberately not implemented (see qiyi.ts TODO).
 *
 * The three brands share one normalisation trap worth stating: GAN's 16-bit
 * components are SIGN-MAGNITUDE, not two's complement, so 0xFFFF is -1.0 and
 * 0x8000 is negative zero. Both extremes are asserted.
 */

import { describe, it, expect } from 'vitest';
import { decodeGanV2Frame, type MoveDecodeState as GanV2State } from '@/app/[lang]/timer/_lib/bluetooth/gan_v2';
import { decodeGanV4Frame, type MoveDecodeState as GanV4State } from '@/app/[lang]/timer/_lib/bluetooth/gan_v4';
import { parseGoCubeQuaternion } from '@/app/[lang]/timer/_lib/bluetooth/gocube';
import {
  createMoyu32State,
  decodeMoyu32Frame,
  decodeMoyu32Quaternion,
  moyu32DefaultMac,
} from '@/app/[lang]/timer/_lib/bluetooth/moyu32';
import type { GyroQuaternion, GyroVelocity } from '@/app/[lang]/timer/_lib/bluetooth/driver';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

type BitWrite = [startBit: number, lenBits: number, value: number];

/** Pack big-endian bit fields into `totalBytes` bytes. */
function packBits(totalBytes: number, writes: BitWrite[]): Uint8Array {
  const bits = new Uint8Array(totalBytes * 8);
  for (const [start, len, value] of writes) {
    for (let i = 0; i < len; i++) bits[start + i] = (value >>> (len - 1 - i)) & 1;
  }
  const out = new Uint8Array(totalBytes);
  for (let b = 0; b < totalBytes; b++) {
    let v = 0;
    for (let i = 0; i < 8; i++) v = (v << 1) | bits[b * 8 + i];
    out[b] = v;
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  const out = new Uint8Array(clean.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

interface GyroCapture {
  quaternions: GyroQuaternion[];
  velocities: Array<GyroVelocity | undefined>;
  sink: (q: GyroQuaternion, v?: GyroVelocity) => void;
}

function capture(): GyroCapture {
  const c: GyroCapture = { quaternions: [], velocities: [], sink: () => {} };
  c.sink = (q, v) => { c.quaternions.push(q); c.velocities.push(v); };
  return c;
}

/** Exactly ±1 in GAN's 16-bit sign-magnitude encoding. */
const GAN_POS_ONE = 0x7fff;
const GAN_NEG_ONE = 0xffff;
/** Sign bit set, magnitude zero — decodes to negative zero. */
const GAN_NEG_ZERO = 0x8000;

/* ------------------------------------------------------------------ */
/*  GAN gen2 — mode 1, quaternion @ 4/20/36/52, velocity @ 68/72/76    */
/* ------------------------------------------------------------------ */

function ganV2GyroFrame(
  q: { w: number; x: number; y: number; z: number },
  v: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
): Uint8Array {
  return packBits(20, [
    [0, 4, 1],
    [4, 16, q.w], [20, 16, q.x], [36, 16, q.y], [52, 16, q.z],
    [68, 4, v.x], [72, 4, v.y], [76, 4, v.z],
  ]);
}

function freshV2State(): GanV2State {
  return { prevMoveCnt: -1, prevMoves: [], battery: null, badFrames: 0 };
}

describe('GAN gen2 gyro (mode 1)', () => {
  it('decodes the ±1 extremes, the sign bit and negative zero', () => {
    const cap = capture();
    const dec = freshV2State();
    const moves = decodeGanV2Frame(
      ganV2GyroFrame({ w: GAN_POS_ONE, x: GAN_NEG_ONE, y: 0x0000, z: GAN_NEG_ZERO }),
      dec,
      cap.sink,
    );

    expect(moves).toEqual([]);            // a gyro frame is never a move
    expect(cap.quaternions).toHaveLength(1);
    const q = cap.quaternions[0];
    expect(q.w).toBe(1);
    expect(q.x).toBe(-1);
    expect(q.y).toBe(0);
    // 0x8000 = sign set, magnitude 0 → -0. Object.is distinguishes it from 0;
    // this asserts we implement sign-MAGNITUDE and not two's complement (where
    // 0x8000 would be -32768 / 32767 ≈ -1.00003).
    expect(Object.is(q.z, -0)).toBe(true);
  });

  it('decodes a mid-range component with GAN normalisation', () => {
    const cap = capture();
    decodeGanV2Frame(
      ganV2GyroFrame({ w: 0x4000, x: 0xc000, y: 0x0001, z: 0x7fff }),
      freshV2State(),
      cap.sink,
    );
    const q = cap.quaternions[0];
    expect(q.w).toBeCloseTo(16384 / 32767, 12);
    expect(q.x).toBeCloseTo(-16384 / 32767, 12);
    expect(q.y).toBeCloseTo(1 / 32767, 12);
    expect(q.z).toBe(1);
  });

  it('decodes 4-bit sign-magnitude angular velocity', () => {
    const cap = capture();
    decodeGanV2Frame(
      ganV2GyroFrame({ w: 0, x: 0, y: 0, z: 0 }, { x: 0x7, y: 0xf, z: 0x8 }),
      freshV2State(),
      cap.sink,
    );
    const v = cap.velocities[0];
    expect(v).toBeDefined();
    expect(v!.x).toBe(7);   // 0x7 → +7 (max magnitude, positive)
    expect(v!.y).toBe(-7);  // 0xF → sign set, magnitude 7
    expect(Object.is(v!.z, -0)).toBe(true); // 0x8 → sign set, magnitude 0
  });

  it('never touches move state and costs nothing without a listener', () => {
    const dec = freshV2State();
    dec.prevMoveCnt = 42;
    const moves = decodeGanV2Frame(ganV2GyroFrame({ w: 0x7fff, x: 0, y: 0, z: 0 }), dec);
    expect(moves).toEqual([]);
    expect(dec.prevMoveCnt).toBe(42);
    expect(dec.badFrames).toBe(0);
  });

  it('leaves the move path working after a gyro frame', () => {
    // A gyro burst between moves must not desync the counter — the whole
    // point of routing both through one decode function.
    const cap = capture();
    const dec = freshV2State();
    // mode 4 (facelets) seeds the counter at 10.
    decodeGanV2Frame(packBits(20, [[0, 4, 4], [4, 8, 10]]), dec, cap.sink);
    expect(dec.prevMoveCnt).toBe(10);
    decodeGanV2Frame(ganV2GyroFrame({ w: 0x7fff, x: 0, y: 0, z: 0 }), dec, cap.sink);
    // mode 2 move frame, counter 11, window[0] = newest = code 4 -> "F".
    const moves = decodeGanV2Frame(
      packBits(20, [[0, 4, 2], [4, 8, 11], [12, 5, 4]]),
      dec,
      cap.sink,
    );
    expect(moves).toEqual(['F']);
    expect(cap.quaternions).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/*  GAN gen4 — 0xEC, quaternion @ 16/32/48/64, velocity @ 80/84/88     */
/* ------------------------------------------------------------------ */

function ganV4GyroFrame(
  q: { w: number; x: number; y: number; z: number },
  v: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
): Uint8Array {
  return packBits(20, [
    [0, 8, 0xec],
    [16, 16, q.w], [32, 16, q.x], [48, 16, q.y], [64, 16, q.z],
    [80, 4, v.x], [84, 4, v.y], [88, 4, v.z],
  ]);
}

function freshV4State(): GanV4State {
  return { prevMoveCnt: -1, battery: null, badFrames: 0 };
}

describe('GAN gen4 gyro (0xEC)', () => {
  it('decodes the ±1 extremes, the sign bit and negative zero', () => {
    const cap = capture();
    const dec = freshV4State();
    const moves = decodeGanV4Frame(
      ganV4GyroFrame({ w: GAN_NEG_ONE, x: GAN_POS_ONE, y: GAN_NEG_ZERO, z: 0x0000 }),
      dec,
      cap.sink,
    );

    expect(moves).toEqual([]);
    const q = cap.quaternions[0];
    expect(q.w).toBe(-1);
    expect(q.x).toBe(1);
    expect(Object.is(q.y, -0)).toBe(true);
    expect(q.z).toBe(0);
  });

  it('reads the quaternion from bytes 2..10, one 16-bit word per component', () => {
    // The gen4 offsets are byte-aligned, so spell the frame out by hand
    // instead of via packBits — an independent check on the offsets.
    const frame = new Uint8Array(20);
    frame[0] = 0xec;
    frame[2] = 0x7f; frame[3] = 0xff; // w = +1
    frame[4] = 0xff; frame[5] = 0xff; // x = -1
    frame[6] = 0x40; frame[7] = 0x00; // y = 16384/32767
    frame[8] = 0xc0; frame[9] = 0x00; // z = -16384/32767
    const cap = capture();
    decodeGanV4Frame(frame, freshV4State(), cap.sink);
    const q = cap.quaternions[0];
    expect(q.w).toBe(1);
    expect(q.x).toBe(-1);
    expect(q.y).toBeCloseTo(16384 / 32767, 12);
    expect(q.z).toBeCloseTo(-16384 / 32767, 12);
  });

  it('decodes 4-bit sign-magnitude angular velocity', () => {
    const cap = capture();
    decodeGanV4Frame(
      ganV4GyroFrame({ w: 0, x: 0, y: 0, z: 0 }, { x: 0x1, y: 0x9, z: 0x7 }),
      freshV4State(),
      cap.sink,
    );
    const v = cap.velocities[0]!;
    expect(v.x).toBe(1);
    expect(v.y).toBe(-1);
    expect(v.z).toBe(7);
  });

  it('0xEC counts as a KNOWN mode — it must not trip the wrong-MAC detector', () => {
    const dec = freshV4State();
    dec.badFrames = 3;
    decodeGanV4Frame(ganV4GyroFrame({ w: 0x7fff, x: 0, y: 0, z: 0 }), dec);
    expect(dec.badFrames).toBe(0);
    expect(dec.prevMoveCnt).toBe(-1);
  });
});

/* ------------------------------------------------------------------ */
/*  GoCube — opcode 0x03, ASCII "x#y#z#w" over 16384                   */
/* ------------------------------------------------------------------ */

/** Build a full GoCube notification: 2A | len | op | payload | crc | 0D 0A. */
function goCubeFrame(opcode: number, payload: string): { dv: DataView; payloadLen: number } {
  const body = Array.from(payload, (c) => c.charCodeAt(0));
  const bytes = [0x2a, body.length + 4, opcode, ...body, 0x00, 0x0d, 0x0a];
  const u8 = new Uint8Array(bytes);
  return {
    dv: new DataView(u8.buffer),
    payloadLen: u8.length - 6,
  };
}

describe('GoCube orientation (opcode 0x03)', () => {
  it('parses the ASCII "x#y#z#w" payload and scales by 2^14', () => {
    const { dv, payloadLen } = goCubeFrame(0x03, '16384#-16384#0#8192');
    const q = parseGoCubeQuaternion(dv, payloadLen);
    expect(q).not.toBeNull();
    // Field order on the wire is x, y, z, w — NOT scalar-first.
    expect(q!.x).toBe(1);
    expect(q!.y).toBe(-1);
    expect(q!.z).toBe(0);
    expect(q!.w).toBe(0.5);
  });

  it('handles the ±1 extremes in every slot', () => {
    const a = goCubeFrame(0x03, '-16384#16384#-16384#16384');
    const qa = parseGoCubeQuaternion(a.dv, a.payloadLen)!;
    expect(qa.x).toBe(-1);
    expect(qa.y).toBe(1);
    expect(qa.z).toBe(-1);
    expect(qa.w).toBe(1);
  });

  it('keeps the sign of a real-world negative sample', () => {
    // The negative-value example the protocol doc spells out in raw bytes
    // ("-13528" as 0x2D 0x31 0x33 0x35 0x32 0x38).
    const { dv, payloadLen } = goCubeFrame(0x03, '-13528#100#-200#16000');
    const q = parseGoCubeQuaternion(dv, payloadLen)!;
    expect(q.x).toBeCloseTo(-13528 / 16384, 12);
    expect(q.y).toBeCloseTo(100 / 16384, 12);
    expect(q.z).toBeCloseTo(-200 / 16384, 12);
    expect(q.w).toBeCloseTo(16000 / 16384, 12);
  });

  it('returns null rather than NaN for malformed payloads', () => {
    // A truncated notification or a firmware wording it differently must not
    // surface as a NaN quaternion that poisons the smoothing filter.
    for (const bad of ['16384#0#0', '16384#0#0#0#0', 'abc#def#ghi#jkl', '#####']) {
      const { dv, payloadLen } = goCubeFrame(0x03, bad);
      expect(parseGoCubeQuaternion(dv, payloadLen)).toBeNull();
    }
  });

  it('returns null for a payload too short to hold four fields', () => {
    const { dv, payloadLen } = goCubeFrame(0x03, '0#0');
    expect(parseGoCubeQuaternion(dv, payloadLen)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  MoYu32 — 0xAB, four signed LE int32 as (w, x, -z, y) over 2^30     */
/* ------------------------------------------------------------------ */

const POW30 = 1073741824;

/** Build a 0xAB frame from four raw int32 in wire order (w, x, -z, y). */
function moyu32GyroFrame(w: number, x: number, negZ: number, y: number): Uint8Array {
  const frame = new Uint8Array(20);
  const dv = new DataView(frame.buffer);
  frame[0] = 0xab;
  dv.setInt32(1, w, true);
  dv.setInt32(5, x, true);
  dv.setInt32(9, negZ, true);
  dv.setInt32(13, y, true);
  return frame;
}

describe('MoYu32 orientation (0xAB)', () => {
  it('reproduces the worked example from the published protocol', () => {
    // Verbatim from lukeburong/weilong-v10-ai-protocol:
    //   0xAB47882CFFF873493FA2B87509ECB43AFF000000
    // with the documented intermediate integers -13858745, 1061778424,
    // 158709922, -12929812. (The doc's own float for the last one is a typo —
    // it divides -12930068 instead of -12929812 — so we assert the integer
    // maths, which the doc states unambiguously.)
    const frame = hexToBytes('AB47882CFFF873493FA2B87509ECB43AFF000000');
    expect(frame).toHaveLength(20);
    const q = decodeMoyu32Quaternion(frame);
    expect(q.w).toBeCloseTo(-13858745 / POW30, 12);
    expect(q.x).toBeCloseTo(1061778424 / POW30, 12);
    expect(q.y).toBeCloseTo(-12929812 / POW30, 12);
    // Third slot is NEGATED z on the wire.
    expect(q.z).toBeCloseTo(-(158709922 / POW30), 12);
    // Sanity against the doc's stated floats, to 6 dp.
    expect(q.x).toBeCloseTo(0.9888582, 6);
    expect(q.z).toBeCloseTo(-0.14781013, 6);
    expect(q.w).toBeCloseTo(-0.012906962, 6);
  });

  it('decodes the ±1 extremes and the sign of every slot', () => {
    const q = decodeMoyu32Quaternion(moyu32GyroFrame(POW30, -POW30, POW30, -POW30));
    expect(q.w).toBe(1);
    expect(q.x).toBe(-1);
    expect(q.y).toBe(-1);
    expect(q.z).toBe(-1); // wire slot held +2^30 for -z, so z = -1
  });

  it('treats the components as SIGNED little-endian, not unsigned', () => {
    // 0xFFFFFFFF is -1, not 4294967295. Getting this wrong yields quaternion
    // components around +4 instead of a hair below zero.
    const q = decodeMoyu32Quaternion(hexToBytes('ABFFFFFFFF01000000FFFFFFFF01000000000000'));
    expect(q.w).toBeCloseTo(-1 / POW30, 15);
    expect(q.x).toBeCloseTo(1 / POW30, 15);
    expect(q.z).toBeCloseTo(1 / POW30, 15);
    expect(q.y).toBeCloseTo(1 / POW30, 15);
  });

  it('routes 0xAB frames to the gyro sink and emits no moves', () => {
    const cap = capture();
    const dec = createMoyu32State();
    dec.prevMoveCnt = 7;
    const moves = decodeMoyu32Frame(moyu32GyroFrame(POW30, 0, 0, 0), dec, cap.sink);
    expect(moves).toEqual([]);
    expect(cap.quaternions).toHaveLength(1);
    expect(cap.quaternions[0].w).toBe(1);
    // No angular velocity in this protocol — never fabricate one.
    expect(cap.velocities[0]).toBeUndefined();
    expect(dec.prevMoveCnt).toBe(7);
    expect(dec.badFrames).toBe(0);
  });

  it('skips the decode entirely when nobody is listening', () => {
    const dec = createMoyu32State();
    expect(decodeMoyu32Frame(moyu32GyroFrame(POW30, 0, 0, 0), dec)).toEqual([]);
    expect(dec.badFrames).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  MoYu32 move / state path — the gyro branch must not disturb it     */
/* ------------------------------------------------------------------ */

/** 0xA3 state snapshot carrying only the move counter at bits 152..160. */
function moyu32StateFrame(moveCnt: number): Uint8Array {
  return packBits(20, [[0, 8, 0xa3], [152, 8, moveCnt & 0xff]]);
}

/** 0xA5 move frame: counter at bits 88..96, five 5-bit codes from bit 96. */
function moyu32MoveFrame(moveCnt: number, codes: number[]): Uint8Array {
  const writes: BitWrite[] = [[0, 8, 0xa5], [88, 8, moveCnt & 0xff]];
  for (let i = 0; i < 5; i++) writes.push([96 + i * 5, 5, (codes[i] ?? 0) & 0x1f]);
  return packBits(20, writes);
}

describe('MoYu32 move stream', () => {
  it('stays silent until a 0xA3 snapshot seeds the counter', () => {
    const dec = createMoyu32State();
    // Code 0 = "F"; without a seed csTimer drops the frame outright.
    expect(decodeMoyu32Frame(moyu32MoveFrame(3, [0, 0, 0, 0, 0]), dec)).toEqual([]);
    expect(dec.prevMoveCnt).toBe(-1);
  });

  it('decodes the FBUDLR code table with the low bit as direction', () => {
    const dec = createMoyu32State();
    decodeMoyu32Frame(moyu32StateFrame(0), dec);
    expect(dec.prevMoveCnt).toBe(0);
    // Counter jumps 0 -> 5, so all five window slots are new. window[0] is the
    // NEWEST, so emission order is slot 4, 3, 2, 1, 0.
    // codes: 0=F 3=B' 4=U 9=L' 11=R'
    const moves = decodeMoyu32Frame(moyu32MoveFrame(5, [0, 3, 4, 9, 11]), dec);
    expect(moves).toEqual(["R'", "L'", 'U', "B'", 'F']);
    expect(dec.prevMoveCnt).toBe(5);
  });

  it('emits only the moves the counter says are new', () => {
    const dec = createMoyu32State();
    decodeMoyu32Frame(moyu32StateFrame(10), dec);
    // +2 → only the two newest window slots are unseen.
    expect(decodeMoyu32Frame(moyu32MoveFrame(12, [2, 4, 6, 8, 10]), dec)).toEqual(['U', 'B']);
    expect(dec.prevMoveCnt).toBe(12);
  });

  it('clamps a large counter jump to the 5-slot window', () => {
    const dec = createMoyu32State();
    decodeMoyu32Frame(moyu32StateFrame(0), dec);
    const moves = decodeMoyu32Frame(moyu32MoveFrame(200, [0, 2, 4, 6, 8]), dec);
    expect(moves).toHaveLength(5);
    expect(dec.prevMoveCnt).toBe(200);
  });

  it('ignores a duplicate counter', () => {
    const dec = createMoyu32State();
    decodeMoyu32Frame(moyu32StateFrame(4), dec);
    expect(decodeMoyu32Frame(moyu32MoveFrame(4, [0, 0, 0, 0, 0]), dec)).toEqual([]);
  });

  it('flags an out-of-range move code as a wrong key without advancing', () => {
    const dec = createMoyu32State();
    decodeMoyu32Frame(moyu32StateFrame(1), dec);
    // 12..31 are not valid moves; csTimer's `m >= 12` garbage check.
    expect(decodeMoyu32Frame(moyu32MoveFrame(2, [0, 0, 31, 0, 0]), dec)).toEqual([]);
    expect(dec.badFrames).toBe(1);
    expect(dec.prevMoveCnt).toBe(1);
    expect(decodeMoyu32Frame(moyu32MoveFrame(3, [12, 0, 0, 0, 0]), dec)).toEqual([]);
    expect(dec.badFrames).toBe(2);
  });

  it('counts unrecognised message types toward the wrong-key detector', () => {
    const dec = createMoyu32State();
    for (let i = 0; i < 6; i++) {
      const junk = new Uint8Array(20);
      junk[0] = 0x37; // not one of A1/A3/A4/A5/AB/AC
      decodeMoyu32Frame(junk, dec);
    }
    expect(dec.badFrames).toBe(6);
  });

  it('reads the battery percentage from bits 8..16', () => {
    const dec = createMoyu32State();
    decodeMoyu32Frame(packBits(20, [[0, 8, 0xa4], [8, 8, 83]]), dec);
    expect(dec.battery).toBe(83);
    // Out-of-range readings are dropped, not clamped.
    decodeMoyu32Frame(packBits(20, [[0, 8, 0xa4], [8, 8, 200]]), dec);
    expect(dec.battery).toBe(83);
  });

  it('ignores short frames instead of decoding garbage', () => {
    const dec = createMoyu32State();
    expect(decodeMoyu32Frame(new Uint8Array([0xa5, 0, 0]), dec)).toEqual([]);
    expect(dec.badFrames).toBe(0);
  });
});

describe('MoYu32 name-derived default MAC', () => {
  it('maps WCU_MY32_XXYY to the vendor prefix csTimer uses', () => {
    expect(moyu32DefaultMac('WCU_MY32_AB12')).toBe('CF:30:16:00:AB:12');
    expect(moyu32DefaultMac('  WCU_MY32_00FF  ')).toBe('CF:30:16:00:00:FF');
  });

  it('returns null for anything that is not that exact pattern', () => {
    // No OUI guessing: an unrecognised name must fall through to the prompt.
    for (const n of ['WCU_MY32_ABC', 'WCU_MY32_ABCDE', 'WCU_MY3_AB12', 'GAN-1234', '', null]) {
      expect(moyu32DefaultMac(n)).toBeNull();
    }
  });
});
