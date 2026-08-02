/*
 * A multi-frame draw over a RANGE must follow the true conditional distribution.
 *
 * This is the regression guard for the subtlest bug the trainer has had: engine B (the
 * conditional draw that makes rare difficulties reachable at all) is exact only for ONE depth,
 * so an earlier version that cycled the depths inside the window silently reweighted it —
 * "six colours, 4–6 moves" came back 4 moves 84% of the time against a true 26%, and "0–8 moves"
 * handed out an already-solved cross essentially every draw. Nothing else in the suite noticed:
 * every scramble was a legitimate member of the window, just not with the right frequency.
 *
 * The oracle is `trainerMetric` — the metric's own Monte-Carlo histogram over uniform cubes,
 * which shares no code with the samplers. The threshold is deliberately loose (χ² well past
 * p = 1e-6): this test exists to catch a broken sampler, not to police sampling noise.
 */

import { describe, expect, it } from 'vitest';
import { drawTrainerState, trainerMetric, type TrainerSpec } from '@/lib/cross-trainer';

interface Case { spec: TrainerSpec; draws: number; chi2Max: number }

const CASES: Case[] = [
  // Six colours over the default band: the cell the old engine got wrong by 40σ.
  { spec: { variant: 'std', stage: 'cross', colors: 'BGORWY', slot: 0, lo: 4, hi: 6 }, draws: 1500, chi2Max: 30 },
  // A window spanning the whole stage, including the rare ends.
  { spec: { variant: 'std', stage: 'cross', colors: 'WY', slot: 0, lo: 3, hi: 7 }, draws: 1500, chi2Max: 40 },
  // Slotted stage, "best slot" — different frame machinery, same contract.
  { spec: { variant: 'pseudo', stage: 'pseudo_cross', colors: 'BGORWY', slot: 0, lo: 2, hi: 5 }, draws: 1500, chi2Max: 35 },
];

/** Truth: P(metric = d | metric ∈ [lo,hi]) straight off the metric, sampler untouched. */
function expected(spec: TrainerSpec, draws: number): number[] {
  const hist = trainerMetric({ ...spec, lo: 0, hi: 99 }, 200_000);
  const out: number[] = [];
  let total = 0;
  for (let d = spec.lo; d <= spec.hi; d++) total += hist[d] ?? 0;
  for (let d = spec.lo; d <= spec.hi; d++) out.push(((hist[d] ?? 0) / total) * draws);
  return out;
}

describe('cross-trainer / window distribution', () => {
  for (const c of CASES) {
    const { spec } = c;
    const name = `${spec.variant}/${spec.stage} ${spec.colors} [${spec.lo},${spec.hi}]`;
    it(`${name} matches the true conditional`, () => {
      const exp = expected(spec, c.draws);
      const got = new Array<number>(spec.hi - spec.lo + 1).fill(0);
      for (let i = 0; i < c.draws; i++) {
        const r = drawTrainerState(spec, Math.random, 3000);
        expect(r.ok, `${name} draw ${i}`).toBe(true);
        if (r.ok) {
          expect(r.depth, `${name} depth in window`).toBeGreaterThanOrEqual(spec.lo);
          expect(r.depth).toBeLessThanOrEqual(spec.hi);
          got[r.depth - spec.lo]++;
        }
      }
      let chi2 = 0;
      for (let i = 0; i < exp.length; i++) {
        // Bins the metric itself almost never visits carry no information — skip rather than
        // let a 0.4-expected bin dominate the statistic.
        if (exp[i] < 5) continue;
        chi2 += ((got[i] - exp[i]) ** 2) / exp[i];
      }
      expect(chi2, `${name} chi2 (got ${got.join('/')} exp ${exp.map((x) => x.toFixed(1)).join('/')})`)
        .toBeLessThan(c.chi2Max);
    }, 300_000);
  }
});
