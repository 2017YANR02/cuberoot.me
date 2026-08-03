/*
 * cross-trainer, Free Pair stage (cross solved + one F2L pair ready to insert).
 *
 *  • GATE 1: the goal set derived from Setup × Insert must be or18's 17 states for a fixed slot
 *    (68 = 4 × 17 once the cross may sit D-offset). That one number pins the whole closure: with
 *    Setup applied AFTER the insert instead of before, the same formulas yield 5, not 17.
 *  • GATE 2/3: the enumerated layers must equal or18's published Free Pair / Pseudo Free Pair
 *    histograms, which pins the coordinate as well as the goal set.
 *  • Every sampled state's depth is re-derived by an IDA* that only knows the CROSS distance to
 *    the goal set's cross projection (a strictly weaker, independent heuristic), so a bug in the
 *    cross+corner / cross+edge tables cannot hide behind itself.
 *  • PAIR_FULL_BFS=1 additionally enumerates all 72,990,720 states (~55 s per variant) and locks
 *    the complete histogram — that is where the published-prefix + total + max-depth agreement
 *    was verified; the routine run only re-checks the prefix.
 */

import { describe, expect, it } from 'vitest';
import { CROSS_STATES, crossNext } from '@/lib/cross-trainer/dist';
import { CORNER_STEP, EDGE_STEP, f2lSlots, skipRow, COLOR_FACE, type FaceIdx } from '@/lib/cross-trainer/model';
import { fillState } from '@/lib/cross-trainer/fill';
import {
  PAIR_HISTOGRAM, PAIR_STATES, PSEUDO_PAIR_HISTOGRAM,
  pairDistCapped, pairFrameData, pairGoals, pairInsertNames, pairPins,
  pairShallowHistogram, randomPairCoord, samplePairCoord, type PairCoord, type PairFrame,
} from '@/lib/cross-trainer/pair';

/** or18's published prefixes (the layers this file enumerates). */
const PUBLISHED_PAIR = [17, 255, 3102, 35217, 367070, 3184390];
const PUBLISHED_PSEUDO = [68, 816, 9256, 103681, 1012687, 7689281];
/**
 * Full histograms, measured by the exhaustive BFS below. They live in ./pair now (both this file
 * and /scramble/stats read them), so the prefix check here doubles as a check that the published
 * six entries really are the head of the shipped array.
 */
const FULL_PAIR = [...PAIR_HISTOGRAM];
const FULL_PSEUDO = [...PSEUDO_PAIR_HISTOGRAM];

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const pack = (c: number, co: number, e: number) => c * 576 + co * 24 + e;

/** Exact distance on the cross coordinate alone to the goal set's cross projection. */
function crossOnlyDist(goals: Int32Array): Uint8Array {
  const next = crossNext();
  const dist = new Uint8Array(CROSS_STATES).fill(255);
  let frontier: number[] = [];
  for (const g of goals) {
    const c = (g / 576) | 0;
    if (dist[c] === 255) { dist[c] = 0; frontier.push(c); }
  }
  for (let d = 0; frontier.length; d++) {
    const out: number[] = [];
    for (const idx of frontier) {
      const base = idx * 18;
      for (let m = 0; m < 18; m++) {
        const nb = next[base + m];
        if (dist[nb] === 255) { dist[nb] = d + 1; out.push(nb); }
      }
    }
    frontier = out;
  }
  return dist;
}

/** Independent optimal-length search: heuristic = cross distance only. */
function slowPairDist(frame: PairFrame, st: PairCoord, cap: number): number {
  const next = crossNext();
  const goals = pairGoals(frame);
  const goalSet = new Set<number>(goals);
  const cd = crossOnlyDist(goals);
  if (goalSet.has(pack(st.cross, st.corner, st.edge))) return 0;
  const rec = (c: number, co: number, e: number, depth: number, prev: number): boolean => {
    const skip = skipRow(prev);
    const base = c * 18;
    for (let m = 0; m < 18; m++) {
      if (skip[m]) continue;
      const nc = next[base + m], nco = CORNER_STEP[m][co], ne = EDGE_STEP[m][e];
      if (depth === 1) { if (goalSet.has(pack(nc, nco, ne))) return true; continue; }
      if (cd[nc] >= depth) continue;
      if (rec(nc, nco, ne, depth - 1, m)) return true;
    }
    return false;
  };
  for (let lim = Math.max(cd[st.cross], 1); lim <= cap; lim++) {
    if (rec(st.cross, st.corner, st.edge, lim, -1)) return lim;
  }
  return -1;
}

/** Exhaustive BFS over the packed coordinate — the full depth histogram. */
function fullHistogram(frame: PairFrame): number[] {
  const d = pairFrameData(frame);
  const next = crossNext();
  const N = CROSS_STATES * 576;
  const dist = new Uint8Array(N).fill(255);
  for (const g of d.goals) dist[g] = 0;
  const hist: number[] = [d.goals.length];
  for (let depth = 0; ; depth++) {
    let found = 0;
    for (let v = 0; v < N; v++) {
      if (dist[v] !== depth) continue;
      const e = v % 24, co = ((v - e) / 24) % 24, c = ((v - e) / 24 - co) / 24;
      const base = c * 18;
      for (let m = 0; m < 18; m++) {
        const nv = next[base + m] * 576 + CORNER_STEP[m][co] * 24 + EDGE_STEP[m][e];
        if (dist[nv] === 255) { dist[nv] = depth + 1; found++; }
      }
    }
    if (!found) return hist;
    hist.push(found);
  }
}

describe('cross-trainer / Free Pair', () => {
  const frame: PairFrame = { face: COLOR_FACE.Yellow, slot: 0 };
  const pseudoFrame: PairFrame = { ...frame, pseudo: true };

  it("derives or18's Setup × Insert formulas in the frame's own letters", () => {
    const slots = f2lSlots(COLOR_FACE.Yellow);
    const bl = slots.findIndex((s) => s.name === 'BL');
    // DEFINITIONS.md § Pair Analyzer, BL slot: NULL / L U L' / L U' L' / B' U B / B' U' B
    expect(new Set(pairInsertNames({ face: COLOR_FACE.Yellow, slot: bl }))).toEqual(
      new Set(['', "L U L'", "L U' L'", "B' U B", "B' U' B"]),
    );
    // the same rule, unchanged, produces the mirrored slot's formulas
    const fr = slots.findIndex((s) => s.name === 'FR');
    expect(new Set(pairInsertNames({ face: COLOR_FACE.Yellow, slot: fr }))).toEqual(
      new Set(['', "R U R'", "R U' R'", "F' U F", "F' U' F"]),
    );
  });

  it('GATE 1 / GATE 3: 17 goals per slot, 68 pseudo, on all 24 frames', () => {
    // all six cross colours × four slots — also proves the "lifting quarter turn" derivation is
    // total (it throws if a side face has neither), which is what makes the frame generic
    for (let face = 0 as FaceIdx; face < 6; face++) {
      for (let slot = 0; slot < 4; slot++) {
        expect(pairGoals({ face, slot }).length, `${face}/${slot}`).toBe(17);
        expect(pairGoals({ face, slot, pseudo: true }).length, `${face}/${slot} pseudo`).toBe(68);
      }
    }
  }, 120_000);

  it('GATE 1: every goal keeps the cross solved, and the inserted pair is one of them', () => {
    const d = pairFrameData(frame);
    // the insert conjugates lift a cross edge and put it back, so the whole product fixes the
    // cross — a goal with a broken cross would mean the closure escaped the stage definition
    for (const g of d.goals) expect((g / 576) | 0).toBe(d.crossGoal);
    expect(d.goalSet.has(pack(d.crossGoal, d.cornerPiece * 3, d.edgePiece * 2))).toBe(true);
    expect(new Set(d.goals).size).toBe(17);
  });

  it('GATE 2: shallow layers match the published Free Pair histogram', () => {
    const t0 = Date.now();
    pairFrameData(frame);
    const t1 = Date.now();
    expect(pairShallowHistogram(frame)).toEqual(PUBLISHED_PAIR);
    // eslint-disable-next-line no-console
    console.log(`[pair] heuristic tables ${t1 - t0} ms (0 = already cached), shallow BFS ${Date.now() - t1} ms`);
  }, 300_000);

  it('the histogram is the same for every frame (symmetry)', () => {
    expect(pairShallowHistogram({ face: COLOR_FACE.Green, slot: 2 })).toEqual(PUBLISHED_PAIR);
  }, 300_000);

  it('GATE 3: pseudo goal set is 4 × 17 and matches the published Pseudo Free Pair histogram', () => {
    expect(pairGoals(pseudoFrame).length).toBe(68);
    const t0 = Date.now();
    pairFrameData(pseudoFrame);
    const t1 = Date.now();
    expect(pairShallowHistogram(pseudoFrame)).toEqual(PUBLISHED_PSEUDO);
    // eslint-disable-next-line no-console
    console.log(`[pseudo pair] heuristic tables ${t1 - t0} ms, shallow BFS ${Date.now() - t1} ms`);
  }, 300_000);

  it('capped IDA* agrees with a cross-only-heuristic search', () => {
    const rng = lcg(4242);
    const d = pairFrameData(frame);
    for (let i = 0; i < 24; i++) {
      const st = randomPairCoord(rng);
      expect(pairDistCapped(d, st, 8), `#${i}`).toBe(slowPairDist(frame, st, 8));
    }
  }, 300_000);

  it('capped IDA* agrees with a cross-only-heuristic search (pseudo)', () => {
    const rng = lcg(555);
    const d = pairFrameData(pseudoFrame);
    for (let i = 0; i < 16; i++) {
      const st = randomPairCoord(rng);
      expect(pairDistCapped(d, st, 8), `#${i}`).toBe(slowPairDist(pseudoFrame, st, 8));
    }
  }, 300_000);

  it('samples land at the requested depth, enumerated and rejected alike', () => {
    const rng = lcg(99);
    const d = pairFrameData(frame);
    for (let target = 0; target <= 9; target++) {
      // depths 0..5 come out of the enumerated layers, 6..9 out of rejection
      const draws = target <= 5 ? 5 : 1;
      for (let k = 0; k < draws; k++) {
        const got = samplePairCoord(frame, target, target, rng, 2_000_000);
        expect(got, `depth ${target}`).not.toBeNull();
        expect(got!.depth, `depth ${target}`).toBe(target);
        // re-verify with the capped search, not the sampler's own bookkeeping
        expect(pairDistCapped(d, got!.coord, 9), `verify ${target}`).toBe(target);
      }
    }
  }, 300_000);

  it('pseudo samples land at the requested depth', () => {
    const rng = lcg(7);
    const d = pairFrameData(pseudoFrame);
    for (let target = 0; target <= 8; target++) {
      const got = samplePairCoord(pseudoFrame, target, target, rng, 2_000_000);
      expect(got, `depth ${target}`).not.toBeNull();
      expect(got!.depth, `depth ${target}`).toBe(target);
      expect(pairDistCapped(d, got!.coord, 8), `verify ${target}`).toBe(target);
    }
  }, 300_000);

  it('a window wider than the enumerated layers stays inside its bounds', () => {
    const rng = lcg(2024);
    const d = pairFrameData(frame);
    for (let i = 0; i < 30; i++) {
      const got = samplePairCoord(frame, 4, 7, rng)!;
      expect(got).not.toBeNull();
      expect(got.depth).toBeGreaterThanOrEqual(4);
      expect(got.depth).toBeLessThanOrEqual(7);
      expect(pairDistCapped(d, got.coord, 9)).toBe(got.depth);
    }
  }, 300_000);

  it('an unreachable window returns null instead of a wrong state', () => {
    expect(samplePairCoord(frame, 10, 12, lcg(1), 1000)).toBeNull();
    expect(samplePairCoord(pseudoFrame, 9, 9, lcg(1), 1000)).toBeNull();
  });

  it('coordinates fill into legal cubes with the pinned pieces intact', () => {
    const rng = lcg(31337);
    const d = pairFrameData(frame);
    for (let i = 0; i < 200; i++) {
      const got = samplePairCoord(frame, 0, 4, rng)!;
      const { edgePins, cornerPins } = pairPins(d, got.coord);
      const cube = fillState(edgePins, cornerPins, rng);
      for (const p of edgePins) { expect(cube.ep[p.slot]).toBe(p.piece); expect(cube.eo[p.slot]).toBe(p.ori); }
      for (const p of cornerPins) { expect(cube.cp[p.slot]).toBe(p.piece); expect(cube.co[p.slot]).toBe(p.ori); }
      expect(cube.eo.reduce((a, b) => a + b, 0) % 2).toBe(0);
      expect(cube.co.reduce((a, b) => a + b, 0) % 3).toBe(0);
      expect(new Set(cube.ep).size).toBe(12);
      expect(new Set(cube.cp).size).toBe(8);
    }
  }, 300_000);

  // ~55 s per variant — opt in with PAIR_FULL_BFS=1. This is the run that proved the totals and
  // the maxima the sampler caps on (PAIR_MAX_DEPTH 9, PSEUDO_PAIR_MAX_DEPTH 8).
  it.runIf(!!process.env.PAIR_FULL_BFS)('exhaustive BFS reproduces the whole histogram', () => {
    const pairHist = fullHistogram(frame);
    expect(pairHist).toEqual(FULL_PAIR);
    expect(pairHist.reduce((a, b) => a + b, 0)).toBe(PAIR_STATES);
    const pseudoHist = fullHistogram(pseudoFrame);
    expect(pseudoHist).toEqual(FULL_PSEUDO);
    expect(pseudoHist.reduce((a, b) => a + b, 0)).toBe(PAIR_STATES);
  }, 1_800_000);
});
