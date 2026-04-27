/**
 * QiYi Smart Cube driver — covers QiYi XS / Spark / MHC / Smart Mat.
 *
 * UNTESTED ON REAL HARDWARE in this codebase. Protocol decoding is
 * transcribed from public reverse-engineering, primarily:
 *   - https://github.com/cs0x7f/cstimer (qiyicube.js)
 *   - https://github.com/Cubing/cubing.js community discussions
 *
 * Pair a GAN v3 cube for the auto-stop feature until QiYi is field-verified.
 *
 * Protocol summary:
 *   - Service UUID `0000fff0-0000-1000-8000-00805f9b34fb`
 *   - Notify characteristic `0000fff6-...` — emits 16-byte AES-128-CBC
 *     encrypted frames whenever the cube moves, on a heartbeat, or in
 *     response to a write to the command characteristic.
 *   - Write characteristic `0000fff5-...` — used to send a "hello" /
 *     "request state" packet at connect.
 *   - Encryption: AES-128-CBC with a fixed 16-byte key and 16-byte IV
 *     XOR-mixed with the 6-byte device MAC. The MAC is unfortunately not
 *     readable from Web Bluetooth, so we fall back to parsing the trailing
 *     hex from `device.name` (older firmwares show "QY-XXYYZZ") or using
 *     the all-zero MAC.
 *
 * Frame format (16 bytes plaintext, after CBC decrypt):
 *   - byte 0   : magic, 0xFE for valid QiYi frames
 *   - byte 1   : command code:
 *       0x01 — hello (sent in response to our hello write)
 *       0x02 — move event
 *       0x03 — gyroscope (ignored)
 *       0x04 — battery
 *       0x05 — facelets snapshot
 *   - bytes 2.. payload, command-specific
 *
 * Move event (cmd=0x02) payload:
 *   - byte 2   : timestamp high (ms, 32-bit big-endian over bytes 2..5)
 *   - byte 6   : move counter (8-bit, used for drop detection)
 *   - byte 7   : move code:
 *                  high nibble = face (0..5 = L R D U B F — QiYi's order),
 *                  low nibble  = direction (0 = CW, 1 = CCW, 2 = double).
 *   - bytes 8..15 : facelet bitfield + CRC.
 */

import type { CubeDriver, CubeDriverStartResult } from './driver';
import type { CubeBrand } from './types';

const QIYI_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';
const QIYI_NOTIFY_CHAR = '0000fff6-0000-1000-8000-00805f9b34fb';
const QIYI_COMMAND_CHAR = '0000fff5-0000-1000-8000-00805f9b34fb';

const BATTERY_SERVICE = 0x180f;
const BATTERY_LEVEL_CHAR = 0x2a19;

// QiYi factory key/IV. Public values from cstimer's qiyicube.js. XORed with
// the reversed 6-byte MAC.
const QIYI_KEY_BASE = new Uint8Array([
  0x57, 0xb1, 0xf9, 0xab, 0xcd, 0x1c, 0x48, 0xf7,
  0xce, 0x0b, 0xe7, 0xa7, 0x71, 0x4a, 0xc5, 0x05,
]);
const QIYI_IV_BASE = new Uint8Array([
  0x46, 0x5e, 0x6f, 0xb6, 0x70, 0x40, 0x4e, 0xc7,
  0xc1, 0xae, 0xa3, 0x8b, 0xc1, 0x9d, 0xfd, 0x9e,
]);

// Move face order in QiYi's command byte. CAUTION: this differs from GAN.
const QIYI_FACE_ORDER = ['L', 'R', 'D', 'U', 'B', 'F'] as const;

// Frame magic byte.
const QIYI_MAGIC = 0xfe;

// Command codes we recognize.
const CMD_HELLO = 0x01;
const CMD_MOVE = 0x02;
const CMD_BATTERY = 0x04;

// Hello packet: [magic, cmd_hello, len=0x10, padding...]. Cube replies with
// its own hello frame containing the firmware version and a 6-byte MAC echo
// (which we ignore — the MAC is needed BEFORE decryption, so this echo
// arrives already-encrypted).
const QIYI_HELLO = new Uint8Array([
  0xfe, 0x01, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

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
    out.set(lower, 3);
    return out;
  }
  return null;
}

/** XOR base key/IV with reversed MAC over the first 6 bytes. */
function deriveKey(base: Uint8Array, mac: Uint8Array): Uint8Array {
  const out = new Uint8Array(16);
  out.set(base);
  const reversed = new Uint8Array(mac.length);
  for (let i = 0; i < mac.length; i++) reversed[i] = mac[mac.length - 1 - i];
  for (let i = 0; i < reversed.length; i++) out[i] ^= reversed[i];
  return out;
}

/* ================================================================== */
/*  Pure-TS AES-128 (ECB block + CBC mode, decrypt-only).             */
/*  Synchronous so the BLE handler doesn't drop frames.                */
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
 * AES-128-CBC decrypt of a single 16-byte block. The caller supplies the IV;
 * for QiYi the IV is the per-cube derived value, used anew for each frame.
 */
function aesCbcDecrypt(ct: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  const w = expandKey(key);
  const out = new Uint8Array(ct.length);
  let prev = iv;
  for (let off = 0; off < ct.length; off += 16) {
    const block = ct.subarray(off, off + 16);
    if (block.length < 16) break;
    const pt = aesDecryptBlock(block, w);
    for (let i = 0; i < 16; i++) out[off + i] = pt[i] ^ prev[i];
    prev = block;
  }
  return out;
}

/** AES-128-CBC encrypt — used to package the hello packet for the cube. */
function aesEncryptBlock(block: Uint8Array, w: Uint8Array): Uint8Array {
  const s = new Uint8Array(block);
  addRoundKey(s, w, 0);
  for (let r = 1; r <= 9; r++) {
    // SubBytes
    for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
    // ShiftRows
    let t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
    t = s[2]; s[2] = s[10]; s[10] = t;
    t = s[6]; s[6] = s[14]; s[14] = t;
    t = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = t;
    // MixColumns
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
  // Final round (no MixColumns).
  for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
  let t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
  t = s[2]; s[2] = s[10]; s[10] = t;
  t = s[6]; s[6] = s[14]; s[14] = t;
  t = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = t;
  addRoundKey(s, w, 160);
  return s;
}

function aesCbcEncryptSingleBlock(pt: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  const w = expandKey(key);
  const xored = new Uint8Array(16);
  for (let i = 0; i < 16; i++) xored[i] = pt[i] ^ iv[i];
  return aesEncryptBlock(xored, w);
}

/* ================================================================== */
/*  Frame parsing                                                      */
/* ================================================================== */

interface DecodeState {
  /** Last seen move counter; used to drop heartbeat / duplicate frames. */
  lastCounter: number;
  /** Most recent battery percentage from a cmd-4 event. */
  battery: number | null;
}

/**
 * Decode a 16-byte plaintext QiYi frame into 0..1 moves.
 *
 * Direction encoding in the move byte's low nibble:
 *   0 = CW   → "F"
 *   1 = CCW  → "F'"
 *   2 = 180° → "F2"  (rare; QiYi usually splits doubles into two frames)
 *
 * Faces are reported in QiYi's order: L R D U B F.
 */
function decodeFrame(frame: Uint8Array, dec: DecodeState): string[] {
  if (frame.length < 16) return [];
  if (frame[0] !== QIYI_MAGIC) return [];
  const cmd = frame[1];

  if (cmd === CMD_BATTERY) {
    const pct = frame[2];
    if (pct <= 100) dec.battery = pct;
    return [];
  }

  if (cmd === CMD_HELLO) {
    // Cube acknowledges our hello. Nothing to do — we already subscribed.
    return [];
  }

  if (cmd !== CMD_MOVE) return [];

  const counter = frame[6];
  if (counter === dec.lastCounter) return [];
  dec.lastCounter = counter;

  const moveByte = frame[7];
  const face = (moveByte >> 4) & 0x0f;
  const dir = moveByte & 0x0f;
  if (face >= QIYI_FACE_ORDER.length) return [];
  const f = QIYI_FACE_ORDER[face];
  if (dir === 0) return [f];
  if (dir === 1) return [`${f}'`];
  if (dir === 2) return [`${f}2`];
  return [];
}

/* ================================================================== */
/*  Driver implementation                                              */
/* ================================================================== */

export const qiyiDriver: CubeDriver = {
  brand: 'qiyi' satisfies CubeBrand,
  service: QIYI_SERVICE,
  optionalServices: [String(BATTERY_SERVICE)],

  matches(device: BluetoothDevice): boolean {
    const n = device.name ?? '';
    // QiYi cubes commonly advertise as "QiYi-XXYYZZ" / "QY-..." / "MHC-..."
    // (Mofang HuanCai). The service UUID is shared with GAN v3 firmwares,
    // so this matcher must run AFTER the v3 driver in the registry.
    return /^(QiYi|MHC|QY-)/i.test(n);
  },

  async start(server, onMove): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(QIYI_SERVICE);
    const notifyChar = await service.getCharacteristic(QIYI_NOTIFY_CHAR);

    const mac = tryParseMacFromName(server.device.name) ?? new Uint8Array(6);
    const aesKey = deriveKey(QIYI_KEY_BASE, mac);
    const aesIv = deriveKey(QIYI_IV_BASE, mac);

    const decState: DecodeState = { lastCounter: -1, battery: null };

    const onChar = (ev: Event): void => {
      const target = ev.target as BluetoothRemoteGATTCharacteristic;
      const dv = target.value;
      if (!dv) return;
      const ct = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      let pt: Uint8Array;
      try {
        pt = aesCbcDecrypt(ct, aesKey, aesIv);
      } catch {
        return;
      }
      const moves = decodeFrame(pt, decState);
      for (const mv of moves) onMove(mv);
    };

    notifyChar.addEventListener('characteristicvaluechanged', onChar);
    await notifyChar.startNotifications();

    // Send the hello packet so the cube starts streaming move events.
    // Failure is non-fatal (some firmwares stream after subscribe alone).
    try {
      const cmdChar = await service.getCharacteristic(QIYI_COMMAND_CHAR);
      const helloEnc = aesCbcEncryptSingleBlock(QIYI_HELLO, aesKey, aesIv);
      const helloBuf = new ArrayBuffer(helloEnc.length);
      new Uint8Array(helloBuf).set(helloEnc);
      if (cmdChar.writeValueWithResponse) {
        await cmdChar.writeValueWithResponse(helloBuf);
      } else {
        await cmdChar.writeValue(helloBuf);
      }
    } catch {
      // Ignore.
    }

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      notifyChar.removeEventListener('characteristicvaluechanged', onChar);
      void notifyChar.stopNotifications().catch(() => {});
    };

    const battery = async (): Promise<number | null> => {
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
