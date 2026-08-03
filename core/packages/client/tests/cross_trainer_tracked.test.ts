/*
 * cross-trainer/tracked — the shared "these corners + these edges, home and oriented" engine.
 *
 * The engine is only worth having if it is right, and the cheapest proof is that it reproduces
 * two tables written independently of it:
 *   • ./dist's cross table (190,080), itself pinned to or18's published histogram;
 *   • ./block's 2×2×2 table (253,440), written with its own packing and its own BFS.
 * Both must agree to the digit. What the engine then adds — the Roux square (12,672) and the
 * Roux first block (5,322,240) — is checked structurally instead: every frame of a colour must
 * give the same histogram (they are conjugate), and a square is a sub-block of the 1×2×3, so its
 * distance can never exceed it. That last one is checked over the WHOLE 5.3 M coordinate.
 */

import { describe, expect, it } from 'vitest';
import { crossHistogram } from '@/lib/cross-trainer/dist';
import {
  BLOCK123_HISTOGRAM, CANON_BLOCK, SQUARE122_HISTOGRAM,
  block123Pieces, block222Histogram, square122Pieces,
} from '@/lib/cross-trainer/block';
import { FACE_EDGES, type FaceIdx } from '@/lib/cross-trainer/model';
import {
  cornerStates, edgeStates, packCorners, packEdges, trackedHistogram, trackedStates, trackedTable,
  unpackCorners, unpackEdges,
} from '@/lib/cross-trainer/tracked';

/** The shipped constants (./block), re-derived here from every frame on every run. */
const SQUARE122_HIST = [...SQUARE122_HISTOGRAM];
const BLOCK123_HIST = [...BLOCK123_HISTOGRAM];

const FACES: FaceIdx[] = [0, 1, 2, 3, 4, 5];
const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);
/** The four side faces of a bottom colour. */
const sidesOf = (f: FaceIdx) => FACES.filter((s) => s !== f && s !== ((f + 3) % 6));

describe('cross-trainer / tracked', () => {
  it('counts the coordinate space the way the piece lists say it should', () => {
    expect(cornerStates(0)).toBe(1);
    expect(cornerStates(1)).toBe(24);
    expect(cornerStates(2)).toBe(504);
    expect(edgeStates(2)).toBe(528);
    expect(edgeStates(3)).toBe(10560);
    expect(edgeStates(4)).toBe(190080);
    expect(trackedStates(square122Pieces(3, 2, 0))).toBe(12672);
    expect(trackedStates(block123Pieces(3, 2))).toBe(5322240);
    expect(trackedStates({ corners: [CANON_BLOCK.corner], edges: CANON_BLOCK.edges })).toBe(253440);
  });

  it('round-trips both halves of the coordinate', () => {
    const out = new Int8Array(3);
    for (let i = 0; i < cornerStates(2); i++) {
      unpackCorners(i, 2, out);
      expect(packCorners(out, 2)).toBe(i);
    }
    for (let i = 0; i < edgeStates(3); i++) {
      unpackEdges(i, 3, out);
      expect(packEdges(out, 3)).toBe(i);
    }
  });

  it('reproduces ./dist cross histogram on every colour', () => {
    for (const f of FACES) {
      expect(trackedHistogram({ corners: [], edges: FACE_EDGES[f] }), `face ${f}`)
        .toEqual(crossHistogram(f));
    }
  });

  it('reproduces ./block 2x2x2 histogram', () => {
    expect(trackedHistogram({ corners: [CANON_BLOCK.corner], edges: CANON_BLOCK.edges }))
      .toEqual(block222Histogram());
  });

  it('1x2x2 square: same histogram from all 48 frames', () => {
    for (const f of FACES) {
      for (const s of sidesOf(f)) {
        for (const w of [0, 1] as const) {
          expect(trackedHistogram(square122Pieces(f, s, w)), `${f}/${s}/${w}`).toEqual(SQUARE122_HIST);
        }
      }
    }
    expect(sum(SQUARE122_HIST)).toBe(12672);
  });

  it('1x2x3 block: same histogram from all 24 frames', () => {
    for (const f of FACES) {
      for (const s of sidesOf(f)) {
        expect(trackedHistogram(block123Pieces(f, s)), `${f}/${s}`).toEqual(BLOCK123_HIST);
      }
    }
    expect(sum(BLOCK123_HIST)).toBe(5322240);
  }, 300_000);

  it('the square really is the block minus a corner and an edge', () => {
    for (const f of FACES) {
      for (const s of sidesOf(f)) {
        const big = block123Pieces(f, s);
        for (const w of [0, 1] as const) {
          const small = square122Pieces(f, s, w);
          expect(big.corners).toContain(small.corners[0]);
          for (const e of small.edges) expect(big.edges).toContain(e);
        }
      }
    }
  });

  it('a square is never further than the block containing it — over all 5,322,240 states', () => {
    const f: FaceIdx = 3, s: FaceIdx = 2;
    const big = block123Pieces(f, s);
    const small = square122Pieces(f, s, 0);
    const bigT = trackedTable(big);
    const smallT = trackedTable(small);

    // Where the square's pieces sit inside the block's coordinate.
    const ci = big.corners.indexOf(small.corners[0]);
    const ei = small.edges.map((e) => big.edges.indexOf(e));
    const bc = new Int8Array(2), be = new Int8Array(3);
    const sc = new Int8Array(1), se = new Int8Array(2);
    const bigEdges = edgeStates(3), smallEdges = edgeStates(2);

    let worst = 0;
    for (let v = 0; v < bigT.dist.length; v++) {
      const c = (v / bigEdges) | 0;
      unpackCorners(c, 2, bc);
      unpackEdges(v - c * bigEdges, 3, be);
      sc[0] = bc[ci];
      se[0] = be[ei[0]]; se[1] = be[ei[1]];
      const d = smallT.dist[packCorners(sc, 1) * smallEdges + packEdges(se, 2)];
      if (d > bigT.dist[v]) throw new Error(`square ${d} > block ${bigT.dist[v]} at ${v}`);
      if (bigT.dist[v] - d > worst) worst = bigT.dist[v] - d;
    }
    // The two are genuinely different problems, not the same table twice.
    expect(worst).toBeGreaterThan(0);
  }, 300_000);
});
