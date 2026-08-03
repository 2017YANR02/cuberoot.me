/*
 * cross-trainer, ZZ's two openers: pure EO (2,048 states) and EOLine (270,336).
 *
 * Both are enumerated outright, so the sampler cannot miss a rare depth — it draws out of the
 * layer. What is left to check is the model itself:
 *
 *   • the two BFS histograms, locked by value. They pin the coordinate, the goal and the
 *     orientation convention all at once: get any of the three wrong and the layer sizes move.
 *   • the samplers: every depth of every stage must come back at exactly that depth, re-measured
 *     through `stageMetric` rather than through the table the draw itself used, on a legal cube.
 *
 * That the metric is the SITE's metric — the one /scramble/stats and the WCA filter mean — is
 * `cross_trainer_parity.test.ts`'s job: both stages reproduce every column of
 * stats/scramble/comp_steps_eoline exactly, and that file was written by the Rust engine.
 */

import { describe, expect, it } from 'vitest';
import { drawTrainerState, stageMetric, type TrainerSpec } from '@/lib/cross-trainer';
import { COLOR_FACE, type FaceIdx } from '@/lib/cross-trainer/model';
import {
  EOLINE_MAX_DEPTH, EOLINE_STATES, EO_MAX_DEPTH, eoDistCapped, eoHistogram, eoLineDist,
  eoLineHistogram, linePieces,
} from '@/lib/cross-trainer/eoline';
import { EO_WORD_STATES, type EoAxis } from '@/lib/cross-trainer/eo';
import { fillState } from '@/lib/cross-trainer/fill';
import { validateCubie } from '@/lib/cube-facelet';

/** BFS layer sizes. Sum to the full state count, top index = the stage's god number. */
const EO_HIST = [1, 2, 25, 202, 620, 900, 285, 13];
const EOLINE_HIST = [1, 9, 91, 851, 6831, 41703, 130239, 88683, 1927, 1];

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

describe('cross-trainer / pure EO + EOLine tables', () => {
  it('the pure-EO BFS reproduces its layer sizes, on every axis', () => {
    for (const axis of [0, 1, 2] as EoAxis[]) {
      expect(eoHistogram(axis), `axis ${axis}`).toEqual(EO_HIST);
    }
    expect(EO_HIST.reduce((a, b) => a + b, 0)).toBe(EO_WORD_STATES);
    expect(EO_HIST.length - 1).toBe(EO_MAX_DEPTH);
    // Depth 1 is 2, not 4: the flip word records WHICH slots are flipped, and F and F' flip the
    // same four. Any coordinate that counted them apart would show 4 here.
    expect(EO_HIST[1]).toBe(2);
  });

  it('the EOLine BFS reproduces its layer sizes', () => {
    expect(eoLineHistogram()).toEqual(EOLINE_HIST);
    expect(EOLINE_HIST.reduce((a, b) => a + b, 0)).toBe(EOLINE_STATES);
    expect(EOLINE_HIST.length - 1).toBe(EOLINE_MAX_DEPTH);
    // Nine of the eighteen moves miss both line edges and flip nothing on the F/B axis... but
    // every one of the other nine lands somewhere different, so layer 1 is 9 — and the antipode
    // is unique.
    expect(EOLINE_HIST[1]).toBe(9);
    expect(EOLINE_HIST[EOLINE_MAX_DEPTH]).toBe(1);
  });

  it('a colour names two perpendicular axes, and its line follows the axis', () => {
    // Yellow = the D face: its lines are DF/DB (F/B axis) and DR/DL (R/L axis), never a U/D one.
    expect(linePieces(COLOR_FACE.Yellow, 2).sort()).toEqual([5, 7]);      // DF, DB
    expect(linePieces(COLOR_FACE.Yellow, 1).sort()).toEqual([4, 6]);      // DR, DL
    expect(linePieces(COLOR_FACE.Green, 0).sort()).toEqual([1, 5]);       // UF, DF
  });

  it('pure EO is a relaxation of EOLine, so it never exceeds it', () => {
    const rng = lcg(7);
    for (let i = 0; i < 400; i++) {
      const st = fillState([], [], rng);
      for (const face of [COLOR_FACE.Yellow, COLOR_FACE.Red, COLOR_FACE.Green] as FaceIdx[]) {
        for (const axis of [0, 1, 2] as EoAxis[]) {
          if (axis === (face % 3)) continue;
          const eo = eoDistCapped(st, axis, EO_MAX_DEPTH);
          const line = eoLineDist(st, face, axis, EOLINE_MAX_DEPTH);
          expect(eo, `${face}/${axis}`).toBeGreaterThanOrEqual(0);
          expect(line).toBeGreaterThanOrEqual(eo);
        }
      }
    }
  });
});

// ── the samplers ─────────────────────────────────────────────────────────────────────────────

describe('cross-trainer / EO + EOLine draws', () => {
  for (const [stage, top] of [['eo', EO_MAX_DEPTH], ['eoline', EOLINE_MAX_DEPTH]] as const) {
    it(`${stage}: every depth draws at exactly that depth, on a legal cube`, () => {
      for (let d = 0; d <= top; d++) {
        const spec: TrainerSpec = { variant: 'eoline', stage, colors: 'Y', slot: 0, lo: d, hi: d };
        const got = drawTrainerState(spec, lcg(1000 + d), 3000);
        expect(got.ok, `${stage} @${d}`).toBe(true);
        if (!got.ok) continue;
        expect(got.depth).toBe(d);
        // re-measured through the public metric, not the table the draw came out of
        expect(stageMetric('eoline', stage, got.state, 'Y'), `${stage} @${d} re-measured`).toBe(d);
        expect(validateCubie(got.state), `${stage} @${d} legal`).toBe(null);
      }
    }, 60_000);
  }
});
