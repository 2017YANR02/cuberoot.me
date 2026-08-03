/*
 * cross-trainer, XXCross + the pseudo (D-offset) goal family.
 *
 *  • Every enumerated layer is checked against or18's production numbers — that pins the
 *    coordinate AND the goal set at the same time. Adjacent and diagonal slot pairs are
 *    asserted separately because they are different puzzles.
 *  • The capped IDA* is checked against those BFS layers (a heuristic-free oracle) and, on a
 *    few states, against a search that only knows the cross distance — a strictly weaker,
 *    independent heuristic, so a bug in the joint tables cannot hide behind itself.
 *  • Pseudo depth ≤ plain depth is verified over the WHOLE cross coordinate, not by sampling.
 */

import { describe, expect, it } from 'vitest';
import { crossDist, crossNext, CROSS_STATES } from '@/lib/cross-trainer/dist';
import { CORNER_STEP, EDGE_STEP, COLOR_FACE, f2lSlots, skipRow } from '@/lib/cross-trainer/model';
import { frameData, randomXCoord, xcrossDistCapped, type Frame } from '@/lib/cross-trainer/xcross';
import { fillState } from '@/lib/cross-trainer/fill';
import {
  PSEUDO_CROSS_MAX_DEPTH, PSEUDO_XCROSS_HISTOGRAM, PSEUDO_XCROSS_PRACTICAL_MAX,
  PX_BFS_DEPTH, XXCROSS_DEPTH_SHARE, XXCROSS_DRAW_COST_MS, XXCROSS_LAYERS_ADJACENT,
  XXCROSS_LAYERS_DIAGONAL, XXCROSS_PRACTICAL_MAX, XXCROSS_STATES, XX_BFS_DEPTH,
  pseudoCrossDist, pseudoCrossHistogram, pseudoCrossPins, pseudoXFrameData,
  pseudoXcrossDistCapped, pseudoXcrossPins, pseudoXcrossShallowHistogram,
  randomXXCoord, samplePseudoCross, samplePseudoXCoord, sampleXXCoord,
  xxFrameData, xxcrossDistCapped, xxcrossPins, xxcrossShallowHistogram,
  type XXCoord, type XXFrame,
} from '@/lib/cross-trainer/multi';

const D = COLOR_FACE.Yellow; // the D face — f2lSlots(D) = [FR, FL, BL, BR]
const FR = 0, FL = 1, BL = 2, BR = 3;
const ADJACENT: XXFrame = { face: D, slots: [BL, BR] };
const DIAGONAL: XXFrame = { face: D, slots: [BL, FR] };

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Independent optimal-length search for XXCross: heuristic = cross distance only. */
function slowXXDist(frame: XXFrame, st: XXCoord, cap: number): number {
  const next = crossNext();
  const d = xxFrameData(frame);
  const cd = crossDist(frame.face);
  const gc0 = d.cornerPieces[0] * 3, gc1 = d.cornerPieces[1] * 3;
  const ge0 = d.edgePieces[0] * 2, ge1 = d.edgePieces[1] * 2;
  const done = (c: number, c0: number, c1: number, e0: number, e1: number) =>
    c === d.crossGoal && c0 === gc0 && c1 === gc1 && e0 === ge0 && e1 === ge1;
  if (done(st.cross, st.c0, st.c1, st.e0, st.e1)) return 0;
  const rec = (c: number, c0: number, c1: number, e0: number, e1: number, depth: number, prev: number): boolean => {
    const skip = skipRow(prev);
    const base = c * 18;
    for (let m = 0; m < 18; m++) {
      if (skip[m]) continue;
      const nc = next[base + m], cs = CORNER_STEP[m], es = EDGE_STEP[m];
      const n0 = cs[c0], n1 = cs[c1], f0 = es[e0], f1 = es[e1];
      if (depth === 1) { if (done(nc, n0, n1, f0, f1)) return true; continue; }
      if (cd[nc] >= depth) continue;
      if (rec(nc, n0, n1, f0, f1, depth - 1, m)) return true;
    }
    return false;
  };
  for (let lim = Math.max(cd[st.cross], 1); lim <= cap; lim++) if (rec(st.cross, st.c0, st.c1, st.e0, st.e1, lim, -1)) return lim;
  return -1;
}

// ═══ XXCross ═════════════════════════════════════════════════════════════════════════════════

describe('cross-trainer / XXCross', () => {
  it('classifies adjacent vs diagonal slot pairs from geometry', () => {
    expect(f2lSlots(D).map((s) => s.name)).toEqual(['FR', 'FL', 'BL', 'BR']);
    for (const pair of [[FR, FL], [FL, BL], [BL, BR], [BR, FR]] as [number, number][]) {
      expect(xxFrameData({ face: D, slots: pair }).adjacent, `${pair}`).toBe(true);
    }
    for (const pair of [[FR, BL], [FL, BR]] as [number, number][]) {
      expect(xxFrameData({ face: D, slots: pair }).adjacent, `${pair}`).toBe(false);
    }
  }, 300_000);

  it('the exported coordinate size and cost table describe the real space', () => {
    expect(XXCROSS_STATES).toBe(CROSS_STATES * (8 * 7 * 3 * 3) * (8 * 7 * 2 * 2));
    // "practical" means a rejection sample lands well inside a second …
    const at = (d: number) => XXCROSS_DRAW_COST_MS[d] / XXCROSS_DEPTH_SHARE[d];
    expect(at(XXCROSS_PRACTICAL_MAX)).toBeLessThan(1000);
    // … and the next bin does not
    expect(at(XXCROSS_PRACTICAL_MAX + 1)).toBeGreaterThan(1000);
  });

  it('adjacent {BL,BR} reproduces or18 layer sizes 0..6', () => {
    const t0 = Date.now();
    expect(xxcrossShallowHistogram(ADJACENT, 6)).toEqual([...XXCROSS_LAYERS_ADJACENT]);
    process.stdout.write(`[xxcross] adjacent BFS 0..6: ${Date.now() - t0} ms\n`);
  }, 600_000);

  it('diagonal {BL,FR} reproduces or18 layer sizes 0..6', () => {
    const t0 = Date.now();
    expect(xxcrossShallowHistogram(DIAGONAL, 6)).toEqual([...XXCROSS_LAYERS_DIAGONAL]);
    process.stdout.write(`[xxcross] diagonal BFS 0..6: ${Date.now() - t0} ms\n`);
  }, 600_000);

  it('the shape, not the particular pair, decides the histogram', () => {
    const head = (n: number[]) => n.slice(0, XX_BFS_DEPTH + 1);
    for (const pair of [[FR, FL], [FL, BL], [BR, FR]] as [number, number][]) {
      expect(xxcrossShallowHistogram({ face: D, slots: pair }), `${pair}`).toEqual(head([...XXCROSS_LAYERS_ADJACENT]));
    }
    expect(xxcrossShallowHistogram({ face: D, slots: [FL, BR] })).toEqual(head([...XXCROSS_LAYERS_DIAGONAL]));
    // a different cross colour must behave identically
    expect(xxcrossShallowHistogram({ face: COLOR_FACE.White, slots: [0, 1] })).toEqual(head([...XXCROSS_LAYERS_ADJACENT]));
  }, 600_000);

  it('capped IDA* returns the BFS depth of enumerated states', () => {
    const rng = lcg(7);
    for (const frame of [ADJACENT, DIAGONAL]) {
      const d = xxFrameData(frame);
      for (let depth = 0; depth <= XX_BFS_DEPTH; depth++) {
        for (let i = 0; i < 12; i++) {
          const got = sampleXXCoord(frame, depth, depth, rng)!;
          expect(got.depth).toBe(depth);
          expect(xxcrossDistCapped(d, got.coord, XX_BFS_DEPTH), `d=${depth}`).toBe(depth);
          if (depth > 0) expect(xxcrossDistCapped(d, got.coord, depth - 1), `d=${depth} capped`).toBe(-1);
        }
      }
    }
  }, 600_000);

  it('capped IDA* agrees with a cross-only-heuristic search', () => {
    const rng = lcg(31337);
    const d = xxFrameData(ADJACENT);
    // deep random states are unaffordable for the weak oracle, so probe the enumerated layers
    for (let depth = 0; depth <= XX_BFS_DEPTH; depth++) {
      for (let i = 0; i < 3; i++) {
        const st = sampleXXCoord(ADJACENT, depth, depth, rng)!.coord;
        expect(slowXXDist(ADJACENT, st, 7), `d=${depth}`).toBe(xxcrossDistCapped(d, st, 7));
      }
    }
    // plus a couple of genuinely random ones, capped where the weak oracle is still affordable
    for (let i = 0; i < 2; i++) {
      const st = randomXXCoord(rng);
      expect(slowXXDist(ADJACENT, st, 6), `rand#${i}`).toBe(xxcrossDistCapped(d, st, 6));
    }
  }, 600_000);

  it('samples land at the requested depth, shallow and deep', () => {
    const rng = lcg(99);
    const d = xxFrameData(ADJACENT);
    for (let target = 0; target <= XXCROSS_PRACTICAL_MAX; target++) {
      const t0 = Date.now();
      const got = sampleXXCoord(ADJACENT, target, target, rng);
      expect(got, `depth ${target}`).not.toBeNull();
      expect(got!.depth, `depth ${target}`).toBe(target);
      // re-verified by the capped search, not by the sampler's own bookkeeping
      expect(xxcrossDistCapped(d, got!.coord, target), `verify ${target}`).toBe(target);
      if (target > XX_BFS_DEPTH) process.stdout.write(`[xxcross] depth ${target}: ${Date.now() - t0} ms per sample\n`);
    }
  }, 600_000);

  it('pins rebuild a legal cube with the tracked pieces exactly where the coord says', () => {
    const rng = lcg(5150);
    const d = xxFrameData(ADJACENT);
    for (let i = 0; i < 200; i++) {
      const st = randomXXCoord(rng);
      const { edgePins, cornerPins } = xxcrossPins(d, st);
      expect(new Set(edgePins.map((p) => p.slot)).size).toBe(6);
      expect(new Set(edgePins.map((p) => p.piece)).size).toBe(6);
      const cube = fillState(edgePins, cornerPins, rng);
      for (const p of edgePins) { expect(cube.ep[p.slot]).toBe(p.piece); expect(cube.eo[p.slot]).toBe(p.ori); }
      for (const p of cornerPins) { expect(cube.cp[p.slot]).toBe(p.piece); expect(cube.co[p.slot]).toBe(p.ori); }
      // legality: both permutations are permutations, orientation sums vanish, parities agree
      expect(new Set(cube.ep).size).toBe(12);
      expect(new Set(cube.cp).size).toBe(8);
      expect(cube.eo.reduce((a, b) => a + b, 0) % 2).toBe(0);
      expect(cube.co.reduce((a, b) => a + b, 0) % 3).toBe(0);
    }
  }, 300_000);

  it('bench: table build + per-draw cost by depth', () => {
    const rng = lcg(2024);
    const t0 = Date.now();
    xxFrameData(ADJACENT);
    const build = Date.now() - t0;
    const t1 = Date.now();
    xxcrossShallowHistogram(ADJACENT);
    process.stdout.write(`[xxcross] joint tables ${build} ms, shallow layers 0..5 ${Date.now() - t1} ms\n`);

    // XX_BENCH_MS raises the per-cap budget when a real measurement is wanted; the default
    // keeps this test at ~40 s while still being enough to rank the depths.
    const budget = Number(process.env.XX_BENCH_MS ?? 6000);
    const d = xxFrameData(ADJACENT);
    for (const cap of [8, 9, 10, 11, 12, 13]) {
      const start = Date.now();
      const hist = new Array<number>(cap + 1).fill(0);
      let draws = 0, hits = 0;
      while (Date.now() - start < budget) {
        const v = xxcrossDistCapped(d, randomXXCoord(rng), cap);
        draws++;
        if (v >= 0) hist[v]++;
        if (v === cap) hits++;
      }
      const el = Date.now() - start;
      const perHit = hits ? (el / hits / 1000).toFixed(2) : `> ${(el / 1000).toFixed(0)}`;
      process.stdout.write(
        `[xxcross] cap ${cap}: ${(el / draws).toFixed(2)} ms/draw over ${draws} draws, ` +
        `${hits} exactly ${cap} → ${perHit} s per depth-${cap} sample  [${hist.join(',')}]\n`,
      );
    }
  }, 1_200_000);
});

// ═══ pseudo cross ════════════════════════════════════════════════════════════════════════════

describe('cross-trainer / pseudo cross', () => {
  // published prefix + the tail this BFS measured; together they cover the 190,080 coordinates
  const HIST = [4, 48, 440, 3576, 21492, 74660, 81780];
  const FULL = [...HIST, 8064, 16];

  it('multi-source layers match the published pseudo-cross histogram', () => {
    const h = pseudoCrossHistogram(D);
    expect(h.slice(0, 7)).toEqual(HIST);
    expect(h).toEqual(FULL);
    expect(h.reduce((a, b) => a + b, 0)).toBe(CROSS_STATES);
    expect(h.length).toBe(PSEUDO_CROSS_MAX_DEPTH + 1);
    process.stdout.write(`[pseudo-cross] layers: ${h.join(', ')}\n`);
  }, 120_000);

  it('every cross colour gives the same histogram', () => {
    for (const f of [COLOR_FACE.White, COLOR_FACE.Green, COLOR_FACE.Orange] as const) {
      expect(pseudoCrossHistogram(f).slice(0, 7), `face ${f}`).toEqual(HIST);
    }
  }, 120_000);

  it('pseudo depth ≤ plain depth for EVERY coordinate', () => {
    const pd = pseudoCrossDist(D), cd = crossDist(D);
    let strictlyLess = 0;
    for (let i = 0; i < CROSS_STATES; i++) {
      if (pd[i] > cd[i]) throw new Error(`coord ${i}: pseudo ${pd[i]} > plain ${cd[i]}`);
      if (pd[i] < cd[i]) strictlyLess++;
    }
    expect(strictlyLess).toBeGreaterThan(0);
  }, 120_000);

  it('samples land at the requested depth 0..7 and pin 4 edges', () => {
    const rng = lcg(11);
    const pd = pseudoCrossDist(D);
    for (let depth = 0; depth <= PSEUDO_CROSS_MAX_DEPTH; depth++) {
      const got = samplePseudoCross(D, depth, depth, rng);
      expect(got, `depth ${depth}`).not.toBeNull();
      expect(got!.depth).toBe(depth);
      expect(pd[got!.coord]).toBe(depth);
      const { edgePins, cornerPins } = pseudoCrossPins(D, got!.coord);
      expect(edgePins.length).toBe(4);
      expect(cornerPins.length).toBe(0);
      const cube = fillState(edgePins, cornerPins, rng);
      for (const p of edgePins) expect(cube.ep[p.slot]).toBe(p.piece);
    }
  }, 120_000);
});

// ═══ pseudo XCross ═══════════════════════════════════════════════════════════════════════════

describe('cross-trainer / pseudo XCross', () => {
  const frame: Frame = { face: D, slot: FR };

  it('shallow layers match the first six published entries', () => {
    const t0 = Date.now();
    expect(pseudoXcrossShallowHistogram(frame)).toEqual(PSEUDO_XCROSS_HISTOGRAM.slice(0, PX_BFS_DEPTH + 1));
    process.stdout.write(`[pseudo-xcross] tables + shallow BFS: ${Date.now() - t0} ms\n`);
  }, 300_000);

  it('the published histogram covers the whole 72,990,720-state coordinate', () => {
    expect(PSEUDO_XCROSS_HISTOGRAM.reduce((a, b) => a + b, 0)).toBe(72990720);
  });

  /*
   * The tail of PSEUDO_XCROSS_HISTOGRAM was or18's number, re-derived here only as far as the
   * shallow layers reach (depth 5). /scramble/stats now ships the whole thing as an exhaustive
   * dataset, and "published" is not the standard that page holds itself to — so enumerate the
   * whole coordinate once, from the goal set, with nothing but the move tables.
   *
   * Same run re-derives plain XCross's fixed-slot histogram, which reached exact_dist.ts from
   * `solver/src/bin/dist_xcross_1col_fixed.rs`. A third independent implementation agreeing to
   * the digit is what makes that cell a fact rather than a transcription.
   *
   * ~60 s per goal set + 109 MB — opt in with PX_FULL_BFS=1.
   */
  it.runIf(!!process.env.PX_FULL_BFS)('exhaustive BFS reproduces both fixed-slot histograms', () => {
    const fullHistogram = (goals: readonly number[]): number[] => {
      const next = crossNext();
      const N = CROSS_STATES * 576;
      const dist = new Uint8Array(N).fill(255);
      for (const g of goals) dist[g] = 0;
      const hist: number[] = [goals.length];
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
    };
    const pack = (cross: number, corner: number, edge: number) => cross * 576 + corner * 24 + edge;

    const px = pseudoXFrameData(frame);
    const pseudo = fullHistogram(px.goals.map((g) => pack(g.cross, g.corner, g.edge)));
    expect(pseudo).toEqual([...PSEUDO_XCROSS_HISTOGRAM]);
    expect(pseudo.reduce((a, b) => a + b, 0)).toBe(72990720);

    const xd = frameData(frame);
    const plain = fullHistogram([pack(xd.crossGoal, xd.cornerPiece * 3, xd.edgePiece * 2)]);
    // solver/src/bin/dist_xcross_1col_fixed.rs GOLDEN, as shipped in _data/exact_dist.ts.
    expect(plain).toEqual([1, 15, 172, 1950, 21535, 220368, 1989591, 13431990, 40963892, 16325184, 36022]);
    expect(plain.reduce((a, b) => a + b, 0)).toBe(72990720);
  }, 1_800_000);

  it('every slot of every colour gives the same shallow histogram', () => {
    const want = PSEUDO_XCROSS_HISTOGRAM.slice(0, PX_BFS_DEPTH + 1);
    for (const f of [D, COLOR_FACE.White] as const) {
      for (const slot of [1, 3]) expect(pseudoXcrossShallowHistogram({ face: f, slot }), `${f}:${slot}`).toEqual(want);
    }
  }, 600_000);

  it('capped IDA* returns the BFS depth of enumerated states', () => {
    const rng = lcg(808);
    const d = pseudoXFrameData(frame);
    for (let depth = 0; depth <= PX_BFS_DEPTH; depth++) {
      for (let i = 0; i < 20; i++) {
        const got = samplePseudoXCoord(frame, depth, depth, rng)!;
        expect(got.depth).toBe(depth);
        expect(pseudoXcrossDistCapped(d, got.coord, PX_BFS_DEPTH)).toBe(depth);
        if (depth > 0) expect(pseudoXcrossDistCapped(d, got.coord, depth - 1)).toBe(-1);
      }
    }
  }, 300_000);

  it('pseudo depth ≤ plain xcross depth on random coordinates', () => {
    const rng = lcg(4242);
    const pd = pseudoXFrameData(frame);
    const xd = frameData(frame);
    let strictlyLess = 0;
    for (let i = 0; i < 60; i++) {
      const st = randomXCoord(rng);
      const p = pseudoXcrossDistCapped(pd, st, 10);
      const x = xcrossDistCapped(xd, st, 10);
      expect(p, `#${i}`).toBeGreaterThanOrEqual(0);
      expect(x, `#${i}`).toBeGreaterThanOrEqual(0);
      expect(p, `#${i}`).toBeLessThanOrEqual(x);
      if (p < x) strictlyLess++;
    }
    expect(strictlyLess).toBeGreaterThan(0);
  }, 600_000);

  it('samples land at the requested depth up to the practical max', () => {
    const rng = lcg(1234);
    const d = pseudoXFrameData(frame);
    for (let target = 0; target <= PSEUDO_XCROSS_PRACTICAL_MAX; target++) {
      const t0 = Date.now();
      const got = samplePseudoXCoord(frame, target, target, rng);
      expect(got, `depth ${target}`).not.toBeNull();
      expect(got!.depth, `depth ${target}`).toBe(target);
      expect(pseudoXcrossDistCapped(d, got!.coord, target), `verify ${target}`).toBe(target);
      process.stdout.write(`[pseudo-xcross] depth ${target}: ${Date.now() - t0} ms per sample\n`);
      const { edgePins, cornerPins } = pseudoXcrossPins(d, got!.coord);
      expect(edgePins.length).toBe(5);
      expect(cornerPins.length).toBe(1);
      const cube = fillState(edgePins, cornerPins, rng);
      for (const p of edgePins) expect(cube.ep[p.slot]).toBe(p.piece);
      expect(cube.cp[cornerPins[0].slot]).toBe(cornerPins[0].piece);
    }
  }, 600_000);
});
