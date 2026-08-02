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
import { BATTERY_SERVICE } from './driver';
import type { CubeBrand } from './types';
import {
  decryptFrame,
  deriveKeyFromMac,
  encryptFrame,
  expandKey,
  readBits,
} from './gan_crypto';
import { GAN_MAC_ADV, macStringToBytes } from './mac';
import { GanMoveSync, type TimedMove } from './gan_move_sync';
import { decodeCubieFacelets } from '../cube/cubie';

// GAN v3 GATT identifiers — match cstimer's V3DATA / V3READ / V3WRITE.
const GAN_V3_SERVICE = '8653000a-43e6-47b7-9cb0-5fc21d4ae340';
const GAN_V3_NOTIFY_CHAR = '8653000b-43e6-47b7-9cb0-5fc21d4ae340';
const GAN_V3_COMMAND_CHAR = '8653000c-43e6-47b7-9cb0-5fc21d4ae340';

// Standard Bluetooth Battery Service / level characteristic. v3 cubes do NOT
// expose the standard service — battery arrives as mode-16 events on the
// notify pipe — but we still attempt the read and fall back to the cached
// value from the most recent in-band event.
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

interface MoveDecodeState {
  /**
   * Serial-number FIFO. Until it is seeded by a facelets snapshot, move events
   * are observed but not applied — we do not know where the cube started.
   */
  sync: GanMoveSync;
  /** Most recent battery percentage from a mode-16 event (0..100). */
  battery: number | null;
  /** Consecutive frames with a bad magic byte (≠ 0x55) — wrong key/MAC. */
  badFrames: number;
  /** The cube's self-reported facelet state — see `CubeDriverContext.onState`. */
  onState?: (facelets: string) => void;
  /** Host-clock time of the last move event, for the facelets debounce. */
  prevMoveLocTime: number | null;
  /** Injectable clock so tests don't depend on wall time. */
  now: () => number;
}

/** See the identical constant in `gan_v4.ts`. */
const FACELET_RESYNC_QUIET_MS = 500;

/**
 * Decode the cube-state payload of a mode-2 frame into a facelet string, or
 * null when it is not a physically valid cube (i.e. wrong AES key).
 *
 * Bit layout, read off cstimer's `parseV3Data` mode-2 branch — the same
 * payload as v4's 0xED, shifted one byte later by the v3 magic header:
 *   bit 40 + 3i  corner permutation, i = 0..6
 *   bit 61 + 2i  corner orientation, i = 0..6
 *   bit 77 + 4i  edge permutation,   i = 0..10
 *   bit 121 + i  edge orientation,   i = 0..10
 */
function decodeV3Facelets(frame: Uint8Array): string | null {
  const ca: number[] = [];
  for (let i = 0; i < 7; i++) {
    const perm = readBits(frame, 40 + i * 3, 3);
    const ori = readBits(frame, 61 + i * 2, 2);
    ca.push((ori << 3) | perm);
  }
  const ea: number[] = [];
  for (let i = 0; i < 11; i++) {
    const perm = readBits(frame, 77 + i * 4, 4);
    const ori = readBits(frame, 121 + i, 1);
    ea.push((perm << 1) | ori);
  }
  return decodeCubieFacelets(ca, ea);
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
function decodeFrame(frame: Uint8Array, dec: MoveDecodeState): TimedMove[] {
  if (frame.length < 16) return [];
  // cstimer validates magic == 0x55 and bails on any other value. A wrong key
  // decrypts to a non-0x55 byte on every frame, so this also flags bad MACs.
  if (frame[0] !== 0x55) { dec.badFrames++; return []; }
  dec.badFrames = 0;
  const mode = frame[1];
  const len = frame[2];
  if (len <= 0) return [];

  if (mode === 2) {
    // Cube state — the frame that says where the cube actually is. See the
    // long note on the 0xED branch in `gan_v4.ts`: leaving the counter
    // unseeded here is what made the user's first turn after connecting
    // vanish, and with it every scramble check and every auto-stop.
    const moveCnt = (frame[4] << 8) | frame[3];

    if (dec.sync.seeded) {
      dec.sync.observe(moveCnt);
      if (dec.prevMoveLocTime !== null
        && dec.now() - dec.prevMoveLocTime > FACELET_RESYNC_QUIET_MS) {
        dec.sync.requestResync(moveCnt);
      }
      return [];
    }

    const facelets = decodeV3Facelets(frame);
    if (facelets === null) {
      dec.badFrames++;
      return [];
    }
    dec.sync.seed(moveCnt);
    dec.onState?.(facelets);
    return [];
  }

  if (mode === 1) {
    // 16-bit moveCnt — high byte at bits 64..72, low byte at bits 56..64.
    // Mirrors cstimer's `value.slice(64,72) + value.slice(56,64)`.
    const moveCntHi = frame[8];
    const moveCntLo = frame[7];
    const moveCnt = (moveCntHi << 8) | moveCntLo;

    dec.prevMoveLocTime = dec.now();

    const pow = readBits(frame, 72, 2);
    const axisCode = readBits(frame, 74, 6);
    const axis = GAN_V3_AXIS_LOOKUP.indexOf(axisCode);
    if (axis === -1 || pow >= 2) return [];

    const f = GAN_V3_FACE_ORDER[axis];
    // The cube's own clock: bits 24..55, low byte first (cstimer reads it as
    // `value.slice(48,56) + ... + value.slice(24,32)`, i.e. byte order 6,5,4,3).
    const deviceTs = (frame[3] | (frame[4] << 8) | (frame[5] << 16) | (frame[6] << 24)) >>> 0;
    return dec.sync.push(moveCnt, pow === 1 ? `${f}'` : f, deviceTs);
  }

  if (mode === 6) {
    // History replay — the answer to our own request after a dropped frame.
    //   startMoveCnt at bits 24..32, then 4 bits per move starting at 32.
    //   numberOfMoves = (len - 1) * 2. Axis is 3 bits indexing "DUBFLR",
    //   pow is 1 bit (0 = CW, 1 = CCW). Newest first.
    const startMoveCnt = frame[3];
    const numberOfMoves = Math.max(0, (len - 1) * 2);
    const replay: { cnt: number; mv: string }[] = [];
    for (let i = 0; i < numberOfMoves; i++) {
      const axis = readBits(frame, 32 + 4 * i, 3);
      const pow = readBits(frame, 35 + 4 * i, 1);
      if (axis < 6) {
        const f = GAN_V3_HISTORY_FACE_ORDER[axis];
        replay.push({ cnt: (startMoveCnt - i) & 0xff, mv: pow ? `${f}'` : f });
      }
    }
    return dec.sync.injectHistory(replay);
  }

  if (mode === 16) {
    // Battery percentage at bits 24..32 (i.e. byte 3).
    const pct = frame[3];
    if (pct <= 100) dec.battery = pct;
    return [];
  }

  // mode 7 (hardware info) carries nothing we act on.
  return [];
}

/* ================================================================== */
/*  Driver implementation                                              */
/* ================================================================== */

export const ganV3Driver: CubeDriver = {
  brand: 'gan-v3' satisfies CubeBrand,
  service: GAN_V3_SERVICE,
  // `Gi` for the GiC- / GiS- 356i firmwares; the 356 itself advertises as GAN…
  namePrefixes: ['GAN', 'Gi'],
  optionalServices: [BATTERY_SERVICE],
  needsMac: true,
  macAdv: GAN_MAC_ADV,
  // No gyro: the v3 event set (modes 1/2/6/7/16) has no orientation message
  // at all — neither cstimer's `parseV3Data` nor afedotov's gen3 parser has
  // one. GAN's gen3 firmware simply doesn't ship the sensor feed.

  matches(device: BluetoothDevice): boolean {
    const n = device.name ?? '';
    // GAN 356 i / i3 / i Play / 357 — the v3 family. cstimer in fact accepts
    // any 'GAN' / 'MG' / 'AiCube' prefix and discriminates on the service
    // UUID at runtime, but our registry routes by `matches()` so we narrow
    // here to the 356-class names. v4 (GAN 12 / 13 / 14 / Mini / MG / AiCube)
    // is matched by gan_v4 and explicitly excludes 356 via lookahead.
    return /^(GAN-?(356|357|i)|Gi[CSBM3]?-)/i.test(n);
  },

  async start(server, onMove, ctx): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(GAN_V3_SERVICE);
    const notifyChar = await service.getCharacteristic(GAN_V3_NOTIFY_CHAR);

    const mac = ctx?.mac
      ? macStringToBytes(ctx.mac)
      : (tryParseMacFromName(server.device.name) ?? new Uint8Array(6));
    const aesKey = deriveKeyFromMac(GAN_V3_KEY_BASE, mac);
    const aesIv = deriveKeyFromMac(GAN_V3_IV_BASE, mac);
    const expandedKey = expandKey(aesKey);

    // Bound late: the command characteristic is resolved after we subscribe,
    // and the decoder only reaches for this from a notification.
    let sendCmd: (req: Uint8Array) => Promise<void> = async () => {};

    const requestFaceletsFrame = (): Uint8Array => {
      const req = new Uint8Array(16);
      req[0] = 0x68; req[1] = 0x01;
      return req;
    };

    const decState: MoveDecodeState = {
      sync: new GanMoveSync({
        // cstimer's requestMoveHistory, v3 opcode: 0x68 / 0x03.
        requestHistory: (startMoveCnt, numberOfMoves) => {
          const req = new Uint8Array(16);
          req[0] = 0x68; req[1] = 0x03;
          req[2] = startMoveCnt & 0xff;
          req[4] = numberOfMoves & 0xff;
          void sendCmd(req);
        },
        // Same deliberate divergence as v4: re-seed from the cube instead of
        // dropping the connection.
        onWedged: () => {
          decState.sync.reset();
          void sendCmd(requestFaceletsFrame());
        },
      }),
      battery: null,
      badFrames: 0,
      onState: (facelets) => ctx?.onState?.(facelets),
      prevMoveLocTime: null,
      now: () => Date.now(),
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
      for (const mv of moves) onMove(mv.mv, mv.ts);
      // Several bad-magic frames in a row ⇒ wrong MAC. Tell the hook once.
      if (!keyErrorFired && decState.badFrames >= 6) {
        keyErrorFired = true;
        ctx?.onKeyError?.();
      }
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

    sendCmd = async (req: Uint8Array): Promise<void> => {
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
      const facelets = requestFaceletsFrame();
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
