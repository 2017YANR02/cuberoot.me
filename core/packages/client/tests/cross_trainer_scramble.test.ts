/*
 * cross-trainer → scramble text: the last link of the timer's random-difficulty source.
 *
 * The generator picks a STATE; the timer needs notation. lib/m2p-scramble asks min2phase for
 * the inverse solution, which is only "the scramble that builds this state" if two conventions
 * line up: cube-facelet's URFDLB piece order must be min2phase's, and INVERSE_SOLUTION must
 * mean what we think. Both are checked here against min2phase itself — `fromScramble` applies
 * the notation to a solved cube, so the round trip has to come back to the same 54 chars.
 *
 * Then the difficulty is re-measured from the notation with lib/cross-solver (a different edge
 * model, verified separately against 40,000 WCA scrambles), so a wrong state → wrong scramble
 * cannot pass by agreeing with itself.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import init, { Min2Phase } from '@/wasm/m2p/m2p_wasm';
import { cubieToFacelet, validateCubie } from '@/lib/cube-facelet';
import { sampleTrainerState, trainerCaps, trainerStagesOf, trainerVariants, letterOfFace } from '@/lib/cross-trainer';
import { COLOR_FACE, FACE_COLOR, type FaceIdx } from '@/lib/cross-trainer/model';
import { crossLength, type CrossColor } from '@/lib/cross-solver';
import { perfScale } from './_perf_scale';

const INVERSE_SOLUTION = 0x2;
let m2p: Min2Phase;

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Exactly what lib/m2p-scramble's `m2pScrambleForFacelets` does. */
const scrambleFor = (facelets: string): string =>
  m2p.solveEx(facelets, 21, 100_000, 0, INVERSE_SOLUTION).trim();

beforeAll(async () => {
  const wasmPath = fileURLToPath(new URL('../wasm/m2p/m2p_wasm_bg.wasm', import.meta.url));
  await init({ module_or_path: await WebAssembly.compile(readFileSync(wasmPath)) });
  m2p = new Min2Phase();
}, 60_000);

describe('cross-trainer / scramble text', () => {
  it('the scramble reproduces the generated state exactly', () => {
    const rng = lcg(20260802);
    for (const variant of trainerVariants()) {
      for (const stage of trainerStagesOf(variant)) {
        const caps = trainerCaps(variant, stage)!;
        const [lo, hi] = caps.band;
        for (let n = 0; n < 3; n++) {
          const got = sampleTrainerState({ variant, stage, colors: 'W', slot: 0, lo, hi }, rng);
          expect(got, `${variant}/${stage}`).not.toBeNull();
          expect(validateCubie(got!.state), `${variant}/${stage} legality`).toBeNull();
          const facelets = cubieToFacelet(got!.state);
          const scramble = scrambleFor(facelets);
          expect(scramble.length, `${variant}/${stage} #${n}`).toBeGreaterThan(0);
          expect(m2p.fromScramble(scramble), `${variant}/${stage} #${n}`).toBe(facelets);
        }
      }
    }
  // This exact all-variant oracle is ~30s alone, but can exceed two minutes
  // while the full suite builds the other cross/xcross tables in parallel.
  }, 240_000);

  it('cross: the notation really has the requested cross length, per colour', () => {
    const rng = lcg(4242);
    const faces: FaceIdx[] = [COLOR_FACE.White, COLOR_FACE.Yellow, COLOR_FACE.Green, COLOR_FACE.Blue, COLOR_FACE.Red, COLOR_FACE.Orange];
    for (const f of faces) {
      for (const d of [0, 3, 5, 7, 8]) {
        const got = sampleTrainerState(
          { variant: 'std', stage: 'cross', colors: letterOfFace(f), slot: 'best', lo: d, hi: d }, rng,
        );
        expect(got, `${FACE_COLOR[f]} d=${d}`).not.toBeNull();
        const scramble = scrambleFor(cubieToFacelet(got!.state));
        expect(crossLength(scramble, FACE_COLOR[f] as CrossColor), `${FACE_COLOR[f]} d=${d}`).toBe(d);
      }
    }
  }, 120_000);

  it('[perf] the whole pipeline, per scramble', () => {
    // What the timer pays per scramble once a stage's tables exist: sample the state, then let
    // min2phase turn it into notation. The vendored or18 trainers pay ~18 ms (cross) / 13–24 ms
    // (xxcross) per scramble and rebuild their tables per page; ours must stay under that.
    const rng = lcg(11);
    const cases: Array<[string, string, string, number | 'best', number, number]> = [
      ['std', 'cross', 'BGORWY', 'best', 5, 6],
      ['std', 'xcross', 'W', 0, 7, 8],
      ['std', 'xxcross', 'W', 0, 9, 10],
      ['eo', 'eo_cross', 'W', 'best', 7, 8],
      ['pair', 'cross_pair', 'W', 0, 6, 7],
      ['pair', 'xcross_pair', 'W', 0, 7, 8],
      ['pseudo', 'pseudo_xcross', 'W', 0, 7, 8],
    ];
    const scale = perfScale();
    for (const [variant, stage, colors, slot, lo, hi] of cases) {
      sampleTrainerState({ variant, stage, colors, slot, lo, hi }, rng); // warm the tables
      const N = 20;
      let sampleMs = 0, solveMs = 0;
      for (let i = 0; i < N; i++) {
        const t0 = Date.now();
        const got = sampleTrainerState({ variant, stage, colors, slot, lo, hi }, rng)!;
        const t1 = Date.now();
        scrambleFor(cubieToFacelet(got.state));
        solveMs += Date.now() - t1;
        sampleMs += t1 - t0;
      }
      // eslint-disable-next-line no-console
      console.log(`[perf] ${variant}/${stage} ${colors}/${slot}: sample ${(sampleMs / N).toFixed(1)} ms + m2p ${(solveMs / N).toFixed(1)} ms (scale ${scale.toFixed(1)})`);
      expect((sampleMs + solveMs) / N, `${variant}/${stage}`).toBeLessThan(13 * scale);
    }
  }, 300_000);

  it('cross: colour-neutral notation is that many moves for the BEST colour', () => {
    const rng = lcg(99);
    for (const [lo, hi] of [[3, 3], [5, 5], [6, 6]] as const) {
      const got = sampleTrainerState(
        { variant: 'std', stage: 'cross', colors: 'BGORWY', slot: 'best', lo, hi }, rng,
      );
      expect(got).not.toBeNull();
      const scramble = scrambleFor(cubieToFacelet(got!.state));
      const best = Math.min(...FACE_COLOR.map((c) => crossLength(scramble, c as CrossColor) ?? 99));
      expect(best, `[${lo},${hi}]`).toBe(got!.depth);
      expect(best).toBeGreaterThanOrEqual(lo);
      expect(best).toBeLessThanOrEqual(hi);
    }
  }, 120_000);
});
