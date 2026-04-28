/**
 * GAN Smart Cube v3 driver — covers GAN 356 i / i3 / i Play / 357 Play
 * (the firmwares that expose the 8653000a-… service introduced ~2022).
 *
 * Protocol reference: cstimer's `src/js/hardware/gancube.js` (v3 path —
 * `v3init` / `parseV3Data`). This driver is byte-for-byte aligned with that
 * implementation:
 *
 *   - Service UUID `8653000a-43e6-47b7-9cb0-5fc21d4ae340`
 *   - Notify (read) characteristic `8653000b-…`  (20-byte event frames)
 *   - Write characteristic         `8653000c-…`  (16-byte command frames)
 *   - AES-128-ECB key/IV derivation: per-cube key/iv = base + reversed-MAC
 *     under modular addition mod 255 (NOT XOR — GAN's quirk; same as v4 and
 *     the source of the v4 silent-failure we just fixed). Base bytes are
 *     KEYS[2] / KEYS[3] from cstimer's KEYS array.
 *   - Encrypt/decrypt is a 16-byte rolling-window with two passes; for
 *     frames longer than 16 bytes the trailing 16-byte window is
 *     decrypted-then-XORed-with-IV first, then the leading 16-byte window.
 *     Encrypt is the exact inverse. See `decode()` / `encode()` in cstimer.
 *   - At connect we send hardware-info / facelets / battery requests so the
 *     cube starts streaming events. Each is a 16-byte frame with
 *     [0]=0x68, [1]=opcode (4=hw, 1=facelets, 7=battery).
 *   - Parsed events (mode at bits 8..16, after magic 0x55 at bits 0..8):
 *       mode 1  → cube move (axis one-hot {2,32,8,1,16,4} → URFDLB index,
 *                 power 0=CW / 1=CCW, plus a 16-bit moveCnt for drop
 *                 detection),
 *       mode 6  → move history (firmware replay; axis order "DUBFLR"),
 *       mode 16 → battery percentage,
 *       mode 2  → facelets snapshot (we ignore the perm/ori payload — the
 *                 host's CubeStateTracker re-models state from moves).
 *
 * MAC discovery: same fallback chain as v4. Web Bluetooth on Chromium can
 * surface the MAC via `device.watchAdvertisements()` + manufacturer-data
 * (CIC list 0x0001..0xFF01), but our picker (`index.ts`) does not request
 * advertisements, so we fall back to parsing the trailing hex bytes from
 * `device.name` ("GAN-…-XXYYZZ"). When that also fails we use a zero-MAC,
 * which works on a tiny subset of pre-MAC firmwares and silently fails on
 * the rest — at which point the user must use cstimer to learn the MAC.
 */

import type { CubeDriver, CubeDriverStartResult } from './driver';
import type { CubeBrand } from './types';

// GAN v3 GATT identifiers — match cstimer's V3DATA / V3READ / V3WRITE.
const GAN_V3_SERVICE = '8653000a-43e6-47b7-9cb0-5fc21d4ae340';
const GAN_V3_NOTIFY_CHAR = '8653000b-43e6-47b7-9cb0-5fc21d4ae340';
const GAN_V3_COMMAND_CHAR = '8653000c-43e6-47b7-9cb0-5fc21d4ae340';

// Standard Bluetooth Battery Service / level characteristic. v3 cubes do NOT
// expose the standard service — battery arrives as mode-16 events on the
// notify pipe — but we still attempt the read and fall back to the cached
// value from the most recent in-band event.
const BATTERY_SERVICE = 0x180f;
const BATTERY_LEVEL_CHAR = 0x2a19;

// GAN v3 base key / IV. cstimer compresses these into LZString blobs
// (KEYS[2] / KEYS[3]); decompressed they are exactly these bytes. v3 and v4
// share the same base — the per-cube derivation differs only in which
// service UUID we connect to.
const GAN_V3_KEY_BASE = new Uint8Array([
  0x01, 0x02, 0x42, 0x28, 0x31, 0x91, 0x16, 0x07,
  0x20, 0x05, 0x18, 0x54, 0x42, 0x11, 0x12, 0x53,
]);
const GAN_V3_IV_BASE = new Uint8Array([
  0x11, 0x03, 0x32, 0x28, 0x21, 0x01, 0x76, 0x27,
  0x20, 0x95, 0x78, 0x14, 0x32, 0x12, 0x02, 0x43,
]);

// v3 axis encoding: cstimer maps the one-hot byte [2, 32, 8, 1, 16, 4] to
// indices 0..5, which then index into "URFDLB". Encoded directions: 0 = CW,
// 1 = CCW. Quarter-turn only — there is no half-turn opcode in the move
// stream; double turns arrive as two consecutive frames.
const GAN_V3_AXIS_LOOKUP = [2, 32, 8, 1, 16, 4];
const GAN_V3_FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
// History event uses a different axis ordering ("DUBFLR") — see cstimer
// parseV3Data mode == 6 branch.
const GAN_V3_HISTORY_FACE_ORDER = ['D', 'U', 'B', 'F', 'L', 'R'] as const;

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function tryParseMacFromName(name: string | undefined): Uint8Array | null {
  if (!name) return null;
  const m12 = /([0-9A-Fa-f]{12})$/.exec(name);
  if (m12) return hexToBytes(m12[1]);
  const m6 = /-([0-9A-Fa-f]{6})$/.exec(name);
  if (m6) {
    const lower = hexToBytes(m6[1]);
    const out = new Uint8Array(6);
    // Hard-coded GAN OUI — better than zeros when the name only carries the
    // last 3 bytes. Real cube MACs may use a different OUI on newer batches;
    // if decryption fails this is the first thing to revisit.
    out[0] = 0xcc; out[1] = 0x9b; out[2] = 0x0f;
    out.set(lower, 3);
    return out;
  }
  return null;
}

/**
 * Per-cube key/IV derivation. cstimer's `getKeyV2` (used by both v2 and v3
 * because they share the same KEYS[2..3] base):
 *
 *   key[i] = (key[i] + value[5 - i]) % 255;   // for i in 0..5
 *
 * `value` is the MAC in forward byte order, so we add `mac[5 - i]` (i.e.
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
/*  v4 to keep the v3 module self-contained. Sync so the BLE handler   */
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
 * GAN frame decrypt — mirrors cstimer's `decode()` (shared verbatim across
 * v2 / v3 / v4):
 *
 *   if (length > 16):
 *     decrypt last 16 bytes (ECB), then XOR with IV in place.
 *   decrypt first 16 bytes (ECB), XOR with IV.
 *
 * For the canonical 20-byte v3 payload this means: the trailing 16 bytes
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
   * guard in `parseV3Data`.
   */
  prevMoveCnt: number;
  /** Most recent battery percentage from a mode-16 event (0..100). */
  battery: number | null;
}

/** Read N bits (big-endian within the byte) starting at `bitOffset`. */
function readBits(buf: Uint8Array, bitOffset: number, nBits: number): number {
  // Defensive: a truncated/oddball frame could otherwise read past the
  // backing buffer and decode garbage into a nonsense move. The canonical
  // 20-byte v3 frame always satisfies this.
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
 * Decode a 20-byte plaintext v3 frame. cstimer's `parseV3Data` works in a
 * big-endian bit-stream view of the payload; we mirror that with `readBits`.
 *
 * Header (all events):
 *   bits 0..7   : magic = 0x55
 *   bits 8..15  : mode
 *   bits 16..23 : payload length (in bytes — only validated for non-zero)
 *
 * Mode 1 (cube move) — note the byte ordering quirks (cstimer sources
 * the high byte at the higher bit-offset, low byte first):
 *   bits 24..56 : 32-bit timestamp, byte order [3,2,1,0] = LE per byte
 *   bits 56..72 : 16-bit moveCnt, byte order [hi,lo] (high byte at 64..72)
 *   bits 72..74 : direction (0 = CW, 1 = CCW)
 *   bits 74..80 : axis as one-hot in {2, 32, 8, 1, 16, 4} → URFDLB index.
 *
 * Mode 6 (move history — replay of a window of past moves):
 *   bits 24..32 : startMoveCnt (most recent move's counter in window)
 *   from bits 32 onward, 4 bits per move: 3-bit axis (DUBFLR), 1-bit pow.
 *   numberOfMoves = (len - 1) * 2.
 *
 * Mode 16 (battery):
 *   bits 24..32 : battery percentage (1 byte).
 *
 * Mode 2 (facelets snapshot) — ignored; the host re-models from moves.
 * Mode 7 (hardware info) — ignored.
 */
function decodeFrame(frame: Uint8Array, dec: MoveDecodeState): string[] {
  if (frame.length < 16) return [];
  // cstimer validates magic == 0x55 and bails on any other value.
  if (frame[0] !== 0x55) return [];
  const mode = frame[1];
  const len = frame[2];
  if (len <= 0) return [];

  if (mode === 1) {
    // 16-bit moveCnt — high byte at bits 64..72, low byte at bits 56..64.
    // Mirrors cstimer's `value.slice(64,72) + value.slice(56,64)`.
    const moveCntHi = frame[8];
    const moveCntLo = frame[7];
    const moveCnt = (moveCntHi << 8) | moveCntLo;

    if (dec.prevMoveCnt === -1) {
      // First event after connect: align without replaying history.
      dec.prevMoveCnt = moveCnt;
      return [];
    }
    if (moveCnt === dec.prevMoveCnt) return [];

    const pow = readBits(frame, 72, 2);
    const axisCode = readBits(frame, 74, 6);
    const axis = GAN_V3_AXIS_LOOKUP.indexOf(axisCode);

    const out: string[] = [];
    if (axis !== -1 && pow < 2) {
      // If we missed events between prevMoveCnt and moveCnt, cstimer would
      // write a history request to FFFC. We don't have a write hook into
      // that path here — we just emit the latest move; the host's
      // CubeStateTracker resyncs on the next solved snapshot. (Same
      // behaviour as the v4 driver's mode-1 path.)
      const f = GAN_V3_FACE_ORDER[axis];
      out.push(pow === 1 ? `${f}'` : f);
    }

    dec.prevMoveCnt = moveCnt;
    return out;
  }

  if (mode === 6) {
    // History replay. Bit layout per cstimer:
    //   startMoveCnt at bits 24..32, then 4 bits per move starting at 32.
    //   numberOfMoves = (len - 1) * 2. Axis is 3 bits indexing "DUBFLR",
    //   pow is 1 bit (0 = CW, 1 = CCW).
    const startMoveCnt = frame[3];
    const numberOfMoves = Math.max(0, (len - 1) * 2);
    const replay: { cnt: number; mv: string }[] = [];
    for (let i = 0; i < numberOfMoves; i++) {
      const axis = readBits(frame, 32 + 4 * i, 3);
      const pow = readBits(frame, 35 + 4 * i, 1);
      if (axis < 6) {
        const f = GAN_V3_HISTORY_FACE_ORDER[axis];
        const mv = pow ? `${f}'` : f;
        const cnt = (startMoveCnt - i) & 0xff;
        replay.push({ cnt, mv });
      }
    }
    // Filter out moves we've already seen and emit the rest in chronological
    // order (oldest first). cstimer walks newest → oldest; our caller wants
    // them oldest-first so it can apply them to its tracker in order.
    replay.sort((a, b) => ((a.cnt - dec.prevMoveCnt) & 0xff) - ((b.cnt - dec.prevMoveCnt) & 0xff));
    const out: string[] = [];
    for (const r of replay) {
      const diff = (r.cnt - dec.prevMoveCnt) & 0xff;
      if (diff === 0 || diff > 64) continue; // already-seen (0) or wrap (huge diff)
      out.push(r.mv);
      dec.prevMoveCnt = r.cnt;
    }
    return out;
  }

  if (mode === 16) {
    // Battery percentage at bits 24..32 (i.e. byte 3).
    const pct = frame[3];
    if (pct <= 100) dec.battery = pct;
    return [];
  }

  // mode 2 (facelets snapshot) and mode 7 (hardware info) are intentionally
  // ignored — the higher-level CubeStateTracker re-models state from moves.
  return [];
}

/* ================================================================== */
/*  Driver implementation                                              */
/* ================================================================== */

export const ganV3Driver: CubeDriver = {
  brand: 'gan-v3' satisfies CubeBrand,
  service: GAN_V3_SERVICE,
  optionalServices: [String(BATTERY_SERVICE)],

  matches(device: BluetoothDevice): boolean {
    const n = device.name ?? '';
    // GAN 356 i / i3 / i Play / 357 — the v3 family. cstimer in fact accepts
    // any 'GAN' / 'MG' / 'AiCube' prefix and discriminates on the service
    // UUID at runtime, but our registry routes by `matches()` so we narrow
    // here to the 356-class names. v4 (GAN 12 / 13 / 14 / Mini / MG / AiCube)
    // is matched by gan_v4 and explicitly excludes 356 via lookahead.
    return /^(GAN-?(356|357|i)|Gi[CSBM3]?-)/i.test(n);
  },

  async start(server, onMove): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(GAN_V3_SERVICE);
    const notifyChar = await service.getCharacteristic(GAN_V3_NOTIFY_CHAR);

    const mac = tryParseMacFromName(server.device.name) ?? new Uint8Array(6);
    const aesKey = deriveKey(GAN_V3_KEY_BASE, mac);
    const aesIv = deriveKey(GAN_V3_IV_BASE, mac);
    const expandedKey = expandKey(aesKey);

    const decState: MoveDecodeState = { prevMoveCnt: -1, battery: null };

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
    };

    notifyChar.addEventListener('characteristicvaluechanged', onChar);
    await notifyChar.startNotifications();

    // Send the standard hello sequence cstimer's v3init runs:
    //   v3requestHardwareInfo  → 16-byte frame [0]=0x68 [1]=4
    //   v3requestFacelets      → 16-byte frame [0]=0x68 [1]=1
    //   v3requestBattery       → 16-byte frame [0]=0x68 [1]=7
    // All encrypted via the same key/IV, written to the v3 write characteristic.
    // Note: v3 commands are 16 bytes (single AES block — no rolling window
    // since length is not > 16), unlike v4 which is 20 bytes.
    let cmdChar: BluetoothRemoteGATTCharacteristic | null = null;
    try {
      cmdChar = await service.getCharacteristic(GAN_V3_COMMAND_CHAR);
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
      const hwInfo = new Uint8Array(16);
      hwInfo[0] = 0x68; hwInfo[1] = 0x04;
      const facelets = new Uint8Array(16);
      facelets[0] = 0x68; facelets[1] = 0x01;
      const battery = new Uint8Array(16);
      battery[0] = 0x68; battery[1] = 0x07;
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
      // cube most recently reported on a mode-16 event.
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
