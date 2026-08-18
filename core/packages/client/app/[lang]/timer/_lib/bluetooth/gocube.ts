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

import {
  GOCUBE_COMMAND_BATTERY,
  GOCUBE_COMMAND_STATE,
  GOCUBE_NOTIFY_CHARACTERISTIC_UUID,
  GOCUBE_SERVICE_UUID,
  GOCUBE_STATE_REACK_AFTER_MOVES,
  GOCUBE_WRITE_CHARACTERISTIC_UUID,
  createGoCubeCommand,
  matchesGoCubeName,
  parseGoCubeNotification,
} from '@cuberoot/shared/smart-cube/gocube';
import { fromFaceletString } from '../cube/state';
import type { CubeDriver, CubeDriverStartResult, GyroQuaternion } from './driver';
import type { CubeBrand } from './types';

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
  if (payloadLen !== dv.byteLength - 6) return null;
  const notification = parseGoCubeNotification(dv);
  if (notification?.type !== 'state') return null;
  return fromFaceletString(notification.facelets) ? notification.facelets : null;
}

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
  if (payloadLen !== dv.byteLength - 6) return null;
  const notification = parseGoCubeNotification(dv);
  return notification?.type === 'orientation' ? notification.quaternion : null;
}

export const gocubeDriver: CubeDriver = {
  brand: 'gocube' satisfies CubeBrand,
  service: GOCUBE_SERVICE_UUID,
  // `Rubik` and not cstimer's `Rubiks`: Rubik's Connected ships firmwares
  // advertising both `Rubiks Connected` and `Rubik's Connected`.
  namePrefixes: ['GoCube', 'Rubik'],
  // Plaintext protocol: no AES, no MAC, so this is the one brand whose gyro
  // we can reason about end-to-end from the bytes alone.
  hasGyro: true,

  matches(device: BluetoothDevice): boolean {
    return matchesGoCubeName(device.name);
  },

  async start(server, onMove, ctx): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(GOCUBE_SERVICE_UUID);
    const writeChar = await service.getCharacteristic(GOCUBE_WRITE_CHARACTERISTIC_UUID);
    const notifyChar = await service.getCharacteristic(GOCUBE_NOTIFY_CHARACTERISTIC_UUID);

    let lastBattery: number | null = null;
    let batteryWaiters: Array<(v: number | null) => void> = [];
    let movesSinceAck = 0;

    const writeCmd = (cmd: number): Promise<void> => {
      // The Web Bluetooth typings accept BufferSource — pass the underlying
      // ArrayBuffer to keep the call portable (some platforms reject the
      // Uint8Array view directly).
      return writeChar.writeValue(createGoCubeCommand(cmd));
    };

    const onChar = (ev: Event): void => {
      const target = ev.target as BluetoothRemoteGATTCharacteristic;
      const dv = target.value;
      if (!dv) return;
      const notification = parseGoCubeNotification(dv);
      if (!notification) return;

      if (notification.type === 'moves') {
        for (const move of notification.moves) {
          onMove(move);
          movesSinceAck++;
        }
        if (movesSinceAck > GOCUBE_STATE_REACK_AFTER_MOVES) {
          movesSinceAck = 0;
          void writeCmd(GOCUBE_COMMAND_STATE).catch(() => {});
        }
      } else if (notification.type === 'state') {
        // Full state dump. The cube sends one on connect (we ask for it) and
        // one after every re-ack, so this is both the initial truth and a
        // periodic correction for anything the move stream lost.
        if (ctx?.onState && fromFaceletString(notification.facelets)) {
          ctx.onState(notification.facelets);
        }
      } else if (notification.type === 'orientation') {
        // Orientation. GoCube pushes these ~15x/s once connected, so only
        // pay the ASCII parse when someone is listening.
        // No angular velocity in this protocol — the second arg stays
        // undefined rather than being faked from finite differences.
        ctx?.onGyro?.(notification.quaternion);
      } else if (notification.type === 'battery') {
        lastBattery = notification.level;
        const waiters = batteryWaiters;
        batteryWaiters = [];
        for (const w of waiters) w(lastBattery);
      }
    };

    notifyChar.addEventListener('characteristicvaluechanged', onChar);
    await notifyChar.startNotifications();

    // Kick the cube: requesting a state dump arms the move stream, matching
    // cstimer's init().
    try { await writeCmd(GOCUBE_COMMAND_STATE); } catch { /* ignore */ }

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
      let finish: (value: number | null) => void = () => {};
      const response = new Promise<number | null>(resolve => {
        let done = false;
        finish = (value: number | null): void => {
          if (done) return;
          done = true;
          batteryWaiters = batteryWaiters.filter((waiter) => waiter !== finish);
          resolve(value);
        };
        batteryWaiters.push(finish);
        setTimeout(() => finish(lastBattery), 1000);
      });
      try { await writeCmd(GOCUBE_COMMAND_BATTERY); } catch { finish(lastBattery); }
      return response;
    };

    return { battery, cleanup };
  },
};
