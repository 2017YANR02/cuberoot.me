/**
 * MoYu AI smart cube driver — covers the MoYu AI ("MHC..." device-name
 * series). The companion WCU/MY32-prefixed firmware on MoYu's "AI 32" cube
 * uses a different, encrypted protocol (see cstimer's `moyu32cube.js`) and
 * is intentionally NOT handled here; we only ship the unencrypted MHC
 * protocol because it's the one most field cubes ("MoYu AI Cube") expose.
 *
 * Protocol reference: cstimer's `src/js/hardware/moyucube.js`. This file is
 * a faithful TypeScript port of that battle-tested implementation.
 *
 * Wire summary
 * ------------
 *   Service:        00001000-0000-1000-8000-00805f9b34fb
 *   Char (write):   00001001-0000-1000-8000-00805f9b34fb     (unused here)
 *   Char (read):    00001002-0000-1000-8000-00805f9b34fb     (notify, status)
 *   Char (turn):    00001003-0000-1000-8000-00805f9b34fb     (notify, moves)
 *   Char (gyro):    00001004-0000-1000-8000-00805f9b34fb     (notify, ignored)
 *
 * Frames are unencrypted. The turn characteristic delivers a single packet
 * per notification:
 *
 *   byte 0           : n_moves (number of move records that follow)
 *   then per move (6 bytes):
 *     byte 0,1       : low 16 bits of a 32-bit timestamp (host-endian-quirk;
 *                      see cstimer mix-up — we don't use ts here)
 *     byte 2,3       : high 16 bits of timestamp
 *     byte 4         : face index 0..5 in the cube's native (FRBLUD-ish)
 *                      ordering; remap with [3,4,5,1,2,0] to URFDLB.
 *     byte 5         : signed-ish rotation delta in ~36° units (one quarter
 *                      turn ≈ +5 units; the cube counts rotation modulo 9
 *                      on `faceStatus[face]`, and emits a discrete move only
 *                      when the accumulator crosses the half-revolution
 *                      boundary at 5).
 *
 * Move emission rule (mirrors cstimer):
 *   prevRot = faceStatus[face]
 *   curRot  = (faceStatus[face] + dir + 9) % 9    (wrap, but raw curRot
 *                                                  before mod is the value
 *                                                  we test boundary on)
 *   if prevRot <= 4 and curRot >= 5  → CW   (no suffix)
 *   if prevRot >= 5 and curRot <= 4  → CCW  (`'`)
 *   else: no move (sub-quarter wiggle).
 *
 * Half-turns surface as two consecutive same-direction quarter-turn frames.
 *
 * No battery readback path on this firmware (cstimer's `getBatteryLevel`
 * intentionally returns `Promise.resolve([100, name])` with the wrong type
 * — i.e. it doesn't actually report). We expose `null` so the UI shows "—".
 */

import type { CubeDriver, CubeDriverStartResult } from './driver';
import type { CubeBrand } from './types';

const UUID_SUFFIX = '-0000-1000-8000-00805f9b34fb';
const MOYU_SERVICE = '00001000' + UUID_SUFFIX;
const MOYU_CHAR_WRITE = '00001001' + UUID_SUFFIX;
const MOYU_CHAR_READ = '00001002' + UUID_SUFFIX;
const MOYU_CHAR_TURN = '00001003' + UUID_SUFFIX;
const MOYU_CHAR_GYRO = '00001004' + UUID_SUFFIX;

/** native face index → URFDLB axis index (cstimer: `[3,4,5,1,2,0][face]`). */
const MOYU_AXIS_LUT: ReadonlyArray<number> = [3, 4, 5, 1, 2, 0];
const URFDLB = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

/**
 * Parse one turn-characteristic notification. `dv` is the raw notification
 * value; `faceStatus` is mutated in place to track per-face accumulated
 * rotation between frames. Returns the moves to emit, oldest first.
 */
function parseTurn(dv: DataView, faceStatus: Int8Array): string[] {
  const out: string[] = [];
  if (dv.byteLength < 1) return out;
  const nMoves = dv.getUint8(0);
  if (dv.byteLength < 1 + nMoves * 6) return out;
  for (let i = 0; i < nMoves; i++) {
    const offset = 1 + i * 6;
    const face = dv.getUint8(offset + 4);
    if (face > 5) continue;
    // Cstimer rounds dir to nearest /36. Sometimes the cube reports a small
    // decay tick (|dir| < 18 → rounds to 0) which we ignore.
    const dirRaw = dv.getUint8(offset + 5);
    // Treat as signed 8-bit so backward rotations land negative.
    const dirSigned = dirRaw > 127 ? dirRaw - 256 : dirRaw;
    const dir = Math.round(dirSigned / 36);
    if (dir === 0) continue;

    const prevRot = faceStatus[face];
    const curRotRaw = prevRot + dir;
    // cstimer compares against the UN-wrapped raw value so that a quarter-tick
    // wrap across 9->0 (or 0->-1->8) doesn't synthesise a phantom inverse move.
    // We then store the wrapped value for the next frame.
    faceStatus[face] = ((curRotRaw % 9) + 9) % 9;

    let pow: 0 | 2 | -1 = -1;
    if (prevRot >= 5 && curRotRaw <= 4) pow = 2;       // CCW
    else if (prevRot <= 4 && curRotRaw >= 5) pow = 0;  // CW
    if (pow === -1) continue;

    const axis = MOYU_AXIS_LUT[face];
    if (axis === undefined) continue;
    const f = URFDLB[axis];
    out.push(pow === 0 ? f : `${f}'`);
  }
  return out;
}

export const moyuDriver: CubeDriver = {
  brand: 'moyu' satisfies CubeBrand,
  service: MOYU_SERVICE,
  optionalServices: [],

  matches(device: BluetoothDevice): boolean {
    const n = (device.name ?? '').trim();
    // cstimer's `prefix: 'MHC'`. Some firmwares advertise MoYu prefix on
    // older units; keep the regex permissive but anchored.
    return /^(MHC|MoYu|MY-)/i.test(n);
  },

  async start(server, onMove): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(MOYU_SERVICE);

    // The four characteristics. Read/gyro are subscribed to but their
    // payloads are intentionally ignored — cstimer logs them but never
    // surfaces moves from them. Turn is the move stream.
    const turnChar = await service.getCharacteristic(MOYU_CHAR_TURN);
    let readChar: BluetoothRemoteGATTCharacteristic | null = null;
    let gyroChar: BluetoothRemoteGATTCharacteristic | null = null;
    try {
      readChar = await service.getCharacteristic(MOYU_CHAR_READ);
    } catch {
      // older firmware may omit the read char; non-fatal.
    }
    try {
      gyroChar = await service.getCharacteristic(MOYU_CHAR_GYRO);
    } catch {
      // gyro is optional; non-fatal.
    }
    // Touch the write char so future host->cube commands are possible if
    // we ever need them; failure is non-fatal.
    try {
      await service.getCharacteristic(MOYU_CHAR_WRITE);
    } catch {
      // ignore
    }

    const faceStatus = new Int8Array(6);

    const onTurn = (ev: Event): void => {
      const target = ev.target as BluetoothRemoteGATTCharacteristic;
      const dv = target.value;
      if (!dv) return;
      try {
        const moves = parseTurn(dv, faceStatus);
        for (const mv of moves) onMove(mv);
      } catch {
        // Defensive — never let a malformed frame crash the host.
      }
    };

    // No-op listeners on read/gyro keep notifications flowing; cstimer
    // subscribes for parity with the real firmware's expectations.
    const onIgnored = (): void => { /* no-op */ };

    turnChar.addEventListener('characteristicvaluechanged', onTurn);
    await turnChar.startNotifications();
    if (readChar) {
      readChar.addEventListener('characteristicvaluechanged', onIgnored);
      try { await readChar.startNotifications(); } catch { /* ignore */ }
    }
    if (gyroChar) {
      gyroChar.addEventListener('characteristicvaluechanged', onIgnored);
      try { await gyroChar.startNotifications(); } catch { /* ignore */ }
    }

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      turnChar.removeEventListener('characteristicvaluechanged', onTurn);
      void turnChar.stopNotifications().catch(() => {});
      if (readChar) {
        readChar.removeEventListener('characteristicvaluechanged', onIgnored);
        void readChar.stopNotifications().catch(() => {});
      }
      if (gyroChar) {
        gyroChar.removeEventListener('characteristicvaluechanged', onIgnored);
        void gyroChar.stopNotifications().catch(() => {});
      }
    };

    // No battery characteristic on this firmware (cstimer stub returns a
    // placeholder). Surface null so the UI shows "—".
    const battery = async (): Promise<number | null> => null;

    return { battery, cleanup };
  },
};
