/**
 * GAN Smart Cube v4 driver — covers GAN 12, GAN 14, Mini Pro, Magnetic
 * Boost (Smart Cube v4 protocol).
 *
 * STUB ONLY. The v4 protocol is a redesign over v3:
 *   - Custom service `0000fff0-...` is reused but with new characteristic
 *     UUIDs and a different encryption/key-exchange scheme.
 *   - Frames are length-prefixed, AES-128-CTR with a session key
 *     established via a write to the command characteristic at connect.
 *   - Move format uses a packed 6-bit face+direction per move with a
 *     32-bit timestamp.
 *
 * Public references for the curious:
 *   https://github.com/Flying-Toast/gan_v4 (reverse-engineering notes)
 *   https://github.com/cubing/cubing.js/tree/main/src/bluetooth/gan
 *
 * For now we connect, attempt to read battery, and return without
 * decoding any moves. Pair a v3 cube for the auto-stop feature until v4
 * is implemented.
 */

import type { CubeDriver, CubeDriverStartResult } from './driver';
import type { CubeBrand } from './types';

// v4 reuses the broad service UUID; v3 and v4 share namespace prefixes.
const GAN_V4_SERVICE = '8653000a-43e6-47b7-9cb0-5fc21d4ae340';
const BATTERY_SERVICE = 0x180f;
const BATTERY_LEVEL_CHAR = 0x2a19;

export const ganV4Driver: CubeDriver = {
  brand: 'gan-v4' satisfies CubeBrand,
  service: GAN_V4_SERVICE,
  optionalServices: [String(BATTERY_SERVICE)],

  matches(device: BluetoothDevice): boolean {
    const n = device.name ?? '';
    // v4 cubes typically present as "GAN-12-XXXX" / "GAN-14-XXXX".
    return /^GAN-?(12|14|Mini)/i.test(n);
  },

  async start(server): Promise<CubeDriverStartResult> {
    // TODO: implement v4 frame decoding (AES-CTR + length prefix).
    // The `onMove` callback is intentionally unused — a stub driver only
    // surfaces battery for now.
    const battery = async (): Promise<number | null> => {
      try {
        const battSvc = await server.getPrimaryService(BATTERY_SERVICE);
        const battChar = await battSvc.getCharacteristic(BATTERY_LEVEL_CHAR);
        const v = await battChar.readValue();
        return v.getUint8(0);
      } catch {
        return null;
      }
    };
    return { battery, cleanup: () => {} };
  },
};
