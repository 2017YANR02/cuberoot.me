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
 *   0x02 — full state dump (54 stickers). We don't track facelets here, the
 *          shared CubeStateTracker does.
 *   0x03 — orientation quaternion (ignored).
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

import type { CubeDriver, CubeDriverStartResult } from './driver';
import type { CubeBrand } from './types';

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

// Re-ack interval: every 20 moves cstimer issues another CMD_STATE so the
// firmware does not stop pushing notifications.
const REACK_EVERY = 20;

export const gocubeDriver: CubeDriver = {
  brand: 'gocube' satisfies CubeBrand,
  service: GOCUBE_SERVICE,

  matches(device: BluetoothDevice): boolean {
    const n = device.name ?? '';
    return /^(GoCube|Rubiks?)/i.test(n);
  },

  async start(server, onMove): Promise<CubeDriverStartResult> {
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
      } else if (opcode === 0x05 && payloadLen >= 1) {
        lastBattery = dv.getUint8(3);
        const waiters = batteryWaiters;
        batteryWaiters = [];
        for (const w of waiters) w(lastBattery);
      }
      // 0x02 (state), 0x03 (quat), 0x07 (offline), 0x08 (cube type): ignored.
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
