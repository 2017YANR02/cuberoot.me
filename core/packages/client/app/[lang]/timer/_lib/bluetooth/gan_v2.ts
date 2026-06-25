/**
 * GAN Smart Cube v2 driver — covers the GAN 356 i / i Carry / i Play, the
 * GAN MG / Mini family, and AiCube clones that speak the older Nordic-UART
 * v2 protocol (before the 8653000a-… v3 service existed).
 *
 * Protocol reference: cstimer's `src/js/hardware/gancube.js` (v2 path —
 * `v2init` / `parseV2Data` / `getKeyV2`). This driver is byte-for-byte
 * aligned with that implementation:
 *
 *   - Nordic UART service UUID `6e400001-b5a3-f393-e0a9-e50e24dc4179`
 *   - Notify (read) characteristic  `28be4cb6-cd67-11e9-a32f-2a2ae2dbcce4`
 *   - Write characteristic          `28be4a4a-cd67-11e9-a32f-2a2ae2dbcce4`
 *   - AES-128-ECB key/IV derivation: per-cube key/iv = base + reversed-MAC
 *     under modular addition mod 255 (NOT XOR — GAN's quirk; same formula as
 *     v3/v4). Normal cubes share v3's base bytes (KEYS[2]/KEYS[3]); AiCube
 *     cubes (name starts with "AiCube") use a separate base pair.
 *   - Encrypt/decrypt is a 16-byte rolling-window with two passes; for
 *     frames longer than 16 bytes the trailing 16-byte window is
 *     decrypted-then-XORed-with-IV first, then the leading 16-byte window.
 *     Encrypt is the exact inverse. Copied verbatim from the v3 driver.
 *   - At connect we send three requests (hardware info / facelets / battery)
 *     so the cube starts streaming. Each is a 20-byte frame, all zero except
 *     [0]=opcode (5=hw, 4=facelets, 9=battery), encrypted and written.
 *   - Notification frames are decoded into a big-endian bit-string and the
 *     top 4 bits select a mode:
 *       mode 2  → move event. Carries an 8-bit move counter and a SLIDING
 *                 WINDOW of the last 7 quarter-turns (5 bits each:
 *                 [face index into "URFDLB"] << 1 | [direction]).
 *                 prevMoves[0] is the NEWEST move, prevMoves[6] the oldest.
 *                 We emit `(moveCnt - prevMoveCnt) & 0xff` new moves
 *                 (clamped to 7), oldest-of-new first.
 *       mode 4  → facelets snapshot. Seeds the move counter on first sight;
 *                 we ignore the perm/ori payload (the host re-models state
 *                 from moves).
 *       mode 9  → battery percentage (bits 8..16).
 *       mode 1 (gyro) / mode 5 (hardware info) → ignored.
 *
 * 180° turns arrive as TWO consecutive quarter-turns in the v2 stream — this
 * driver therefore never emits doubles.
 *
 * MAC: supplied by the hook via `ctx.mac` ("XX:XX:XX:XX:XX:XX"); falls back to
 * parsing the trailing hex from `device.name`, then to a zero-MAC. The per-cube
 * key derivation needs the MAC — a wrong/zero MAC decrypts to garbage moves
 * (we detect that via the 5-bit move codes exceeding the valid range).
 */

import type { CubeDriver, CubeDriverStartResult, CubeDriverContext } from './driver';
import type { CubeBrand } from './types';
import { macStringToBytes, parseMacFromName } from './mac';

// GAN v2 GATT identifiers — match cstimer's V2SERVICE / V2READ / V2WRITE.
const GAN_V2_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dc4179';
const GAN_V2_NOTIFY_CHAR = '28be4cb6-cd67-11e9-a32f-2a2ae2dbcce4';
const GAN_V2_COMMAND_CHAR = '28be4a4a-cd67-11e9-a32f-2a2ae2dbcce4';

// Standard Bluetooth Battery Service / level characteristic. v2 cubes report
// battery as a mode-9 event on the notify pipe — but we still attempt the
// standard read and fall back to the cached value from the most recent event.
const BATTERY_SERVICE = 0x180f;
const BATTERY_LEVEL_CHAR = 0x2a19;

// Normal GAN v2 base key / IV — identical to v3 (cstimer KEYS[2]/KEYS[3]).
const GAN_V2_KEY_BASE = new Uint8Array([
  0x01, 0x02, 0x42, 0x28, 0x31, 0x91, 0x16, 0x07,
  0x20, 0x05, 0x18, 0x54, 0x42, 0x11, 0x12, 0x53,
]);
const GAN_V2_IV_BASE = new Uint8Array([
  0x11, 0x03, 0x32, 0x28, 0x21, 0x01, 0x76, 0x27,
  0x20, 0x95, 0x78, 0x14, 0x32, 0x12, 0x02, 0x43,
]);

// AiCube clone base key / IV — cstimer's getKeyV2 swaps to these when the
// device name starts with "AiCube".
const AICUBE_KEY_BASE = new Uint8Array([
  0x05, 0x12, 0x02, 0x45, 0x02, 0x01, 0x29, 0x56,
  0x12, 0x78, 0x12, 0x76, 0x81, 0x01, 0x08, 0x03,
]);
const AICUBE_IV_BASE = new Uint8Array([
  0x01, 0x44, 0x28, 0x06, 0x86, 0x21, 0x22, 0x28,
  0x51, 0x05, 0x08, 0x31, 0x82, 0x02, 0x21, 0x06,
]);

// v2 move codes: the 5-bit value is [faceIndex << 1 | direction]. faceIndex
// indexes "URFDLB"; direction 0 = CW, 1 = CCW. Quarter-turn only.
const GAN_V2_FACE_ORDER = 'URFDLB';

/**
 * Per-cube key/IV derivation. cstimer's `getKeyV2`:
 *
 *   key[i] = (key[i] + value[5 - i]) % 255;   // for i in 0..5
 *
 * `value` is the MAC in forward byte order, so we add `mac[5 - i]` (iterate
 * the MAC in reverse) into the first 6 bytes of the base, modulo 255 (NOT 256
 * — GAN's quirk; XOR-based ports break on real hardware). Bytes 6..15 are
 * unchanged. Identical to the v3 driver's `deriveKey`.
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
/*  v3 to keep the v2 module self-contained. Sync so the BLE handler   */
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
 * For the canonical 20-byte v2 payload this means: the trailing 16 bytes
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
   * Last seen 8-bit move counter from the cube. -1 means we haven't seen any
   * moves yet, in which case move events are ignored until a facelets (mode 4)
   * event seeds the counter — same as cstimer's `prevMoveCnt == -1` guard.
   */
  prevMoveCnt: number;
  /** Sliding window of the last 7 moves; [0] newest, [6] oldest. */
  prevMoves: string[];
  /** Most recent battery percentage from a mode-9 event (0..100). */
  battery: number | null;
  /** Consecutive garbage move-frames (out-of-range codes) — wrong key/MAC. */
  badFrames: number;
}

/**
 * Build cstimer's big-endian bit-string view of a plaintext frame:
 *   for each byte b: (b + 256).toString(2).slice(1)  → 8-char "0/1" string.
 * Concatenated, `bit(a, b)` reads bits [a, b) as an unsigned integer.
 */
function toBitReader(frame: Uint8Array): (a: number, b: number) => number {
  let value = '';
  for (let i = 0; i < frame.length; i++) {
    value += (frame[i] + 256).toString(2).slice(1);
  }
  return (a: number, b: number): number => parseInt(value.slice(a, b), 2);
}

/**
 * Decode a plaintext v2 frame and return the moves to emit (oldest first).
 * Mirrors cstimer's `parseV2Data` / `onStateChangedV2`.
 *
 *   mode = bit(0, 4)   (top 4 bits of byte 0)
 *
 *   mode 2 (move): moveCnt = bit(4, 12) (8-bit counter). Seven moves packed
 *     5 bits each from bit 12: m = bit(12 + i*5, 17 + i*5);
 *       face = "URFDLB"[m >> 1], dir = (m & 1) ? "'" : "".
 *     prevMoves[0] is the NEWEST, prevMoves[6] the oldest. We emit
 *     moveDiff = (moveCnt - prevMoveCnt) & 0xff new moves (clamped to 7),
 *     walking prevMoves[moveDiff-1] → prevMoves[0] (oldest-of-new → newest).
 *     If any code is >= 12 it's garbage (wrong key) — we flag keyError and
 *     emit nothing this frame.
 *
 *   mode 4 (facelets): moveCnt = bit(4, 12). Seeds prevMoveCnt on first sight.
 *   mode 9 (battery):  batteryLevel = bit(8, 16).
 *   mode 1 (gyro) / mode 5 (hardware info): ignored.
 */
function decodeFrame(frame: Uint8Array, dec: MoveDecodeState): string[] {
  if (frame.length < 16) return [];
  const bit = toBitReader(frame);
  const mode = bit(0, 4);

  if (mode === 2) {
    const moveCnt = bit(4, 12);
    // Ignore the very first move frame (no seed yet) and duplicate frames.
    if (dec.prevMoveCnt === moveCnt || dec.prevMoveCnt === -1) return [];

    const parsed: string[] = [];
    let garbage = false;
    for (let i = 0; i < 7; i++) {
      const m = bit(12 + i * 5, 17 + i * 5);
      if (m >= 12) { garbage = true; break; }
      const face = GAN_V2_FACE_ORDER[m >> 1];
      const dir = (m & 1) ? "'" : '';
      parsed[i] = face + dir;
    }
    if (garbage) {
      // Wrong key / MAC — the move codes are nonsense. Count it; the driver
      // fires ctx.onKeyError after a few of these so the hook can re-prompt.
      dec.badFrames++;
      return [];
    }
    dec.badFrames = 0;

    dec.prevMoves = parsed;
    let moveDiff = (moveCnt - dec.prevMoveCnt) & 0xff;
    if (moveDiff > 7) moveDiff = 7;
    const out: string[] = [];
    // prevMoves[moveDiff-1] is the oldest of the new moves; [0] is the newest.
    for (let i = moveDiff - 1; i >= 0; i--) out.push(parsed[i]);
    dec.prevMoveCnt = moveCnt;
    return out;
  }

  if (mode === 4) {
    // Facelets snapshot — seeds the move counter. We don't need the cube
    // state; the host re-models from the move stream.
    const moveCnt = bit(4, 12);
    if (dec.prevMoveCnt === -1) dec.prevMoveCnt = moveCnt;
    return [];
  }

  if (mode === 9) {
    const pct = bit(8, 16);
    if (pct <= 100) dec.battery = pct;
    return [];
  }

  // mode 1 (gyro) and mode 5 (hardware info) are intentionally ignored.
  return [];
}

/* ================================================================== */
/*  Driver implementation                                              */
/* ================================================================== */

export const ganV2Driver: CubeDriver = {
  brand: 'gan-v2' satisfies CubeBrand,
  service: GAN_V2_SERVICE,
  optionalServices: [BATTERY_SERVICE],
  needsMac: true,

  matches(device: BluetoothDevice): boolean {
    // GAN / MG / AiCube / Gi families. cstimer accepts these prefixes and
    // discriminates on the service UUID at runtime; our registry routes by
    // `matches()`, so the picked device's GATT service gates the rest.
    return /^(GAN|MG|AiCube|Gi)/i.test(device.name ?? '');
  },

  async start(server, onMove, ctx?: CubeDriverContext): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(GAN_V2_SERVICE);
    const notifyChar = await service.getCharacteristic(GAN_V2_NOTIFY_CHAR);

    // Resolve MAC: prefer the hook-supplied ctx.mac, fall back to the name,
    // then a zero-MAC (works on a tiny subset of firmwares, garbage otherwise).
    const nameMac = parseMacFromName(server.device.name);
    const macBytes = ctx?.mac
      ? macStringToBytes(ctx.mac)
      : (nameMac ? macStringToBytes(nameMac) : new Uint8Array(6));

    // Normal GAN v2 shares v3's base; AiCube clones use their own pair.
    const isAiCube = (server.device.name ?? '').startsWith('AiCube');
    const keyBase = isAiCube ? AICUBE_KEY_BASE : GAN_V2_KEY_BASE;
    const ivBase = isAiCube ? AICUBE_IV_BASE : GAN_V2_IV_BASE;

    const aesKey = deriveKey(keyBase, macBytes);
    const aesIv = deriveKey(ivBase, macBytes);
    const expandedKey = expandKey(aesKey);

    const decState: MoveDecodeState = {
      prevMoveCnt: -1,
      prevMoves: [],
      battery: null,
      badFrames: 0,
    };
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
      // A few garbage move-frames in a row ⇒ wrong MAC. Tell the hook once.
      if (!keyErrorFired && decState.badFrames >= 3) {
        keyErrorFired = true;
        ctx?.onKeyError?.();
      }
    };

    notifyChar.addEventListener('characteristicvaluechanged', onChar);
    await notifyChar.startNotifications();

    // Send cstimer's v2init hello sequence. Each is a 20-byte frame, all zero
    // except [0]=opcode, encrypted via the same key/IV and written to the
    // command characteristic:
    //   v2requestHardwareInfo → opcode 5
    //   v2requestFacelets     → opcode 4
    //   v2requestBattery      → opcode 9
    let cmdChar: BluetoothRemoteGATTCharacteristic | null = null;
    try {
      cmdChar = await service.getCharacteristic(GAN_V2_COMMAND_CHAR);
    } catch {
      // No write characteristic — older firmware variant; just listen.
    }

    const sendCmd = async (opcode: number): Promise<void> => {
      if (!cmdChar) return;
      const req = new Uint8Array(20);
      req[0] = opcode;
      const enc = encryptFrame(req, expandedKey, aesIv);
      // Detach into a fresh ArrayBuffer-backed Uint8Array — the strict TS lib
      // types narrow `BufferSource` to `Uint8Array<ArrayBuffer>` and our
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
      await sendCmd(5); // hardware info
      await sendCmd(4); // facelets (seeds move counter)
      await sendCmd(9); // battery
    }

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      notifyChar.removeEventListener('characteristicvaluechanged', onChar);
      void notifyChar.stopNotifications().catch(() => {});
    };

    const battery = async (): Promise<number | null> => {
      // Try the standard battery service first; fall back to whatever the cube
      // most recently reported on a mode-9 event.
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
