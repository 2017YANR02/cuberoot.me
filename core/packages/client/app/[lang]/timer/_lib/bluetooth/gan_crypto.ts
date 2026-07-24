/**
 * Shared GAN-family wire primitives — AES-128, the rolling-window frame
 * codec, MAC-salted key derivation, big-endian bit readers, and the gyro
 * field normalisation the GAN gens share.
 *
 * Why one module: `gan_v2.ts`, `gan_v3.ts` and `gan_v4.ts` each carried a
 * byte-for-byte identical ~200-line copy of the AES tables + block cipher +
 * `decryptFrame` / `encryptFrame`, and `qiyi.ts` carried a fourth (ECB-only,
 * same block cipher inlined differently). MoYu32 makes it five: cstimer's
 * `moyu32cube.js` says outright "Uses the same encryption scheme as GAN
 * Gen2/3" and its `decode()` / `encode()` are copy-pastes of `gancube.js`'s.
 *
 * Reference: cstimer `src/js/lib/sha256.js` (`$.aes128`) plus the identical
 * `decode()` / `encode()` / `getKeyV2()` in `src/js/hardware/gancube.js` and
 * `src/js/hardware/moyu32cube.js`.
 *
 * Everything here is synchronous and allocation-light: BLE notification
 * handlers must not await, or frames get dropped.
 *
 * ── The frame codec is NOT standard CBC ────────────────────────────────────
 * cstimer's `decode()` is a two-pass 16-byte rolling window:
 *
 *   if (len > 16):  decrypt(bytes[len-16 .. len]) then XOR that block with IV
 *   always:         decrypt(bytes[0 .. 16])       then XOR that block with IV
 *
 * For the canonical 20-byte frame the two windows OVERLAP on bytes 4..16, and
 * the tail pass runs FIRST so the head pass sees its output. `encryptFrame`
 * is the exact inverse (head first, then tail). Calling this "AES-CBC" — as
 * some third-party ports do — and using a library CBC mode produces different
 * bytes and silently decodes garbage on real cubes.
 *
 * ── The key derivation is mod 255, not mod 256 ─────────────────────────────
 * `deriveKeyFromMac` adds the REVERSED MAC into the first six bytes of the
 * base key/IV modulo **255**. That is GAN's quirk, not a typo: 0xFF + 0x00
 * wraps to 0x00, and every XOR-based or mod-256 port breaks on hardware.
 */

/* ================================================================== */
/*  AES-128 tables                                                     */
/* ================================================================== */

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

const RCON = new Uint8Array([0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]);

/* ================================================================== */
/*  AES-128 core                                                       */
/* ================================================================== */

/** Expand a 16-byte key into the 176-byte round-key schedule. */
export function expandKey(key: Uint8Array): Uint8Array {
  const w = new Uint8Array(176);
  w.set(key.subarray(0, 16), 0);
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

/**
 * AES-128 single-block encrypt. Reads the first 16 bytes of `block` and
 * returns a fresh 16-byte array; `block` is never mutated (cstimer's
 * `AES128.prototype.encrypt` mutates in place, and only ever touches the
 * first 16 entries even when handed a 20-element array — same net effect).
 */
export function aesEncryptBlock(block: Uint8Array, w: Uint8Array): Uint8Array {
  const s = new Uint8Array(16);
  s.set(block.subarray(0, 16));
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

/** AES-128 single-block decrypt. Same contract as `aesEncryptBlock`. */
export function aesDecryptBlock(block: Uint8Array, w: Uint8Array): Uint8Array {
  const s = new Uint8Array(16);
  s.set(block.subarray(0, 16));
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

/** ECB-encrypt a buffer whose length is a multiple of 16. Used by QiYi. */
export function aesEcbEncrypt(buf: Uint8Array, w: Uint8Array): Uint8Array {
  const out = new Uint8Array(buf.length);
  for (let off = 0; off + 16 <= buf.length; off += 16) {
    out.set(aesEncryptBlock(buf.subarray(off, off + 16), w), off);
  }
  return out;
}

/** ECB-decrypt a buffer whose length is a multiple of 16. Used by QiYi. */
export function aesEcbDecrypt(buf: Uint8Array, w: Uint8Array): Uint8Array {
  const out = new Uint8Array(buf.length);
  for (let off = 0; off + 16 <= buf.length; off += 16) {
    out.set(aesDecryptBlock(buf.subarray(off, off + 16), w), off);
  }
  return out;
}

/* ================================================================== */
/*  Frame codec (GAN gen2/3/4 + MoYu32)                                */
/* ================================================================== */

/**
 * Decrypt one notification frame — mirrors cstimer's `decode()` verbatim
 * (identical source in `gancube.js` and `moyu32cube.js`):
 *
 *   if (length > 16):
 *     decrypt last 16 bytes (ECB), then XOR with IV in place.
 *   decrypt first 16 bytes (ECB), XOR with IV.
 *
 * The tail pass runs FIRST and its output feeds the head pass — for a 20-byte
 * frame the windows overlap on bytes 4..16. Frames of exactly 16 bytes take
 * only the head pass (cstimer's `ret.length > 16` guard).
 */
export function decryptFrame(ct: Uint8Array, w: Uint8Array, iv: Uint8Array): Uint8Array {
  const out = new Uint8Array(ct);
  if (out.length > 16) {
    const offset = out.length - 16;
    const block = aesDecryptBlock(out.subarray(offset), w);
    for (let i = 0; i < 16; i++) out[offset + i] = block[i] ^ iv[i];
  }
  const head = aesDecryptBlock(out.subarray(0, 16), w);
  for (let i = 0; i < 16; i++) out[i] = head[i] ^ iv[i];
  return out;
}

/**
 * Encrypt one host->cube frame — the exact inverse of `decryptFrame`, and a
 * mirror of cstimer's `encode()`: head window first (XOR-IV then encrypt),
 * then the tail window.
 */
export function encryptFrame(pt: Uint8Array, w: Uint8Array, iv: Uint8Array): Uint8Array {
  const out = new Uint8Array(pt);
  const head = new Uint8Array(out.subarray(0, 16));
  for (let i = 0; i < 16; i++) head[i] ^= iv[i];
  out.set(aesEncryptBlock(head, w), 0);
  if (out.length > 16) {
    const offset = out.length - 16;
    const tail = new Uint8Array(out.subarray(offset));
    for (let i = 0; i < 16; i++) tail[i] ^= iv[i];
    out.set(aesEncryptBlock(tail, w), offset);
  }
  return out;
}

/**
 * Per-cube key/IV derivation — cstimer's `getKeyV2` (GAN gen2/3/4) and the
 * identical `getKeyAndIv` in `moyu32cube.js`:
 *
 *   key[i] = (key[i] + mac[5 - i]) % 255;   // for i in 0..5
 *
 * `mac` is in forward byte order (`mac[0]` is the high byte of
 * "AA:BB:CC:DD:EE:FF"), so adding `mac[5 - i]` walks it in REVERSE. Bytes
 * 6..15 of the base pass through untouched.
 *
 * Modulo **255**, not 256 — 0xFF + 0x00 wraps to 0x00. Ports that use XOR or
 * mod 256 derive a wrong key and fail silently on hardware.
 */
export function deriveKeyFromMac(base: Uint8Array, mac: Uint8Array): Uint8Array {
  const out = new Uint8Array(16);
  out.set(base.subarray(0, 16));
  for (let i = 0; i < 6; i++) {
    out[i] = (out[i] + (mac[5 - i] ?? 0)) % 255;
  }
  return out;
}

/* ================================================================== */
/*  Bit readers                                                        */
/* ================================================================== */

/**
 * Build cstimer's big-endian bit-string view of a plaintext frame:
 *   for each byte b: (b + 256).toString(2).slice(1)  → 8-char "0/1" string.
 * Concatenated, the returned `bit(a, b)` reads bits [a, b) as an unsigned
 * integer — the exact idiom `parseV2Data` / `moyu32cube.js parseData` use.
 */
export function toBitReader(frame: Uint8Array): (a: number, b: number) => number {
  let value = '';
  for (let i = 0; i < frame.length; i++) {
    value += (frame[i] + 256).toString(2).slice(1);
  }
  return (a: number, b: number): number => parseInt(value.slice(a, b), 2);
}

/**
 * Read `nBits` (big-endian, MSB first) starting at `bitOffset`. Equivalent to
 * `toBitReader(buf)(bitOffset, bitOffset + nBits)` but without materialising
 * the bit string.
 *
 * Defensive: a truncated / oddball frame would otherwise read past the
 * backing buffer and decode garbage into a nonsense move, so an out-of-range
 * read returns 0. Canonical 20-byte frames always fit.
 */
export function readBits(buf: Uint8Array, bitOffset: number, nBits: number): number {
  if (bitOffset < 0 || nBits <= 0 || bitOffset + nBits > buf.length * 8) return 0;
  let v = 0;
  for (let i = 0; i < nBits; i++) {
    const byteIdx = (bitOffset + i) >> 3;
    const bitIdx = 7 - ((bitOffset + i) & 7);
    v = (v << 1) | ((buf[byteIdx] >> bitIdx) & 1);
  }
  return v >>> 0;
}

/* ================================================================== */
/*  GAN gyroscope field decode                                         */
/* ================================================================== */

/** Orientation quaternion, scalar-first to match `./orientation.ts`'s `Quat`. */
export interface GyroQuaternion {
  w: number;
  x: number;
  y: number;
  z: number;
}

/** Angular velocity over the cube's current output-data-rate frame. */
export interface GyroVelocity {
  x: number;
  y: number;
  z: number;
}

/** What a driver calls when it decodes an orientation sample. */
export type GyroSink = (q: GyroQuaternion, v?: GyroVelocity) => void;

/**
 * Decode a GAN gyro payload. Both gens pack four 16-bit sign-magnitude
 * quaternion components at a 16-bit stride from `quatBitOffset` in w,x,y,z
 * order, then three 4-bit sign-magnitude angular velocities at a 4-bit
 * stride from `velocityBitOffset` in x,y,z order:
 *
 *   gen2 (mode 1):   quat @ 4,  velocity @ 68
 *   gen4 (0xEC):     quat @ 16, velocity @ 80
 *
 * Normalisation (both gens):
 *   q = (1 - (raw >> 15) * 2) * (raw & 0x7FFF) / 0x7FFF      → [-1, 1]
 *   v = (1 - (raw >>  3) * 2) * (raw & 0x7)                  → [-7, 7]
 *
 * i.e. the top bit is a SIGN bit, not two's complement: 0xFFFF is -1.0, not
 * a hair under zero.
 *
 * NOTE: cstimer leaves both gyro branches empty (`if (mode == 1) { }` in
 * `parseV2Data`, `else if (mode == 0xEC) { }` in `parseV4Data`) — it decodes
 * no orientation at all. The layout above therefore comes from
 * afedotov/gan-web-bluetooth (`src/gan-cube-protocol.ts`, the GYRO branches
 * of the gen2 and gen4 parsers), which is the de-facto reference the GAN
 * community uses. UNVERIFIED against hardware — we own no smart cube.
 */
export function decodeGanGyro(
  frame: Uint8Array,
  quatBitOffset: number,
  velocityBitOffset: number,
): { quaternion: GyroQuaternion; velocity: GyroVelocity } {
  const qw = readBits(frame, quatBitOffset, 16);
  const qx = readBits(frame, quatBitOffset + 16, 16);
  const qy = readBits(frame, quatBitOffset + 32, 16);
  const qz = readBits(frame, quatBitOffset + 48, 16);
  const vx = readBits(frame, velocityBitOffset, 4);
  const vy = readBits(frame, velocityBitOffset + 4, 4);
  const vz = readBits(frame, velocityBitOffset + 8, 4);
  return {
    quaternion: {
      w: signMagnitude16(qw),
      x: signMagnitude16(qx),
      y: signMagnitude16(qy),
      z: signMagnitude16(qz),
    },
    velocity: {
      x: signMagnitude4(vx),
      y: signMagnitude4(vy),
      z: signMagnitude4(vz),
    },
  };
}

/** 16-bit sign-magnitude → [-1, 1]. */
function signMagnitude16(raw: number): number {
  return (1 - (raw >> 15) * 2) * (raw & 0x7fff) / 0x7fff;
}

/** 4-bit sign-magnitude → [-7, 7]. */
function signMagnitude4(raw: number): number {
  return (1 - (raw >> 3) * 2) * (raw & 0x7);
}
