/**
 * Stackmat mic decoder — signal-level regression tests.
 *
 * The decoder is a port of csTimer's (see `_lib/stackmat/decoder.ts`). These
 * tests feed it synthesised 1200-baud audio across the conditions real setups
 * actually present: both polarities, both sample rates, a very quiet input, a
 * noisy one, and the DC sag of an AC-coupled mic jack.
 */

import { describe, it, expect } from 'vitest';
import {
  createDecoder,
  feed,
  synthesizeBytes,
  synthesizePacket,
  type SynthOptions,
} from '@/app/[lang]/timer/_lib/stackmat/decoder';
import { buildPacket, parsePacket } from '@/app/[lang]/timer/_lib/stackmat/packet';
import type { StackmatPacket, StackmatStateByte } from '@/app/[lang]/timer/_lib/stackmat/packet';

/** Feed a signal in 1024-sample blocks, as the ScriptProcessor does. */
function decodeAll(samples: Float32Array, sampleRate: number): StackmatPacket[] {
  const dec = createDecoder(sampleRate);
  const out: StackmatPacket[] = [];
  for (let i = 0; i < samples.length; i += 1024) {
    const pkt = feed(dec, samples.subarray(i, Math.min(i + 1024, samples.length)));
    if (pkt) out.push(pkt);
  }
  return out;
}

function decodeOne(
  state: StackmatStateByte,
  totalMs: number,
  sampleRate: number,
  opts: SynthOptions & { unit?: 1 | 10 } = {},
): StackmatPacket | null {
  const audio = synthesizePacket(state, totalMs, sampleRate, opts);
  return decodeAll(audio, sampleRate)[0] ?? null;
}

describe('stackmat packet parsing', () => {
  it('parses a 10-byte (millisecond) frame', () => {
    const pkt = parsePacket(buildPacket('S', 12_345, 1));
    expect(pkt).toEqual({
      state: 'S', minutes: 0, seconds: 12, millis: 345, totalMs: 12_345, unit: 1,
    });
  });

  it('parses a 9-byte (centisecond) frame and pads the last digit', () => {
    const pkt = parsePacket(buildPacket(' ', 12_340, 10));
    expect(pkt).toEqual({
      state: ' ', minutes: 0, seconds: 12, millis: 340, totalMs: 12_340, unit: 10,
    });
  });

  it('carries minutes', () => {
    expect(parsePacket(buildPacket('S', 125_670, 1))?.totalMs).toBe(125_670);
  });

  it('rejects a bad checksum', () => {
    const bytes = buildPacket('S', 12_345, 1);
    bytes[7] = (bytes[7] + 1) & 0xff;
    expect(parsePacket(bytes)).toBeNull();
  });

  it('rejects an unknown state byte', () => {
    const bytes = buildPacket('S', 12_345, 1);
    bytes[0] = 'X'.charCodeAt(0);
    expect(parsePacket(bytes)).toBeNull();
  });

  it('rejects wrong-length frames', () => {
    expect(parsePacket(buildPacket('S', 1_000, 1).slice(0, 8))).toBeNull();
  });
});

describe('stackmat decoder — clean signal', () => {
  for (const rate of [44_100, 48_000]) {
    it(`decodes a running frame at ${rate} Hz`, () => {
      const pkt = decodeOne('S', 12_345, rate);
      expect(pkt).not.toBeNull();
      expect(pkt?.state).toBe('S');
      expect(pkt?.totalMs).toBe(12_345);
    });
  }

  it('decodes a centisecond (9-byte) firmware frame', () => {
    const pkt = decodeOne(' ', 9_870, 44_100, { unit: 10 });
    expect(pkt?.totalMs).toBe(9_870);
    expect(pkt?.unit).toBe(10);
  });

  it('decodes every state byte', () => {
    for (const st of [' ', 'I', 'A', 'L', 'R', 'C', 'S'] as StackmatStateByte[]) {
      expect(decodeOne(st, 3_210, 44_100)?.state).toBe(st);
    }
  });

  it('decodes a stream of consecutive frames', () => {
    const rate = 44_100;
    const chunks: Float32Array[] = [];
    const times = [0, 1_230, 2_460, 3_690, 4_920];
    for (const t of times) {
      chunks.push(synthesizePacket('S', t, rate, { leadIdle: 24, trailIdle: 24 }));
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const audio = new Float32Array(total);
    let at = 0;
    for (const c of chunks) { audio.set(c, at); at += c.length; }

    const got = decodeAll(audio, rate);
    expect(got.map(p => p.totalMs)).toEqual(times);
  });
});

describe('stackmat decoder — hostile signal', () => {
  it('decodes an inverted signal (inverting cable / sound card)', () => {
    const pkt = decodeOne('S', 12_345, 44_100, { invert: true });
    expect(pkt?.totalMs).toBe(12_345);
    expect(pkt?.state).toBe('S');
  });

  it('decodes a quiet input (amplitude 0.02)', () => {
    // The previous fixed-threshold decoder needed >0.05 and saw silence here.
    const pkt = decodeOne('S', 12_345, 44_100, { amplitude: 0.02 });
    expect(pkt?.totalMs).toBe(12_345);
  });

  it('stays silent below the noise gate (RMS < 0.01), rather than inventing packets', () => {
    // The AGC floor is deliberate: below it the "signal" is the room, and
    // normalising it would manufacture bits out of noise.
    expect(decodeOne('S', 12_345, 44_100, { amplitude: 0.002 })).toBeNull();
  });

  it('decodes a loud/clipped input (amplitude 1.0)', () => {
    expect(decodeOne('S', 12_345, 44_100, { amplitude: 1 })?.totalMs).toBe(12_345);
  });

  it('decodes through additive noise', () => {
    const pkt = decodeOne('S', 12_345, 44_100, { amplitude: 0.5, noise: 0.06 });
    expect(pkt?.totalMs).toBe(12_345);
  });

  it('decodes through the DC sag of an AC-coupled mic input', () => {
    const pkt = decodeOne('S', 12_345, 44_100, { dcDecay: 0.0004 });
    expect(pkt?.totalMs).toBe(12_345);
  });

  it('reports no signal on silence and never invents a packet', () => {
    const rate = 44_100;
    const silence = new Float32Array(rate); // 1 s
    for (let i = 0; i < silence.length; i++) silence[i] = (i % 7) * 1e-6;
    const dec = createDecoder(rate);
    for (let i = 0; i < silence.length; i += 1024) {
      expect(feed(dec, silence.subarray(i, i + 1024))).toBeNull();
    }
    expect(dec.signalPresent).toBe(false);
    expect(dec.lastPacket).toBeNull();
  });

  it('drops a corrupted frame but recovers on the next one', () => {
    const rate = 44_100;
    const bad = buildPacket('S', 12_345, 1);
    bad[7] = (bad[7] + 1) & 0xff;                       // break the checksum
    const audio = concat([
      synthesizeBytes(bad, rate, { leadIdle: 24, trailIdle: 24 }),
      synthesizePacket('S', 23_456, rate, { leadIdle: 24, trailIdle: 24 }),
    ]);
    const got = decodeAll(audio, rate);
    expect(got.map(p => p.totalMs)).toEqual([23_456]);
  });
});

function concat(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
