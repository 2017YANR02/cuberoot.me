/**
 * Stackmat Gen 3 / 4 packet structure.
 *
 * Each packet is 9 ASCII bytes:
 *   [0] state byte:
 *         ' ' (0x20)  idle / both pads up after stop
 *         'I' (0x49)  initial idle after power-on
 *         'A' (0x41)  one hand on left pad
 *         'L' (0x4C)  one hand on right pad
 *         'R' (0x52)  one hand on right pad (some variants)
 *         'C' (0x43)  both hands on (ready to start)
 *         'S' (0x53)  running (timer counting)
 *   [1]      minute  ('0'..'9')
 *   [2..3]   seconds tens, ones
 *   [4..6]   ms hundreds, tens, ones (== centiseconds high digit + ms low two)
 *   [7]      checksum byte = 0x40 + sum(digits)  (sum of the 6 digit bytes
 *            interpreted as their numeric values, plus 64); validated below.
 *   [8]      terminator: '\n' (0x0A) or '\r' (0x0D)
 *
 * Some firmwares emit a slightly different checksum (e.g. plain 0x7F). We
 * accept either the additive checksum, the constant 0x7F, OR a generic
 * "all six digit-bytes are valid 0..9" sanity check. A single invalid packet
 * just gets dropped — useStackmat refreshes phase/ms from the next valid one.
 */

export type StackmatStateByte = ' ' | 'I' | 'A' | 'L' | 'R' | 'C' | 'S';

export interface StackmatPacket {
  state: StackmatStateByte;
  minutes: number;
  seconds: number;
  /** Milliseconds 0..999 (3 ASCII digits). */
  millis: number;
  /** Total ms (M*60s + S + ms). */
  totalMs: number;
}

const isDigit = (b: number) => b >= 0x30 && b <= 0x39;
const digitValue = (b: number) => b - 0x30;

export function isStateByte(b: number): boolean {
  // ' ' I A L R C S
  return b === 0x20 || b === 0x49 || b === 0x41 || b === 0x4C
      || b === 0x52 || b === 0x43 || b === 0x53;
}

/**
 * Validate and parse a 9-byte buffer as a Stackmat packet.
 * Returns null if the bytes don't form a valid packet.
 */
export function parsePacket(bytes: Uint8Array): StackmatPacket | null {
  if (bytes.length !== 9) return null;

  // 1. Terminator must be CR or LF.
  const term = bytes[8];
  if (term !== 0x0A && term !== 0x0D) return null;

  // 2. State byte must be one of the known set.
  if (!isStateByte(bytes[0])) return null;

  // 3. Six digit bytes must all be ASCII digits.
  for (let i = 1; i <= 6; i++) {
    if (!isDigit(bytes[i])) return null;
  }

  // 4. Checksum: accept several variants observed in the wild.
  const cs = bytes[7];
  const digitSum =
    digitValue(bytes[1]) + digitValue(bytes[2]) + digitValue(bytes[3]) +
    digitValue(bytes[4]) + digitValue(bytes[5]) + digitValue(bytes[6]);
  const additive = (digitSum + 64) & 0xff;       // 'standard' Gen 3 spec
  const altPlain = 0x7F;                          // simpler firmwares
  if (cs !== additive && cs !== altPlain && (cs < 0x30 || cs > 0x7F)) {
    return null;
  }

  const minutes = digitValue(bytes[1]);
  const seconds = digitValue(bytes[2]) * 10 + digitValue(bytes[3]);
  const millis  = digitValue(bytes[4]) * 100 + digitValue(bytes[5]) * 10 + digitValue(bytes[6]);

  // Sanity: seconds must be 0..59.
  if (seconds > 59) return null;

  const totalMs = minutes * 60_000 + seconds * 1_000 + millis;

  return {
    state: String.fromCharCode(bytes[0]) as StackmatStateByte,
    minutes,
    seconds,
    millis,
    totalMs,
  };
}
