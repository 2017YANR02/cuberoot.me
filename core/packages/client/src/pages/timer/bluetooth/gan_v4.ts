/**
 * GAN Smart Cube v4 driver — covers GAN 12, GAN 13, GAN 14, Mini Pro, Magnetic
 * Boost (Smart Cube Gen2/Gen3 protocol), and the GAN 356 i3 firmware revisions
 * that switched to the `8653000a-...` service UUID.
 *
 * UNTESTED ON REAL HARDWARE in this codebase. Protocol decoding is
 * transcribed from public reverse-engineering, primarily:
 *   - https://github.com/afedotov/gan-web-bluetooth (MIT)
 *   - https://github.com/cubing/cubing.js/tree/main/src/bluetooth/gan
 *   - https://github.com/cs0x7f/cstimer (gancube.js)
 *
 * Pair a GAN v3 cube for the auto-stop feature until v4 is field-verified.
 *
 * Protocol summary (Gen2):
 *   - Service UUID `8653000a-43e6-47b7-9cb0-5fc21d4ae340`
 *   - Notify characteristic `8653000b-...` — emits 16-byte AES-128-ECB
 *     encrypted frames. Two-pass decryption (matches GAN v3 layout):
 *       pass 1: decrypt the LAST 16-byte window if frame > 16 bytes,
 *       pass 2: decrypt the FIRST 16-byte window.
 *     v4 frames are typically 16 bytes flat, so the second pass is a no-op
 *     for short frames.
 *   - Write characteristic `8653000c-...` — used to send a "request state"
 *     opcode to nudge the cube into emitting events at connect.
 *   - Encryption key/IV: XOR a fixed 16-byte base key/IV with the device's
 *     reversed MAC over the first 6 bytes. The MAC is unfortunately not
 *     readable from Web Bluetooth in most browsers; we fall back to
 *     parsing the trailing hex bytes from `device.name` (older firmwares
 *     embed "GAN-XXYYZZ" in the name) or to the all-zero MAC. Real-world
 *     mileage will vary; if the cube ships with a randomized MAC and
 *     no name suffix, decryption will fail silently and no moves emit.
 *
 * Frame format (16 bytes plaintext):
 *   - Bits 0..3 (high nibble of byte 0): event type. 1 = move, 4 = battery,
 *     5 = facelets/state, others ignored here.
 *   - Move event (type=1):
 *       bits 4..15  : 12-bit move timestamp (ms, wraps every 4096 ms),
 *       bits 16..19 : face index (0..5 = U R F D L B),
 *       bit 20      : direction (0 = CW, 1 = CCW),
 *       remainder   : facelet bitfield + serial counter (used to detect
 *                     dropped frames; we walk the serial like v3).
 */

import type { CubeDriver, CubeDriverStartResult } from './driver';
import type { CubeBrand } from './types';

// GAN Gen2/Gen3 "AppService" service + characteristics.
const GAN_V4_SERVICE = '8653000a-43e6-47b7-9cb0-5fc21d4ae340';
const GAN_V4_NOTIFY_CHAR = '8653000b-43e6-47b7-9cb0-5fc21d4ae340';
const GAN_V4_COMMAND_CHAR = '8653000c-43e6-47b7-9cb0-5fc21d4ae340';

// Standard Bluetooth Battery Service / level characteristic.
const BATTERY_SERVICE = 0x180f;
const BATTERY_LEVEL_CHAR = 0x2a19;

// GAN v4 factory key/IV (Gen2/Gen3). Public values from gan-web-bluetooth
// (MIT). XOR with the device MAC (reversed) gives the per-cube key.
const GAN_V4_KEY_BASE = new Uint8Array([
  0x01, 0x02, 0x42, 0x28, 0x31, 0x91, 0x16, 0x07,
  0x20, 0x05, 0x18, 0x54, 0x42, 0x11, 0x12, 0x53,
]);
const GAN_V4_IV_BASE = new Uint8Array([
  0x11, 0x03, 0x32, 0x28, 0x21, 0x01, 0x76, 0x27,
  0x20, 0x95, 0x78, 0x14, 0x32, 0x12, 0x02, 0x43,
]);

// Move face order. v4 uses U R F D L B, same as v3.
const GAN_V4_FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

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
    // GAN OUI prefix.
    out[0] = 0xcc; out[1] = 0x9b; out[2] = 0x0f;
    out.set(lower, 3);
    return out;
  }
  return null;
}

/** XOR base key/IV with reversed MAC over first 6 bytes. */
function deriveKey(base: Uint8Array, mac: Uint8Array): Uint8Array {
  const out = new Uint8Array(16);
  out.set(base);
  const reversed = new Uint8Array(mac.length);
  for (let i = 0; i < mac.length; i++) reversed[i] = mac[mac.length - 1 - i];
  for (let i = 0; i < reversed.length; i++) out[i] ^= reversed[i];
  return out;
}

/* ================================================================== */
/*  Pure-TS AES-128 (ECB block, decrypt-only) — duplicated from v3 to */
/*  keep the v4 module self-contained. Synchronous so the BLE handler */
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
 * GAN v4 frame decrypt — two-pass overlapping window. For 16-byte frames the
 * second pass is the only meaningful one; longer frames mirror v3's layout.
 */
function decryptFrame(ct: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  const w = expandKey(key);
  const out = new Uint8Array(ct);
  if (ct.length >= 32) {
    // pass 1: last 16 bytes XOR iv.
    const tail = aesDecryptBlock(ct.subarray(ct.length - 16), w);
    for (let i = 0; i < 16; i++) tail[i] ^= iv[i];
    out.set(tail, ct.length - 16);
  }
  // pass 2: first 16 bytes XOR iv.
  const head = aesDecryptBlock(out.subarray(0, 16), w);
  for (let i = 0; i < 16; i++) head[i] ^= iv[i];
  out.set(head, 0);
  return out;
}

/* ================================================================== */
/*  Frame parsing                                                      */
/* ================================================================== */

interface MoveDecodeState {
  /** Last seen serial counter; used to detect dropped frames. */
  lastSerial: number;
  /** Most recent battery percentage from a type-4 event. */
  battery: number | null;
}

/** Read N bits starting at `bitOffset` from a big-endian-ordered byte stream. */
function readBits(buf: Uint8Array, bitOffset: number, nBits: number): number {
  let v = 0;
  for (let i = 0; i < nBits; i++) {
    const byteIdx = (bitOffset + i) >> 3;
    const bitIdx = 7 - ((bitOffset + i) & 7);
    v = (v << 1) | ((buf[byteIdx] >> bitIdx) & 1);
  }
  return v;
}

/**
 * Decode a 16-byte plaintext v4 frame into 0..N moves.
 *
 * Event types (high nibble of byte 0):
 *   0x1 — move
 *   0x4 — battery
 *   0x5 — facelets / state snapshot
 *   others — ignored
 *
 * Move event layout (gan-web-bluetooth Gen2):
 *   bits 0..3   : event type = 1
 *   bits 4..15  : 12-bit timestamp (ms since cube boot, mod 4096)
 *   bits 16..23 : serial counter (8-bit, used for drop detection)
 *   bits 24..27 : face index (0..5 = U R F D L B, 6/7 reserved)
 *   bit  28     : direction (0 = CW, 1 = CCW)
 *   remainder   : facelet bitfield (cube state snapshot)
 */
function decodeFrame(frame: Uint8Array, dec: MoveDecodeState): string[] {
  if (frame.length < 16) return [];
  const eventType = (frame[0] >> 4) & 0x0f;

  if (eventType === 0x4) {
    // Battery: byte 1 holds the percentage (0..100).
    const pct = frame[1];
    if (pct <= 100) dec.battery = pct;
    return [];
  }

  if (eventType !== 0x1) return [];

  const serial = readBits(frame, 16, 8);
  const last = dec.lastSerial;
  dec.lastSerial = serial;
  if (last < 0) {
    // First frame: emit only the latest move so we don't replay history.
    const face = readBits(frame, 24, 4);
    const dir = readBits(frame, 28, 1);
    if (face >= GAN_V4_FACE_ORDER.length) return [];
    const f = GAN_V4_FACE_ORDER[face];
    return [dir ? `${f}'` : f];
  }

  // Detect dropped frames via serial wrap-around.
  let delta = (serial - last) & 0xff;
  if (delta === 0) return [];
  // We only have one move slot per v4 frame; clamp.
  if (delta > 1) delta = 1;

  const face = readBits(frame, 24, 4);
  const dir = readBits(frame, 28, 1);
  if (face >= GAN_V4_FACE_ORDER.length) return [];
  const f = GAN_V4_FACE_ORDER[face];
  return [dir ? `${f}'` : f];
}

/* ================================================================== */
/*  Driver implementation                                              */
/* ================================================================== */

export const ganV4Driver: CubeDriver = {
  brand: 'gan-v4' satisfies CubeBrand,
  service: GAN_V4_SERVICE,
  optionalServices: [String(BATTERY_SERVICE)],

  matches(device: BluetoothDevice): boolean {
    const n = device.name ?? '';
    // v4 cubes typically present as "GAN-12-XXXX" / "GAN-13-XXXX" /
    // "GAN-14-XXXX" / "Mini Pro-XXXX". Older "GAN356" names are matched
    // by v3; v4-specific match must come after v3 in the registry.
    return /^(GAN-?(12|13|14|Mini)|MG-)/i.test(n);
  },

  async start(server, onMove): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(GAN_V4_SERVICE);
    const notifyChar = await service.getCharacteristic(GAN_V4_NOTIFY_CHAR);

    const mac = tryParseMacFromName(server.device.name) ?? new Uint8Array(6);
    const aesKey = deriveKey(GAN_V4_KEY_BASE, mac);
    const aesIv = deriveKey(GAN_V4_IV_BASE, mac);

    const decState: MoveDecodeState = { lastSerial: -1, battery: null };

    const onChar = (ev: Event): void => {
      const target = ev.target as BluetoothRemoteGATTCharacteristic;
      const dv = target.value;
      if (!dv) return;
      const ct = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      let pt: Uint8Array;
      try {
        pt = decryptFrame(ct, aesKey, aesIv);
      } catch {
        return;
      }
      const moves = decodeFrame(pt, decState);
      for (const mv of moves) onMove(mv);
    };

    notifyChar.addEventListener('characteristicvaluechanged', onChar);
    await notifyChar.startNotifications();

    // Send a "request state" command to nudge older firmwares into emitting.
    // Failure is non-fatal — many v4 cubes auto-stream after subscribe.
    try {
      const cmdChar = await service.getCharacteristic(GAN_V4_COMMAND_CHAR);
      const opcode = new Uint8Array([0xdd, 0x04, 0x00, 0x00, 0x00]);
      if (cmdChar.writeValueWithResponse) {
        await cmdChar.writeValueWithResponse(opcode);
      } else {
        await cmdChar.writeValue(opcode);
      }
    } catch {
      // Ignore — command characteristic absent or write rejected.
    }

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      notifyChar.removeEventListener('characteristicvaluechanged', onChar);
      void notifyChar.stopNotifications().catch(() => {});
    };

    const battery = async (): Promise<number | null> => {
      // Prefer the standard battery service; fall back to whatever the cube
      // most recently reported on a type-4 event.
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
