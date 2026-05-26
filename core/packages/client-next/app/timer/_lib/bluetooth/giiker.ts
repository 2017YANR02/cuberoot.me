/**
 * Giiker / Xiaomi Mi Smart Magic Cube driver.
 *
 * Protocol reference: cstimer's `src/js/hardware/giikercube.js` (the upstream
 * battle-tested implementation). This file is a faithful TypeScript port of
 * the relevant decode path; we only emit the newest move per notification
 * because the Giiker fires one notification per physical turn.
 *
 * Wire summary
 * ------------
 *   Data service:    0000aadb-0000-1000-8000-00805f9b34fb
 *   Notify char:     0000aadc-0000-1000-8000-00805f9b34fb     (also readable)
 *   RW service:      0000aaaa-0000-1000-8000-00805f9b34fb
 *   Read char:       0000aaab-...                              (battery push)
 *   Write char:      0000aaac-...                              (battery pull,
 *                                                              opcode 0xB5)
 *
 * Notify payload is 20 bytes, unencrypted on most older Giiker / Mi units;
 * Cube4U / supercube i3s revisions wrap a 0xA7-tagged ciphertext that we
 * decrypt via the published key (cstimer toHexVal logic).
 *
 * We treat each notification as carrying 4 historical moves (8 nibbles at
 * offsets 32..39), newest first. We dedupe against the previous notification
 * by remembering the 4-move window and only forwarding the freshest "new"
 * moves. Over a normal turn cadence that means exactly 1 move per
 * notification; if the host JS event loop stalls we recover up to 4 turns of
 * backlog.
 *
 * Move-byte encoding (cstimer):
 *   face nibble (1..6) → "BDLURF"[face - 1]
 *   dir  nibble (1..3) → " 2'"[(dir - 1) % 7]
 *     1 → CW (no suffix), 2 → 180°, 3 → CCW
 */

import type { CubeDriver, CubeDriverStartResult } from './driver';
import type { CubeBrand } from './types';

const GIIKER_DATA_SERVICE = '0000aadb-0000-1000-8000-00805f9b34fb';
const GIIKER_NOTIFY_CHAR = '0000aadc-0000-1000-8000-00805f9b34fb';

const GIIKER_RW_SERVICE = '0000aaaa-0000-1000-8000-00805f9b34fb';
const GIIKER_READ_CHAR = '0000aaab-0000-1000-8000-00805f9b34fb';
const GIIKER_WRITE_CHAR = '0000aaac-0000-1000-8000-00805f9b34fb';

/**
 * Decryption key for 0xA7-tagged frames (Cube4U / supercube i3s firmwares).
 * Public; lifted from cstimer giikercube.js. For "plain" Giiker / Mi units
 * the tag byte is not 0xA7 and we skip this entirely.
 */
const GIIKER_DECRYPT_KEY: ReadonlyArray<number> = [
  176, 81, 104, 224, 86, 137, 237, 119,
  38, 26, 193, 161, 210, 126, 150, 81,
  93, 13, 236, 249, 89, 235, 88, 24,
  113, 81, 214, 131, 130, 199, 2, 169,
  39, 165, 171, 41,
];

/** Face alphabet used by the move byte (cstimer "BDLURF"). */
const GIIKER_FACE_ORDER = ['B', 'D', 'L', 'U', 'R', 'F'] as const;
/** Direction suffix table indexed by `(dir - 1) % 7`: 0='', 1='2', 2="'". */
const GIIKER_DIR_SUFFIX = ['', '2', "'"] as const;

/**
 * Decrypt the 20-byte raw frame to the 18 plaintext bytes per cstimer's
 * toHexVal. Returns 36 nibbles (most significant nibble first within each
 * byte). For untagged frames we still produce the 40-nibble (20-byte) array
 * so callers can read `valhex[32..39]` for the move history.
 */
function toHexVal(dv: DataView): number[] {
  if (dv.byteLength < 20) return [];
  const raw: number[] = new Array(20);
  for (let i = 0; i < 20; i++) raw[i] = dv.getUint8(i);
  let plain: number[] = raw;
  if (raw[18] === 0xa7) {
    const k1 = (raw[19] >> 4) & 0xf;
    const k2 = raw[19] & 0xf;
    const dec: number[] = new Array(18);
    for (let i = 0; i < 18; i++) {
      // Match cstimer's modular addition.
      dec[i] = (raw[i] + GIIKER_DECRYPT_KEY[i + k1] + GIIKER_DECRYPT_KEY[i + k2]) & 0xff;
    }
    plain = dec;
  }
  const valhex: number[] = new Array(plain.length * 2);
  for (let i = 0; i < plain.length; i++) {
    valhex[i * 2] = (plain[i] >> 4) & 0xf;
    valhex[i * 2 + 1] = plain[i] & 0xf;
  }
  return valhex;
}

/** Format a (face, dir) move pair from the giiker nibbles. */
function formatMove(faceNib: number, dirNib: number): string | null {
  if (faceNib < 1 || faceNib > 6) return null;
  if (dirNib < 1) return null;
  const face = GIIKER_FACE_ORDER[faceNib - 1];
  const suffix = GIIKER_DIR_SUFFIX[(dirNib - 1) % 7] ?? '';
  return `${face}${suffix}`;
}

/**
 * Compare the move-history window in this notification against the previous
 * one and return the new moves (oldest first, ready to push into onMove).
 *
 * Window layout: 8 nibbles = 4 moves, newest first. Cstimer's `prevMoves`
 * array is indexed `[newest, ..., oldest]`. So a cube that has just turned R
 * once after R' will produce `[R, R', ...]` whereas the previous frame was
 * `[R', ..., older]`. We therefore identify how many leading entries are new
 * by aligning the second-newest of THIS frame with the newest of the
 * PREVIOUS frame. That count is bounded by 0..4.
 */
function diffMoves(
  curr: ReadonlyArray<number>,
  prev: ReadonlyArray<number> | null,
): number[] {
  // curr/prev each hold 8 nibbles. Pack into 4 16-bit move codes for compare.
  const currCodes: number[] = [];
  for (let i = 0; i < 8; i += 2) {
    currCodes.push((curr[i] << 4) | curr[i + 1]);
  }
  if (!prev) {
    // First notification ever: don't replay history, just emit the newest.
    if (currCodes[0] === 0) return [];
    return [currCodes[0]];
  }
  const prevCodes: number[] = [];
  for (let i = 0; i < 8; i += 2) {
    prevCodes.push((prev[i] << 4) | prev[i + 1]);
  }
  // Find the smallest k >= 1 such that currCodes[k..] aligns with
  // prevCodes[0..3-k]. k is the number of new moves (1..4); if no alignment
  // we treat all 4 as new (very rare — usually means we missed > 4 turns).
  for (let k = 1; k <= 4; k++) {
    let ok = true;
    for (let j = 0; j + k < 4; j++) {
      if (currCodes[j + k] !== prevCodes[j]) { ok = false; break; }
    }
    if (ok) {
      // Oldest-first, drop placeholder zero codes.
      const out: number[] = [];
      for (let i = k - 1; i >= 0; i--) {
        if (currCodes[i] !== 0) out.push(currCodes[i]);
      }
      return out;
    }
  }
  // No alignment: emit all four newest-first reversed to oldest-first.
  return [currCodes[3], currCodes[2], currCodes[1], currCodes[0]].filter(c => c !== 0);
}

export const giikerDriver: CubeDriver = {
  brand: 'giiker' satisfies CubeBrand,
  service: GIIKER_DATA_SERVICE,
  optionalServices: [GIIKER_RW_SERVICE],

  matches(device: BluetoothDevice): boolean {
    const n = (device.name ?? '').trim();
    // cstimer's `prefix: ['Gi', 'Mi Smart Magic Cube', 'Hi-']`. We mirror
    // that, with leading-anchored regex so we don't accidentally claim
    // unrelated names.
    return /^(Gi|Mi Smart Magic Cube|Hi-)/.test(n);
  },

  async start(server, onMove): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(GIIKER_DATA_SERVICE);
    const notifyChar = await service.getCharacteristic(GIIKER_NOTIFY_CHAR);

    let prevHistoryNibbles: number[] | null = null;
    let lastBattery: number | null = null;

    const handleFrame = (dv: DataView): void => {
      const valhex = toHexVal(dv);
      if (valhex.length < 40) return;
      const history = valhex.slice(32, 40);
      const codes = diffMoves(history, prevHistoryNibbles);
      prevHistoryNibbles = history;
      for (const code of codes) {
        const faceNib = (code >> 4) & 0xf;
        const dirNib = code & 0xf;
        const mv = formatMove(faceNib, dirNib);
        if (mv) onMove(mv);
      }
    };

    const onChar = (ev: Event): void => {
      const target = ev.target as BluetoothRemoteGATTCharacteristic;
      const dv = target.value;
      if (!dv) return;
      try {
        handleFrame(dv);
      } catch {
        // Defensive — never let a malformed frame crash the host.
      }
    };

    notifyChar.addEventListener('characteristicvaluechanged', onChar);
    await notifyChar.startNotifications();

    // cstimer reads the initial value once after subscribing; we do the same
    // so the first physical turn diffs against a real baseline (otherwise
    // the first turn replays whatever historical moves were buffered before
    // we connected).
    try {
      const initial = await notifyChar.readValue();
      handleFrame(initial);
    } catch {
      // Older firmwares disallow read on this char — non-fatal.
    }

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      notifyChar.removeEventListener('characteristicvaluechanged', onChar);
      void notifyChar.stopNotifications().catch(() => {});
    };

    /**
     * Battery query: write 0xB5 to the RW write-char, then wait for one
     * notification on the read-char. Mirrors cstimer's `getBatteryLevel`.
     * Resolves to null on any failure / timeout.
     */
    const battery = async (): Promise<number | null> => {
      try {
        const rwSvc = await server.getPrimaryService(GIIKER_RW_SERVICE);
        const readChar = await rwSvc.getCharacteristic(GIIKER_READ_CHAR);
        const writeChar = await rwSvc.getCharacteristic(GIIKER_WRITE_CHAR);

        const result = await new Promise<number | null>(resolve => {
          let settled = false;
          const listener = (ev: Event): void => {
            if (settled) return;
            settled = true;
            const target = ev.target as BluetoothRemoteGATTCharacteristic;
            const dv = target.value;
            const pct = dv && dv.byteLength >= 2 ? dv.getUint8(1) : null;
            readChar.removeEventListener('characteristicvaluechanged', listener);
            void readChar.stopNotifications().catch(() => {});
            resolve(pct !== null && pct <= 100 ? pct : null);
          };
          readChar.addEventListener('characteristicvaluechanged', listener);
          void readChar.startNotifications().then(async () => {
            // 0xB5 = battery query opcode (cstimer).
            const buf = new Uint8Array([0xb5]);
            try {
              if (writeChar.writeValueWithResponse) {
                await writeChar.writeValueWithResponse(buf);
              } else if (writeChar.writeValueWithoutResponse) {
                await writeChar.writeValueWithoutResponse(buf);
              } else {
                await writeChar.writeValue(buf);
              }
            } catch {
              if (!settled) {
                settled = true;
                readChar.removeEventListener('characteristicvaluechanged', listener);
                void readChar.stopNotifications().catch(() => {});
                resolve(null);
              }
            }
          }).catch(() => {
            if (!settled) {
              settled = true;
              resolve(null);
            }
          });
          // Timeout: cube might have gone idle. 1.5s is plenty; if it never
          // arrives we just fall back to null.
          setTimeout(() => {
            if (settled) return;
            settled = true;
            readChar.removeEventListener('characteristicvaluechanged', listener);
            void readChar.stopNotifications().catch(() => {});
            resolve(null);
          }, 1500);
        });
        if (result !== null) lastBattery = result;
        return result ?? lastBattery;
      } catch {
        return lastBattery;
      }
    };

    return { battery, cleanup };
  },
};
