import { startLegacyWebCube } from './legacy_session';
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
  MOYU_SERVICE_UUID,
  matchesMoyuName,
} from '@cuberoot/shared/smart-cube/moyu';
import type { CubeDriver } from './driver';
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

  start(server, onMove, context) {
    return startLegacyWebCube('moyu', server, onMove, context);
  },
};
