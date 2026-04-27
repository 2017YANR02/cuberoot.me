/**
 * GAN Smart Cube v3 driver — covers GAN 356 i / i3 / i Play / 357.
 *
 * Protocol overview (re-implemented from public references; see cubing.js'
 * `bluetooth/gan` directory and the cstimer gancube.js source):
 *
 *   - Primary service exposes a notification characteristic that emits
 *     20-byte AES-128-CBC encrypted frames whenever the cube moves.
 *   - The decryption key/IV are derived per-cube by XOR-ing a fixed
 *     "factory" key & IV with the device's MAC address (reversed, padded).
 *     The MAC arrives via manufacturer-data records we cannot read from
 *     Web Bluetooth on most platforms, so we attempt two fallbacks:
 *       1. parse trailing 12 hex chars from `device.name` (older firmwares
 *          embed the MAC suffix there: "GAN-XXXXXX"),
 *       2. otherwise use the all-zeros MAC, which works on a subset of
 *          firmwares that ship without per-device key derivation.
 *   - After decryption each frame's leading nibble selects the message
 *     type; we only handle 0x1 (move history). Each move slot encodes a
 *     face index (0..5 = U, R, F, D, L, B in GAN's order) and direction
 *     (0 = CW, 1 = CCW).
 *
 *   This is enough for the auto-stop-on-solved use case. We deliberately
 *   skip gyroscope / orientation / battery-status frames; battery is
 *   instead read from the standard Battery Service (0x180F) characteristic
 *   0x2A19 if the cube exposes one, otherwise reported as null.
 *
 * KNOWN CAVEATS — needs real-device verification:
 *   - Per-cube key derivation: the ideal source is the BLE advertisement's
 *     manufacturer-data (company ID 0x0001), but Web Bluetooth doesn't
 *     surface advertisement data without an active scan. The name-based
 *     fallback covers most "GAN-XXXXXX" / "Gi3-XXXXXX" units shipped
 *     2019–2023; newer ones may use a randomized address and require a
 *     separate scan permission.
 *   - The decoder uses pure-TS AES (decrypt-only) so the BLE notification
 *     callback can stay synchronous; WebCrypto's AES-CBC requires PKCS#7
 *     padding which doesn't match GAN's 20-byte rolling-window format.
 *   - Some newer firmwares respond to a "request state" write to the
 *     command characteristic before they emit any notifications; we send
 *     that opcode once at start. Failure is non-fatal.
 */

import type { CubeDriver, CubeDriverStartResult } from './driver';
import type { CubeBrand } from './types';

// Primary GAN smart-cube service (the v3 family — i / i3 / i Carry / 357).
const GAN_V3_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';
// Notification characteristic — emits move/state frames.
const GAN_V3_NOTIFY_CHAR = '0000fff5-0000-1000-8000-00805f9b34fb';
// Optional command characteristic — used to nudge the cube into emitting.
const GAN_V3_COMMAND_CHAR = '0000fff6-0000-1000-8000-00805f9b34fb';

// Standard Bluetooth Battery Service / level characteristic.
const BATTERY_SERVICE = 0x180f;
const BATTERY_LEVEL_CHAR = 0x2a19;

// GAN factory key/IV. Public values (cubing.js / cstimer). XORed per-cube
// with the device MAC (reversed) to derive the actual key.
const GAN_KEY_BASE = new Uint8Array([
  0x01, 0x02, 0x42, 0x28, 0x31, 0x91, 0x16, 0x07,
  0x20, 0x05, 0x18, 0x54, 0x42, 0x11, 0x12, 0x53,
]);
const GAN_IV_BASE = new Uint8Array([
  0x11, 0x03, 0x32, 0x28, 0x21, 0x01, 0x76, 0x27,
  0x20, 0x95, 0x78, 0x14, 0x32, 0x12, 0x02, 0x43,
]);

// Order of faces as encoded by the GAN move stream: 0..5.
const GAN_FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

function tryParseMacFromName(name: string | undefined): Uint8Array | null {
  if (!name) return null;
  // Common forms: "GAN-XXXXXX", "Gi3-XXXXXX", "GAN357-XXXXXX". The trailing
  // 6 hex chars are the lower 3 bytes of the MAC; older units expose all
  // 12 hex chars after a hyphen.
  const m12 = /([0-9A-Fa-f]{12})$/.exec(name);
  if (m12) return hexToBytes(m12[1]);
  const m6 = /-([0-9A-Fa-f]{6})$/.exec(name);
  if (m6) {
    // Pad to 6 bytes; the upper 3 bytes are GAN's OUI prefix CC:9B:0F.
    const lower = hexToBytes(m6[1]);
    const out = new Uint8Array(6);
    out[0] = 0xcc; out[1] = 0x9b; out[2] = 0x0f;
    out.set(lower, 3);
    return out;
  }
  return null;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

/** Derive the per-cube AES-128 key (or IV) by XOR-ing the base with the MAC. */
function deriveKey(base: Uint8Array, mac: Uint8Array): Uint8Array {
  const out = new Uint8Array(16);
  out.set(base);
  // GAN convention: reverse the MAC bytes, then XOR into the first 6 bytes
  // of the key.
  const reversed = new Uint8Array(mac.length);
  for (let i = 0; i < mac.length; i++) reversed[i] = mac[mac.length - 1 - i];
  for (let i = 0; i < reversed.length; i++) out[i] ^= reversed[i];
  return out;
}

/* ================================================================== */
/*  Pure-TS AES-128 (ECB block + CBC-mode wrapper, decrypt-only)       */
/*                                                                      */
/*  We use an in-house implementation rather than crypto.subtle because */
/*  WebCrypto's AES-CBC mandates PKCS#7 padding, while GAN frames are   */
/*  20 bytes and decrypted via a 16-byte rolling window with no pad.    */
/*  The decoder also benefits from being synchronous so the BLE         */
/*  notification handler doesn't drop frames waiting on a Promise.      */
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

/** Expand a 16-byte AES-128 key into 11 round keys (176 bytes). */
function expandKey(key: Uint8Array): Uint8Array {
  const w = new Uint8Array(176);
  w.set(key, 0);
  let i = 16;
  while (i < 176) {
    const t = new Uint8Array(4);
    t[0] = w[i - 4]; t[1] = w[i - 3]; t[2] = w[i - 2]; t[3] = w[i - 1];
    if (i % 16 === 0) {
      // RotWord + SubWord + Rcon.
      const x = t[0]; t[0] = t[1]; t[1] = t[2]; t[2] = t[3]; t[3] = x;
      t[0] = SBOX[t[0]]; t[1] = SBOX[t[1]]; t[2] = SBOX[t[2]]; t[3] = SBOX[t[3]];
      t[0] ^= RCON[i / 16];
    }
    for (let j = 0; j < 4; j++) w[i + j] = w[i - 16 + j] ^ t[j];
    i += 4;
  }
  return w;
}

/** Multiply by 2 in GF(2^8). */
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
  // Row 1: shift right by 1.
  let t = s[13]; s[13] = s[9]; s[9] = s[5]; s[5] = s[1]; s[1] = t;
  // Row 2: shift right by 2.
  t = s[2]; s[2] = s[10]; s[10] = t;
  t = s[6]; s[6] = s[14]; s[14] = t;
  // Row 3: shift right by 3.
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

/** Decrypt a single 16-byte AES-128 block. */
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

/** Decrypt a 16-byte AES-CBC block (single block) given the IV. */
function aesCbcDecrypt16(ct: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  const w = expandKey(key);
  const pt = aesDecryptBlock(ct, w);
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = pt[i] ^ iv[i];
  return out;
}

/* ================================================================== */
/*  Frame parsing                                                      */
/* ================================================================== */

interface MoveDecodeState {
  /** Last seen move serial; used to drop duplicates on re-subscribed bursts. */
  lastSerial: number;
}

/**
 * Decode a 20-byte plaintext GAN v3 frame into 0..N moves.
 *
 * Frame layout (move-history type, leading nibble = 0x1):
 *   - byte 0 high nibble = message type (0x1 for moves)
 *   - byte 0 low nibble + byte 1 = serial (move counter, big-endian 12-bit)
 *   - bytes 2..N = up to 7 move slots, each one nibble:
 *       high nibble = face index (0..5 = U R F D L B), low nibble unused
 *       direction lives in a parallel array of bits in bytes 12..13.
 *
 * Many firmwares pack the moves more densely; the layout above is correct
 * for the i3 / 357 generation. This decoder is intentionally lenient — it
 * walks 12 nibbles starting at byte 4 and uses a single direction bit per
 * move from the bitstream at byte 12.
 */
function decodeMoveFrame(frame: Uint8Array, dec: MoveDecodeState): string[] {
  if ((frame[0] >> 4) !== 0x1) return [];
  const serial = ((frame[0] & 0x0f) << 8) | frame[1];
  const last = dec.lastSerial;
  dec.lastSerial = serial;

  // Number of new moves since last seen serial (mod 256 wrap).
  let delta = (serial - last) & 0xff;
  if (last === -1) delta = 1; // first frame — only emit the latest move
  if (delta === 0) return [];
  if (delta > 7) delta = 7;   // we only have 7 history slots in a frame

  const out: string[] = [];
  // Newest move is at slot 0 (index after header). Walk newest → oldest, then
  // emit oldest-first to match the user's physical order.
  const stack: string[] = [];
  for (let i = 0; i < delta; i++) {
    const nib = (frame[2 + (i >> 1)] >> ((i & 1) ? 0 : 4)) & 0x0f;
    const face = nib & 0x07;
    if (face >= GAN_FACE_ORDER.length) continue;
    const dirBit = (frame[12 + (i >> 3)] >> (i & 7)) & 1;
    const f = GAN_FACE_ORDER[face];
    stack.push(dirBit ? `${f}'` : f);
  }
  for (let i = stack.length - 1; i >= 0; i--) out.push(stack[i]);
  return out;
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
    return /^(GAN|Gi|GiC|GiS|GiB|GiM|GAN357|GAN356)/i.test(n);
  },

  async start(server, onMove): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(GAN_V3_SERVICE);
    const notifyChar = await service.getCharacteristic(GAN_V3_NOTIFY_CHAR);

    // Derive the AES key/IV from whatever MAC we can extract.
    const mac = tryParseMacFromName(server.device.name) ?? new Uint8Array(6);
    const aesKey = deriveKey(GAN_KEY_BASE, mac);
    const aesIv = deriveKey(GAN_IV_BASE, mac);

    const decState: MoveDecodeState = { lastSerial: -1 };

    const onChar = (ev: Event): void => {
      const target = ev.target as BluetoothRemoteGATTCharacteristic;
      const dv = target.value;
      if (!dv) return;
      const ct = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      // Decrypt synchronously via pure-TS AES.
      let pt: Uint8Array;
      try {
        pt = decryptFrameSync(ct, aesKey, aesIv);
      } catch {
        return;
      }
      const moves = decodeMoveFrame(pt, decState);
      for (const mv of moves) onMove(mv);
    };

    notifyChar.addEventListener('characteristicvaluechanged', onChar);
    await notifyChar.startNotifications();

    // Some firmwares need a kick on the command characteristic. If we have
    // it, send the standard "request state" opcode (0x04). Failure is fine.
    try {
      const cmdChar = await service.getCharacteristic(GAN_V3_COMMAND_CHAR);
      const opcode = new Uint8Array([0x04]);
      if (cmdChar.writeValueWithResponse) {
        await cmdChar.writeValueWithResponse(opcode);
      } else {
        await cmdChar.writeValue(opcode);
      }
    } catch {
      // Command characteristic may not exist on all firmwares; ignore.
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
        return null;
      }
    };

    return { battery, cleanup };
  },
};

/**
 * Synchronous frame decrypt — uses our pure-TS AES. The notification
 * handler must be synchronous to avoid dropping back-to-back frames.
 */
function decryptFrameSync(ct: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  if (ct.length !== 20) return new Uint8Array(ct);
  const out = new Uint8Array(ct);
  // Last 16 bytes first, then first 16 bytes (overlapping window).
  const dec1 = aesCbcDecrypt16(ct.subarray(4, 20), key, iv);
  out.set(dec1, 4);
  const dec2 = aesCbcDecrypt16(out.subarray(0, 16), key, iv);
  out.set(dec2, 0);
  return out;
}
