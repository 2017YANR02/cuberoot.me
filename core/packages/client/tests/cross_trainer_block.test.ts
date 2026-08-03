/*
 * cross-trainer, the 2×2×2 block (one corner and its three edges).
 *
 * The whole stage is 253,440 states, so there is no sampling question to answer — one BFS
 * enumerates everything and each depth is drawn out of its layer. What the tests hold down is the
 * model:
 *
 *   • the BFS histogram, locked by value. Layer 1 is the sharpest of the checks: exactly nine of
 *     the eighteen moves miss the DFR block entirely (the U, L and B families), so a coordinate
 *     that tracked the wrong pieces would not produce 9.
 *   • the frame algebra: the 24 (colour, slot) frames must name 8 distinct blocks, each from its
 *     three faces — that is why two OPPOSITE colours already cover every block, which is in turn
 *     why the reach table's two-, four- and six-colour rows are identical.
 *   • the draws: every depth comes back at exactly that depth, re-measured through `stageMetric`
 *     rather than through the table the draw came out of, on a legal cube.
 *
 * That this is the SITE's block metric — the one /scramble/stats means by "222, yellow" — is
 * `cross_trainer_parity.test.ts`'s job: it reproduces every column of
 * stats/scramble/comp_steps_222, which the Rust engine wrote.
 */

import { describe, expect, it } from 'vitest';
import { drawTrainerState, stageMetric, type TrainerSpec } from '@/lib/cross-trainer';
import {
  BLOCK222_MAX_DEPTH, BLOCK222_STATES, CANON_BLOCK, block222Histogram, blockPieces,
} from '@/lib/cross-trainer/block';
import { COLOR_FACE, FACE_CORNERS, f2lSlots, type FaceIdx } from '@/lib/cross-trainer/model';
import { validateCubie } from '@/lib/cube-facelet';

const HIST = [1, 9, 90, 852, 7169, 44182, 131636, 68940, 561];

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

describe('cross-trainer / 2×2×2 block table', () => {
  it('the BFS reproduces its layer sizes', () => {
    expect(block222Histogram()).toEqual(HIST);
    expect(HIST.reduce((a, b) => a + b, 0)).toBe(BLOCK222_STATES);
    expect(HIST.length - 1).toBe(BLOCK222_MAX_DEPTH);
    // Nine of eighteen moves fix the DFR block outright (U, L, B), so nine break it.
    expect(HIST[1]).toBe(9);
  });

  it('the canonical block is DFR: corner 4 with edges DR, DF, FR', () => {
    expect(CANON_BLOCK.corner).toBe(4);
    expect(CANON_BLOCK.edges).toEqual([4, 5, 8]);
  });

  it('a block is one corner plus the three edges around it, for all 24 frames', () => {
    const byCorner = new Map<number, number>();
    for (let f = 0 as FaceIdx; f < 6; f++) {
      const slots = f2lSlots(f);
      for (let s = 0; s < 4; s++) {
        const { corner, edges } = blockPieces(f, s);
        expect(corner, `${f}/${s} corner is the slot's`).toBe(slots[s].corner);
        expect(FACE_CORNERS[f]).toContain(corner);
        expect(new Set(edges).size).toBe(3);
        expect(edges, `${f}/${s} includes the slot's own edge`).toContain(slots[s].edge);
        byCorner.set(corner, (byCorner.get(corner) ?? 0) + 1);
      }
    }
    // 8 blocks, each named from each of its three faces — the reason ./index deduplicates frames
    // and the reason two opposite colours already saturate the stage.
    expect(byCorner.size).toBe(8);
    expect([...byCorner.values()]).toEqual(new Array(8).fill(3));
  });

  it('one colour covers four blocks, an opposite pair covers all eight', () => {
    const of = (f: FaceIdx) => new Set(f2lSlots(f).map((s) => s.corner));
    const white = of(COLOR_FACE.White), yellow = of(COLOR_FACE.Yellow);
    expect(white.size).toBe(4);
    expect([...white].some((c) => yellow.has(c))).toBe(false);
    expect(new Set([...white, ...yellow]).size).toBe(8);
  });
});

describe('cross-trainer / 2×2×2 block draws', () => {
  it('every depth draws at exactly that depth, on a legal cube', () => {
    for (let d = 0; d <= BLOCK222_MAX_DEPTH; d++) {
      // A fixed slot on one colour = one block, which is the only frame set that reaches the
      // deepest layer (the best of four never needs 8).
      const spec: TrainerSpec = { variant: '222', stage: 'block222', colors: 'Y', slot: 0, lo: d, hi: d };
      const got = drawTrainerState(spec, lcg(500 + d), 3000);
      expect(got.ok, `@${d}`).toBe(true);
      if (!got.ok) continue;
      expect(got.depth).toBe(d);
      expect(stageMetric('222', 'block222', got.state, 'Y', 0), `@${d} re-measured`).toBe(d);
      expect(validateCubie(got.state), `@${d} legal`).toBe(null);
    }
  }, 60_000);

  it('the best of a colour’s four blocks is never worse than the fixed one', () => {
    const rng = lcg(11);
    for (let i = 0; i < 200; i++) {
      const got = drawTrainerState(
        { variant: '222', stage: 'block222', colors: 'Y', slot: 'best', lo: 0, hi: BLOCK222_MAX_DEPTH }, rng, 3000,
      );
      expect(got.ok).toBe(true);
      if (!got.ok) continue;
      for (let s = 0; s < 4; s++) {
        expect(stageMetric('222', 'block222', got.state, 'Y', s)).toBeGreaterThanOrEqual(got.depth);
      }
    }
  }, 60_000);
});
