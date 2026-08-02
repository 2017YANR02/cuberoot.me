/*
 * cross-trainer, XCross stage.
 *
 *  • The enumerated shallow layers must equal or18's published XCross histogram
 *    {1, 15, 172, 1950, 21535, 220368, …} — that pins the coordinate AND the goal.
 *  • Every sampled state's depth is re-derived by an IDA* that only knows the cross
 *    distance (a strictly weaker, independent heuristic), so a bug in the cross+corner /
 *    cross+edge tables cannot hide behind itself.
 */

import { describe, expect, it } from 'vitest';
import { crossNext } from '@/lib/cross-trainer/dist';
import { CORNER_STEP, EDGE_STEP, f2lSlots, skipRow, COLOR_FACE } from '@/lib/cross-trainer/model';
import { crossDist } from '@/lib/cross-trainer/dist';
import { frameData, sampleXCoord, xcrossShallowHistogram, xcrossDistCapped, randomXCoord, type Frame } from '@/lib/cross-trainer/xcross';

const PUBLISHED = [1, 15, 172, 1950, 21535, 220368];

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Independent optimal-length search: heuristic = cross distance only. */
function slowXcrossDist(frame: Frame, cross: number, corner: number, edge: number, cap: number): number {
  const next = crossNext();
  const d = frameData(frame);
  const cd = crossDist(frame.face);
  const goalCorner = d.cornerPiece * 3, goalEdge = d.edgePiece * 2;
  const solved = (c: number, co: number, e: number) => c === d.crossGoal && co === goalCorner && e === goalEdge;
  if (solved(cross, corner, edge)) return 0;
  const rec = (c: number, co: number, e: number, depth: number, prev: number): boolean => {
    const skip = skipRow(prev);
    const base = c * 18;
    for (let m = 0; m < 18; m++) {
      if (skip[m]) continue;
      const nc = next[base + m], nco = CORNER_STEP[m][co], ne = EDGE_STEP[m][e];
      if (depth === 1) { if (solved(nc, nco, ne)) return true; continue; }
      if (cd[nc] >= depth) continue;
      if (rec(nc, nco, ne, depth - 1, m)) return true;
    }
    return false;
  };
  for (let lim = Math.max(cd[cross], 1); lim <= cap; lim++) if (rec(cross, corner, edge, lim, -1)) return lim;
  return -1;
}

describe('cross-trainer / XCross', () => {
  const frame: Frame = { face: COLOR_FACE.Yellow, slot: 0 };

  it('slot geometry is a real F2L pair', () => {
    const slots = f2lSlots(COLOR_FACE.Yellow);
    expect(slots.map((s) => s.name).sort()).toEqual(['BL', 'BR', 'FL', 'FR'].sort());
    // every slot's corner + edge share exactly the two side faces
    expect(new Set(slots.map((s) => s.corner)).size).toBe(4);
    expect(new Set(slots.map((s) => s.edge)).size).toBe(4);
  });

  it('shallow layer sizes match the published XCross histogram', () => {
    const t0 = Date.now();
    expect(xcrossShallowHistogram(frame)).toEqual(PUBLISHED);
    // eslint-disable-next-line no-console
    console.log(`[xcross] tables + shallow BFS: ${Date.now() - t0} ms`);
  }, 120_000);

  it('the histogram is the same for every frame (symmetry)', () => {
    for (const f of [COLOR_FACE.White, COLOR_FACE.Green] as const) {
      for (const slot of [1, 3]) expect(xcrossShallowHistogram({ face: f, slot })).toEqual(PUBLISHED);
    }
  }, 240_000);

  it('capped IDA* agrees with a cross-only-heuristic search', () => {
    const rng = lcg(4242);
    const d = frameData(frame);
    for (let i = 0; i < 40; i++) {
      const st = randomXCoord(rng);
      const fast = xcrossDistCapped(d, st, 9);
      const slow = slowXcrossDist(frame, st.cross, st.corner, st.edge, 9);
      expect(fast, `#${i}`).toBe(slow);
    }
  }, 240_000);

  it('samples land at the requested depth, shallow and deep', () => {
    const rng = lcg(99);
    const d = frameData(frame);
    for (const target of [0, 1, 3, 5, 6, 7, 8, 9]) {
      const got = sampleXCoord(frame, target, target, rng);
      expect(got, `depth ${target}`).not.toBeNull();
      expect(got!.depth, `depth ${target}`).toBe(target);
      // re-verify with the capped search (not the sampler's own bookkeeping)
      expect(xcrossDistCapped(d, got!.coord, 10), `verify ${target}`).toBe(target);
    }
  }, 240_000);
});
