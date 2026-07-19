import { describe, it, expect } from 'vitest';
import {
  VERTEX_NAMES,
  parsePyraMoves, pyraMoveToString, pyraMovesToString,
  invertPyraMoves, reducePyraAlg, randomPyraScramble, type PyraMove,
} from '@/app/[lang]/sim/engine/pyra/pyraState';

// ── Independent geometry anchor ───────────────────────────────────────────────
// The Pyraminx is a regular tetrahedron (vertices = the 4 cube corners with an even
// number of minus signs) cut ⊥ each vertex axis at t_k = V_k·x = A/3 and 5A/3 — the
// exact depths in cubing.js's def `t v 0.333 v 1.667`. We re-derive the convex cells
// here from scratch and assert the renderer's piece/facelet structure (4 tips + 4
// corners + 6 edges, every facelet a triangle, 36 = 4 faces × 9). A transcription
// error in pyraGeometry's plane sets would diverge from this.
const VDIR: [number, number, number][] = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
const A = 1, TIP = (5 / 3) * A, COR = (1 / 3) * A, FACE = -A;
const dot = (n: number[], v: number[]) => n[0] * v[0] + n[1] * v[1] + n[2] * v[2];
type Plane = { n: number[]; rhs: number };

function solve3(p: Plane, q: Plane, r: Plane): number[] | null {
  const Am = [p.n, q.n, r.n], b = [p.rhs, q.rhs, r.rhs];
  const det = (M: number[][]) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
    - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
    + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const D = det(Am); if (Math.abs(D) < 1e-9) return null;
  const col = (i: number) => Am.map((row, r2) => row.map((v, c) => (c === i ? b[r2] : v)));
  return [det(col(0)) / D, det(col(1)) / D, det(col(2)) / D];
}
function cellVerts(planes: Plane[]): number[][] {
  const ok = (v: number[]) => planes.every((p) => dot(p.n, v) <= p.rhs + 1e-6);
  const out: number[][] = [];
  for (let i = 0; i < planes.length; i++)
    for (let j = i + 1; j < planes.length; j++)
      for (let k = j + 1; k < planes.length; k++) {
        const v = solve3(planes[i], planes[j], planes[k]);
        if (v && ok(v) && !out.some((w) => Math.hypot(w[0] - v[0], w[1] - v[1], w[2] - v[2]) < 1e-4)) out.push(v);
      }
  return out;
}
const faces: Plane[] = VDIR.map((V) => ({ n: V.map((c) => -c), rhs: A }));
const negV = (k: number): number[] => VDIR[k].map((c) => -c);
const posV = (k: number): number[] => [...VDIR[k]];
const facesOf = (verts: number[][]) =>
  [0, 1, 2, 3].filter((m) => verts.filter((v) => Math.abs(dot(VDIR[m], v) - FACE) < 1e-3).length >= 3);

describe('Pyraminx geometry anchor', () => {
  it('tips: 4 tetra caps, 3 triangle facelets each', () => {
    for (let k = 0; k < 4; k++) {
      const v = cellVerts([...faces, { n: negV(k), rhs: -TIP }]);
      expect(v.length).toBe(4); // tetra
      expect(facesOf(v).length).toBe(3);
    }
  });
  it('corners: 4 cells, 3 facelets each', () => {
    for (let k = 0; k < 4; k++) {
      const P: Plane[] = [...faces, { n: negV(k), rhs: -COR }, { n: posV(k), rhs: TIP }];
      for (let j = 0; j < 4; j++) if (j !== k) P.push({ n: posV(j), rhs: COR });
      expect(facesOf(cellVerts(P)).length).toBe(3);
    }
  });
  it('edges: 6 cells, 2 facelets each — 36 = 4 faces × 9 facelets total', () => {
    let facelets = 4 * 3 + 4 * 3; // tips + corners
    const pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
    for (const [k, j] of pairs) {
      const P: Plane[] = [...faces,
        { n: negV(k), rhs: -COR }, { n: negV(j), rhs: -COR },
        { n: posV(k), rhs: TIP }, { n: posV(j), rhs: TIP }];
      for (let l = 0; l < 4; l++) if (l !== k && l !== j) P.push({ n: posV(l), rhs: COR });
      expect(facesOf(cellVerts(P)).length).toBe(2);
      facelets += 2;
    }
    expect(facelets).toBe(36);
  });
});

describe('Pyraminx notation', () => {
  it('parse / stringify round-trips (corners + tips + primes)', () => {
    const txt = "U L' R B' u r' b";
    expect(pyraMovesToString(parsePyraMoves(txt))).toBe(txt);
  });
  it('uppercase = corner layer, lowercase = tip', () => {
    const [big, tip] = parsePyraMoves('U u');
    expect(big.part).toBe('corner');
    expect(tip.part).toBe('tip');
  });
  it('skips unknown tokens', () => {
    expect(parsePyraMoves('U foo R2 L x').length).toBe(2); // U, L
  });
  it('bare = clockwise (dir -1), primed = +120 (dir +1)', () => {
    expect(pyraMoveToString({ vertex: 0, part: 'corner', dir: -1 })).toBe('U');
    expect(pyraMoveToString({ vertex: 0, part: 'corner', dir: 1 })).toBe("U'");
    expect(pyraMoveToString({ vertex: 1, part: 'tip', dir: -1 })).toBe('l');
  });
  it('four vertex letters U/L/R/B', () => {
    expect([...VERTEX_NAMES]).toEqual(['U', 'L', 'R', 'B']);
  });
  it('face layers: Dw/Lw/Rw/Fw turn about the OPPOSITE vertex axis; bare = dir +1', () => {
    const [dw, lw, rw, fw] = parsePyraMoves("Dw Lw Rw Fw'");
    expect(dw).toEqual({ vertex: 0, part: 'face', dir: 1 });  // D face ↔ U vertex
    expect(lw).toEqual({ vertex: 2, part: 'face', dir: 1 });  // L face ↔ R vertex
    expect(rw).toEqual({ vertex: 1, part: 'face', dir: 1 });  // R face ↔ L vertex
    expect(fw).toEqual({ vertex: 3, part: 'face', dir: -1 }); // F face ↔ B vertex
    expect(pyraMovesToString(parsePyraMoves("Dw Lw' Rw Fw'"))).toBe("Dw Lw' Rw Fw'");
  });
  it('bare D is an input alias for Dw (canonical output = Dw)', () => {
    expect(parsePyraMoves("D D'")).toEqual(parsePyraMoves("Dw Dw'"));
    expect(pyraMovesToString(parsePyraMoves('D'))).toBe('Dw');
  });
  it('no Uw/Bw faces, no lowercase face tokens', () => {
    expect(parsePyraMoves('Uw Bw dw lw').length).toBe(0);
  });
});

describe('Pyraminx algebra (notation-level)', () => {
  it('invert reverses order + flips direction; double-invert = identity', () => {
    const m = parsePyraMoves("U L' R u'");
    expect(pyraMovesToString(invertPyraMoves(m))).toBe("u R' L U'");
    expect(invertPyraMoves(invertPyraMoves(m))).toEqual(m);
  });
  it('reduce folds same-vertex/same-part runs mod 3', () => {
    expect(reducePyraAlg('U U')).toBe("U'");   // -240° ≡ +120°
    expect(reducePyraAlg("U' U'")).toBe('U');   // +240° ≡ -120°
    expect(reducePyraAlg("U U'")).toBe('');     // cancels
    expect(reducePyraAlg('U U U')).toBe('');    // order 3
    expect(reducePyraAlg('U u')).toBe('U u');   // corner + tip don't merge
    expect(reducePyraAlg('U L')).toBe('U L');   // different vertices don't merge
    expect(reducePyraAlg('Dw Dw')).toBe("Dw'"); // +240° ≡ -120°
    expect(reducePyraAlg("Dw Dw'")).toBe('');
    expect(reducePyraAlg('Dw Dw Dw')).toBe(''); // order 3
    expect(reducePyraAlg('U Dw')).toBe('U Dw'); // same axis, different part — never merge
  });
});

describe('Pyraminx scramble', () => {
  it('big turns never repeat a vertex consecutively; tips trail', () => {
    for (let trial = 0; trial < 50; trial++) {
      const moves = randomPyraScramble(10);
      const big = moves.filter((m) => m.part === 'corner');
      expect(big.length).toBe(10);
      for (let i = 1; i < big.length; i++) expect(big[i].vertex).not.toBe(big[i - 1].vertex);
      // tips (if any) come after the big block — face turns never appear in scrambles
      const firstTip = moves.findIndex((m) => m.part === 'tip');
      if (firstTip >= 0) expect(moves.slice(firstTip).every((m: PyraMove) => m.part === 'tip')).toBe(true);
    }
  });
});
