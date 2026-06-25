/**
 * GAN Smart Cube v4 driver — covers GAN 12 / 13 / 14, Mini Pro, MG / AiCube
 * v4 firmwares that expose the FFF5/FFF6 GATT characteristics under the
 * 00000010-…-fff5fff4fff0 service.
 *
 * Protocol reference: cstimer's `src/js/hardware/gancube.js` (battle-tested
 * across years of community use). This driver is aligned with that
 * implementation:
 *
 *   - Service UUID `00000010-0000-fff7-fff6-fff5fff4fff0`
 *   - Notify characteristic `0000fff6-…` (mode + length + payload, 20 bytes)
 *   - Write characteristic   `0000fff5-…` (encrypted command opcodes)
 *   - AES-128-ECB key/IV derivation: per-cube key/iv = base + reversed-MAC
 *     under modular addition mod 255 (NOT XOR — GAN's quirk). Base bytes are
 *     KEYS[2] / KEYS[3] from gancube.js.
 *   - Encrypt/decrypt is a 16-byte rolling-window with two passes; for
 *     frames longer than 16 bytes the trailing 16-byte window is
 *     decrypted-then-XORed-with-IV first, then the leading 16-byte window.
 *     Encrypt is the exact inverse.
 *   - At connect we send hardware-info / facelets / battery requests so the
 *     cube starts streaming events. They are non-fatal.
 *   - Parsed events:
 *       mode 0x01 → cube move (axis + power, plus a 16-bit moveCnt for
 *                   drop detection),
 *       mode 0xEF → battery percentage,
 *       mode 0xED → facelets snapshot (we ignore the perm/ori payload; the
 *                   higher-level CubeStateTracker re-models state from
 *                   moves),
 *       mode 0xD1 → move history (used by cstimer to recover dropped moves;
 *                   we replay these into onMove so the host's state tracker
 *                   stays in sync).
 *
 * MAC discovery: Web Bluetooth on Chromium can surface the MAC via
 * `device.watchAdvertisements()` + manufacturer-data (CIC list 0x0001..0xFF01),
 * but only when the page was launched with `optionalManufacturerData` in the
 * picker filters AND the user has the experimental flag enabled. In this
 * codebase the picker (in `index.ts`) does not request advertisements, so
 * we fall back to parsing the trailing hex bytes from `device.name`
 * ("GAN-…-XXYYZZ"). When that also fails we use a zero-MAC, which works on
 * a small subset of pre-MAC firmwares and silently fails on the rest.
 */

import type { CubeDriver, CubeDriverStartResult } from './driver';
import type { CubeBrand } from './types';
import { macStringToBytes } from './mac';

// GAN v4 GATT identifiers — match cstimer's V4DATA / V4READ / V4WRITE.
const GAN_V4_SERVICE = '00000010-0000-fff7-fff6-fff5fff4fff0';
const GAN_V4_NOTIFY_CHAR = '0000fff6-0000-1000-8000-00805f9b34fb';
const GAN_V4_COMMAND_CHAR = '0000fff5-0000-1000-8000-00805f9b34fb';

// Standard Bluetooth Battery Service / level characteristic. Most GAN v4
// cubes do NOT expose the standard service — they ship battery via mode
// 0xEF events on the notify pipe — but we still try, and fall back to the
// most recent 0xEF reading.
const BATTERY_SERVICE = 0x180f;
const BATTERY_LEVEL_CHAR = 0x2a19;

// GAN v4 base key / IV. cstimer compresses these into LZString blobs
// (KEYS[2] / KEYS[3]); decompressed they are exactly these bytes.
const GAN_V4_KEY_BASE = new Uint8Array([
  0x01, 0x02, 0x42, 0x28, 0x31, 0x91, 0x16, 0x07,
  0x20, 0x05, 0x18, 0x54, 0x42, 0x11, 0x12, 0x53,
]);
const GAN_V4_IV_BASE = new Uint8Array([
  0x11, 0x03, 0x32, 0x28, 0x21, 0x01, 0x76, 0x27,
  0x20, 0x95, 0x78, 0x14, 0x32, 0x12, 0x02, 0x43,
]);

// v4 axis encoding: cstimer maps the one-hot byte [2, 32, 8, 1, 16, 4] to
// indices 0..5, which then index into "URFDLB". Encoded directions: 0 = CW,
// 1 = CCW. Quarter-turn only — there is no half-turn opcode in the move
// stream; double turns arrive as two consecutive frames.
const GAN_V4_AXIS_LOOKUP = [2, 32, 8, 1, 16, 4];
const GAN_V4_FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
// History event uses a different axis ordering ("DUBFLR") — see cstimer
// parseV4Data mode == 0xD1 branch.
const GAN_V4_HISTORY_FACE_ORDER = ['D', 'U', 'B', 'F', 'L', 'R'] as const;

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function tryParseMacFromName(name: string | undefined): Uint8Array | null {
  if (!name) return null;
  // Only a FULL 6-byte MAC embedded in the name is trustworthy. We don't
  // fabricate one from a 3-byte suffix + a guessed OUI (GAN uses several OUIs
  // across batches — a guess derives a wrong key and fails silently). The hook
  // resolves the MAC (advertisement / prompt) before start() anyway.
  const m12 = /([0-9A-Fa-f]{12})$/.exec(name);
  if (m12) return hexToBytes(m12[1]);
  return null;
}

/**
 * Per-cube key/IV derivation. cstimer's `getKeyV2`:
 *
 *   key[i] = (key[i] + value[5 - i]) % 255;   // for i in 0..5
 *
 * `value` is the MAC in forward byte order. So we add `mac[5 - i]` (i.e.
 * iterate the MAC in reverse) into the first 6 bytes of the base, modulo
 * 255 (NOT 256 — this is GAN's quirk and the reason XOR-based ports break
 * on real hardware).
 */
function deriveKey(base: Uint8Array, mac: Uint8Array): Uint8Array {
  const out = new Uint8Array(16);
  out.set(base);
  for (let i = 0; i < 6; i++) {
    out[i] = (out[i] + mac[5 - i]) % 255;
  }
  return out;
}

/* ================================================================== */
/*  Pure-TS AES-128 (ECB block, encrypt + decrypt) — duplicated from   */
/*  v3 to keep the v4 module self-contained. Sync so the BLE handler   */
/*  doesn't drop frames waiting on a Promise.                          */
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

function shiftRows(s: Uint8Array): void {
  let t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
  t = s[2]; s[2] = s[10]; s[10] = t;
  t = s[6]; s[6] = s[14]; s[14] = t;
  t = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = t;
}
function invShiftRows(s: Uint8Array): void {
  let t = s[13]; s[13] = s[9]; s[9] = s[5]; s[5] = s[1]; s[1] = t;
  t = s[2]; s[2] = s[10]; s[10] = t;
  t = s[6]; s[6] = s[14]; s[14] = t;
  t = s[3]; s[3] = s[7]; s[7] = s[11]; s[11] = s[15]; s[15] = t;
}
function subBytes(s: Uint8Array): void {
  for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
}
function invSubBytes(s: Uint8Array): void {
  for (let i = 0; i < 16; i++) s[i] = SBOX_INV[s[i]];
}
function mixColumns(s: Uint8Array): void {
  for (let c = 0; c < 4; c++) {
    const i = c * 4;
    const a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
    s[i]     = gmul(a0, 2) ^ gmul(a1, 3) ^ a2 ^ a3;
    s[i + 1] = a0 ^ gmul(a1, 2) ^ gmul(a2, 3) ^ a3;
    s[i + 2] = a0 ^ a1 ^ gmul(a2, 2) ^ gmul(a3, 3);
    s[i + 3] = gmul(a0, 3) ^ a1 ^ a2 ^ gmul(a3, 2);
  }
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

/** AES-128 ECB single-block encrypt. */
function aesEncryptBlock(block: Uint8Array, w: Uint8Array): Uint8Array {
  const s = new Uint8Array(block);
  addRoundKey(s, w, 0);
  for (let r = 1; r <= 9; r++) {
    subBytes(s);
    shiftRows(s);
    mixColumns(s);
    addRoundKey(s, w, r * 16);
  }
  subBytes(s);
  shiftRows(s);
  addRoundKey(s, w, 160);
  return s;
}

/** AES-128 ECB single-block decrypt. */
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

/**
 * GAN v4 frame decrypt — mirrors cstimer's `decode()`:
 *
 *   if (length > 16):
 *     decrypt last 16 bytes (ECB), then XOR with IV in place.
 *   decrypt first 16 bytes (ECB), XOR with IV.
 *
 * For the canonical 20-byte v4 payload this means: the trailing 16 bytes
 * (offset 4..20) are decrypted first, then the leading 16 bytes (offset
 * 0..16). The middle 12 bytes are touched by both passes — that's the
 * rolling-window overlap.
 */
function decryptFrame(ct: Uint8Array, w: Uint8Array, iv: Uint8Array): Uint8Array {
  const out = new Uint8Array(ct);
  if (ct.length > 16) {
    const offset = ct.length - 16;
    const block = aesDecryptBlock(out.subarray(offset), w);
    for (let i = 0; i < 16; i++) out[offset + i] = block[i] ^ iv[i];
  }
  const head = aesDecryptBlock(out.subarray(0, 16), w);
  for (let i = 0; i < 16; i++) out[i] = head[i] ^ iv[i];
  return out;
}

/** Inverse of `decryptFrame` — used when sending opcodes back to the cube. */
function encryptFrame(pt: Uint8Array, w: Uint8Array, iv: Uint8Array): Uint8Array {
  const out = new Uint8Array(pt);
  // Pass 1: first 16 bytes XOR-IV-then-encrypt.
  const head = new Uint8Array(out.subarray(0, 16));
  for (let i = 0; i < 16; i++) head[i] ^= iv[i];
  const headEnc = aesEncryptBlock(head, w);
  out.set(headEnc, 0);
  if (out.length > 16) {
    const offset = out.length - 16;
    const tail = new Uint8Array(out.subarray(offset));
    for (let i = 0; i < 16; i++) tail[i] ^= iv[i];
    const tailEnc = aesEncryptBlock(tail, w);
    out.set(tailEnc, offset);
  }
  return out;
}

/* ================================================================== */
/*  Frame parsing                                                      */
/* ================================================================== */

interface MoveDecodeState {
  /**
   * Last seen 16-bit move counter from the cube. -1 means we haven't seen
   * any moves yet, in which case the very first event is treated as a
   * baseline (no move emitted) — same as cstimer's `prevMoveCnt == -1`
   * guard in `parseV4Data`.
   */
  prevMoveCnt: number;
  /** Most recent battery percentage from a mode-0xEF event (0..100). */
  battery: number | null;
  /** Consecutive frames with an unrecognised mode byte — wrong key/MAC. */
  badFrames: number;
}

// Every mode byte a correctly-keyed v4 cube emits. A wrong key randomises
// frame[0], which almost never lands here — so sustained misses ⇒ bad MAC.
const V4_KNOWN_MODES = new Set([0x01, 0xed, 0xef, 0xd1, 0xec, 0xf5, 0xf6, 0xfa, 0xfc, 0xfd, 0xfe, 0xff]);

/** Read N bits (big-endian within the byte) starting at `bitOffset`. */
function readBits(buf: Uint8Array, bitOffset: number, nBits: number): number {
  // Defensive: a truncated/oddball frame could otherwise read past the
  // backing buffer and decode garbage into a nonsense move. The canonical
  // 20-byte v4 frame always satisfies this.
  if (bitOffset + nBits > buf.length * 8) return 0;
  let v = 0;
  for (let i = 0; i < nBits; i++) {
    const byteIdx = (bitOffset + i) >> 3;
    const bitIdx = 7 - ((bitOffset + i) & 7);
    v = (v << 1) | ((buf[byteIdx] >> bitIdx) & 1);
  }
  return v;
}

/**
 * Decode a 20-byte plaintext v4 frame. cstimer's `parseV4Data` works in a
 * big-endian bit-stream view of the payload; we mirror that with `readBits`.
 *
 * Mode = byte 0:
 *   0x01 → cube move
 *   0xED → facelets / state snapshot (we ignore — the host re-models from
 *          moves)
 *   0xEF → battery (1 byte at bits 8 + len*8 .. 16 + len*8)
 *   0xD1 → move history (replays missed moves; we expand them into onMove)
 *   0xEC → gyroscope (ignored)
 *   0xF5/F6/FA/FC/FD/FE/FF → hardware info (ignored)
 *
 * Move event layout (mode = 0x01):
 *   bits 0..7   : mode = 0x01
 *   bits 8..15  : payload length (in bytes? cstimer does not validate it)
 *   bits 16..47 : 32-bit timestamp (little-endian byte order) — unused here
 *                 because we re-stamp on the host clock.
 *   bits 48..63 : 16-bit moveCnt (little-endian byte order) — used to detect
 *                 duplicates and dropped frames.
 *   bits 64..65 : direction (0 = CW, 1 = CCW)
 *   bits 66..71 : axis as one-hot in {2, 32, 8, 1, 16, 4} → URFDLB index.
 */
function decodeFrame(frame: Uint8Array, dec: MoveDecodeState): string[] {
  if (frame.length < 16) return [];
  const mode = frame[0];
  // Unrecognised mode byte ⇒ likely a wrong-key decrypt; count it for the
  // MAC-error detector. Known modes (incl. the ignored ones) reset the count.
  if (V4_KNOWN_MODES.has(mode)) dec.badFrames = 0;
  else { dec.badFrames++; return []; }

  if (mode === 0xef) {
    // Battery: bits 8 + len*8 .. 16 + len*8. cstimer reads len from bits
    // 8..16, then reads the byte at offset (8 + len*8). For the canonical
    // 20-byte frame with len=1 this lands at bit 16 → byte index 2.
    const len = frame[1];
    const byteIdx = 1 + len;
    if (byteIdx >= 0 && byteIdx < frame.length) {
      const pct = frame[byteIdx];
      if (pct <= 100) dec.battery = pct;
    }
    return [];
  }

  if (mode === 0x01) {
    // 16-bit moveCnt, little-endian (high byte at bits 56..63, low byte
    // at bits 48..55). Match cstimer's `value.slice(56,64) + value.slice(48,56)`.
    const moveCntHi = frame[7];
    const moveCntLo = frame[6];
    const moveCnt = (moveCntHi << 8) | moveCntLo;

    if (dec.prevMoveCnt === -1) {
      // Cube was just connected: align without replaying history.
      dec.prevMoveCnt = moveCnt;
      return [];
    }
    if (moveCnt === dec.prevMoveCnt) return [];

    const pow = readBits(frame, 64, 2);     // 0 = CW, 1 = CCW (any value
                                            // >= 2 is unexpected — cstimer
                                            // only formats with " '" so 2/3
                                            // would render as undefined.
                                            // We drop those.)
    const axisCode = readBits(frame, 66, 6);
    const axis = GAN_V4_AXIS_LOOKUP.indexOf(axisCode);

    const out: string[] = [];
    if (axis !== -1 && pow < 2) {
      // If we missed events between prevMoveCnt and moveCnt, cstimer would
      // request a history dump. We don't have a write hook into that path
      // here, so we just emit the latest move; the host's CubeStateTracker
      // will resync on the next solved snapshot. This is a (rare) corner
      // case that benign-degrades.
      const f = GAN_V4_FACE_ORDER[axis];
      out.push(pow === 1 ? `${f}'` : f);
    }

    dec.prevMoveCnt = moveCnt;
    return out;
  }

  if (mode === 0xd1) {
    // Move history. Layout per cstimer:
    //   bits 16..23 : startMoveCnt (most recent move's counter)
    //   from bits 24 onward, 4 bits per move: 3-bit axis (DUBFLR), 1-bit pow.
    //   numberOfMoves = (len - 1) * 2.
    const len = frame[1];
    const startMoveCnt = frame[2];
    const numberOfMoves = Math.max(0, (len - 1) * 2);
    const out: string[] = [];
    // Walk newest → oldest like cstimer, but the resulting array is in the
    // order the cube reports (newest first). Since we only fall through to
    // here when the host has already processed moves, we replay oldest →
    // newest by reversing once filled.
    const replay: { cnt: number; mv: string }[] = [];
    for (let i = 0; i < numberOfMoves; i++) {
      const axis = readBits(frame, 24 + 4 * i, 3);
      const pow = readBits(frame, 27 + 4 * i, 1);
      if (axis < 6) {
        const f = GAN_V4_HISTORY_FACE_ORDER[axis];
        const mv = pow ? `${f}'` : f;
        const cnt = (startMoveCnt - i) & 0xff;
        replay.push({ cnt, mv });
      }
    }
    // Filter out moves we've already seen and emit the rest in chronological
    // order (oldest first).
    replay.sort((a, b) => ((a.cnt - dec.prevMoveCnt) & 0xff) - ((b.cnt - dec.prevMoveCnt) & 0xff));
    for (const r of replay) {
      const diff = (r.cnt - dec.prevMoveCnt) & 0xff;
      if (diff === 0 || diff > 64) continue; // already-seen (0) or wrap (huge diff)
      out.push(r.mv);
      dec.prevMoveCnt = r.cnt;
    }
    return out;
  }

  return [];
}

/* ================================================================== */
/*  Driver implementation                                              */
/* ================================================================== */

export const ganV4Driver: CubeDriver = {
  brand: 'gan-v4' satisfies CubeBrand,
  service: GAN_V4_SERVICE,
  optionalServices: [BATTERY_SERVICE],
  needsMac: true,

  matches(device: BluetoothDevice): boolean {
    const n = device.name ?? '';
    // GAN 12 / 13 / 14 / Mini Pro / MG / AiCube. The `(?!356)` lookahead is
    // intentional: GAN 356 (i / i3 / etc.) is the v3 family and is matched
    // by the v3 driver in the registry.
    return /^(GAN-?(?!356)(12|13|14|Mini)|MG-|AiCube)/i.test(n);
  },

  async start(server, onMove, ctx): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(GAN_V4_SERVICE);
    const notifyChar = await service.getCharacteristic(GAN_V4_NOTIFY_CHAR);

    const mac = ctx?.mac
      ? macStringToBytes(ctx.mac)
      : (tryParseMacFromName(server.device.name) ?? new Uint8Array(6));
    const aesKey = deriveKey(GAN_V4_KEY_BASE, mac);
    const aesIv = deriveKey(GAN_V4_IV_BASE, mac);
    const expandedKey = expandKey(aesKey);

    const decState: MoveDecodeState = { prevMoveCnt: -1, battery: null, badFrames: 0 };
    let keyErrorFired = false;

    const onChar = (ev: Event): void => {
      const target = ev.target as BluetoothRemoteGATTCharacteristic;
      const dv = target.value;
      if (!dv) return;
      const ct = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      let pt: Uint8Array;
      try {
        pt = decryptFrame(ct, expandedKey, aesIv);
      } catch {
        return;
      }
      const moves = decodeFrame(pt, decState);
      for (const mv of moves) onMove(mv);
      // Several unrecognised frames in a row ⇒ wrong MAC. Tell the hook once.
      if (!keyErrorFired && decState.badFrames >= 6) {
        keyErrorFired = true;
        ctx?.onKeyError?.();
      }
    };

    notifyChar.addEventListener('characteristicvaluechanged', onChar);
    await notifyChar.startNotifications();

    // Send the standard hello sequence cstimer's v4init runs:
    //   v4requestHardwareInfo  → opcode 0xDF / 0x03
    //   v4requestFacelets      → opcode 0xDD / 0x04 / 0xED
    //   v4requestBattery       → opcode 0xDD / 0x04 / 0xEF
    // All 20 bytes, encrypted via the same key/IV, written to FFF5. Failure
    // is non-fatal — many cubes auto-stream after subscribe.
    let cmdChar: BluetoothRemoteGATTCharacteristic | null = null;
    try {
      cmdChar = await service.getCharacteristic(GAN_V4_COMMAND_CHAR);
    } catch {
      // No write characteristic — older firmware variant; just listen.
    }

    const sendCmd = async (req: Uint8Array): Promise<void> => {
      if (!cmdChar) return;
      const enc = encryptFrame(req, expandedKey, aesIv);
      // Detach into a fresh ArrayBuffer-backed Uint8Array — the strict TS
      // lib types narrow `BufferSource` to `Uint8Array<ArrayBuffer>` and our
      // chained subarrays surface as `ArrayBufferLike`.
      const buf = new Uint8Array(enc.length);
      buf.set(enc);
      try {
        if (cmdChar.writeValueWithResponse) {
          await cmdChar.writeValueWithResponse(buf);
        } else {
          await cmdChar.writeValue(buf);
        }
      } catch {
        // Ignore — write rejected, cube may still stream regardless.
      }
    };

    if (cmdChar) {
      const hwInfo = new Uint8Array(20);
      hwInfo[0] = 0xdf; hwInfo[1] = 0x03;
      const facelets = new Uint8Array(20);
      facelets[0] = 0xdd; facelets[1] = 0x04; facelets[3] = 0xed;
      const battery = new Uint8Array(20);
      battery[0] = 0xdd; battery[1] = 0x04; battery[3] = 0xef;
      // Sequenced — cstimer awaits each in turn.
      await sendCmd(hwInfo);
      await sendCmd(facelets);
      await sendCmd(battery);
    }

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      notifyChar.removeEventListener('characteristicvaluechanged', onChar);
      void notifyChar.stopNotifications().catch(() => {});
    };

    const battery = async (): Promise<number | null> => {
      // Try the standard battery service first; fall back to whatever the
      // cube most recently reported on a mode-0xEF event.
      try {
        const battSvc = await server.getPrimaryService(BATTERY_SERVICE);
        const battChar = await battSvc.getCharacteristic(BATTERY_LEVEL_CHAR);
        const v = await battChar.readValue();
        return v.getUint8(0);
      } catch {
        return decState.battery;
      }
    };

    return { battery, cleanup };
  },
};
