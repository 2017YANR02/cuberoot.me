/**
 * QiYi Smart Cube driver — covers QY-QYSC (Smart Cube) and XMD-TornadoV4-i.
 *
 * Protocol reference: cstimer's `src/js/hardware/qiyicube.js`. This file is a
 * faithful TypeScript port of that battle-tested implementation; comments
 * call out the two places we deviate (MAC discovery and pure-ECB self-AES).
 *
 * Wire summary
 * ------------
 *   Service:       0000fff0-0000-1000-8000-00805f9b34fb
 *   Char (notify): 0000fff6-0000-1000-8000-00805f9b34fb     (also write)
 *
 * Both reads and writes go through fff6. Frames are AES-128-**ECB** (NOT
 * CBC, no IV) on each 16-byte block, with a single fixed factory key. The
 * MAC address only matters because the cube's hello payload contains the
 * MAC, so the cube can verify the host already knows it.
 *
 * Plain-frame layout (after ECB-decrypting all blocks):
 *   [0]    magic 0xFE
 *   [1]    total length L (frame is L bytes; remainder is zero pad)
 *   [2]    opcode: 0x02 = hello (initial), 0x03 = state change
 *   [3..6] big-endian 32-bit timestamp (1.6 us per tick — see cstimer)
 *   [7..33]  27 bytes of facelet nibbles (54 stickers, "LRDUFB" alphabet)
 *   [34]   current move (state opcode only)
 *   [35]   battery percent (state opcode only; also at this offset in hello)
 *   [36..90] history-move slots; current + up to 9 past entries can be read
 *           by walking offset = 91 - 5*i for i = 1..9, each (4 ts, 1 mv)
 *   [L-2..L-1] CRC-16/MODBUS (little-endian) over msg[0..L-2]
 *
 * Move-byte encoding (1..12):
 *   axis = [4,1,3,0,2,5][(mv-1) >> 1]   -> URFDLB index
 *   power = (mv & 1) ? 0 : 2            -> 0 = CW, 2 = CCW (no doubles)
 */

import type { CubeDriver, CubeDriverStartResult } from './driver';
import type { CubeBrand } from './types';

const QIYI_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';
/** fff6 is full-duplex: notifications come in, hello/ack go out on the same. */
const QIYI_CUBE_CHAR = '0000fff6-0000-1000-8000-00805f9b34fb';

/**
 * Single fixed AES-128-ECB key shared by all QiYi smart cubes. Lifted from
 * cstimer (KEYS[0], LZ-decompressed). Public, ships in their PWA bundle.
 */
const QIYI_AES_KEY = new Uint8Array([
  0x57, 0xb1, 0xf9, 0xab, 0xcd, 0x5a, 0xe8, 0xa7,
  0x9c, 0xb9, 0x8c, 0xe7, 0x57, 0x8c, 0x51, 0x08,
]);

/** WCA face notation indexed by the URFDLB axis. */
const URFDLB = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
/** mv-byte (1..12) → URFDLB axis index, per cstimer. */
const QIYI_AXIS_LUT: ReadonlyArray<number> = [4, 1, 3, 0, 2, 5];

const QIYI_MAGIC = 0xfe;
const OP_HELLO = 0x02;
const OP_STATE = 0x03;

/* ================================================================== */
/*  AES-128-ECB (encrypt + decrypt). Mirrors cstimer's lib/sha256.js. */
/* ================================================================== */

const SBOX_INV = new Uint8Array([
  0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb,
  0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb,
  0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
  0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25,
  0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92,
  0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
  0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06,
  0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b,
  0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
  0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e,
  0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b,
  0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
  0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
  0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef,
  0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
  0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d,
]);

const SBOX = new Uint8Array([
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
]);

const RCON = new Uint8Array([0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]);

function expandKey(key: Uint8Array): Uint8Array {
  const w = new Uint8Array(176);
  w.set(key, 0);
  let i = 16;
  while (i < 176) {
    const t = new Uint8Array(4);
    t[0] = w[i - 4]; t[1] = w[i - 3]; t[2] = w[i - 2]; t[3] = w[i - 1];
    if (i % 16 === 0) {
      const x = t[0]; t[0] = t[1]; t[1] = t[2]; t[2] = t[3]; t[3] = x;
      t[0] = SBOX[t[0]]; t[1] = SBOX[t[1]]; t[2] = SBOX[t[2]]; t[3] = SBOX[t[3]];
      t[0] ^= RCON[i / 16];
    }
    for (let j = 0; j < 4; j++) w[i + j] = w[i - 16 + j] ^ t[j];
    i += 4;
  }
  return w;
}

function xtime(b: number): number {
  return ((b << 1) ^ ((b & 0x80) ? 0x1b : 0)) & 0xff;
}
function gmul(a: number, b: number): number {
  let r = 0; let aa = a; let bb = b;
  for (let i = 0; i < 8; i++) {
    if (bb & 1) r ^= aa;
    aa = xtime(aa);
    bb >>= 1;
  }
  return r & 0xff;
}

function invShiftRows(s: Uint8Array): void {
  let t = s[13]; s[13] = s[9]; s[9] = s[5]; s[5] = s[1]; s[1] = t;
  t = s[2]; s[2] = s[10]; s[10] = t;
  t = s[6]; s[6] = s[14]; s[14] = t;
  t = s[3]; s[3] = s[7]; s[7] = s[11]; s[11] = s[15]; s[15] = t;
}
function invSubBytes(s: Uint8Array): void {
  for (let i = 0; i < 16; i++) s[i] = SBOX_INV[s[i]];
}
function invMixColumns(s: Uint8Array): void {
  for (let c = 0; c < 4; c++) {
    const i = c * 4;
    const a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
    s[i]     = gmul(a0, 14) ^ gmul(a1, 11) ^ gmul(a2, 13) ^ gmul(a3,  9);
    s[i + 1] = gmul(a0,  9) ^ gmul(a1, 14) ^ gmul(a2, 11) ^ gmul(a3, 13);
    s[i + 2] = gmul(a0, 13) ^ gmul(a1,  9) ^ gmul(a2, 14) ^ gmul(a3, 11);
    s[i + 3] = gmul(a0, 11) ^ gmul(a1, 13) ^ gmul(a2,  9) ^ gmul(a3, 14);
  }
}
function addRoundKey(s: Uint8Array, w: Uint8Array, off: number): void {
  for (let i = 0; i < 16; i++) s[i] ^= w[off + i];
}

/** AES-128-ECB decrypt of a single 16-byte block (in place semantics). */
function aesDecryptBlock(block: Uint8Array, w: Uint8Array): Uint8Array {
  const s = new Uint8Array(block);
  addRoundKey(s, w, 160);
  for (let r = 9; r >= 1; r--) {
    invShiftRows(s);
    invSubBytes(s);
    addRoundKey(s, w, r * 16);
    invMixColumns(s);
  }
  invShiftRows(s);
  invSubBytes(s);
  addRoundKey(s, w, 0);
  return s;
}

/** AES-128-ECB encrypt of a single 16-byte block. */
function aesEncryptBlock(block: Uint8Array, w: Uint8Array): Uint8Array {
  const s = new Uint8Array(block);
  addRoundKey(s, w, 0);
  for (let r = 1; r <= 9; r++) {
    for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
    let t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
    t = s[2]; s[2] = s[10]; s[10] = t;
    t = s[6]; s[6] = s[14]; s[14] = t;
    t = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = t;
    for (let c = 0; c < 4; c++) {
      const i = c * 4;
      const a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
      s[i]     = gmul(a0, 2) ^ gmul(a1, 3) ^ a2 ^ a3;
      s[i + 1] = a0 ^ gmul(a1, 2) ^ gmul(a2, 3) ^ a3;
      s[i + 2] = a0 ^ a1 ^ gmul(a2, 2) ^ gmul(a3, 3);
      s[i + 3] = gmul(a0, 3) ^ a1 ^ a2 ^ gmul(a3, 2);
    }
    addRoundKey(s, w, r * 16);
  }
  for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
  let t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
  t = s[2]; s[2] = s[10]; s[10] = t;
  t = s[6]; s[6] = s[14]; s[14] = t;
  t = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = t;
  addRoundKey(s, w, 160);
  return s;
}

/** ECB-decrypt a buffer that's already a multiple of 16 bytes. */
function aesEcbDecrypt(buf: Uint8Array, w: Uint8Array): Uint8Array {
  const out = new Uint8Array(buf.length);
  for (let off = 0; off + 16 <= buf.length; off += 16) {
    const pt = aesDecryptBlock(buf.subarray(off, off + 16), w);
    out.set(pt, off);
  }
  return out;
}

/** ECB-encrypt a buffer that's already a multiple of 16 bytes. */
function aesEcbEncrypt(buf: Uint8Array, w: Uint8Array): Uint8Array {
  const out = new Uint8Array(buf.length);
  for (let off = 0; off + 16 <= buf.length; off += 16) {
    const ct = aesEncryptBlock(buf.subarray(off, off + 16), w);
    out.set(ct, off);
  }
  return out;
}

/* ================================================================== */
/*  CRC-16/MODBUS — same polynomial as cstimer                         */
/* ================================================================== */

function crc16Modbus(data: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) !== 0 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
    }
  }
  return crc & 0xffff;
}

/* ================================================================== */
/*  Frame builders & parser                                            */
/* ================================================================== */

/**
 * Build, CRC-frame, zero-pad, and ECB-encrypt a host->cube message.
 * Mirrors cstimer's `sendMessage`.
 */
function buildPacket(content: ReadonlyArray<number>, w: Uint8Array): Uint8Array {
  // Header (2) + content + CRC (2), then zero-pad to a multiple of 16.
  const headerLen = 2 + content.length + 2;
  const padded = new Uint8Array(Math.ceil(headerLen / 16) * 16);
  padded[0] = QIYI_MAGIC;
  padded[1] = headerLen;
  for (let i = 0; i < content.length; i++) padded[2 + i] = content[i] & 0xff;
  const crc = crc16Modbus(padded.subarray(0, 2 + content.length));
  padded[2 + content.length] = crc & 0xff;
  padded[2 + content.length + 1] = (crc >>> 8) & 0xff;
  return aesEcbEncrypt(padded, w);
}

/**
 * Best-effort MAC parse from `device.name`. cstimer pulls the MAC from BLE
 * advertisement manufacturer data (CIC 0x0504), but Web Bluetooth doesn't
 * surface that to us reliably; the cube name carries the low two bytes.
 *
 * Names look like `QY-QYSC-X-XXXX` or `XMD-TornadoV4-i-X-XXXX`. The official
 * MAC prefix for QiYi Smart Cube is `CC:A3:00:00:` followed by the trailing
 * four hex chars of the device name.
 *
 * Returns 6 bytes in big-endian MAC order ([0]=high) or null.
 */
function macFromDeviceName(name: string | undefined): Uint8Array | null {
  if (!name) return null;
  const m = /^(?:QY-QYSC|XMD-TornadoV4-i)-.-([0-9A-F]{4})$/i.exec(name.trim());
  if (!m) return null;
  const tail = m[1].toUpperCase();
  return new Uint8Array([0xcc, 0xa3, 0x00, 0x00,
    parseInt(tail.slice(0, 2), 16),
    parseInt(tail.slice(2, 4), 16)]);
}

interface DecodeState {
  /** Most recent timestamp (cube's 32-bit counter). Used to dedupe. */
  lastTs: number;
  /** Most recent battery percentage. */
  battery: number | null;
}

/** Format a (axis, power) pair into WCA notation. power in {0=CW, 2=CCW}. */
function formatMove(axis: number, power: number): string | null {
  if (axis < 0 || axis >= URFDLB.length) return null;
  if (power === 0) return URFDLB[axis];
  if (power === 2) return `${URFDLB[axis]}'`;
  return null;
}

/**
 * Parse a fully-decrypted, length-trimmed, CRC-validated frame.
 * Returns moves in chronological order (oldest first) plus the new lastTs.
 */
function parseStateMoves(msg: Uint8Array, prevLastTs: number):
    { moves: string[]; lastTs: number; battery: number | null } {
  const opcode = msg[2];
  const ts = ((msg[3] << 24) | (msg[4] << 16) | (msg[5] << 8) | msg[6]) >>> 0;
  if (opcode === OP_HELLO) {
    // Hello carries a facelet snapshot and battery. We can't replay the
    // pre-connect history, so just absorb the timestamp + battery.
    const battery = msg.length > 35 ? msg[35] : null;
    return { moves: [], lastTs: ts, battery: battery !== null && battery <= 100 ? battery : null };
  }
  if (opcode !== OP_STATE) {
    return { moves: [], lastTs: prevLastTs, battery: null };
  }

  // todoMoves: newest first. Index 0 is the just-happened move.
  const todo: Array<{ mv: number; ts: number }> = [];
  if (msg.length > 34) {
    todo.push({ mv: msg[34], ts });
  }
  // History: walk back through up to 9 historical entries while their
  // timestamps are strictly newer than what we last saw.
  for (let i = 1; i < 10; i++) {
    const off = 91 - 5 * i;
    if (off + 4 >= msg.length) break;
    const hisTs = ((msg[off] << 24) | (msg[off + 1] << 16) | (msg[off + 2] << 8) | msg[off + 3]) >>> 0;
    const hisMv = msg[off + 4];
    if (hisTs <= prevLastTs || hisMv === 0) break;
    todo.push({ mv: hisMv, ts: hisTs });
  }

  // Replay oldest -> newest so the timer sees moves in real order.
  const moves: string[] = [];
  for (let i = todo.length - 1; i >= 0; i--) {
    const mv = todo[i].mv;
    if (mv < 1 || mv > 12) continue;
    const axis = QIYI_AXIS_LUT[(mv - 1) >> 1];
    const power = (mv & 1) !== 0 ? 0 : 2; // odd = CW, even = CCW
    const formatted = formatMove(axis, power);
    if (formatted) moves.push(formatted);
  }

  const battery = msg.length > 35 ? msg[35] : null;
  return { moves, lastTs: ts, battery: battery !== null && battery <= 100 ? battery : null };
}

/* ================================================================== */
/*  Driver implementation                                              */
/* ================================================================== */

export const qiyiDriver: CubeDriver = {
  brand: 'qiyi' satisfies CubeBrand,
  service: QIYI_SERVICE,
  optionalServices: [],

  matches(device: BluetoothDevice): boolean {
    const n = (device.name ?? '').trim();
    return /^(QY-QYSC|XMD-TornadoV4-i)/i.test(n);
  },

  async start(server, onMove): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(QIYI_SERVICE);
    const cubeChar = await service.getCharacteristic(QIYI_CUBE_CHAR);

    const w = expandKey(QIYI_AES_KEY);
    const decState: DecodeState = { lastTs: 0, battery: null };

    /** Send a host->cube ECB packet on the cube characteristic. */
    const send = async (content: ReadonlyArray<number>): Promise<void> => {
      const enc = buildPacket(content, w);
      // Allocate a fresh ArrayBuffer to satisfy strict TS BufferSource typing.
      const ab = new ArrayBuffer(enc.length);
      new Uint8Array(ab).set(enc);
      if (cubeChar.writeValueWithResponse) {
        await cubeChar.writeValueWithResponse(ab);
      } else if (cubeChar.writeValueWithoutResponse) {
        await cubeChar.writeValueWithoutResponse(ab);
      } else {
        await cubeChar.writeValue(ab);
      }
    };

    const onChar = (ev: Event): void => {
      const target = ev.target as BluetoothRemoteGATTCharacteristic;
      const dv = target.value;
      if (!dv || dv.byteLength === 0 || (dv.byteLength % 16) !== 0) return;
      const ct = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      const pt = aesEcbDecrypt(ct, w);
      if (pt[0] !== QIYI_MAGIC) return;
      const len = pt[1];
      if (len < 4 || len > pt.length) return;
      const msg = pt.subarray(0, len);
      if (crc16Modbus(msg) !== 0) return; // CRC is over msg incl. trailing CRC = 0

      // Ack opcode + 4 ts bytes for state and hello frames, mirroring cstimer.
      const opcode = msg[2];
      if (opcode === OP_HELLO || opcode === OP_STATE) {
        // Fire-and-forget; failures shouldn't lose moves we already parsed.
        void send(Array.from(msg.subarray(2, 7)));
      }

      const parsed = parseStateMoves(msg, decState.lastTs);
      decState.lastTs = parsed.lastTs;
      if (parsed.battery !== null) decState.battery = parsed.battery;
      for (const mv of parsed.moves) onMove(mv);
    };

    cubeChar.addEventListener('characteristicvaluechanged', onChar);
    await cubeChar.startNotifications();

    // Send initial hello. Without a known MAC the cube ignores it, so try a
    // best-effort name-derived MAC; if that fails, we still subscribe and
    // hope a later ack-loop kicks the cube into streaming.
    const mac = macFromDeviceName(server.device.name);
    if (mac) {
      const helloContent: number[] = [
        0x00, 0x6b, 0x01, 0x00, 0x00, 0x22, 0x06, 0x00, 0x02, 0x08, 0x00,
      ];
      // cstimer sends MAC bytes in reverse (low byte first).
      for (let i = 5; i >= 0; i--) helloContent.push(mac[i]);
      try {
        await send(helloContent);
      } catch {
        // Non-fatal — some firmwares stream after subscribe alone.
      }
    }

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      cubeChar.removeEventListener('characteristicvaluechanged', onChar);
      void cubeChar.stopNotifications().catch(() => {});
    };

    const battery = async (): Promise<number | null> => decState.battery;

    return { battery, cleanup };
  },
};
