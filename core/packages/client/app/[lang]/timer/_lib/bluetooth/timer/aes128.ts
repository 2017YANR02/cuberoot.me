/**
 * AES-128-ECB — the block cipher the QiYi Timer / QiYi Adapter speaks.
 *
 * Textbook AES-128 (FIPS-197), no mode-of-operation wrapper: every 16-byte
 * block is transformed independently, there is no IV and no padding scheme
 * beyond what the QiYi framing itself does (pad with 0x01, see
 * `./qiyi_timer.ts`). csTimer's equivalent is `$.aes128` in
 * `src/js/lib/sha256.js:120-217`; that is the same algorithm written with
 * fused shift/sub/add tables.
 *
 * Why a local copy: `../qiyi.ts` (the QiYi smart *cube* driver) contains the
 * same routines, but does not export them and is owned by another workstream.
 * The two should be folded into one shared `aes128` module — see the note in
 * `./index.ts`.
 *
 * `Web Crypto` cannot be used here: `crypto.subtle` deliberately does not
 * implement ECB, and it is async, while the notification handler needs to
 * decrypt synchronously inside the `characteristicvaluechanged` callback.
 */

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

const SBOX_INV = new Uint8Array(256);
for (let i = 0; i < 256; i++) SBOX_INV[SBOX[i]] = i;

const RCON = new Uint8Array([0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]);

/** Opaque expanded key: 11 round keys of 16 bytes. */
export type AesRoundKeys = Uint8Array;

/** AES-128 key schedule: 16-byte key -> 176-byte expanded key. */
export function expandKey(key: Uint8Array): AesRoundKeys {
  if (key.length !== 16) throw new Error('AES-128 requires a 16-byte key');
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
  return ((b << 1) ^ ((b & 0x80) !== 0 ? 0x1b : 0)) & 0xff;
}

function gmul(a: number, b: number): number {
  let r = 0; let aa = a; let bb = b;
  for (let i = 0; i < 8; i++) {
    if ((bb & 1) !== 0) r ^= aa;
    aa = xtime(aa);
    bb >>= 1;
  }
  return r & 0xff;
}

function addRoundKey(s: Uint8Array, w: Uint8Array, off: number): void {
  for (let i = 0; i < 16; i++) s[i] ^= w[off + i];
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

/** Encrypt one 16-byte block; returns a new array (input untouched). */
export function aesEncryptBlock(block: Uint8Array, w: AesRoundKeys): Uint8Array {
  const s = new Uint8Array(block);
  addRoundKey(s, w, 0);
  for (let r = 1; r <= 9; r++) {
    for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
    shiftRows(s);
    mixColumns(s);
    addRoundKey(s, w, r * 16);
  }
  for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
  shiftRows(s);
  addRoundKey(s, w, 160);
  return s;
}

/** Decrypt one 16-byte block; returns a new array (input untouched). */
export function aesDecryptBlock(block: Uint8Array, w: AesRoundKeys): Uint8Array {
  const s = new Uint8Array(block);
  addRoundKey(s, w, 160);
  for (let r = 9; r >= 1; r--) {
    invShiftRows(s);
    for (let i = 0; i < 16; i++) s[i] = SBOX_INV[s[i]];
    addRoundKey(s, w, r * 16);
    invMixColumns(s);
  }
  invShiftRows(s);
  for (let i = 0; i < 16; i++) s[i] = SBOX_INV[s[i]];
  addRoundKey(s, w, 0);
  return s;
}

/** ECB-encrypt a buffer whose length is a multiple of 16. Trailing partial
 *  blocks are dropped — callers pad before calling. */
export function aesEcbEncrypt(buf: Uint8Array, w: AesRoundKeys): Uint8Array {
  const out = new Uint8Array(buf.length - (buf.length % 16));
  for (let off = 0; off + 16 <= buf.length; off += 16) {
    out.set(aesEncryptBlock(buf.subarray(off, off + 16), w), off);
  }
  return out;
}

/** ECB-decrypt a buffer whose length is a multiple of 16. */
export function aesEcbDecrypt(buf: Uint8Array, w: AesRoundKeys): Uint8Array {
  const out = new Uint8Array(buf.length - (buf.length % 16));
  for (let off = 0; off + 16 <= buf.length; off += 16) {
    out.set(aesDecryptBlock(buf.subarray(off, off + 16), w), off);
  }
  return out;
}
