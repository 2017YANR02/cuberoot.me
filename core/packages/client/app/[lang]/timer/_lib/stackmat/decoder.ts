/**
 * Stackmat 1200-baud audio decoder — port of csTimer's decoder.
 *
 * Upstream: `tools/cstimer/js/cstimer.js`, the `stackmat` module (functions
 * `a`/`M`/`r` there). We took its algorithm rather than keeping our own
 * fixed-threshold one, because the two differ exactly where real hardware
 * bites:
 *
 *   1. AGC. The sample stream is normalised by a running power estimate
 *      (`s / sqrt(power)`) before anything looks at it, so a quiet mic input —
 *      cheap splitter cable, low system input gain, phone headset jack — still
 *      decodes. The old fixed 0.05 threshold simply saw silence.
 *   2. Polarity independence. We never assume "idle = high". The idle level is
 *      LEARNED: any run of >10 identical bits is idle by definition, and that
 *      value becomes the reference for start/stop bits and for bit polarity.
 *      Cables and sound cards invert the signal often enough that assuming a
 *      polarity means half of them never work.
 *   3. Edge-driven bit recovery. Bits are emitted from level transitions
 *      (with a g/6-sample delay line as the comparator) instead of sampling at
 *      fixed offsets after a falling edge, which tolerates sample-rate drift
 *      and the AC coupling of the audio input.
 *   4. 9- and 10-byte frames — see `./packet.ts`. Centisecond firmwares emit
 *      one digit fewer; the old parser mis-framed them into garbage times.
 *
 * Pure functions over Float32Array — no Web Audio dependency in this file.
 */

import { buildPacket, parsePacket, type StackmatPacket, type StackmatStateByte } from './packet';

/* ------------------------------------------------------------------ */
/*  Tuning constants (values are csTimer's)                            */
/* ------------------------------------------------------------------ */

/** Minimum swing, in normalised units, for a transition to count as an edge. */
const EDGE_DELTA = 0.7;
/** How far past the current level a sample must be before we believe it. */
const LEVEL_MARGIN = 0.2;
/** An edge closer than this fraction of a bit period is ringing, not data. */
const MIN_EDGE_FRACTION = 0.6;
/** A run of identical bits at least this long means the line is idle. */
const IDLE_RUN_BITS = 10;
/** A run this long means nothing is transmitting at all. */
const SILENT_RUN_BITS = 100;

export interface DecoderState {
  sampleRate: number;
  /** Samples per bit (= sampleRate / 1200). */
  samplesPerBit: number;

  /* --- analogue front end --- */
  /** Running mean of s², the AGC reference. */
  power: number;
  /** One-pole coefficient for the power / noise estimators. */
  agcRate: number;
  /**
   * Samples seen since the decoder was created. Used only to widen the AGC
   * coefficient during warm-up (see `feed`).
   */
  samplesSeen: number;
  /** Delay line (~1/6 bit) the edge detector compares against. */
  delay: Float64Array;
  delayIdx: number;
  /** Current logical level, 0 or 1 (meaning is relative to `idleLevel`). */
  level: 0 | 1;
  /**
   * False until `level` has been seeded from the actual line state. csTimer
   * starts at 0 unconditionally; if the line is sitting high at that moment,
   * its edge detector is looking for the wrong direction and stays deaf until
   * the first LOW->HIGH transition, so the first frame after connecting is
   * always lost (and, worse, the idle level is learned inverted in between).
   * We seed it from the first sample with real amplitude instead.
   */
  primed: boolean;
  /** Samples since the last emitted bit boundary. */
  sinceEdge: number;
  /** Estimated noise 0..1 — how far the signal sits from a clean square wave. */
  noise: number;
  /** Smoothed raw peak 0..1, for the VU meter. */
  vu: number;

  /* --- bit / frame assembly --- */
  /** Rolling 10-bit window: start bit, 8 data bits, stop bit. */
  frameBits: number[];
  /** Bytes decoded since the line was last idle. */
  chars: number[];
  /** Learned idle level (0 or 1) — the polarity reference. */
  idleLevel: number;
  /** Value of the previous bit, for run-length tracking. */
  lastBit: number;
  /** How many identical bits in a row we have seen. */
  runLength: number;

  /** Latest valid packet. */
  lastPacket: StackmatPacket | null;
  /** False once the line has been static long enough to call it dead. */
  signalPresent: boolean;
  /**
   * Optional tap on the recovered bit stream, for the debug panel and tests —
   * this is the layer where "the cable is plugged in but nothing decodes"
   * becomes diagnosable. Null in normal operation.
   */
  onBit: ((bit: number) => void) | null;
}

export function createDecoder(sampleRate: number): DecoderState {
  const samplesPerBit = sampleRate / 1200;
  const delayLen = Math.max(1, Math.ceil(samplesPerBit / 6));
  const delay = new Float64Array(delayLen);
  // NaN means "no history yet"; every comparison against it is false, which is
  // how csTimer's initially-empty array behaves.
  delay.fill(NaN);
  return {
    sampleRate,
    samplesPerBit,
    power: 1,
    agcRate: 0.001 / samplesPerBit,
    samplesSeen: 0,
    delay,
    delayIdx: 0,
    level: 0,
    primed: false,
    sinceEdge: 0,
    noise: 0,
    vu: 0,
    frameBits: [],
    chars: [],
    idleLevel: 0,
    lastBit: 0,
    runLength: 0,
    lastPacket: null,
    signalPresent: false,
    onBit: null,
  };
}

/** Push a normalised sample into the delay line, returning the value it evicts. */
function pushDelay(state: DecoderState, v: number): number {
  const out = state.delay[state.delayIdx];
  state.delay[state.delayIdx] = v;
  state.delayIdx = (state.delayIdx + 1) % state.delay.length;
  return out;
}

/**
 * Consume one recovered bit. Assembles bytes on a 10-bit frame window and
 * frames them into packets. Returns a packet when one completes.
 *
 * Framing rules (csTimer's): within the 10-bit window, bit 0 must differ from
 * the idle level (start bit) and bit 9 must equal it (stop bit); otherwise we
 * slide the window by one and try again. Data bits are LSB-first, and a bit
 * equal to the idle level is a 1.
 */
function pushBit(state: DecoderState, bit: number): StackmatPacket | null {
  state.onBit?.(bit);
  state.frameBits.push(bit);

  if (bit !== state.lastBit) {
    state.lastBit = bit;
    state.runLength = 1;
  } else {
    state.runLength++;
  }

  if (state.runLength > IDLE_RUN_BITS) {
    // Line is idle: this level IS the idle level. Drop partial frames.
    state.idleLevel = bit;
    state.frameBits = [];
    if (state.chars.length) state.chars = [];
    if (state.runLength > SILENT_RUN_BITS) state.signalPresent = false;
    return null;
  }

  if (state.frameBits.length < 10) return null;

  if (state.frameBits[0] === state.idleLevel || state.frameBits[9] !== state.idleLevel) {
    // Not aligned on a start/stop pair — slide one bit and wait for the next.
    state.frameBits.shift();
    return null;
  }

  let byte = 0;
  for (let i = 8; i > 0; i--) {
    byte = (byte << 1) | (state.frameBits[i] === state.idleLevel ? 1 : 0);
  }
  state.frameBits = [];
  state.chars.push(byte);

  // Try to close a frame at both legal lengths, newest bytes first. A 10-byte
  // firmware fails the 9-byte test (its byte -9 is a digit, not a state byte)
  // and completes one byte later, so the two windows never race.
  //
  // csTimer only tests when the buffer is exactly 9 or 10 long and relies on
  // the idle gap between frames to reset it. Testing the tail instead means a
  // single corrupted byte costs one frame rather than everything up to the
  // next idle stretch.
  for (const len of [10, 9]) {
    if (state.chars.length < len) continue;
    const pkt = parsePacket(state.chars.slice(state.chars.length - len));
    if (!pkt) continue;
    state.chars = [];
    state.lastPacket = pkt;
    state.signalPresent = true;
    return pkt;
  }
  if (state.chars.length > 12) state.chars = state.chars.slice(-12);
  return null;
}

/**
 * Feed one block of audio samples through the decoder. Updates `state` in
 * place and returns the most recent packet seen (null if none completed).
 */
export function feed(state: DecoderState, samples: Float32Array): StackmatPacket | null {
  let last: StackmatPacket | null = null;
  const g = state.samplesPerBit;
  const k0 = state.agcRate;

  let blockPeak = 0;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const mag = s < 0 ? -s : s;
    if (mag > blockPeak) blockPeak = mag;

    // AGC: normalise against the running RMS so absolute input gain drops out.
    //
    // csTimer uses a fixed coefficient, whose time constant is ~0.8 s — the
    // first second after connecting decodes nothing because `power` is still
    // sliding from its seed value. Widening the coefficient to 1/n while n is
    // small makes the estimate a true running mean from the very first sample
    // and converges to csTimer's behaviour once n passes the time constant.
    state.samplesSeen++;
    const k = Math.max(k0, 1 / state.samplesSeen);
    state.power = Math.max(1e-4, state.power + (s * s - state.power) * k);
    const v = s / Math.sqrt(state.power);

    const prev = pushDelay(state, v);

    // Seed the level (and hence the polarity the edge detector expects) from
    // the line itself, once the AGC has enough history for `v` to mean
    // anything. An idle Stackmat line holds a steady level, so one confident
    // sample is all it takes.
    if (!state.primed && state.samplesSeen > state.delay.length && Math.abs(v) > 0.5) {
      state.level = v > 0 ? 1 : 0;
      state.lastBit = state.level;
      state.idleLevel = state.level;
      state.primed = true;
    }

    const target = state.level ? 1 : -1;

    if ((prev - v) * target > EDGE_DELTA
        && Math.abs(v - target) - 1 > LEVEL_MARGIN
        && state.sinceEdge > MIN_EDGE_FRACTION * g) {
      // A transition: everything since the last one was `level`, so emit that
      // many bits before flipping.
      const n = Math.round(state.sinceEdge / g);
      for (let b = 0; b < n; b++) {
        const pkt = pushBit(state, state.level);
        if (pkt) last = pkt;
      }
      state.level = (state.level ^ 1) as 0 | 1;
      state.sinceEdge = 0;
    } else if (state.sinceEdge > 2 * g) {
      // No edge for over two bit periods — the line is holding a level.
      const pkt = pushBit(state, state.level);
      if (pkt) last = pkt;
      state.sinceEdge -= g;
    }
    state.sinceEdge++;

    // Noise: distance from an ideal square while data is moving; pinned to 1
    // once the line has been static long enough to be meaningless.
    if (state.runLength < IDLE_RUN_BITS) {
      const d = v - (state.level ? 1 : -1);
      state.noise = Math.max(1e-4, state.noise + (d * d - state.noise) * k);
    } else if (state.runLength > SILENT_RUN_BITS) {
      state.noise = 1;
    }
  }

  // VU meter (one-pole smoothing on the raw peak).
  state.vu = state.vu * 0.8 + blockPeak * 0.2;
  if (state.vu > 1) state.vu = 1;
  if (state.vu < 0) state.vu = 0;

  return last;
}

/* ------------------------------------------------------------------ */
/*  Synthesis helpers (tests)                                          */
/* ------------------------------------------------------------------ */

export interface SynthOptions {
  /** Peak amplitude of the square wave. Default 0.5. */
  amplitude?: number;
  /** Invert the signal, as an inverting cable / sound card would. */
  invert?: boolean;
  /** Uniform noise amplitude added to every sample. Default 0. */
  noise?: number;
  /**
   * Per-sample decay towards zero, modelling the AC coupling of a mic input
   * (a flat level sags instead of holding). 0 = ideal square wave.
   */
  dcDecay?: number;
  /** Idle bit periods emitted before and after the frame. Default 16 / 16. */
  leadIdle?: number;
  trailIdle?: number;
  /** Deterministic PRNG seed for `noise`. */
  seed?: number;
}

/** Bit sequence for one byte on the wire: start(0), 8 data LSB-first, stop(1). */
function byteToBits(byte: number): number[] {
  const bits = [0];
  for (let i = 0; i < 8; i++) bits.push((byte >> i) & 1);
  bits.push(1);
  return bits;
}

/**
 * Render a byte sequence as 1200-baud audio. Logical 1 = idle level = positive
 * (unless `invert`). The decoder learns the polarity either way.
 */
export function synthesizeBytes(
  bytes: readonly number[],
  sampleRate: number,
  opts: SynthOptions = {},
): Float32Array {
  const {
    amplitude = 0.5, invert = false, noise = 0, dcDecay = 0,
    leadIdle = 16, trailIdle = 16, seed = 1,
  } = opts;

  const T = sampleRate / 1200;
  const bits: number[] = [];
  for (let i = 0; i < leadIdle; i++) bits.push(1);
  for (const b of bytes) bits.push(...byteToBits(b));
  for (let i = 0; i < trailIdle; i++) bits.push(1);

  const total = Math.ceil(bits.length * T);
  const out = new Float32Array(total);

  // xorshift32 so tests are deterministic.
  let rng = seed >>> 0 || 1;
  const rand = () => {
    rng ^= rng << 13; rng >>>= 0;
    rng ^= rng >> 17;
    rng ^= rng << 5; rng >>>= 0;
    return rng / 0xffffffff - 0.5;
  };

  const sign = invert ? -1 : 1;
  let idx = 0;
  let held = 0;
  let prevBit = -1;
  for (const bit of bits) {
    const target = sign * (bit ? amplitude : -amplitude);
    if (bit !== prevBit) { held = target; prevBit = bit; }
    for (let i = 0; i < T && idx < total; i++) {
      if (dcDecay) held *= (1 - dcDecay);
      out[idx++] = (dcDecay ? held : target) + (noise ? rand() * noise * 2 : 0);
    }
  }
  return out.subarray(0, idx);
}

/** Render one complete Stackmat frame (state + time) as audio. */
export function synthesizePacket(
  state: StackmatStateByte,
  totalMs: number,
  sampleRate: number,
  opts: SynthOptions & { unit?: 1 | 10 } = {},
): Float32Array {
  const { unit = 1, ...rest } = opts;
  return synthesizeBytes(buildPacket(state, totalMs, unit), sampleRate, rest);
}
