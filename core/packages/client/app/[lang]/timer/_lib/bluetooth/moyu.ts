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
 * No orientation decode: cstimer's `onGyroEvent` is a bare
 * `giikerutil.log('[moyucube] Received gyro event', value)` with no parser,
 * and there is no public write-up of this characteristic's layout (unlike
 * MoYu's newer WCU_MY32 protocol, whose 0xAB packet is documented). So we
 * keep the no-op subscription and leave `hasGyro` unset rather than invent a
 * byte layout we could not falsify without hardware.
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
 *     byte 5         : UNSIGNED rotation delta in ~36° units (one quarter
 *                      turn ≈ +5 units; the cube counts rotation modulo 9
 *                      on `faceStatus[face]`, and emits a discrete move only
 *                      when the accumulator crosses the half-revolution
 *                      boundary at 5). cstimer reads it with `getUint8`, so a
 *                      byte ≥ 0x80 is a LARGE forward delta, not a backward
 *                      one; re-reading it as int8 desyncs `faceStatus`.
 *
 * Move emission rule (mirrors cstimer):
 *   prevRot = faceStatus[face]
 *   curRot  = (faceStatus[face] + dir + 9) % 9    (wrap, but raw curRot
 *                                                  before mod is the value
 *                                                  we test boundary on)
 *   if prevRot <= 4 and curRot >= 5  → CW   (no suffix)
 *   if prevRot >= 5 and curRot <= 4  → CCW  (`'`)
 *   else: no move (sub-quarter wiggle).
 * With an unsigned delta the raw curRot never decreases, so the CCW branch is
 * unreachable — kept because cstimer keeps it, not because it can fire.
 *
 * Half-turns surface as two consecutive same-direction quarter-turn frames.
 *
 * No battery readback path on this firmware (cstimer's `getBatteryLevel`
 * intentionally returns `Promise.resolve([100, name])` with the wrong type
 * — i.e. it doesn't actually report). We expose `null` so the UI shows "—".
 */

import {
  MOYU_GYRO_CHARACTERISTIC_UUID,
  MOYU_READ_CHARACTERISTIC_UUID,
  MOYU_SERVICE_UUID,
  MOYU_TURN_CHARACTERISTIC_UUID,
  MOYU_WRITE_CHARACTERISTIC_UUID,
  createMoyuDecodeState,
  matchesMoyuName,
  parseMoyuTurnFrame,
} from '@cuberoot/shared/smart-cube/moyu';
import type { CubeDriver, CubeDriverStartResult } from './driver';
import type { CubeBrand } from './types';

export const moyuDriver: CubeDriver = {
  brand: 'moyu' satisfies CubeBrand,
  service: MOYU_SERVICE_UUID,
  namePrefixes: ['MHC', 'MoYu', 'MY-'],
  optionalServices: [],

  matches(device: BluetoothDevice): boolean {
    const n = (device.name ?? '').trim();
    // cstimer's `prefix: 'MHC'`. Some firmwares advertise MoYu prefix on
    // older units; keep the regex permissive but anchored.
    return matchesMoyuName(n);
  },

  async start(server, onMove): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(MOYU_SERVICE_UUID);

    // The four characteristics. Read/gyro are subscribed to but their
    // payloads are intentionally ignored — cstimer logs them but never
    // surfaces moves from them. Turn is the move stream.
    const turnChar = await service.getCharacteristic(MOYU_TURN_CHARACTERISTIC_UUID);
    let readChar: BluetoothRemoteGATTCharacteristic | null = null;
    let gyroChar: BluetoothRemoteGATTCharacteristic | null = null;
    try {
      readChar = await service.getCharacteristic(MOYU_READ_CHARACTERISTIC_UUID);
    } catch {
      // older firmware may omit the read char; non-fatal.
    }
    try {
      gyroChar = await service.getCharacteristic(MOYU_GYRO_CHARACTERISTIC_UUID);
    } catch {
      // gyro is optional; non-fatal.
    }
    // Touch the write char so future host->cube commands are possible if
    // we ever need them; failure is non-fatal.
    try {
      await service.getCharacteristic(MOYU_WRITE_CHARACTERISTIC_UUID);
    } catch {
      // ignore
    }

    const faceStatus = createMoyuDecodeState();

    const onTurn = (ev: Event): void => {
      const target = ev.target as BluetoothRemoteGATTCharacteristic;
      const dv = target.value;
      if (!dv) return;
      try {
        const moves = parseMoyuTurnFrame(dv, faceStatus);
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
