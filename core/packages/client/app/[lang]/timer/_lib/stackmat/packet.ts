/**
 * Stackmat Gen 3 / 4 frame structure.
 *
 * Ported from csTimer (`tools/cstimer/js/cstimer.js`, the `stackmat` module) so
 * we accept exactly what it accepts — its parser is the one that has been run
 * against every timer/cable/soundcard combination in the wild.
 *
 * A frame is 9 OR 10 ASCII bytes, terminator included:
 *
 *   10 bytes (millisecond firmwares):
 *     [0]      state byte
 *     [1]      minutes            '0'..'9'
 *     [2..3]   seconds tens, ones
 *     [4..6]   ms hundreds, tens, ones
 *     [7]      checksum = 64 + sum(digit values)
 *     [8..9]   terminator (CR LF)
 *
 *   9 bytes (centisecond firmwares — the display only has 2 decimals):
 *     [0]      state byte
 *     [1]      minutes
 *     [2..3]   seconds tens, ones
 *     [4..5]   centisecond tens, ones
 *     [6]      checksum = 64 + sum(digit values)
 *     [7..8]   terminator (CR LF)
 *
 * The `unit` field records which one we got: 1 = the device really measured
 * milliseconds, 10 = the low digit is unknown and we padded a zero. WCA rounds
 * to centiseconds anyway, but a caller that wants to show 3 decimals should
 * know when the third one is fabricated.
 *
 * State byte:
 *   ' ' (0x20)  idle / both pads up after stop
 *   'I' (0x49)  initial idle after power-on
 *   'A' (0x41)  both pads touched (some firmwares: "green light")
 *   'L' (0x4C)  left pad only
 *   'R' (0x52)  right pad only
 *   'C' (0x43)  both hands on, ready to start
 *   'S' (0x53)  running
 *
 * Checksum note: csTimer requires the additive checksum exactly. We do the
 * same — a bad frame is simply dropped, and the next one arrives ~100 ms
 * later. (The previous, laxer implementation accepted any byte in 0x30..0x7F,
 * which let mis-framed noise through as a "valid" time.)
 */

export type StackmatStateByte = ' ' | 'I' | 'A' | 'L' | 'R' | 'C' | 'S';

export interface StackmatPacket {
  state: StackmatStateByte;
  minutes: number;
  seconds: number;
  /** Milliseconds 0..999. On centisecond firmwares this is always a multiple of 10. */
  millis: number;
  /** Total ms (M*60000 + S*1000 + ms). */
  totalMs: number;
  /** Resolution actually reported by the device: 1 = ms, 10 = centiseconds. */
  unit: 1 | 10;
}

const isDigit = (b: number) => b >= 0x30 && b <= 0x39;
const digitValue = (b: number) => b - 0x30;

export function isStateByte(b: number): boolean {
  // ' ' I A L R C S
  return b === 0x20 || b === 0x49 || b === 0x41 || b === 0x4C
      || b === 0x52 || b === 0x43 || b === 0x53;
}

/**
 * Validate and parse a 9- or 10-byte frame (terminator bytes included).
 * Returns null if the bytes don't form a valid Stackmat frame.
 */
export function parsePacket(bytes: Uint8Array | readonly number[]): StackmatPacket | null {
  const len = bytes.length;
  if (len !== 9 && len !== 10) return null;

  // State byte.
  if (!isStateByte(bytes[0])) return null;

  // Digits run from [1] up to (but excluding) the checksum at [len-3].
  const digitCount = len - 4;   // 10 -> 6 digits, 9 -> 5 digits
  let sum = 0;
  for (let i = 1; i <= digitCount; i++) {
    const b = bytes[i];
    if (!isDigit(b)) return null;
    sum += digitValue(b);
  }

  // Additive checksum, exactly as csTimer computes it.
  if (bytes[len - 3] !== ((sum + 64) & 0xff)) return null;

  const minutes = digitValue(bytes[1]);
  const seconds = digitValue(bytes[2]) * 10 + digitValue(bytes[3]);
  if (seconds > 59) return null;

  const unit: 1 | 10 = len === 10 ? 1 : 10;
  const millis = unit === 1
    ? digitValue(bytes[4]) * 100 + digitValue(bytes[5]) * 10 + digitValue(bytes[6])
    : digitValue(bytes[4]) * 100 + digitValue(bytes[5]) * 10;

  return {
    state: String.fromCharCode(bytes[0]) as StackmatStateByte,
    minutes,
    seconds,
    millis,
    totalMs: minutes * 60_000 + seconds * 1_000 + millis,
    unit,
  };
}

/**
 * Build a well-formed frame for a given time — used by the tests and by the
 * synthesizer in `./decoder.ts`. `unit` picks the 10-byte (ms) or 9-byte
 * (centisecond) layout.
 */
export function buildPacket(
  state: StackmatStateByte,
  totalMs: number,
  unit: 1 | 10 = 1,
): number[] {
  const minutes = Math.floor(totalMs / 60_000) % 10;
  const seconds = Math.floor(totalMs / 1_000) % 60;
  const millis = totalMs % 1_000;

  const digits = unit === 1
    ? [minutes, Math.floor(seconds / 10), seconds % 10,
       Math.floor(millis / 100), Math.floor(millis / 10) % 10, millis % 10]
    : [minutes, Math.floor(seconds / 10), seconds % 10,
       Math.floor(millis / 100), Math.floor(millis / 10) % 10];

  const sum = digits.reduce((a, b) => a + b, 0);
  return [
    state.charCodeAt(0),
    ...digits.map(d => 0x30 + d),
    (sum + 64) & 0xff,
    0x0D, 0x0A,
  ];
}
