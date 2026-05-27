/**
 * Stackmat 1200-baud audio decoder.
 *
 * The Stackmat audio jack carries an inverted RS-232-like signal:
 *   - Idle line = HIGH (positive voltage, +ve audio sample after AC coupling).
 *   - Start bit = LOW transition (negative sample).
 *   - 8 data bits, LSB first, NRZ-encoded.
 *   - Stop bit = HIGH.
 *   - 1200 baud => ~36.75 samples / bit @ 44.1 kHz, ~40 / bit @ 48 kHz.
 *
 * Decoding strategy (sample-driven, no zero-crossing PLL needed):
 *   1. Convert each Float32 sample to a sign (+1 / -1) with hysteresis so we
 *      reject low-level noise when no Stackmat is plugged in.
 *   2. Scan for a falling edge (HIGH -> LOW). That's a start-bit candidate.
 *   3. Sample 9 more bits at offsets of (1.5, 2.5, ..., 9.5) * bitPeriod after
 *      the falling edge. The first 8 are data bits (LSB first); the 9th must
 *      be HIGH (stop bit) — otherwise we drop and resume scanning.
 *   4. Push the assembled byte. The byte reader is layered on top: it holds a
 *      rolling buffer, and whenever it sees a `\n` or `\r`, it tries to parse
 *      the preceding 8 bytes + terminator as a Stackmat packet.
 *
 * Pure functions over Float32Array — no Web Audio dependency in this file.
 */

import { parsePacket, type StackmatPacket } from './packet';

export interface DecoderState {
  sampleRate: number;
  /** Samples per bit (= sampleRate / 1200). */
  bitPeriod: number;
  /** Sign of the previous sample (+1 / -1), used for edge detection. */
  prevSign: number;
  /** Samples consumed since the last detected falling edge, or -1 if not in
   *  the middle of decoding a byte. */
  bitsConsumed: number;
  /** Distance (samples) into the current byte; -1 = waiting for falling edge. */
  sampleInByte: number;
  /** Bits assembled so far for the current byte (LSB first). */
  currentByte: number;
  /** Number of data bits collected in current byte (0..8). */
  bitIndex: number;
  /** Rolling byte buffer used to scan for terminators. */
  byteBuffer: number[];
  /** Latest valid packet (caller polls this). */
  lastPacket: StackmatPacket | null;
  /** Running peak signal magnitude (for VU meter). */
  peak: number;
  /** Smoothed signal level 0..1 (for VU meter). */
  level: number;
}

export function createDecoder(sampleRate: number): DecoderState {
  return {
    sampleRate,
    bitPeriod: sampleRate / 1200,
    prevSign: 1,
    bitsConsumed: 0,
    sampleInByte: -1,
    currentByte: 0,
    bitIndex: 0,
    byteBuffer: [],
    lastPacket: null,
    peak: 0,
    level: 0,
  };
}

// Hysteresis thresholds for the sign converter. Below LOW_THRESHOLD in
// magnitude we hold the previous sign, so noise floors don't generate fake
// edges.
const HIGH_THRESHOLD = 0.05;
const LOW_THRESHOLD = 0.02;

function signOf(sample: number, prev: number): number {
  if (sample > HIGH_THRESHOLD) return 1;
  if (sample < -HIGH_THRESHOLD) return -1;
  if (sample > LOW_THRESHOLD) return 1;
  if (sample < -LOW_THRESHOLD) return -1;
  return prev;
}

/** Cap the byte buffer; we only ever care about the most recent ~32 bytes. */
const MAX_BUFFER = 32;

/** Try to parse a packet ending at the most recent terminator in byteBuffer. */
function tryExtractPacket(state: DecoderState): StackmatPacket | null {
  const buf = state.byteBuffer;
  // Find most-recent terminator.
  for (let i = buf.length - 1; i >= 0; i--) {
    if (buf[i] === 0x0A || buf[i] === 0x0D) {
      if (i < 8) return null;          // not enough preceding bytes
      const start = i - 8;
      const slice = new Uint8Array(buf.slice(start, i + 1));
      const pkt = parsePacket(slice);
      if (pkt) {
        // Drop bytes up to and including this terminator so we don't
        // re-process them.
        state.byteBuffer = buf.slice(i + 1);
        return pkt;
      }
      // Bad framing for this terminator — drop just it and keep scanning
      // (subsequent feeds may align).
      state.byteBuffer = buf.slice(i + 1);
      return null;
    }
  }
  // Buffer never gets too big.
  if (buf.length > MAX_BUFFER) state.byteBuffer = buf.slice(-MAX_BUFFER);
  return null;
}

function pushByte(state: DecoderState, byte: number) {
  state.byteBuffer.push(byte);
  const pkt = tryExtractPacket(state);
  if (pkt) state.lastPacket = pkt;
}

/**
 * Feed one block of audio samples through the decoder. Updates `state` in place.
 * Returns the most recent packet seen (null if no new packet).
 *
 * Algorithm:
 *   - When sampleInByte == -1, we're hunting for a falling edge.
 *   - When sampleInByte >= 0, we're inside a byte; we sample bits at indices
 *     1.5, 2.5, ... 9.5 * bitPeriod (data bits 0..7 then stop bit).
 */
export function feed(state: DecoderState, samples: Float32Array): StackmatPacket | null {
  let lastNew: StackmatPacket | null = null;
  const T = state.bitPeriod;

  // VU meter: peak across this buffer, smoothed.
  let blockPeak = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const a = s < 0 ? -s : s;
    if (a > blockPeak) blockPeak = a;

    const sgn = signOf(s, state.prevSign);

    if (state.sampleInByte === -1) {
      // Hunting for falling edge HIGH -> LOW.
      if (state.prevSign === 1 && sgn === -1) {
        // Edge happened between previous sample and this one. Lock the
        // start bit at "0 samples after the edge" = this sample.
        state.sampleInByte = 0;
        state.currentByte = 0;
        state.bitIndex = 0;
      }
    } else {
      state.sampleInByte += 1;
      // Sample bits at positions 1.5, 2.5, ..., 9.5 bit-periods after the
      // falling edge.
      const bitTarget = (state.bitIndex + 1.5) * T;
      if (state.sampleInByte >= bitTarget) {
        if (state.bitIndex < 8) {
          // Data bit: HIGH (sgn==1) = 1, LOW (sgn==-1) = 0.
          const bit = sgn === 1 ? 1 : 0;
          state.currentByte |= (bit << state.bitIndex);
          state.bitIndex += 1;
        } else {
          // Stop bit. Must be HIGH; otherwise drop the byte.
          if (sgn === 1) {
            pushByte(state, state.currentByte & 0xff);
            if (state.lastPacket && state.lastPacket !== lastNew) {
              lastNew = state.lastPacket;
            }
          }
          // Either way, return to hunt mode.
          state.sampleInByte = -1;
          state.currentByte = 0;
          state.bitIndex = 0;
        }
      }
    }
    state.prevSign = sgn;
  }

  // Update VU meter (one-pole smoothing).
  state.peak = blockPeak;
  state.level = state.level * 0.8 + blockPeak * 0.2;
  if (state.level > 1) state.level = 1;
  if (state.level < 0) state.level = 0;

  return lastNew;
}

/**
 * Convenience: synthesize an audio buffer for a single byte at the given
 * sample rate, suitable for tests. Idle-high logic:
 *   - Pre-roll: high
 *   - Start bit: low (1 bit period)
 *   - Data bits LSB first: high=1, low=0 (8 bit periods)
 *   - Stop bit: high (1 bit period)
 *   - Post-roll: high
 */
export function synthesizeByte(byte: number, sampleRate: number,
                               preroll = 0, postroll = 0): Float32Array {
  const T = sampleRate / 1200;
  const total = Math.ceil(preroll + 10 * T + postroll);
  const out = new Float32Array(total);
  const amp = 0.5;
  let idx = 0;
  for (let i = 0; i < preroll; i++) out[idx++] = amp;
  // Start bit (low).
  for (let i = 0; i < T; i++) out[idx++] = -amp;
  // 8 data bits, LSB first.
  for (let b = 0; b < 8; b++) {
    const bit = (byte >> b) & 1;
    const v = bit ? amp : -amp;
    for (let i = 0; i < T; i++) out[idx++] = v;
  }
  // Stop bit (high).
  for (let i = 0; i < T; i++) out[idx++] = amp;
  while (idx < total) out[idx++] = amp;
  return out.subarray(0, idx);
}

/** Synthesize a full 9-byte packet (digits + checksum) at sampleRate. */
export function synthesizePacket(bytes: number[], sampleRate: number): Float32Array {
  const T = sampleRate / 1200;
  const buffers = bytes.map(b => synthesizeByte(b, sampleRate));
  const totalLen = buffers.reduce((a, b) => a + b.length, 0) + Math.ceil(2 * T);
  const out = new Float32Array(totalLen);
  // Preroll 2 bit periods of high.
  let idx = 0;
  for (let i = 0; i < 2 * T; i++) out[idx++] = 0.5;
  for (const buf of buffers) {
    out.set(buf, idx);
    idx += buf.length;
  }
  return out.subarray(0, idx);
}
