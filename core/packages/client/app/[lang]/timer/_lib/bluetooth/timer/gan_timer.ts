/**
 * GAN Smart Timer driver.
 *
 * Protocol reference: csTimer `src/js/hardware/gantimer.js` (itself derived
 * from Andy Fedotov's `gan-web-bluetooth`). This is the easy one of the two —
 * plaintext frames, no encryption, no MAC, no handshake. Subscribe and read.
 *
 * Wire summary
 * ------------
 *   Service (notify):  0000fff0-0000-1000-8000-00805f9b34fb
 *   Characteristic:    0000fff5-0000-1000-8000-00805f9b34fb   (notify only)
 *
 * Every notification is one little-endian frame:
 *
 *   offset  size  meaning
 *   ------  ----  ---------------------------------------------------------
 *     0      1    magic, always 0xFE
 *     1      1    frame length (bytes after this field; not used by us)
 *     2      1    event counter / opcode (opaque; part of the CRC window)
 *     3      1    STATE INDEX into GAN_TIMER_STATES (see below)
 *     4      1    minutes    ┐
 *     5      1    seconds    ├ recorded time, valid on STOPPED
 *     6      2    millis (u16 LE)                                   ┘
 *    ...          previous recorded times (we ignore them)
 *   n-2      2    CRC-16/CCITT-FALSE (u16 LE) over bytes [2 .. n-3]
 *
 *   solveTime = 60000*min + 1000*sec + msec
 *
 * State table, indexed by `data[3]`:
 *   0 DISCONNECT  1 GET_SET  2 HANDS_OFF  3 RUNNING
 *   4 STOPPED     5 GAN_RESET  6 HANDS_ON  7 FINISHED
 *
 * Deviation from csTimer (intentional)
 * ------------------------------------
 * `gantimer.js:78-84` validates magic + CRC, logs "Invalid event data
 * received from Timer" when validation fails — and then falls through and
 * processes the frame anyway (the `if` has no `return`). That is a bug: a
 * corrupted frame can inject a bogus STOPPED with a garbage time straight into
 * the user's session. We DROP invalid frames instead.
 *
 * Second, smaller deviation: csTimer maps an out-of-range state index to
 * DISCONNECT via `[...][idx] || 0`. Emitting a fake "your timer went away" for
 * a state byte a future firmware added is worse than emitting nothing, so we
 * drop those frames too.
 */

import { crc16CcittFalse } from './crc';
import type { BluetoothTimerDriver, BluetoothTimerStartResult } from './driver';
import type { ExternalTimerEvent, ExternalTimerState } from './types';

export const GAN_TIMER_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';
export const GAN_TIMER_STATE_CHAR = '0000fff5-0000-1000-8000-00805f9b34fb';

/** Name prefixes csTimer registers for the GAN timer (gantimer.js:116). */
export const GAN_TIMER_NAME_PREFIXES = ['GAN', 'Gan', 'gan'] as const;

const GAN_TIMER_MAGIC = 0xfe;

/** State table indexed by `data[3]`. Order is load-bearing. */
export const GAN_TIMER_STATES: readonly ExternalTimerState[] = [
  'DISCONNECT',
  'GET_SET',
  'HANDS_OFF',
  'RUNNING',
  'STOPPED',
  'GAN_RESET',
  'HANDS_ON',
  'FINISHED',
];

/**
 * Smallest frame we will look at: magic + len + opcode + state, plus the
 * 2-byte trailing CRC. Real frames are 20 bytes.
 */
const MIN_FRAME_LEN = 6;
/** STOPPED additionally needs min/sec/millis at offsets 4..7. */
const MIN_STOPPED_FRAME_LEN = 10;

/**
 * Magic + CRC check.
 *
 * The CRC window is `[2 .. byteLength-3]` — it skips the magic and the length
 * byte and excludes the CRC itself. csTimer expresses this as
 * `data.buffer.slice(2, data.byteLength - 2)`, which silently ignores the
 * DataView's `byteOffset`; we honour the offset, which is identical whenever
 * the view starts at 0 (always true for Web Bluetooth notifications) and
 * correct when it does not.
 */
export function validateGanTimerFrame(data: DataView): boolean {
  if (data.byteLength < MIN_FRAME_LEN) return false;
  if (data.getUint8(0) !== GAN_TIMER_MAGIC) return false;
  const frameCrc = data.getUint16(data.byteLength - 2, true);
  const window = new Uint8Array(data.buffer, data.byteOffset + 2, data.byteLength - 4);
  return crc16CcittFalse(window) === frameCrc;
}

/**
 * Decode one notification frame. Returns null for anything we won't trust:
 * short frame, bad magic, bad CRC, or an unknown state index.
 */
export function parseGanTimerFrame(data: DataView): ExternalTimerEvent | null {
  if (!validateGanTimerFrame(data)) return null;

  const state = GAN_TIMER_STATES[data.getUint8(3)];
  if (state === undefined) return null;

  if (state !== 'STOPPED') return { state };

  if (data.byteLength < MIN_STOPPED_FRAME_LEN) return null;
  const min = data.getUint8(4);
  const sec = data.getUint8(5);
  const msec = data.getUint16(6, true);
  return { state, solveTime: 60000 * min + 1000 * sec + msec };
}

export const ganTimerDriver: BluetoothTimerDriver = {
  kind: 'gan-timer',
  service: GAN_TIMER_SERVICE,
  namePrefixes: GAN_TIMER_NAME_PREFIXES,

  matches(device: BluetoothDevice): boolean {
    return /^gan/i.test((device.name ?? '').trim());
  },

  async start(server, emit): Promise<BluetoothTimerStartResult> {
    const service = await server.getPrimaryService(GAN_TIMER_SERVICE);
    const stateChar = await service.getCharacteristic(GAN_TIMER_STATE_CHAR);

    const onChar = (ev: Event): void => {
      const dv = (ev.target as BluetoothRemoteGATTCharacteristic).value;
      if (!dv) return;
      const parsed = parseGanTimerFrame(dv);
      // Drop, don't process — see the header note on csTimer's fall-through.
      if (!parsed) return;
      emit(parsed);
    };

    stateChar.addEventListener('characteristicvaluechanged', onChar);
    await stateChar.startNotifications();

    let cleaned = false;
    return {
      cleanup(): void {
        if (cleaned) return;
        cleaned = true;
        stateChar.removeEventListener('characteristicvaluechanged', onChar);
        void stateChar.stopNotifications().catch(() => {});
      },
    };
  },
};
