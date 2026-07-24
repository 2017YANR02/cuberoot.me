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
 * Each notification carries a move history window starting at nibble 32,
 * newest first. Its LENGTH depends on the frame variant, because cstimer's
 * `toHexVal` truncates de-obfuscated frames to 18 bytes (giikercube.js:84):
 *   plain 20-byte frame   -> 40 nibbles -> valhex[32..39] -> 4 moves
 *   0xA7-obfuscated frame -> 36 nibbles -> valhex[32..35] -> 2 moves
 * We dedupe against the previous notification by remembering that window and
 * only forwarding the freshest "new" moves. Over a normal turn cadence that
 * means exactly 1 move per notification; if the host JS event loop stalls we
 * recover up to a whole window of backlog.
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
 * toHexVal, which drops the tag + key byte with `raw = raw.slice(0, 18)`.
 * Returns 36 nibbles (most significant nibble first within each byte) for
 * 0xA7-tagged frames, and the full 40 for untagged ones. Either way the cube
 * state occupies nibbles 0..30 and the move history starts at nibble 32.
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

/** Pack a nibble window into (face, dir) byte codes, newest first. */
function toMoveCodes(nibbles: ReadonlyArray<number>): number[] {
  const codes: number[] = [];
  for (let i = 0; i + 1 < nibbles.length; i += 2) {
    codes.push((nibbles[i] << 4) | nibbles[i + 1]);
  }
  return codes;
}

/**
 * Compare the move-history window in this notification against the previous
 * one and return the new moves (oldest first, ready to push into onMove).
 *
 * Window layout: 2 nibbles per move, newest first — 4 moves on plain frames,
 * 2 on de-obfuscated ones. Cstimer's `prevMoves` array is indexed
 * `[newest, ..., oldest]`. So a cube that has just turned R once after R'
 * will produce `[R, R', ...]` whereas the previous frame was
 * `[R', ..., older]`. We therefore identify how many leading entries are new
 * by aligning the second-newest of THIS frame with the newest of the
 * PREVIOUS frame. That count is bounded by 0..windowLength.
 */
function diffMoves(
  curr: ReadonlyArray<number>,
  prev: ReadonlyArray<number> | null,
): number[] {
  const currCodes = toMoveCodes(curr);
  if (!prev) {
    // First notification ever: don't replay history, just emit the newest.
    if (currCodes[0] === 0) return [];
    return [currCodes[0]];
  }
  const prevCodes = toMoveCodes(prev);
  const n = currCodes.length;
  // Find the smallest k >= 1 such that currCodes[k..] aligns with
  // prevCodes[0..]. k is the number of new moves (1..n); k = n always aligns
  // vacuously, which is the "we missed a whole window of turns" fallback.
  for (let k = 1; k <= n; k++) {
    let ok = true;
    for (let j = 0; j + k < n && j < prevCodes.length; j++) {
      if (currCodes[j + k] !== prevCodes[j]) { ok = false; break; }
    }
    if (!ok) continue;
    // Oldest-first, drop placeholder zero codes.
    const out: number[] = [];
    for (let i = k - 1; i >= 0; i--) {
      if (currCodes[i] !== 0) out.push(currCodes[i]);
    }
    return out;
  }
  return [];
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
      // 36 nibbles is the floor: cstimer truncates de-obfuscated frames to 18
      // bytes, which still covers the state (0..30) plus one history slot.
      // Anything shorter is a runt frame we cannot read a move out of.
      if (valhex.length < 36) return;
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
