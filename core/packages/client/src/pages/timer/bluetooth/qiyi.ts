/**
 * QiYi Smart Cube driver (also covers QiYi Smart Mat).
 *
 * STUB ONLY. QiYi cubes use service `0000fff0-...` with characteristic
 * `0000fff6-...` for notifications, but framing differs from GAN — they
 * use a custom XOR-stream "scramble" applied to a fixed 16-byte block
 * that includes a per-frame counter, then a CRC. The mat exposes
 * additional characteristics for tap / lift events.
 *
 * For now this driver connects, exposes battery via the standard 0x180F
 * service, and does not decode moves. Pair a GAN v3 cube for the
 * auto-stop feature until QiYi is implemented.
 */

import type { CubeDriver, CubeDriverStartResult } from './driver';
import type { CubeBrand } from './types';

const QIYI_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';
const BATTERY_SERVICE = 0x180f;
const BATTERY_LEVEL_CHAR = 0x2a19;

export const qiyiDriver: CubeDriver = {
  brand: 'qiyi' satisfies CubeBrand,
  service: QIYI_SERVICE,
  optionalServices: [String(BATTERY_SERVICE)],

  matches(device: BluetoothDevice): boolean {
    const n = device.name ?? '';
    return /^(QiYi|MHC|QY-)/i.test(n);
  },

  async start(server): Promise<CubeDriverStartResult> {
    // TODO: implement QiYi frame decoding. The `onMove` callback is
    // intentionally unused — a stub driver only surfaces battery for now.
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
