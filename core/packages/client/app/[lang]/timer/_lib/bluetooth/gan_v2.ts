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
 *       mode 1  → gyroscope: orientation quaternion + angular velocity.
 *                 cstimer leaves this branch empty; the layout comes from
 *                 afedotov/gan-web-bluetooth. See `gan_crypto.decodeGanGyro`.
 *       mode 5 (hardware info) → ignored.
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
import { BATTERY_SERVICE } from './driver';
import type { CubeBrand } from './types';
import {
  decodeGanGyro,
  decryptFrame,
  deriveKeyFromMac,
  encryptFrame,
  expandKey,
  toBitReader,
  type GyroSink,
} from './gan_crypto';
import { GAN_MAC_ADV, macStringToBytes, parseMacFromName } from './mac';

// GAN v2 GATT identifiers — match cstimer's V2SERVICE / V2READ / V2WRITE.
const GAN_V2_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dc4179';
const GAN_V2_NOTIFY_CHAR = '28be4cb6-cd67-11e9-a32f-2a2ae2dbcce4';
const GAN_V2_COMMAND_CHAR = '28be4a4a-cd67-11e9-a32f-2a2ae2dbcce4';

// Standard Bluetooth Battery Service / level characteristic. v2 cubes report
// battery as a mode-9 event on the notify pipe — but we still attempt the
// standard read and fall back to the cached value from the most recent event.
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

/* ================================================================== */
/*  Frame parsing                                                      */
/* ================================================================== */

export interface MoveDecodeState {
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
 * Decode a plaintext v2 frame and return the moves to emit (oldest first).
 * Mirrors cstimer's `parseV2Data` / `onStateChangedV2`.
 *
 * Exported for `tests/bluetooth_gyro.test.ts`.
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
 *   mode 1 (gyro):     orientation quaternion at bits 4/20/36/52 plus angular
 *                      velocity at bits 68/72/76 — see `decodeGanGyro`.
 *                      cstimer leaves this branch EMPTY.
 *   mode 5 (hardware info): ignored.
 */
export function decodeGanV2Frame(
  frame: Uint8Array,
  dec: MoveDecodeState,
  onGyro?: GyroSink,
): string[] {
  if (frame.length < 16) return [];
  const bit = toBitReader(frame);
  const mode = bit(0, 4);

  if (mode === 1) {
    // Gyro. Quaternion base bit 4, velocity base bit 68 (= 4 + 64).
    if (onGyro) {
      const g = decodeGanGyro(frame, 4, 68);
      onGyro(g.quaternion, g.velocity);
    }
    return [];
  }

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

  // mode 5 (hardware info) is intentionally ignored. Its bit 104 carries a
  // "gyro enabled" flag cstimer only logs; we don't gate anything on it.
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
  macAdv: GAN_MAC_ADV,
  hasGyro: true,

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

    const aesKey = deriveKeyFromMac(keyBase, macBytes);
    const aesIv = deriveKeyFromMac(ivBase, macBytes);
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
      const moves = decodeGanV2Frame(pt, decState, ctx?.onGyro);
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
