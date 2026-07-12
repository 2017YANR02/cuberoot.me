/*
 * pyram-metric — pyraminx (no-tips) move-count metrics + random scramble generation for the timer's
 * "按步数生成 / generate by move count" mode, mirroring lib/cube222-metric for 2×2.
 *
 * Reuses the shipped pyraminx solver (../solver/pyra), so the numbers match stats/scramble/pyram_essential.json
 * exactly (that data was produced by the same cstimer-derived V/solve logic):
 *   'v'    V   = V-first method's V step = min over the 4 face frames of solvePyraV, 0..7
 *   'cube' 魔方 = full-solve optimal length in HTM, tips excluded (body only), 0..11
 *
 * GENERATION: reuse scramblePyra (30-move mix → optimal solve → inverse = near-uniform random-state scramble),
 * evaluate the chosen metric, accept iff in [lo,hi]. Tips are cosmetic and ignored by both metrics (the solver
 * strips them), so a generated scramble's random tips never affect V/H.
 */

import { solvePyra, solvePyraV } from '../solver/pyra';
import { scramblePyra } from './others';

export type PyramMetric = 'v' | 'cube';
export const PYRAM_METRIC_RANGE: Record<PyramMetric, [number, number]> = {
  v: [0, 7],
  cube: [0, 11],
};

/** Body-only (no-tips) HTM full-solve length of a pyraminx scramble string. */
function cubeDist(scramble: string): number {
  return solvePyra(scramble).moves.filter((m) => /^[RULB]/.test(m)).length;
}

/** V-first V step: the shortest V-solve across the 4 face frames (each already min over its 3 rotations). */
function vDist(scramble: string): number {
  const per = solvePyraV(scramble);
  let best = Infinity;
  for (const f of per) best = Math.min(best, f.moves.length);
  return Number.isFinite(best) ? best : 0;
}

export function pyramMetricOf(scramble: string, metric: PyramMetric): number {
  return metric === 'v' ? vDist(scramble) : cubeDist(scramble);
}

/**
 * Generate a WCA-style pyraminx scramble whose chosen metric value lies in [lo, hi], sampled from the
 * near-uniform random-state generator (rejection sampling). Returns the nearest-in-range candidate as a
 * graceful fallback if none is found within `maxTries` — never throws, never blocks indefinitely.
 */
export function generatePyramByMetric(
  metric: PyramMetric,
  lo: number,
  hi: number,
  rng: () => number,
  maxTries = 4000,
): string {
  let best: { scr: string; d: number } | null = null;
  for (let t = 0; t < maxTries; t++) {
    const scr = scramblePyra(rng);
    const d = pyramMetricOf(scr, metric);
    if (d >= lo && d <= hi) return scr;
    const dist = d < lo ? lo - d : d - hi;
    if (!best || dist < best.d) best = { scr, d: dist };
  }
  return best ? best.scr : scramblePyra(rng);
}
