/**
 * GoCube / Rubik's Connected driver.
 *
 * Aligned with cstimer's `src/js/hardware/gocube.js` — full decode of the
 * unencrypted Nordic UART protocol both GoCube and Rubik's Connected expose.
 *
 * Wire summary
 * ------------
 *   Service:    6e400001-b5a3-f393-e0a9-e50e24dcca9e   (Nordic UART)
 *   Write:      6e400002-b5a3-f393-e0a9-e50e24dcca9e   (host -> cube)
 *   Read:       6e400003-b5a3-f393-e0a9-e50e24dcca9e   (notify, cube -> host)
 *
 * Frames (notify-side):
 *
 *     [0x2a] [len_or_seq] [opcode] payload... [crc] [0x0d] [0x0a]
 *
 * Total notification length is `byteLength`; payload length is therefore
 * `byteLength - 6` (header 3 + 1-byte crc + 2-byte trailer). cstimer ignores
 * `byte[1]` and `crc` — so do we, since the firmware does not punish us.
 *
 * Opcodes:
 *   0x01 — move(s). Each move is a 2-byte record; only byte 0 carries
 *          axis/direction, byte 1 is a tick we ignore.
 *          axis index is `(b >> 1)` in the cube's native order
 *          (B U F D R L), remapped to URFDLB via `axisPerm`.
 *          direction bit (b & 1): 0 = CW, 1 = CCW.
 *   0x02 — full state dump: 6 faces x 9 bytes, centre first then the 8-sticker
 *          ring. Reported through `ctx.onState`; see `parseGoCubeFacelets`.
 *          The cube sends one whenever we write CMD_STATE, which is at connect
 *          and every 20 moves, so it doubles as a periodic resync.
 *   0x03 — orientation quaternion. UNLIKE every other brand here this is
 *          PLAINTEXT ASCII, not packed binary: the payload is the four
 *          components as base-10 signed decimal strings joined by '#'
 *          ("x#y#z#w"), each over 16384 (2^14). See `parseGoCubeQuaternion`.
 *   0x05 — battery level: payload[0] is percent.
 *   0x07 — offline solves stats (ignored).
 *   0x08 — cube type / firmware (ignored).
 *
 * Host -> cube commands (single byte, written to the write characteristic):
 *   0x32 (50) — request battery; cube replies with a 0x05 frame.
 *   0x33 (51) — request full state dump; cube replies with a 0x02 frame and
 *               also re-arms the move stream. cstimer re-issues this every
 *               20 moves to keep the cube streaming, so we mirror that.
 *
 * Battery:
 *   GoCube does not expose the standard 0x180F battery service. We send the
 *   0x32 command and wait briefly for the 0x05 reply, just like cstimer.
 */

import type { CubeDriver, CubeDriverStartResult, GyroQuaternion } from './driver';
import type { CubeBrand } from './types';
import { fromFaceletString } from '../cube/state';

const UUID_SUFFIX = '-b5a3-f393-e0a9-e50e24dcca9e';
const GOCUBE_SERVICE = '6e400001' + UUID_SUFFIX;
const GOCUBE_WRITE_CHAR = '6e400002' + UUID_SUFFIX;
const GOCUBE_NOTIFY_CHAR = '6e400003' + UUID_SUFFIX;

const CMD_BATTERY = 0x32; // 50
const CMD_STATE = 0x33; // 51

// cstimer's axisPerm: native axis index (b >> 1) -> URFDLB index.
// The cube emits axes in BUFDRL order; we want URFDLB.
const AXIS_PERM = [5, 2, 0, 3, 1, 4] as const;
const URFDLB = 'URFDLB';

/**
 * Ring order of the 8 non-centre stickers within a face, and each face's
 * starting offset into that ring — cstimer's `facePerm` / `faceOffset`
 * (`gocube.js:53-54`). The cube walks its own face clockwise from its own
 * corner; these two tables are what turn that walk into Kociemba indices.
 */
const FACE_PERM = [0, 1, 2, 5, 8, 7, 6, 3] as const;
const FACE_OFFSET = [0, 0, 6, 2, 0, 0] as const;

/** Colour alphabet of the state payload — NOT the same order as the axes. */
const GOCUBE_COLOURS = 'BFUDRL';

/**
 * Decode an opcode-0x02 state dump (6 faces x 9 bytes) into the 54-character
 * facelet string, per cstimer's `parseData` msgType 2 branch
 * (`gocube.js:94-108`).
 *
 * Per face `a`: byte 0 is the CENTRE, bytes 1..8 are the ring starting at
 * `FACE_OFFSET[a]`. Each byte is a colour index into `GOCUBE_COLOURS`.
 *
 * Returns null unless every byte is a real colour and the result has nine of
 * each — a partial notification must not be adopted as the cube's state.
 */
export function parseGoCubeFacelets(dv: DataView, payloadLen: number): string | null {
  if (payloadLen < 54) return null;
  const facelet = new Array<string>(54);
  for (let a = 0; a < 6; a++) {
    const axis = AXIS_PERM[a] * 9;
    const aoff = FACE_OFFSET[a];
    const centre = dv.getUint8(3 + a * 9);
    if (centre > 5) return null;
    facelet[axis + 4] = GOCUBE_COLOURS.charAt(centre);
    for (let i = 0; i < 8; i++) {
      const colour = dv.getUint8(3 + a * 9 + i + 1);
      if (colour > 5) return null;
      facelet[axis + FACE_PERM[(i + aoff) % 8]] = GOCUBE_COLOURS.charAt(colour);
    }
  }
  const out = facelet.join('');
  return out.length === 54 && fromFaceletString(out) ? out : null;
}

// Re-ack interval: every 20 moves cstimer issues another CMD_STATE so the
// firmware does not stop pushing notifications.
const REACK_EVERY = 20;

/** 2^14 — GoCube's fixed-point divisor for the quaternion components. */
const QUAT_SCALE = 16384;

/**
 * Decode an opcode-0x03 orientation payload.
 *
 * `dv` is the whole notification; `payloadLen` is `byteLength - 6`, so the
 * payload occupies bytes [3, 3 + payloadLen) — the same window as
 * `buffer.slice(3, byteLength - 3)`.
 *
 * The payload is ASCII, e.g. `-13528#4096#0#16384`, i.e. FOUR base-10 signed
 * integers separated by 0x23 ('#') in **x, y, z, w** order (note: NOT
 * scalar-first), each divided by 16384 to land in [-1, 1].
 *
 * SOURCE NOTE: cstimer's `gocube.js` has this branch completely empty
 * (`} else if (msgType == 3) { // quaternion`), so the layout is NOT from
 * cstimer. It is from two independent public references that agree:
 *   - oddpetersson/gocube-protocol, which documents MsgOrientation (type
 *     0x03) as "x#y#z#w" with ASCII values,
 *   - cubing.js `src/cubing/bluetooth/smart-puzzle/gocube.ts`, which does
 *     `bufferToString(buffer.buffer.slice(3, byteLength - 3)).split("#")
 *      .map(s => parseInt(s, 10) / 16384)` and feeds the results to
 *     `new Quaternion(coords[0], coords[1], coords[2], coords[3])` — three.js
 *     `Quaternion(x, y, z, w)`.
 *
 * We deliberately do NOT reproduce cubing.js's follow-up `targetQuat.y =
 * -targetQuat.y`: that is a fix-up for THEIR world/camera convention, not part
 * of the wire format. Axis remapping belongs in `orientation.ts`'s per-brand
 * basis table, which is the single place that knows about our renderer.
 *
 * Returns null when the payload doesn't parse — a partial notification or a
 * firmware that words it differently must not surface as a NaN quaternion.
 */
export function parseGoCubeQuaternion(dv: DataView, payloadLen: number): GyroQuaternion | null {
  if (payloadLen < 7) return null; // shortest plausible "0#0#0#0"
  let text = '';
  for (let i = 0; i < payloadLen; i++) text += String.fromCharCode(dv.getUint8(3 + i));
  const parts = text.split('#');
  if (parts.length !== 4) return null;
  const nums = parts.map((s) => parseInt(s, 10));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [x, y, z, w] = nums;
  return { w: w / QUAT_SCALE, x: x / QUAT_SCALE, y: y / QUAT_SCALE, z: z / QUAT_SCALE };
}

export const gocubeDriver: CubeDriver = {
  brand: 'gocube' satisfies CubeBrand,
  service: GOCUBE_SERVICE,
  // Plaintext protocol: no AES, no MAC, so this is the one brand whose gyro
  // we can reason about end-to-end from the bytes alone.
  hasGyro: true,

  matches(device: BluetoothDevice): boolean {
    const n = device.name ?? '';
    return /^(GoCube|Rubiks?)/i.test(n);
  },

  async start(server, onMove, ctx): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(GOCUBE_SERVICE);
    const writeChar = await service.getCharacteristic(GOCUBE_WRITE_CHAR);
    const notifyChar = await service.getCharacteristic(GOCUBE_NOTIFY_CHAR);

    let lastBattery: number | null = null;
    let batteryWaiters: Array<(v: number | null) => void> = [];
    let movesSinceAck = 0;

    const writeCmd = (cmd: number): Promise<void> => {
      // The Web Bluetooth typings accept BufferSource — pass the underlying
      // ArrayBuffer to keep the call portable (some platforms reject the
      // Uint8Array view directly).
      const buf = new Uint8Array([cmd]).buffer;
      return writeChar.writeValue(buf);
    };

    const onChar = (ev: Event): void => {
      const target = ev.target as BluetoothRemoteGATTCharacteristic;
      const dv = target.value;
      if (!dv) return;
      const len = dv.byteLength;
      // Frame validation: head 0x2A, trailer 0x0D 0x0A. cstimer drops bad frames.
      if (len < 6) return;
      if (dv.getUint8(0) !== 0x2a) return;
      if (dv.getUint8(len - 2) !== 0x0d) return;
      if (dv.getUint8(len - 1) !== 0x0a) return;

      const opcode = dv.getUint8(2);
      const payloadLen = len - 6; // 3 header + 1 crc + 2 trailer

      if (opcode === 0x01) {
        // Move stream: 2 bytes per move, axis|dir in byte 0 of each pair.
        for (let i = 0; i + 1 < payloadLen; i += 2) {
          const b = dv.getUint8(3 + i);
          const axis = AXIS_PERM[(b >> 1) & 0x07];
          if (axis === undefined) continue;
          const ccw = (b & 1) === 1;
          onMove(ccw ? `${URFDLB.charAt(axis)}'` : URFDLB.charAt(axis));
          movesSinceAck++;
        }
        if (movesSinceAck > REACK_EVERY) {
          movesSinceAck = 0;
          void writeCmd(CMD_STATE).catch(() => {});
        }
      } else if (opcode === 0x02) {
        // Full state dump. The cube sends one on connect (we ask for it) and
        // one after every re-ack, so this is both the initial truth and a
        // periodic correction for anything the move stream lost.
        if (ctx?.onState) {
          const facelets = parseGoCubeFacelets(dv, payloadLen);
          if (facelets) ctx.onState(facelets);
        }
      } else if (opcode === 0x03) {
        // Orientation. GoCube pushes these ~15x/s once connected, so only
        // pay the ASCII parse when someone is listening.
        if (ctx?.onGyro) {
          const q = parseGoCubeQuaternion(dv, payloadLen);
          // No angular velocity in this protocol — the second arg stays
          // undefined rather than being faked from finite differences.
          if (q) ctx.onGyro(q);
        }
      } else if (opcode === 0x05 && payloadLen >= 1) {
        lastBattery = dv.getUint8(3);
        const waiters = batteryWaiters;
        batteryWaiters = [];
        for (const w of waiters) w(lastBattery);
      }
      // 0x02 (state), 0x07 (offline), 0x08 (cube type): ignored.
    };

    notifyChar.addEventListener('characteristicvaluechanged', onChar);
    await notifyChar.startNotifications();

    // Kick the cube: requesting a state dump arms the move stream, matching
    // cstimer's init().
    try { await writeCmd(CMD_STATE); } catch { /* ignore */ }

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      notifyChar.removeEventListener('characteristicvaluechanged', onChar);
      void notifyChar.stopNotifications().catch(() => {});
      // Resolve any pending battery waiters with what we have.
      const waiters = batteryWaiters;
      batteryWaiters = [];
      for (const w of waiters) w(lastBattery);
    };

    const battery = async (): Promise<number | null> => {
      // Issue the battery command and wait up to 1s for the 0x05 reply.
      try { await writeCmd(CMD_BATTERY); } catch { return lastBattery; }
      return new Promise<number | null>(resolve => {
        let done = false;
        const finish = (v: number | null): void => {
          if (done) return;
          done = true;
          resolve(v);
        };
        batteryWaiters.push(finish);
        setTimeout(() => finish(lastBattery), 1000);
      });
    };

    return { battery, cleanup };
  },
};
