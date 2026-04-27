/**
 * GoCube / Rubik's Connected driver.
 *
 * GoCube uses a 16-bit custom service `0xAADB` and a notification
 * characteristic `0xAADC` (long-form
 * `0000aadc-0000-1000-8000-00805f9b34fb`). Frames are unencrypted and
 * length-prefixed:
 *
 *     [0x2a] [len] [opcode] payload... [crc16] [0x0d] [0x0a]
 *
 * Opcode 0x01 carries a single move: payload byte 0 = move code with
 *   bit 0 = direction (0 = CW, 1 = CCW)
 *   bits 1..3 = face index (0..5: B F U D L R — yes, GoCube reorders
 *               the faces relative to GAN).
 *
 * We only decode opcode 0x01 (move). Opcodes 0x02 (orientation), 0x03
 * (state), 0x05 (battery), 0x07 (offline solves) are recognized but
 * forwarded to no-ops; battery is exposed via the standard 0x180F
 * service if present, falling back to the 0x05 frames otherwise.
 */

import type { CubeDriver, CubeDriverStartResult } from './driver';
import type { CubeBrand } from './types';

const GOCUBE_SERVICE = '0000aadb-0000-1000-8000-00805f9b34fb';
const GOCUBE_NOTIFY_CHAR = '0000aadc-0000-1000-8000-00805f9b34fb';
const BATTERY_SERVICE = 0x180f;
const BATTERY_LEVEL_CHAR = 0x2a19;

// GoCube face order from its move opcode — bits 1..3.
const GOCUBE_FACE_ORDER = ['B', 'F', 'U', 'D', 'L', 'R'] as const;

export const gocubeDriver: CubeDriver = {
  brand: 'gocube' satisfies CubeBrand,
  service: GOCUBE_SERVICE,
  optionalServices: [String(BATTERY_SERVICE)],

  matches(device: BluetoothDevice): boolean {
    const n = device.name ?? '';
    return /^(GoCube|Rubiks?)/i.test(n);
  },

  async start(server, onMove): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(GOCUBE_SERVICE);
    const notifyChar = await service.getCharacteristic(GOCUBE_NOTIFY_CHAR);

    let lastBattery: number | null = null;

    const onChar = (ev: Event): void => {
      const target = ev.target as BluetoothRemoteGATTCharacteristic;
      const dv = target.value;
      if (!dv) return;
      const data = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      // Walk the buffer; multiple frames can be packed.
      let i = 0;
      while (i < data.length) {
        if (data[i] !== 0x2a) { i++; continue; }
        if (i + 2 > data.length) break;
        const len = data[i + 1];
        if (i + len > data.length) break;
        const opcode = data[i + 2];
        const payload = data.subarray(i + 3, i + len - 4); // strip CRC + 0d 0a
        if (opcode === 0x01 && payload.length >= 1) {
          const code = payload[0];
          const face = (code >> 1) & 0x07;
          const dir = code & 0x01;
          if (face < GOCUBE_FACE_ORDER.length) {
            const f = GOCUBE_FACE_ORDER[face];
            onMove(dir ? `${f}'` : f);
          }
        } else if (opcode === 0x05 && payload.length >= 1) {
          lastBattery = payload[0];
        }
        i += len;
      }
    };

    notifyChar.addEventListener('characteristicvaluechanged', onChar);
    await notifyChar.startNotifications();

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      notifyChar.removeEventListener('characteristicvaluechanged', onChar);
      void notifyChar.stopNotifications().catch(() => {});
    };

    const battery = async (): Promise<number | null> => {
      // Prefer the standard battery service; fall back to whatever the
      // cube last emitted on opcode 0x05.
      try {
        const battSvc = await server.getPrimaryService(BATTERY_SERVICE);
        const battChar = await battSvc.getCharacteristic(BATTERY_LEVEL_CHAR);
        const v = await battChar.readValue();
        return v.getUint8(0);
      } catch {
        return lastBattery;
      }
    };

    return { battery, cleanup };
  },
};
