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
import {
  decodeGanGyro,
  decryptFrame,
  deriveKeyFromMac,
  encryptFrame,
  expandKey,
  readBits,
  type GyroSink,
} from './gan_crypto';
import { GAN_MAC_ADV, macStringToBytes } from './mac';

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

/* ================================================================== */
/*  Frame parsing                                                      */
/* ================================================================== */

export interface MoveDecodeState {
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
 *   0xEC → gyroscope: orientation quaternion at bits 16/32/48/64 plus
 *          angular velocity at bits 80/84/88. cstimer leaves this branch
 *          EMPTY; layout from afedotov/gan-web-bluetooth.
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
 *
 * Exported for `tests/bluetooth_gyro.test.ts`.
 */
export function decodeGanV4Frame(
  frame: Uint8Array,
  dec: MoveDecodeState,
  onGyro?: GyroSink,
): string[] {
  if (frame.length < 16) return [];
  const mode = frame[0];
  // Unrecognised mode byte ⇒ likely a wrong-key decrypt; count it for the
  // MAC-error detector. Known modes (incl. the ignored ones) reset the count.
  if (V4_KNOWN_MODES.has(mode)) dec.badFrames = 0;
  else { dec.badFrames++; return []; }

  if (mode === 0xec) {
    // Gyro. Quaternion base bit 16, velocity base bit 80 (= 16 + 64).
    if (onGyro) {
      const g = decodeGanGyro(frame, 16, 80);
      onGyro(g.quaternion, g.velocity);
    }
    return [];
  }

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
  macAdv: GAN_MAC_ADV,
  hasGyro: true,

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
    const aesKey = deriveKeyFromMac(GAN_V4_KEY_BASE, mac);
    const aesIv = deriveKeyFromMac(GAN_V4_IV_BASE, mac);
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
      const moves = decodeGanV4Frame(pt, decState, ctx?.onGyro);
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
