/*
 * cross-trainer, EOCross stage (ZZ step 1: every edge oriented + the four cross edges home).
 *
 * Four independent nets, so no bug can hide behind the code that produced it:
 *   • the full-BFS histogram must equal the published one (1, 15, 178, …, 140), sum 24,330,240,
 *     mean 7.530829494 — that pins the coordinate, the goal AND the orientation convention;
 *   • the shallow multi-source BFS (route b, no big table) must reproduce its first six layers;
 *   • the admissible IDA* must agree with the table on random coordinates;
 *   • a generated cube → kociemba scramble → `lib/eocross-dist` (a *different* edge model, its own
 *     numbering, verified separately against the xlsx table) must report the requested length.
 */

import { describe, expect, it } from 'vitest';
import { COLOR_FACE, EDGE_STEP, type FaceIdx } from '@/lib/cross-trainer/model';
import {
  EOCROSS_STATES, edgeStepForAxis, eoCrossDistCapped, eoCrossHistogram, eoCrossLength,
  eoCrossPins, eoCrossShallowHistogram, eoCrossTableMs, eoFrameData, randomEoCoord,
  sampleEoCoord, sampleEoCoordByRejection, sampleEoCrossState, type EoFrame,
} from '@/lib/cross-trainer/eo';
import { fillState } from '@/lib/cross-trainer/fill';
import { validateCubie } from '@/lib/cube-facelet';
import { computeEoCrossDist, eoCrossIndex, EO_CROSS_HIST, EO_CROSS_MEAN } from '@/lib/eocross-dist';
import { buildMoveTables } from '@/app/[lang]/timer/_lib/scramble/kociemba/movetables';
import { buildPruneTables } from '@/app/[lang]/timer/_lib/scramble/kociemba/prune';
import { scrambleFromState } from '@/app/[lang]/timer/_lib/scramble/kociemba/search';
import { formatMoves } from '@/app/[lang]/timer/_lib/scramble/kociemba/cube';

/** Published + already in-repo (lib/eocross-dist.ts EO_CROSS_HIST). */
const GATE = [1, 15, 178, 1982, 21041, 204732, 1645039, 8477633, 12917628, 1061851, 140];
const SHALLOW = GATE.slice(0, 6);

// deterministic RNG so a failure is reproducible
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** D cross + F/B orientation axis — exactly what lib/eocross-dist.ts models. */
const YELLOW: EoFrame = { face: COLOR_FACE.Yellow };

describe('cross-trainer / EOCross orientation model', () => {
  it('the F/B axis rule reproduces kociemba\'s own eo bit-for-bit', () => {
    // "quarter turns of the axis' two faces flip their four edges, nothing else does" is the
    // definition; for axis 2 it must land on the model's native EDGE_STEP or our other two axes
    // are conjugates of the wrong thing.
    const step = edgeStepForAxis(2);
    for (let m = 0; m < 18; m++) expect(Array.from(step[m]), `move ${m}`).toEqual(Array.from(EDGE_STEP[m]));
  });

  it('the convention shift vanishes on the F/B axis and is real on the others', () => {
    expect(Array.from(eoFrameData(YELLOW).delta).every((x) => x === 0)).toBe(true);
    // a D cross with the L/R axis is the other legal ZZ start; it needs a real translation
    expect(Array.from(eoFrameData({ face: COLOR_FACE.Yellow, axis: 1 }).delta).some((x) => x === 1)).toBe(true);
  });

  it('refuses an EO axis parallel to the cross face', () => {
    expect(() => eoFrameData({ face: COLOR_FACE.Yellow, axis: 0 })).toThrow();
    expect(() => eoFrameData({ face: COLOR_FACE.Green, axis: 2 })).toThrow();
  });
});

describe('cross-trainer / EOCross exact table', () => {
  it('depth histogram matches the published one', () => {
    const hist = eoCrossHistogram(YELLOW);
    // eslint-disable-next-line no-console
    console.log(`[eocross] route (a) full BFS table: ${eoCrossTableMs(YELLOW)} ms`);
    expect(hist).toEqual(GATE);
    expect(hist).toEqual([...EO_CROSS_HIST]);
    expect(hist.reduce((a, b) => a + b, 0)).toBe(EOCROSS_STATES);
    expect(EOCROSS_STATES).toBe(24330240);
  }, 300_000);

  it('mean optimal EOCross is 7.530829494', () => {
    const hist = eoCrossHistogram(YELLOW);
    const mean = hist.reduce((s, n, d) => s + n * d, 0) / EOCROSS_STATES;
    expect(mean.toFixed(9)).toBe(EO_CROSS_MEAN.toFixed(9));
    expect(mean.toFixed(9)).toBe('7.530829494');
  }, 300_000);

  it('another cross face on its own perpendicular axis gives the same histogram', () => {
    // R cross + U/D axis is the D-cross frame seen through a z rotation; a mismatch would mean
    // the axis derivation, not the BFS, is wrong.
    expect(eoCrossHistogram({ face: COLOR_FACE.Red })).toEqual(GATE);
  }, 300_000);

  it('shallow multi-source BFS (route b, no table) reproduces the first six layers', () => {
    for (const f of [COLOR_FACE.Yellow, COLOR_FACE.White, COLOR_FACE.Green, COLOR_FACE.Orange] as FaceIdx[]) {
      expect(eoCrossShallowHistogram({ face: f }), `face ${f}`).toEqual(SHALLOW);
    }
    // both EO axes of the same cross are legal ZZ starts and must agree
    expect(eoCrossShallowHistogram({ face: COLOR_FACE.Yellow, axis: 1 })).toEqual(SHALLOW);
  }, 120_000);
});

describe('cross-trainer / EOCross capped IDA*', () => {
  it('agrees with the exact table on random coordinates', () => {
    const rng = lcg(1234);
    const d = eoFrameData(YELLOW);
    for (let i = 0; i < 60; i++) {
      const st = randomEoCoord(rng);
      expect(eoCrossDistCapped(d, st, 10), `#${i}`).toBe(eoCrossLength(YELLOW, st));
    }
  }, 300_000);

  it('returns -1 exactly when the optimum exceeds the cap', () => {
    const rng = lcg(555);
    const d = eoFrameData(YELLOW);
    for (let i = 0; i < 20; i++) {
      const st = randomEoCoord(rng);
      const truth = eoCrossLength(YELLOW, st);
      expect(eoCrossDistCapped(d, st, truth)).toBe(truth);
      if (truth > 0) expect(eoCrossDistCapped(d, st, truth - 1)).toBe(-1);
    }
  }, 300_000);
});

describe('cross-trainer / EOCross sampling', () => {
  it('lands on the requested depth, every depth including the 140-state tail', () => {
    const rng = lcg(99);
    for (let target = 0; target <= 10; target++) {
      for (let n = 0; n < 5; n++) {
        const got = sampleEoCoord(YELLOW, target, target, rng);
        expect(got, `depth ${target}`).not.toBeNull();
        expect(got!.depth, `depth ${target}`).toBe(target);
        expect(eoCrossLength(YELLOW, got!.coord), `verify ${target}`).toBe(target);
      }
    }
  }, 300_000);

  it('the capped IDA* confirms the deep tail the table claims', () => {
    // depth 9 and 10 are where a lower-bound table masquerading as the answer would show up:
    // the search has to exhaust every shorter length before it may report these.
    const rng = lcg(616);
    const d = eoFrameData(YELLOW);
    for (const target of [9, 10]) {
      for (let n = 0; n < 2; n++) {
        const got = sampleEoCoord(YELLOW, target, target, rng)!;
        expect(eoCrossDistCapped(d, got.coord, 10), `depth ${target} #${n}`).toBe(target);
      }
    }
  }, 600_000);

  it('is uniform inside a layer, not just across layers', () => {
    // 178 states at depth 2, 17,800 draws → 100 each. Anything that skewed the rank → coordinate
    // mapping (a wrong block cumulative, a mis-sized block) would drop or double-count members.
    const rng = lcg(20260803);
    const counts = new Map<string, number>();
    const N = 17800;
    for (let i = 0; i < N; i++) {
      const c = sampleEoCoord(YELLOW, 2, 2, rng)!.coord;
      const k = `${c.pos}:${c.eo}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    expect(counts.size).toBe(GATE[2]);
    const hits = [...counts.values()];
    expect(Math.min(...hits)).toBeGreaterThan(50);    // Poisson(100) → 5σ
    expect(Math.max(...hits)).toBeLessThan(160);
  }, 300_000);

  it('a window is drawn with each layer\'s true weight', () => {
    const rng = lcg(31337);
    const N = 4000;
    const seen = new Array<number>(11).fill(0);
    for (let i = 0; i < N; i++) seen[sampleEoCoord(YELLOW, 6, 9, rng)!.depth]++;
    const total = GATE[6] + GATE[7] + GATE[8] + GATE[9];
    for (let d = 6; d <= 9; d++) {
      expect(Math.abs(seen[d] / N - GATE[d] / total), `bin ${d}`).toBeLessThan(0.03);
    }
  }, 300_000);

  it('draws spread over the layer (no constant output)', () => {
    const rng = lcg(7);
    const set = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const c = sampleEoCoord(YELLOW, 8, 8, rng)!.coord;
      set.add(`${c.pos}:${c.eo}`);
    }
    expect(set.size).toBe(60);
  }, 300_000);

  it('route (b) rejection agrees with route (a) on the depths it can reach', () => {
    const rng = lcg(2024);
    const d = eoFrameData(YELLOW);
    for (const target of [0, 3, 5, 6, 7, 8]) {
      const got = sampleEoCoordByRejection(YELLOW, target, target, rng, 400);
      expect(got, `depth ${target}`).not.toBeNull();
      expect(got!.depth, `depth ${target}`).toBe(target);
      expect(eoCrossLength(YELLOW, got!.coord), `table ${target}`).toBe(target);
      expect(eoCrossDistCapped(d, got!.coord, 10), `ida ${target}`).toBe(target);
    }
  }, 300_000);
});

describe('cross-trainer / EOCross generated cubes', () => {
  const mt = buildMoveTables();
  const pt = buildPruneTables(mt);

  it('every pinned coordinate fills into a legal cube', () => {
    const rng = lcg(4242);
    for (let i = 0; i < 200; i++) {
      const got = sampleEoCoord(YELLOW, 0, 10, rng)!;
      const state = fillState(eoCrossPins(YELLOW, got.coord, rng), [], rng);
      expect(validateCubie(state), `#${i} d=${got.depth}`).toBeNull();
    }
  }, 300_000);

  it('an independent model re-measures the requested EOCross length', () => {
    // lib/eocross-dist.ts: its own edge numbering, its own BFS, D cross + F/B axis.
    const oracle = computeEoCrossDist('Yellow').dist;
    const rng = lcg(20260802);
    for (let target = 0; target <= 10; target++) {
      for (let n = 0; n < 3; n++) {
        const got = sampleEoCrossState(YELLOW, target, target, rng);
        expect(got, `depth ${target}`).not.toBeNull();
        expect(validateCubie(got!.state), `legality d=${target}`).toBeNull();
        const scramble = formatMoves(scrambleFromState(got!.state, mt, pt, { timeoutMs: 4000 }));
        const idx = eoCrossIndex(scramble, 'Yellow');
        expect(idx, `parse d=${target} #${n}`).not.toBeNull();
        expect(oracle[idx!], `d=${target} #${n} (${scramble})`).toBe(target);
      }
    }
  }, 600_000);
});

describe('cross-trainer / EOCross route (a) vs route (b)', () => {
  it('measures both and shows why the table wins', () => {
    const rng = lcg(8080);
    const d = eoFrameData(YELLOW);
    const buildMs = eoCrossTableMs(YELLOW);

    const rows: string[] = [];
    for (const depth of [7, 8, 9, 10]) {
      const nA = 200;
      let t0 = Date.now();
      for (let i = 0; i < nA; i++) sampleEoCoord(YELLOW, depth, depth, rng);
      const aMs = (Date.now() - t0) / nA;

      // route (b): time one capped IDA* on uniform draws, then price the rejection honestly.
      const probes = 12;
      t0 = Date.now();
      for (let i = 0; i < probes; i++) eoCrossDistCapped(d, randomEoCoord(rng), depth);
      const idaMs = (Date.now() - t0) / probes;
      const bMs = idaMs * (EOCROSS_STATES / GATE[depth]);
      rows.push(`  depth ${depth}: (a) ${aMs.toFixed(3)} ms/draw | (b) ~${bMs.toFixed(1)} ms/draw `
        + `(${(EOCROSS_STATES / GATE[depth]).toFixed(0)} rejections × ${idaMs.toFixed(2)} ms)`);
    }
    // eslint-disable-next-line no-console
    console.log(`[eocross] route (a) build ${buildMs} ms, then:\n${rows.join('\n')}`);
    expect(buildMs).toBeLessThan(20000);
  }, 600_000);
});
