/**
 * MoYu32 smart-cube driver — the protocol every currently-sold MoYu smart
 * cube speaks (WeiLong V10 Ai onward). BLE device names look like
 * `WCU_MY32_XXYY`.
 *
 * Not to be confused with `moyu.ts`, which handles the OLDER, unencrypted
 * MHC protocol (MoYu AI Cube). The two share nothing but the vendor.
 *
 * Protocol reference: cstimer's `src/js/hardware/moyu32cube.js`, cross-checked
 * against lukeburong/weilong-v10-ai-protocol (the only public write-up of the
 * gyro packet, which cstimer leaves commented out).
 *
 * Wire summary
 * ------------
 *   Service:  0783b03e-7735-b5a0-1760-a305d2795cb0
 *   Notify:   0783b03e-7735-b5a0-1760-a305d2795cb1   (cube -> host)
 *   Write:    0783b03e-7735-b5a0-1760-a305d2795cb2   (host -> cube)
 *
 * Encryption is byte-for-byte the GAN Gen2/Gen3 scheme (cstimer's own comment:
 * "Uses the same encryption scheme as GAN Gen2/3"): AES-128 in the two-pass
 * rolling-window mode of `gan_crypto.ts`, with the per-cube key/IV derived by
 * adding the REVERSED MAC into the first six bytes of a base key/IV modulo
 * 255. Only the base bytes differ from GAN's — see `MOYU32_KEY_BASE` below.
 *
 * Frames are 20 bytes. `byte0` is the message type:
 *
 *   0xA1 info      model name (bits 8..71), sw/hw versions. Ignored beyond
 *                  the handshake.
 *   0xA3 state     48 facelets at 3 bits each (bits 8..152, face order
 *                  FBUDLR, colour alphabet FBUDLR), then an 8-bit move
 *                  counter at bits 152..160. Consumed ONLY while
 *                  `prevMoveCnt === -1`, matching cstimer's
 *                  `if (prevMoveCnt == -1)` guard. Both the counter AND the
 *                  facelets are consumed: the facelets are the only reading of
 *                  where the cube actually is, and assuming solved instead is
 *                  wrong for any cube that was turned before it connected.
 *   0xA4 battery   percentage at bits 8..16.
 *   0xA5 move      see `decodeMoyu32Frame`.
 *   0xAB gyro      orientation quaternion, see below.
 *   0xAC gyro ack  reply to the enable/disable command: bits 8..16 "gyro
 *                  functional", bits 16..24 "gyro enabled".
 *
 * Move event (0xA5) layout:
 *   bits   8..88   five u16 inter-move time offsets in ms, `timeOffs[i]` at
 *                  bits `8 + i*16 .. 24 + i*16`, where index 0 is the NEWEST
 *                  move and each value is the gap BEFORE that move. Unlike
 *                  every other brand this is a DELTA, not a clock reading, so
 *                  `Moyu32DecodeState.deviceTime` accumulates them exactly as
 *                  cstimer's `updateMoveTimes` does (moyu32cube.js:317) and
 *                  each emitted move carries the running total.
 *   bits  88..96   u8 move counter.
 *   bits  96..121  five 5-bit move codes from bit 96. `m` decodes as
 *                  `"FBUDLR"[m >> 1] + " '"[m & 1]`; any `m >= 12` means the
 *                  frame decrypted to garbage, i.e. the MAC/key is wrong.
 *   `prevMoves[0]` is the NEWEST move. We emit
 *   `moveDiff = (moveCnt - prevMoveCnt) & 0xff` moves (clamped to 5),
 *   oldest-of-new first.
 *
 * Gyro event (0xAB) layout — four SIGNED LITTLE-ENDIAN int32 at bytes 1..17,
 * in the order `(w, x, -z, y)`, each divided by 2^30. Note the third slot is
 * NEGATED z, and the y/z slots are swapped relative to the obvious order.
 * cstimer has this branch commented out entirely (`// } else if (msgType ==
 * 171) { // gyro`), so the layout comes from lukeburong's write-up.
 * UNVERIFIED against hardware — we own no smart cube.
 *
 * MAC: advertisement manufacturer data (CIC 0x0100..0xFF00, last six payload
 * bytes reversed) → the vendor default `CF:30:16:00:XX:YY` implied by a
 * `WCU_MY32_XXYY` device name → the hook's manual-prompt chain.
 */

import {
  decryptFrame,
  deriveKeyFromMac,
  encryptFrame,
  expandKey,
  toBitReader,
  type GyroSink,
} from './gan_crypto';
import type {
  CubeDriver, CubeDriverContext, CubeDriverStartResult, TimedMove,
} from './driver';
import { fromFaceletString } from '../cube/state';
import { MOYU32_MAC_ADV, macStringToBytes, normalizeMac } from './mac';
import type { CubeBrand } from './types';

const MOYU32_SERVICE = '0783b03e-7735-b5a0-1760-a305d2795cb0';
const MOYU32_NOTIFY_CHAR = '0783b03e-7735-b5a0-1760-a305d2795cb1';
const MOYU32_COMMAND_CHAR = '0783b03e-7735-b5a0-1760-a305d2795cb2';

/**
 * MoYu32 base key / IV. cstimer ships them LZString-compressed as `KEYS[0]` /
 * `KEYS[1]` in `moyu32cube.js`; decompressed via `lib/lzstring.js` they are
 * exactly these bytes, and they match the "Root key" / "Root IV" hex in
 * lukeburong's protocol write-up (0x15773A5C670E2D1F17672A139B675257 /
 * 0x11232625862A2C3B55067F317E672157).
 */
export const MOYU32_KEY_BASE = new Uint8Array([
  0x15, 0x77, 0x3a, 0x5c, 0x67, 0x0e, 0x2d, 0x1f,
  0x17, 0x67, 0x2a, 0x13, 0x9b, 0x67, 0x52, 0x57,
]);
export const MOYU32_IV_BASE = new Uint8Array([
  0x11, 0x23, 0x26, 0x25, 0x86, 0x2a, 0x2c, 0x3b,
  0x55, 0x06, 0x7f, 0x31, 0x7e, 0x67, 0x21, 0x57,
]);

/** Message types. */
const MSG_INFO = 0xa1;
const MSG_STATE = 0xa3;
const MSG_BATTERY = 0xa4;
const MSG_MOVE = 0xa5;
const MSG_GYRO = 0xab;
const MSG_GYRO_SWITCH = 0xac;

/**
 * Every message type a correctly-keyed cube emits. A wrong key randomises
 * byte 0, which lands here only ~2.3% of the time — so sustained misses mean
 * a bad MAC.
 */
const KNOWN_MSG_TYPES = new Set([MSG_INFO, MSG_STATE, MSG_BATTERY, MSG_MOVE, MSG_GYRO, MSG_GYRO_SWITCH]);

/**
 * Move-code face alphabet. NOT the URFDLB order the GAN drivers use — MoYu
 * numbers its faces F,B,U,D,L,R and the low bit is the direction
 * (0 = CW, 1 = CCW). Quarter turns only; a 180° turn arrives as two frames.
 */
const MOYU32_FACE_ORDER = 'FBUDLR';

/** Sliding move window length. cstimer reads five slots per 0xA5 frame. */
const MOVE_WINDOW = 5;

/** Consecutive garbage frames before we declare the MAC wrong. */
const KEY_ERROR_THRESHOLD = 6;

/** 2^30 — the fixed-point divisor for the gyro quaternion components. */
const GYRO_SCALE = 1073741824;

export interface Moyu32DecodeState {
  /**
   * Last seen 8-bit move counter. -1 means "not seeded yet", in which case
   * move events are ignored until a 0xA3 state snapshot seeds it — cstimer's
   * `prevMoveCnt == -1` guard, which exists so a cube that was turned while
   * disconnected doesn't dump a burst of stale moves at connect.
   */
  prevMoveCnt: number;
  /** Most recent battery percentage from a 0xA4 event (0..100). */
  battery: number | null;
  /** Consecutive garbage frames (unknown type / out-of-range move code). */
  badFrames: number;
  /**
   * Running device clock in ms, accumulated from the 0xA5 inter-move offsets.
   *
   * MoYu is the only brand here that sends DELTAS rather than a counter
   * reading, so the absolute value only means anything relative to itself —
   * which is exactly what `move_clock.ts` needs. It starts at 0 for a freshly
   * seeded cube, so the first move's timestamp is "the gap since the snapshot",
   * and every later one is a real interval away from it.
   */
  deviceTime: number;
  /**
   * Called with the cube's self-reported 54-character facelet state, once, from
   * the 0xA3 snapshot that seeds the counter. See `CubeDriverContext.onState`.
   */
  onState?: (facelets: string) => void;
}

/**
 * Decode the 0xA3 facelet payload (bits 8..152) into a 54-character facelet
 * string in `URFDLB` order.
 *
 * MoYu stores 48 stickers — the six centres are omitted, being fixed — at
 * three bits each, with faces in `FBUDLR` order and the colour alphabet also
 * `FBUDLR`. csTimer's `parseFacelet` (`moyu32cube.js`) walks the faces in the
 * order `[2,5,0,3,4,1]` to emit `URFDLB`, and splices each face's centre back
 * in after the fourth sticker. This is that, verbatim.
 *
 * Returns null when the payload isn't nine of each colour, which is what a
 * wrong AES key decodes to.
 */
function decodeMoyu32Facelets(bit: (from: number, to: number) => number): string | null {
  /** Read faces in this order so the output comes out URFDLB. */
  const FACE_READ_ORDER = [2, 5, 0, 3, 4, 1];
  let out = '';
  for (const face of FACE_READ_ORDER) {
    const base = 8 + face * 24;
    for (let j = 0; j < 8; j++) {
      const colour = bit(base + j * 3, base + j * 3 + 3);
      if (colour > 5) return null;
      out += MOYU32_FACE_ORDER.charAt(colour);
      // The centre is not on the wire: it is this face, by definition.
      if (j === 3) out += MOYU32_FACE_ORDER.charAt(face);
    }
  }
  return fromFaceletString(out) ? out : null;
}

/** Fresh decode state. */
export function createMoyu32State(onState?: (facelets: string) => void): Moyu32DecodeState {
  return { prevMoveCnt: -1, battery: null, badFrames: 0, deviceTime: 0, onState };
}

/**
 * Decode one PLAINTEXT 20-byte frame. Returns the moves to emit, oldest
 * first; orientation samples go to `onGyro` (never buffered — the consumer
 * only ever wants the newest pose).
 *
 * Exported for `tests/bluetooth_gyro.test.ts`, which drives it with synthetic
 * frames since we have no cube to record real ones from.
 */
export function decodeMoyu32Frame(
  frame: Uint8Array,
  dec: Moyu32DecodeState,
  onGyro?: GyroSink,
): TimedMove[] {
  // Anything shorter than a full frame can't carry a move window; bail before
  // the bit reader can walk off the end.
  if (frame.length < 20) return [];
  const msgType = frame[0];

  if (!KNOWN_MSG_TYPES.has(msgType)) {
    // DEVIATION from cstimer: it only ever flags a wrong key from an
    // out-of-range MOVE code, because it force-prompts for the MAC at connect
    // anyway (`initMac(true)`). We don't force a prompt, so we also treat an
    // unrecognised message type as evidence — which lets the wrong-MAC
    // self-heal fire off the handshake replies instead of making the user
    // turn the cube first.
    dec.badFrames++;
    return [];
  }

  const bit = toBitReader(frame);

  if (msgType === MSG_STATE) {
    dec.badFrames = 0;
    // Facelet snapshot — where the cube actually is. cstimer consumes it only
    // while the counter is unseeded (`moyu32cube.js` msgType 163) and primes
    // its cube model from it; so do we. Without this a cube that was already
    // scrambled when it connected is taken to be solved, and every scramble
    // check and auto-stop after that is wrong.
    if (dec.prevMoveCnt === -1) {
      dec.prevMoveCnt = bit(152, 160);
      const facelets = decodeMoyu32Facelets(bit);
      if (facelets) dec.onState?.(facelets);
    }
    return [];
  }

  if (msgType === MSG_BATTERY) {
    dec.badFrames = 0;
    const pct = bit(8, 16);
    if (pct <= 100) dec.battery = pct;
    return [];
  }

  if (msgType === MSG_MOVE) {
    const moveCnt = bit(88, 96);
    // Duplicate frame, or no 0xA3 snapshot seen yet.
    if (moveCnt === dec.prevMoveCnt || dec.prevMoveCnt === -1) return [];

    const moveWindow: string[] = [];
    // timeOffs[i] is the gap BEFORE window slot i, in ms. Slot 0 is the newest
    // move, so accumulating from the oldest emitted slot downwards reproduces
    // the cube's own clock (cstimer's `updateMoveTimes`, moyu32cube.js:317).
    const timeOffs: number[] = [];
    let garbage = false;
    for (let i = 0; i < MOVE_WINDOW; i++) {
      const m = bit(96 + i * 5, 101 + i * 5);
      if (m >= 12) { garbage = true; break; }
      moveWindow[i] = MOYU32_FACE_ORDER[m >> 1] + ((m & 1) ? "'" : '');
      timeOffs[i] = bit(8 + i * 16, 24 + i * 16);
    }
    if (garbage) {
      // Wrong key: the 5-bit codes are nonsense. cstimer counts this into its
      // `keyCheck` and re-prompts; so do we, via ctx.onKeyError. Note we do
      // NOT advance prevMoveCnt here — same as cstimer, which only calls
      // updateMoveTimes() when the frame was clean.
      dec.badFrames++;
      return [];
    }
    dec.badFrames = 0;

    let moveDiff = (moveCnt - dec.prevMoveCnt) & 0xff;
    if (moveDiff > MOVE_WINDOW) moveDiff = MOVE_WINDOW;
    dec.prevMoveCnt = moveCnt;
    // moveWindow[0] is the NEWEST move, so walk down to emit oldest-first.
    const out: TimedMove[] = [];
    for (let i = moveDiff - 1; i >= 0; i--) {
      dec.deviceTime += timeOffs[i];
      out.push({ mv: moveWindow[i], ts: dec.deviceTime });
    }
    return out;
  }

  if (msgType === MSG_GYRO) {
    dec.badFrames = 0;
    onGyro?.(decodeMoyu32Quaternion(frame));
    return [];
  }

  // 0xA1 (info) and 0xAC (gyro ack) carry nothing we act on beyond proving
  // the key is right.
  dec.badFrames = 0;
  return [];
}

/**
 * Decode the 0xAB orientation payload: four signed little-endian int32 at
 * bytes 1..17 in the order `(w, x, -z, y)`, each over 2^30.
 *
 * `DataView.getInt32(off, true)` gives the signed little-endian read directly.
 * lukeburong notes the official app instead does `>> 24` on a signed int and
 * sign-extends by accident, which can shift one byte by 1; we implement the
 * intended maths, not that bug.
 */
export function decodeMoyu32Quaternion(frame: Uint8Array): {
  w: number; x: number; y: number; z: number;
} {
  // Identity rather than zeros for a truncated frame: {0,0,0,0} is not a
  // rotation at all and would blow up any normalisation downstream.
  if (frame.byteLength < 17) return { w: 1, x: 0, y: 0, z: 0 };
  const dv = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const w = dv.getInt32(1, true) / GYRO_SCALE;
  const x = dv.getInt32(5, true) / GYRO_SCALE;
  const negZ = dv.getInt32(9, true) / GYRO_SCALE;
  const y = dv.getInt32(13, true) / GYRO_SCALE;
  return { w, x, y, z: -negZ };
}

/**
 * Vendor default MAC for a `WCU_MY32_XXYY` device name. cstimer's `initMac`
 * builds exactly this string as the prompt's pre-filled default. It is a
 * documented constant prefix for the model, not an OUI guess — a name that
 * doesn't match the pattern returns null and falls through to the prompt.
 */
export function moyu32DefaultMac(name: string | null | undefined): string | null {
  const n = (name ?? '').trim();
  if (!/^WCU_MY32_[0-9A-F]{4}$/i.test(n)) return null;
  return normalizeMac(`CF:30:16:00:${n.slice(9, 11)}:${n.slice(11, 13)}`);
}

/** Build a 20-byte command frame: `[0] = opcode`, rest zero. */
function commandFrame(opcode: number, ...rest: number[]): Uint8Array {
  const req = new Uint8Array(20);
  req[0] = opcode & 0xff;
  for (let i = 0; i < rest.length; i++) req[i + 1] = rest[i] & 0xff;
  return req;
}

export const moyu32Driver: CubeDriver = {
  brand: 'moyu32' satisfies CubeBrand,
  service: MOYU32_SERVICE,
  optionalServices: [],
  needsMac: true,
  macAdv: MOYU32_MAC_ADV,
  hasGyro: true,

  matches(device: BluetoothDevice): boolean {
    // cstimer registers this model under the prefix 'WCU_MY3'.
    return /^WCU_MY3/i.test((device.name ?? '').trim());
  },

  defaultMac(device: BluetoothDevice): string | null {
    return moyu32DefaultMac(device.name);
  },

  async start(server, onMove, ctx?: CubeDriverContext): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(MOYU32_SERVICE);
    const notifyChar = await service.getCharacteristic(MOYU32_NOTIFY_CHAR);

    const macBytes = macStringToBytes(ctx?.mac ?? null);
    const aesKey = deriveKeyFromMac(MOYU32_KEY_BASE, macBytes);
    const aesIv = deriveKeyFromMac(MOYU32_IV_BASE, macBytes);
    const expandedKey = expandKey(aesKey);

    const decState = createMoyu32State(ctx?.onState);
    const onGyro = ctx?.onGyro;
    let keyErrorFired = false;
    let batteryWaiters: Array<(v: number | null) => void> = [];

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
      const before = decState.battery;
      const moves = decodeMoyu32Frame(pt, decState, onGyro);
      for (const mv of moves) onMove(mv.mv, mv.ts);
      if (decState.battery !== null && decState.battery !== before && batteryWaiters.length) {
        const waiters = batteryWaiters;
        batteryWaiters = [];
        for (const w of waiters) w(decState.battery);
      }
      if (!keyErrorFired && decState.badFrames >= KEY_ERROR_THRESHOLD) {
        keyErrorFired = true;
        ctx?.onKeyError?.();
      }
    };

    notifyChar.addEventListener('characteristicvaluechanged', onChar);
    await notifyChar.startNotifications();

    let cmdChar: BluetoothRemoteGATTCharacteristic | null = null;
    try {
      cmdChar = await service.getCharacteristic(MOYU32_COMMAND_CHAR);
    } catch {
      // No write characteristic — we can still listen, but the cube will
      // never send the 0xA3 snapshot that seeds the move counter, so moves
      // stay suppressed. Non-fatal; surfaces as "connected but silent".
    }

    const sendCmd = async (req: Uint8Array): Promise<void> => {
      if (!cmdChar) return;
      const enc = encryptFrame(req, expandedKey, aesIv);
      // Detach into a fresh ArrayBuffer-backed Uint8Array — the strict TS lib
      // types narrow `BufferSource` to `Uint8Array<ArrayBuffer>`.
      const buf = new Uint8Array(enc.length);
      buf.set(enc);
      try {
        if (cmdChar.writeValueWithResponse) {
          await cmdChar.writeValueWithResponse(buf);
        } else {
          await cmdChar.writeValue(buf);
        }
      } catch {
        // Ignore — write rejected; the cube may still stream regardless.
      }
    };

    /**
     * 0xAC with byte 2 = 1/0. Per lukeburong the cube streams 0xAB by default,
     * so we only ever send ENABLE (when a consumer asked for orientation) and
     * DISABLE on teardown or explicit request — we never disable a cube whose
     * orientation nobody asked about, to stay closest to cstimer's behaviour
     * of not touching this register at all.
     */
    const setGyro = async (enabled: boolean): Promise<void> => {
      await sendCmd(commandFrame(MSG_GYRO_SWITCH, 0x00, enabled ? 0x01 : 0x00));
    };

    if (cmdChar) {
      // cstimer's init order: info, then state (seeds the move counter), then
      // battery. Sequenced, each awaited.
      await sendCmd(commandFrame(MSG_INFO));
      await sendCmd(commandFrame(MSG_STATE));
      await sendCmd(commandFrame(MSG_BATTERY));
      if (onGyro) await setGyro(true);
    }

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      // Stop the orientation firehose on the way out, but only if we were the
      // ones who turned it on.
      if (onGyro && cmdChar) void setGyro(false).catch(() => {});
      notifyChar.removeEventListener('characteristicvaluechanged', onChar);
      void notifyChar.stopNotifications().catch(() => {});
      const waiters = batteryWaiters;
      batteryWaiters = [];
      for (const w of waiters) w(decState.battery);
    };

    /**
     * No standard 0x180F battery service on this firmware — the level only
     * ever arrives as a 0xA4 event. DEVIATION from cstimer's
     * `getBatteryLevel`, which fires the request and immediately returns the
     * previous (often still-unset) value: our hook reads battery exactly once
     * at connect, so returning null there would leave the UI showing "—"
     * forever. We wait up to 1s for the reply instead, the same shape
     * `gocube.ts` already uses.
     */
    const battery = async (): Promise<number | null> => {
      if (!cmdChar) return decState.battery;
      await sendCmd(commandFrame(MSG_BATTERY));
      return new Promise<number | null>((resolve) => {
        let done = false;
        const finish = (v: number | null): void => {
          if (done) return;
          done = true;
          resolve(v);
        };
        batteryWaiters.push(finish);
        setTimeout(() => finish(decState.battery), 1000);
      });
    };

    return { battery, cleanup, setGyro };
  },
};
