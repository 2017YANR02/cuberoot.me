import { describe, it, expect } from 'vitest';
import {
  CORNER_NAMES, CENTER_NAMES, CORNER_AXIS, CENTER_AXIS,
  CORNER_CYCLE, CENTER_CYCLE, CORNER_ORI_DELTA,
  solvedSkewb, applySkewbMove, applySkewbScramble, isSolved,
  parseSkewbMoves, skewbMoveToString, skewbMovesToString,
  randomSkewbScramble, type SkewbMove,
} from '@/app/[lang]/sim/engine/skewb/skewbState';

// ── Independent geometric re-derivation (move-model fidelity anchor) ──────────
// The Skewb is deep-cut corner-turning: cube [-1,1]^3, 8 corners (±1,±1,±1), 6 face
// centres (±1 on one axis), 8 grips (body diagonals), each twist a ±120° rotation of
// the cap (the side of the plane ⊥ the grip diagonal). The grip corner spins in
// place; 3 corners + 3 centres 3-cycle. We rebuild positions + the exact 120°
// rotation + sticker-frame orientation FROM SCRATCH and assert the hard-coded tables
// reproduce the geometry — a transcription error would fail even though the puzzle
// would still "scramble" itself.

type V = [number, number, number];
const CORNER_POS: V[] = CORNER_AXIS.map((a) => [...a] as V);
const CENTER_POS: V[] = CENTER_AXIS.map((a) => [...a] as V);

function rot120(axis: readonly number[], dir: 1 | -1, v: V): V {
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
const nearest = (pool: V[], v: V): number => {
  let best = -1, bd = Infinity;
  for (let i = 0; i < pool.length; i++) {
    const d = Math.hypot(v[0] - pool[i][0], v[1] - pool[i][1], v[2] - pool[i][2]);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
};
const veq = (a: V, b: V) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(a[2] - b[2]) < 1e-6;
// the 3 sticker normals of a home corner, in fixed x,y,z order
const cornerNormals = (p: V): V[] => [[Math.sign(p[0]), 0, 0], [0, Math.sign(p[1]), 0], [0, 0, Math.sign(p[2])]];
function oriDelta(ci: number): number {
  const rotated = cornerNormals(CORNER_POS[ci]).map((n) => rot120(CORNER_AXIS[ci], 1, n));
  const landed = nearest(CORNER_POS, rot120(CORNER_AXIS[ci], 1, CORNER_POS[ci]));
  const destHome = cornerNormals(CORNER_POS[landed]);
  for (let s = 0; s < 3; s++) {
    if (rotated.every((r, a) => veq(r, destHome[(a + s) % 3]))) return s;
  }
  return -1;
}

describe('Skewb state — structure', () => {
  it('has 8 corners + 6 centres and matching table lengths', () => {
    expect(CORNER_NAMES.length).toBe(8);
    expect(CENTER_NAMES.length).toBe(6);
    expect(CORNER_AXIS.length).toBe(8);
    expect(CENTER_AXIS.length).toBe(6);
    expect(CORNER_CYCLE.length).toBe(8);
    expect(CENTER_CYCLE.length).toBe(8);
    expect(CORNER_ORI_DELTA.length).toBe(8);
  });

  it('two corner orbits of 4 that never mix (position-cycling)', () => {
    const parent = [...Array(8).keys()];
    const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])));
    for (const cyc of CORNER_CYCLE) for (let k = 0; k < 3; k++) parent[find(cyc[k])] = find(cyc[(k + 1) % 3]);
    const orbits = new Map<number, number[]>();
    for (let i = 0; i < 8; i++) { const r = find(i); (orbits.get(r) ?? orbits.set(r, []).get(r)!).push(i); }
    const sizes = [...orbits.values()].map((o) => o.length).sort();
    expect(sizes).toEqual([4, 4]);
  });
});

describe('Skewb state — move model matches independent geometry', () => {
  it('the grip corner is the cap corner that stays put (spins in place)', () => {
    for (let g = 0; g < 8; g++) {
      // grip corner must NOT be one of the 3 cycling slots
      expect(CORNER_CYCLE[g].includes(g)).toBe(false);
      // and {g} ∪ cycle = exactly the 4 cap corners (dot with axis > 0)
      const cap = [];
      for (let i = 0; i < 8; i++) {
        const d = CORNER_POS[i][0] * CORNER_AXIS[g][0] + CORNER_POS[i][1] * CORNER_AXIS[g][1] + CORNER_POS[i][2] * CORNER_AXIS[g][2];
        if (d > 1e-6) cap.push(i);
      }
      expect(new Set([g, ...CORNER_CYCLE[g]])).toEqual(new Set(cap));
    }
  });

  it('CORNER_CYCLE reproduces the +120° 3-cycle of corners', () => {
    for (let g = 0; g < 8; g++) {
      const [a, b, c] = CORNER_CYCLE[g];
      for (const [from, to] of [[a, b], [b, c], [c, a]] as const) {
        expect(nearest(CORNER_POS, rot120(CORNER_AXIS[g], 1, CORNER_POS[from]))).toBe(to);
      }
    }
  });

  it('CENTER_CYCLE reproduces the +120° 3-cycle of centres', () => {
    for (let g = 0; g < 8; g++) {
      const [a, b, c] = CENTER_CYCLE[g];
      // centres rotate about the GRIP's corner axis (CENTER_AXIS is per-centre).
      for (const [from, to] of [[a, b], [b, c], [c, a]] as const) {
        expect(nearest(CENTER_POS, rot120(CORNER_AXIS[g], 1, CENTER_POS[from]))).toBe(to);
      }
    }
  });

  it('CORNER_ORI_DELTA reproduces the sticker-frame twist for every grip', () => {
    for (let g = 0; g < 8; g++) expect(CORNER_ORI_DELTA[g]).toBe(oriDelta(g));
  });
});

describe('Skewb state — algebra', () => {
  it('grip^3 = identity (both directions)', () => {
    for (let g = 0; g < 8; g++) {
      for (const dir of [1, -1] as const) {
        let s = solvedSkewb();
        for (let k = 0; k < 3; k++) s = applySkewbMove(s, { corner: g, dir });
        expect(isSolved(s)).toBe(true);
      }
    }
  });

  it('bare then primed = identity', () => {
    for (let g = 0; g < 8; g++) {
      let s = solvedSkewb();
      s = applySkewbMove(s, { corner: g, dir: 1 });
      s = applySkewbMove(s, { corner: g, dir: -1 });
      expect(isSolved(s)).toBe(true);
    }
  });

  it('every move keeps corner perm + centre perm valid permutations', () => {
    // (Skewb has NO mod-3 corner-orientation sum invariant: a move twists 4 corners
    //  by d each = 4d ≡ d, not conserved. grip^3 / inverse / scramble cover ori.)
    for (let g = 0; g < 8; g++) {
      const s = applySkewbMove(solvedSkewb(), { corner: g, dir: 1 });
      expect(new Set(s.cornerPerm).size).toBe(8);
      expect(new Set(s.centerPerm).size).toBe(6);
    }
  });
});

describe('Skewb state — WCA notation', () => {
  it('parse / stringify round-trips (incl. two-letter UL/UR families)', () => {
    const txt = "R U' L B' F D UL UR'";
    const moves = parseSkewbMoves(txt);
    expect(moves.length).toBe(8);
    expect(skewbMovesToString(moves)).toBe(txt);
  });

  it('skips unknown tokens (old engine names, doubles)', () => {
    expect(parseSkewbMoves('UFR foo R2 B').length).toBe(1); // only B survives
  });

  it('WCA letters map to the right grips (cubing.js frame)', () => {
    // R=DRB(6) U=UBL(3) L=DLF(5) B=DBL(7); F=UFR(0) D=DFR(4) UL=UFL(1) UR=UBR(2)
    const idx = (tok: string) => parseSkewbMoves(tok)[0].corner;
    expect([idx('R'), idx('U'), idx('L'), idx('B')]).toEqual([6, 3, 5, 7]);
    expect([idx('F'), idx('D'), idx('UL'), idx('UR')]).toEqual([0, 4, 1, 2]);
  });

  it('bare = clockwise (dir -1), primed = +120 (dir +1)', () => {
    expect(skewbMoveToString({ corner: 6, dir: -1 })).toBe('R');
    expect(skewbMoveToString({ corner: 6, dir: 1 })).toBe("R'");
  });
});

describe('Skewb state — scramble', () => {
  it('randomSkewbScramble never repeats a grip consecutively and stays a valid state', () => {
    for (let trial = 0; trial < 50; trial++) {
      const moves = randomSkewbScramble(12);
      expect(moves.length).toBe(12);
      for (let i = 1; i < moves.length; i++) expect(moves[i].corner).not.toBe(moves[i - 1].corner);
      // A WCA scramble uses only the four axis letters R U L B.
      for (const tok of skewbMovesToString(moves).split(' ')) expect(tok.replace("'", '')).toMatch(/^[RULB]$/);
      const s = applySkewbScramble(moves);
      expect(new Set(s.cornerPerm).size).toBe(8);
      expect(new Set(s.centerPerm).size).toBe(6);
    }
  });

  it('a scramble followed by its inverse returns to solved', () => {
    const moves = randomSkewbScramble(20);
    const inv: SkewbMove[] = moves.slice().reverse().map((m) => ({ corner: m.corner, dir: m.dir === 1 ? -1 : 1 }));
    let s = applySkewbScramble(moves);
    for (const m of inv) s = applySkewbMove(s, m);
    expect(isSolved(s)).toBe(true);
  });
});
