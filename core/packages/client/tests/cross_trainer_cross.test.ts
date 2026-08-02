/*
 * cross-trainer, cross stage: the generated state really is N optimal moves from a solved cross.
 *
 * Two independent checks, deliberately not sharing a model with the generator:
 *   • the depth histogram of our own BFS must equal the published one (or18's `num_list`,
 *     also on or18.github.io/RubiksSolverDemo/documentation.html) — sums to 190,080, max 8;
 *   • a generated state → kociemba scramble → `lib/cross-solver` (a *different* edge model,
 *     itself verified against 40,000 WCA scrambles × 6 colours) must report the requested length.
 */

import { describe, expect, it } from 'vitest';
import { crossHistogram, CROSS_STATES } from '@/lib/cross-trainer/dist';
import { sampleCrossState, crossSubsetHistogram } from '@/lib/cross-trainer/sample';
import { COLOR_FACE, type CrossColorName, type FaceIdx } from '@/lib/cross-trainer/model';
import { crossLength, type CrossColor } from '@/lib/cross-solver';
import { validateCubie } from '@/lib/cube-facelet';
import { buildMoveTables } from '@/app/[lang]/timer/_lib/scramble/kociemba/movetables';
import { buildPruneTables } from '@/app/[lang]/timer/_lib/scramble/kociemba/prune';
import { scrambleFromState } from '@/app/[lang]/timer/_lib/scramble/kociemba/search';
import { formatMoves } from '@/app/[lang]/timer/_lib/scramble/kociemba/cube';

// or18's published cross depth histogram (depth 0..8).
const PUBLISHED = [1, 15, 158, 1394, 9809, 46381, 97254, 34966, 102];

const FACES: Array<[CrossColorName, FaceIdx]> = [
  ['White', COLOR_FACE.White], ['Yellow', COLOR_FACE.Yellow], ['Green', COLOR_FACE.Green],
  ['Blue', COLOR_FACE.Blue], ['Red', COLOR_FACE.Red], ['Orange', COLOR_FACE.Orange],
];

// deterministic RNG so a failure is reproducible
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

describe('cross-trainer / cross coordinate', () => {
  it('depth histogram matches the published one, for every colour', () => {
    for (const [, f] of FACES) {
      const hist = crossHistogram(f);
      expect(hist).toEqual(PUBLISHED);
      expect(hist.reduce((a, b) => a + b, 0)).toBe(CROSS_STATES);
    }
  });

  it('mean optimal cross is 1104756/190080 = 5.8121', () => {
    const hist = crossHistogram(3);
    expect(hist.reduce((s, n, d) => s + n * d, 0)).toBe(1104756);
    const mean = 1104756 / CROSS_STATES;
    expect(mean.toFixed(4)).toBe('5.8121');
  });
});

describe('cross-trainer / generated states', () => {
  const mt = buildMoveTables();
  const pt = buildPruneTables(mt);
  const rng = lcg(20260802);

  it('fixed colour: every generated scramble has exactly the requested cross length', () => {
    for (const [color, f] of FACES) {
      for (let d = 0; d <= 8; d++) {
        // 2 draws × 6 colours × 9 depths: the two-phase solve below dominates, and this test is
        // the suite's long pole, so the count buys coverage of every (colour, depth) twice.
        for (let n = 0; n < 2; n++) {
          const state = sampleCrossState({ faces: [f], lo: d, hi: d }, rng);
          expect(state, `${color} d=${d}`).not.toBeNull();
          expect(validateCubie(state!), `${color} d=${d} legality`).toBeNull();
          const scramble = formatMoves(scrambleFromState(state!, mt, pt, { timeoutMs: 2000 }));
          expect(crossLength(scramble, color as CrossColor), `${color} d=${d} #${n}`).toBe(d);
        }
      }
    }
  }, 600_000);

  it('best-of-subset: the minimum over the chosen colours lands in the window', () => {
    const subsets: FaceIdx[][] = [
      [COLOR_FACE.White, COLOR_FACE.Yellow],
      [COLOR_FACE.White, COLOR_FACE.Yellow, COLOR_FACE.Green, COLOR_FACE.Blue, COLOR_FACE.Red, COLOR_FACE.Orange],
    ];
    for (const faces of subsets) {
      const colors = faces.map((f) => FACES.find(([, x]) => x === f)![0]);
      for (const [lo, hi] of [[0, 0], [3, 3], [5, 5], [6, 7]] as const) {
        const state = sampleCrossState({ faces, lo, hi }, rng);
        expect(state, `${colors.join('/')} [${lo},${hi}]`).not.toBeNull();
        const scramble = formatMoves(scrambleFromState(state!, mt, pt, { timeoutMs: 2000 }));
        const best = Math.min(...colors.map((c) => crossLength(scramble, c as CrossColor)!));
        expect(best, `${colors.join('/')} [${lo},${hi}]`).toBeGreaterThanOrEqual(lo);
        expect(best).toBeLessThanOrEqual(hi);
      }
    }
  }, 120_000);

  it('fixed-colour draws spread over the layer (no constant output)', () => {
    const seen = new Set<string>();
    for (let n = 0; n < 40; n++) {
      const s = sampleCrossState({ faces: [COLOR_FACE.Yellow], lo: 5, hi: 5 }, rng)!;
      seen.add(s.ep.join(',') + '|' + s.eo.join(','));
    }
    expect(seen.size).toBe(40);
  });

  it('six-colour cross metric matches the WCA corpus distribution', () => {
    // stats/scramble/distribution.json → sets.wca.variants.std.data.cross.BGORWY, over 1,317,565
    // real scrambles. Our best-of-six sampler must reproduce it (same 口径 as the WCA difficulty
    // filter: the metric is the best cross among the chosen colours).
    const CORPUS = [37, 602, 6486, 55009, 321535, 729811, 203763, 322];
    const corpusN = CORPUS.reduce((a, b) => a + b, 0);
    const N = 40000;
    const hist = crossSubsetHistogram(
      [COLOR_FACE.White, COLOR_FACE.Yellow, COLOR_FACE.Green, COLOR_FACE.Blue, COLOR_FACE.Red, COLOR_FACE.Orange],
      N, lcg(7),
    );
    const mean = hist.reduce((s, c, d) => s + c * d, 0) / N;
    const corpusMean = CORPUS.reduce((s, c, d) => s + c * d, 0) / corpusN;
    expect(Math.abs(mean - corpusMean)).toBeLessThan(0.02);   // corpus mean 4.8109
    // and no six-colour cross ever needs 8 moves
    expect(hist[8] ?? 0).toBe(0);
    for (let d = 3; d <= 7; d++) {
      expect(Math.abs(hist[d] / N - CORPUS[d] / corpusN), `bin ${d}`).toBeLessThan(0.012);
    }
  }, 60_000);
});
