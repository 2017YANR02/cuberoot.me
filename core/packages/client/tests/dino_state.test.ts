import { describe, it, expect } from 'vitest';
import {
  EDGE_NAMES, CORNER_NAMES, CORNER_AXIS, CORNER_CYCLE,
  solvedDino, applyDinoMove, applyDinoScramble, isSolved,
  parseDinoMoves, dinoMoveToString, dinoMovesToString,
  randomDinoScramble, type DinoMove,
} from '@/app/[lang]/sim/engine/dino/dinoState';

// ── Independent geometric re-derivation (move-model fidelity anchor) ──────────
// The Dino Cube is corner-turning: cube [-1,1]^3, 12 edge pieces (one per cube
// edge, coords with one 0 and two ±1), 8 corner axes (body diagonals ±1,±1,±1),
// each twist a ±120° rotation 3-cycling the 3 edges around that corner. We rebuild
// the edge centers + the exact 120° rotation FROM SCRATCH here and assert the
// hard-coded CORNER_CYCLE table reproduces the geometry corner-for-corner — so a
// transcription error in the table would fail even though the puzzle would still
// "scramble" itself.

const EDGE_VEC: Record<string, [number, number, number]> = {};
for (const name of EDGE_NAMES) {
  let x = 0, y = 0, z = 0;
  if (name.includes('U')) y = 1; if (name.includes('D')) y = -1;
  if (name.includes('R')) x = 1; if (name.includes('L')) x = -1;
  if (name.includes('F')) z = 1; if (name.includes('B')) z = -1;
  EDGE_VEC[name] = [x, y, z];
}

function rot120(axis: readonly [number, number, number], dir: 1 | -1, v: [number, number, number]): [number, number, number] {
  const n = Math.hypot(axis[0], axis[1], axis[2]);
  const ux = axis[0] / n, uy = axis[1] / n, uz = axis[2] / n;
  const th = dir * (2 * Math.PI / 3);
  const c = Math.cos(th), s = Math.sin(th), C1 = 1 - c;
  const [x, y, z] = v;
  return [
    (c + ux * ux * C1) * x + (ux * uy * C1 - uz * s) * y + (ux * uz * C1 + uy * s) * z,
    (uy * ux * C1 + uz * s) * x + (c + uy * uy * C1) * y + (uy * uz * C1 - ux * s) * z,
    (uz * ux * C1 - uy * s) * x + (uz * uy * C1 + ux * s) * y + (c + uz * uz * C1) * z,
  ];
}

function nearestEdgeSlot(v: [number, number, number]): number {
  let best = -1, bd = Infinity;
  for (let i = 0; i < EDGE_NAMES.length; i++) {
    const e = EDGE_VEC[EDGE_NAMES[i]];
    const d = Math.hypot(v[0] - e[0], v[1] - e[1], v[2] - e[2]);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

describe('Dino state — structure', () => {
  it('has 12 edges and 8 corners', () => {
    expect(EDGE_NAMES.length).toBe(12);
    expect(CORNER_NAMES.length).toBe(8);
    expect(CORNER_AXIS.length).toBe(8);
    expect(CORNER_CYCLE.length).toBe(8);
  });

  it('each corner cycle is 3 distinct slots, and the union over all corners covers every edge', () => {
    const seen = new Set<number>();
    for (const cyc of CORNER_CYCLE) {
      expect(new Set(cyc).size).toBe(3);
      for (const s of cyc) { expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThan(12); seen.add(s); }
    }
    // every edge is touched by at least one corner (it's an edge of exactly 2 corners)
    expect(seen.size).toBe(12);
  });

  it('each edge belongs to exactly 2 corner cycles (its 2 end corners)', () => {
    for (let slot = 0; slot < 12; slot++) {
      const count = CORNER_CYCLE.filter((c) => c.includes(slot)).length;
      expect(count).toBe(2);
    }
  });
});

describe('Dino state — move model matches independent geometry', () => {
  it('CORNER_CYCLE reproduces the +120° rotation 3-cycle for every corner', () => {
    for (let ci = 0; ci < 8; ci++) {
      const axis = CORNER_AXIS[ci];
      const [a, b, c] = CORNER_CYCLE[ci];
      // +120 should map slot a's center → slot b's center, b→c, c→a
      const pairs: Array<[number, number]> = [[a, b], [b, c], [c, a]];
      for (const [from, to] of pairs) {
        const rv = rot120(axis, 1, EDGE_VEC[EDGE_NAMES[from]]);
        expect(nearestEdgeSlot(rv)).toBe(to);
      }
    }
  });

  it('applying a move permutes pieces exactly as the geometry predicts', () => {
    for (let ci = 0; ci < 8; ci++) {
      for (const dir of [1, -1] as const) {
        const perm = applyDinoMove(solvedDino(), { corner: ci, dir });
        // geometry: piece that was at slot s moves to slot s' = nearestEdge(rot(s))
        const expected = solvedDino();
        const axis = CORNER_AXIS[ci];
        const moving = new Set(CORNER_CYCLE[ci]);
        for (let s = 0; s < 12; s++) {
          if (!moving.has(s)) continue;
          const dst = nearestEdgeSlot(rot120(axis, dir, EDGE_VEC[EDGE_NAMES[s]]));
          expected[dst] = s; // piece id s lands in slot dst
        }
        expect(perm.join(',')).toBe(expected.join(','));
      }
    }
  });
});

describe('Dino state — algebra', () => {
  it('corner^3 = identity', () => {
    for (let ci = 0; ci < 8; ci++) {
      let p = solvedDino();
      for (let k = 0; k < 3; k++) p = applyDinoMove(p, { corner: ci, dir: 1 });
      expect(isSolved(p)).toBe(true);
    }
  });

  it('bare then primed = identity', () => {
    for (let ci = 0; ci < 8; ci++) {
      let p = solvedDino();
      p = applyDinoMove(p, { corner: ci, dir: 1 });
      p = applyDinoMove(p, { corner: ci, dir: -1 });
      expect(isSolved(p)).toBe(true);
    }
  });

  it('every move is an even permutation (parity preserved)', () => {
    const parity = (perm: number[]): number => {
      let swaps = 0;
      const a = perm.slice();
      for (let i = 0; i < a.length; i++) {
        while (a[i] !== i) { const j = a[i]; [a[i], a[j]] = [a[j], a[i]]; swaps++; }
      }
      return swaps % 2;
    };
    for (let ci = 0; ci < 8; ci++) {
      expect(parity(applyDinoMove(solvedDino(), { corner: ci, dir: 1 }))).toBe(0);
    }
  });
});

describe('Dino state — notation', () => {
  it('parse / stringify round-trips', () => {
    const txt = "UFR UFL' DBL DBR' UBL UFR'";
    const moves = parseDinoMoves(txt);
    expect(moves.length).toBe(6);
    expect(dinoMovesToString(moves)).toBe(txt);
  });

  it('skips unknown tokens', () => {
    expect(parseDinoMoves('UFR foo R2 DBL').length).toBe(2);
  });

  it('dinoMoveToString uses bare for the clockwise (-120) twist, prime for +120', () => {
    // Bare = clockwise = dir -1 (R-is-clockwise intuition); primed = CCW = dir +1.
    expect(dinoMoveToString({ corner: 7, dir: -1 })).toBe('UFR');
    expect(dinoMoveToString({ corner: 7, dir: 1 })).toBe("UFR'");
  });
});

describe('Dino state — scramble', () => {
  it('randomDinoScramble never repeats a corner consecutively and is legal', () => {
    for (let trial = 0; trial < 50; trial++) {
      const moves = randomDinoScramble(15);
      expect(moves.length).toBe(15);
      for (let i = 1; i < moves.length; i++) expect(moves[i].corner).not.toBe(moves[i - 1].corner);
      // applies cleanly and (almost surely) leaves the cube unsolved
      const perm = applyDinoScramble(moves);
      expect(perm.length).toBe(12);
      expect(new Set(perm).size).toBe(12); // still a permutation
    }
  });

  it('a scramble followed by its inverse returns to solved', () => {
    const moves = randomDinoScramble(20);
    const inv: DinoMove[] = moves.slice().reverse().map((m) => ({ corner: m.corner, dir: m.dir === 1 ? -1 : 1 }));
    let p = applyDinoScramble(moves);
    for (const m of inv) p = applyDinoMove(p, m);
    expect(isSolved(p)).toBe(true);
  });
});
