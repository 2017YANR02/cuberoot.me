import { describe, it, expect } from 'vitest';
import {
  CORNER_NAMES, CORNER_AXIS, EDGE_NAMES, EDGE_MID, PETAL_FACE, PETAL_CORNER,
  CENTER_CYCLE, EDGE_CYCLE, PETAL_CYCLE,
  solvedRex, applyRexMove, applyRexScramble, isSolved,
  parseRexMoves, rexMoveToString, rexMovesToString, randomRexScramble, type RexMove,
} from '@/app/[lang]/sim/engine/rex/rexState';

// ── Independent geometric re-derivation (move-model fidelity anchor) ──────────
// The Rex Cube is a deep-cut corner-turner: cube [-1,1]^3 cut by 8 spheres, sphere i
// centred at s·Vᵢ (on corner i's body diagonal) through corner i's 3 adjacent
// vertices. A twist = ±120° about the corner axis; the cap = pieces INSIDE sphere i.
// We rebuild the 6 centre / 24 petal / 12 edge representative points + the exact 120°
// rotation FROM SCRATCH here and assert the hard-coded CENTER/EDGE/PETAL_CYCLE tables
// reproduce the geometry — so a transcription error fails even though the puzzle
// would still "scramble" itself. (Cycle structure is s-independent; we use s = 1.3.)

const S = 1.3;
const FACE_NORMAL: [number, number, number][] = [
  [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [-1, 0, 0], [1, 0, 0], // U D F B L R
];
const sub = (a: readonly number[], b: readonly number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len2 = (a: readonly number[]) => a[0] * a[0] + a[1] * a[1] + a[2] * a[2];

function adjacentVertex(i: number): number {
  const a = CORNER_AXIS[i];
  for (let j = 0; j < 8; j++) {
    let d = 0;
    for (let k = 0; k < 3; k++) if (a[k] !== CORNER_AXIS[j][k]) d++;
    if (d === 1) return j;
  }
  return -1;
}
const SPH = CORNER_AXIS.map((V, i) => {
  const c = [V[0] * S, V[1] * S, V[2] * S];
  return { c, R2: len2(sub(c, CORNER_AXIS[adjacentVertex(i)])) };
});
const inSphere = (p: number[], i: number) => len2(sub(p, SPH[i].c)) < SPH[i].R2 - 1e-9;

// representative interior point of each piece (same construction as rexGeometry)
const centerRep = (face: number): number[] => FACE_NORMAL[face].map((v) => v * 0.999);
function petalRep(id: number): number[] {
  const face = PETAL_FACE[id], corner = PETAL_CORNER[id];
  const axis = FACE_NORMAL[face].findIndex((v) => v !== 0);
  const v = CORNER_AXIS[corner].map((c) => c * 0.6);
  v[axis] = FACE_NORMAL[face][axis] * 0.999;
  return v;
}
const edgeRep = (id: number): number[] => EDGE_MID[id].map((v) => v * 0.97);

const CENTER_REP = Array.from({ length: 6 }, (_, i) => centerRep(i));
const PETAL_REP = Array.from({ length: 24 }, (_, i) => petalRep(i));
const EDGE_REP = Array.from({ length: 12 }, (_, i) => edgeRep(i));

function rot120(axis: readonly [number, number, number], dir: 1 | -1, v: number[]): number[] {
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
function nearest(reps: number[][], v: number[]): number {
  let best = -1, bd = Infinity;
  for (let i = 0; i < reps.length; i++) { const d = len2(sub(reps[i], v)); if (d < bd) { bd = d; best = i; } }
  return best;
}
function capOf(reps: number[][], ci: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < reps.length; i++) if (inSphere(reps[i], ci)) out.push(i);
  return out;
}

describe('Rex state — structure', () => {
  it('has 6 centres, 24 petals, 12 edges, 8 corners', () => {
    expect(CORNER_NAMES.length).toBe(8);
    expect(CORNER_AXIS.length).toBe(8);
    expect(EDGE_NAMES.length).toBe(12);
    expect(EDGE_MID.length).toBe(12);
    expect(PETAL_FACE.length).toBe(24);
    expect(PETAL_CORNER.length).toBe(24);
    expect(CENTER_CYCLE.length).toBe(8);
    expect(EDGE_CYCLE.length).toBe(8);
    expect(PETAL_CYCLE.length).toBe(8);
  });

  it('each corner cap is exactly 3 centres + 3 edges + 9 petals', () => {
    for (let ci = 0; ci < 8; ci++) {
      expect(capOf(CENTER_REP, ci).length).toBe(3);
      expect(capOf(EDGE_REP, ci).length).toBe(3);
      expect(capOf(PETAL_REP, ci).length).toBe(9);
    }
  });

  it('memberships: centre in 4 spheres, petal in 3, edge in 2', () => {
    for (let i = 0; i < 6; i++) expect(CORNER_AXIS.filter((_, ci) => inSphere(CENTER_REP[i], ci)).length).toBe(4);
    for (let i = 0; i < 24; i++) expect(CORNER_AXIS.filter((_, ci) => inSphere(PETAL_REP[i], ci)).length).toBe(3);
    for (let i = 0; i < 12; i++) expect(CORNER_AXIS.filter((_, ci) => inSphere(EDGE_REP[i], ci)).length).toBe(2);
  });

  it('each corner: 1 centre 3-cycle, 1 edge 3-cycle, 3 petal 3-cycles', () => {
    for (let ci = 0; ci < 8; ci++) {
      expect(CENTER_CYCLE[ci].length).toBe(1);
      expect(CENTER_CYCLE[ci][0].length).toBe(3);
      expect(EDGE_CYCLE[ci].length).toBe(1);
      expect(EDGE_CYCLE[ci][0].length).toBe(3);
      expect(PETAL_CYCLE[ci].length).toBe(3);
      for (const cyc of PETAL_CYCLE[ci]) expect(cyc.length).toBe(3);
    }
  });
});

describe('Rex state — move model matches independent geometry', () => {
  it('applyRexMove permutes centres/petals/edges exactly as the +120°/−120° rotation predicts', () => {
    for (let ci = 0; ci < 8; ci++) {
      for (const dir of [1, -1] as const) {
        const next = applyRexMove(solvedRex(), { corner: ci, dir });
        const check = (reps: number[][], got: number[], n: number) => {
          const expected = Array.from({ length: n }, (_, i) => i);
          for (const s of capOf(reps, ci)) {
            const dst = nearest(reps, rot120(CORNER_AXIS[ci], dir, reps[s]));
            expected[dst] = s; // piece id s lands in slot dst
          }
          expect(got.join(',')).toBe(expected.join(','));
        };
        check(CENTER_REP, next.centers, 6);
        check(EDGE_REP, next.edges, 12);
        check(PETAL_REP, next.petals, 24);
      }
    }
  });
});

describe('Rex state — algebra', () => {
  it('corner^3 = identity', () => {
    for (let ci = 0; ci < 8; ci++) {
      let s = solvedRex();
      for (let k = 0; k < 3; k++) s = applyRexMove(s, { corner: ci, dir: 1 });
      expect(isSolved(s)).toBe(true);
    }
  });

  it('bare then primed = identity', () => {
    for (let ci = 0; ci < 8; ci++) {
      let s = solvedRex();
      s = applyRexMove(s, { corner: ci, dir: 1 });
      s = applyRexMove(s, { corner: ci, dir: -1 });
      expect(isSolved(s)).toBe(true);
    }
  });

  it('every move is an even permutation on each piece set (3-cycles only)', () => {
    const parity = (perm: number[]): number => {
      let swaps = 0; const a = perm.slice();
      for (let i = 0; i < a.length; i++) while (a[i] !== i) { const j = a[i]; [a[i], a[j]] = [a[j], a[i]]; swaps++; }
      return swaps % 2;
    };
    for (let ci = 0; ci < 8; ci++) {
      const s = applyRexMove(solvedRex(), { corner: ci, dir: 1 });
      expect(parity(s.centers)).toBe(0);
      expect(parity(s.edges)).toBe(0);
      expect(parity(s.petals)).toBe(0);
    }
  });
});

describe('Rex state — notation', () => {
  it('parse / stringify round-trips', () => {
    const txt = "UFR UFL' DBL DBR' UBL UFR'";
    const moves = parseRexMoves(txt);
    expect(moves.length).toBe(6);
    expect(rexMovesToString(moves)).toBe(txt);
  });

  it('skips unknown tokens', () => {
    expect(parseRexMoves('UFR foo R2 DBL').length).toBe(2);
  });

  it('rexMoveToString uses bare for the clockwise (−120) twist, prime for +120', () => {
    expect(rexMoveToString({ corner: 7, dir: -1 })).toBe('UFR');
    expect(rexMoveToString({ corner: 7, dir: 1 })).toBe("UFR'");
  });
});

describe('Rex state — scramble', () => {
  it('randomRexScramble never repeats a corner consecutively and stays a permutation', () => {
    for (let trial = 0; trial < 50; trial++) {
      const moves = randomRexScramble(25);
      expect(moves.length).toBe(25);
      for (let i = 1; i < moves.length; i++) expect(moves[i].corner).not.toBe(moves[i - 1].corner);
      const s = applyRexScramble(moves);
      expect(new Set(s.centers).size).toBe(6);
      expect(new Set(s.petals).size).toBe(24);
      expect(new Set(s.edges).size).toBe(12);
    }
  });

  it('a scramble followed by its inverse returns to solved', () => {
    const moves = randomRexScramble(30);
    const inv: RexMove[] = moves.slice().reverse().map((m) => ({ corner: m.corner, dir: m.dir === 1 ? -1 : 1 }));
    let s = applyRexScramble(moves);
    for (const m of inv) s = applyRexMove(s, m);
    expect(isSolved(s)).toBe(true);
  });
});
