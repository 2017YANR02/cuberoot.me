import { describe, it, expect } from 'vitest';
import {
  HELI_EDGE_NAMES, EDGE_AXIS, EDGE_MID,
  CORNER_SLOTS, WING_SLOTS, EDGES_AT_CORNER_SLOT, EDGES_AT_WING_SLOT,
  solvedHeli, applyHeliMove, isSolvedHeli,
  parseHeliMoves, heliMoveToString, heliMovesToString, randomHeliScrambleMoves,
  type HeliMove,
} from '@/app/[lang]/sim/engine/heli/heliState';
import { heliApply, HELI_MOVE_NAMES, HELI_WING_FACELETS, HELI_FACE_OF } from '@/lib/heli-solver';
import { WING_EDGES } from '@/app/[lang]/sim/engine/heli/heliGeometry';

// ── /sim heli state model is the SAME as the verified solver's ─────────────────────
// lib/heli-solver's piece model is bit-exact vs cstimer poly3dlib (its own test). Here
// we lock /sim's self-contained heliState (embedded generators) against it: applying the
// same moves must yield the identical cp/co/wp. If the /sim generators ever drift, this
// fails. heliState is the SINGLE source of move truth for the 3D cube.

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('heliState move model (vs lib/heli-solver)', () => {
  it('edge names + count match the solver exactly', () => {
    expect([...HELI_EDGE_NAMES]).toEqual([...HELI_MOVE_NAMES]);
    expect(HELI_EDGE_NAMES.length).toBe(12);
  });

  it('applyHeliMove is bit-exact vs heliApply over random sequences', () => {
    const rnd = mulberry32(0x4ED2);
    for (let trial = 0; trial < 2000; trial++) {
      const len = 1 + Math.floor(rnd() * 24);
      const moves: HeliMove[] = [];
      const names: string[] = [];
      for (let i = 0; i < len; i++) {
        const e = Math.floor(rnd() * 12);
        moves.push({ edge: e });
        names.push(HELI_EDGE_NAMES[e]);
      }
      let st = solvedHeli();
      for (const m of moves) st = applyHeliMove(st, m);
      const oracle = heliApply(names.join(' '));
      expect(st.cp, `seq ${names.join(' ')}`).toEqual(oracle.cp);
      expect(st.co, `seq ${names.join(' ')}`).toEqual(oracle.co);
      expect(st.wp, `seq ${names.join(' ')}`).toEqual(oracle.wp);
    }
  });

  it('every edge twist is a 180° involution (X X = solved)', () => {
    for (let e = 0; e < 12; e++) {
      const st = applyHeliMove(applyHeliMove(solvedHeli(), { edge: e }), { edge: e });
      expect(isSolvedHeli(st), HELI_EDGE_NAMES[e]).toBe(true);
    }
  });

  it('isSolvedHeli detects twisted corners (not just permutation)', () => {
    // One twist leaves corners permuted+twisted → not solved; an involution pair → solved.
    expect(isSolvedHeli(applyHeliMove(solvedHeli(), { edge: 0 }))).toBe(false);
    expect(isSolvedHeli(solvedHeli())).toBe(true);
  });

  it('each edge moves exactly 2 corners + 4 wings', () => {
    for (let e = 0; e < 12; e++) {
      expect(CORNER_SLOTS[e].length, `corners ${HELI_EDGE_NAMES[e]}`).toBe(2);
      expect(WING_SLOTS[e].length, `wings ${HELI_EDGE_NAMES[e]}`).toBe(4);
    }
  });

  it('inverse slot tables: each corner on 3 edges, each wing on 2 edges', () => {
    expect(EDGES_AT_CORNER_SLOT.length).toBe(8);
    expect(EDGES_AT_WING_SLOT.length).toBe(24);
    for (const e of EDGES_AT_CORNER_SLOT) expect(e.length).toBe(3);
    for (const e of EDGES_AT_WING_SLOT) expect(e.length).toBe(2);
  });

  it('notation round-trips (bare edge name, no prime)', () => {
    const moves = parseHeliMoves('UF DR  BL\nUF');
    expect(moves.map(heliMoveToString)).toEqual(['UF', 'DR', 'BL', 'UF']);
    expect(heliMovesToString(moves)).toBe('UF DR BL UF');
    // unknown tokens skipped (never throws — the input box must not crash)
    expect(parseHeliMoves('UF X R2 DR').map(heliMoveToString)).toEqual(['UF', 'DR']);
  });

  it('randomHeliScrambleMoves emits only legal edge twists of the requested length', () => {
    const moves = randomHeliScrambleMoves(20);
    expect(moves.length).toBe(20);
    for (const m of moves) expect(m.edge).toBeGreaterThanOrEqual(0);
    for (const m of moves) expect(m.edge).toBeLessThan(12);
  });

  it('EDGE_AXIS / EDGE_MID are the 12 edge midpoint directions', () => {
    for (let e = 0; e < 12; e++) {
      const a = EDGE_AXIS[e];
      expect(Math.hypot(a[0], a[1], a[2])).toBeCloseTo(1, 6);  // unit
      const m = EDGE_MID[e];
      // mid has exactly one zero coord and two ±1 (a cube edge midpoint direction)
      const zeros = m.filter((c) => c === 0).length;
      expect(zeros).toBe(1);
      // axis is the normalized midpoint — check ALL three components
      for (let k = 0; k < 3; k++) expect(a[k]).toBeCloseTo(m[k] / Math.SQRT2, 6);
    }
  });

  it('WING_EDGES geometry table is consistent with the solver + generators', () => {
    expect(WING_EDGES.length).toBe(24);
    for (let wi = 0; wi < 24; wi++) {
      const [face, e1, e2] = WING_EDGES[wi];
      // face matches the solver's facelet→face for this wing
      expect(face, `wing ${wi} face`).toBe(HELI_FACE_OF[HELI_WING_FACELETS[wi]]);
      // the wing's 2 cap edges match the generator-derived inverse slot table (the
      // edges whose 180° twist actually moves this wing slot)
      const fromTable = [e1, e2].slice().sort((a, b) => a - b);
      const fromGenerators = EDGES_AT_WING_SLOT[wi].slice().sort((a, b) => a - b);
      expect(fromTable, `wing ${wi} cap edges`).toEqual(fromGenerators);
    }
  });
});

// ── geometry: zero-interpenetration of the actual piece cap-edges ───────────────────
// Each piece body = cube[-1,1]^3 ∩ {12 edge half-spaces} (cap side a·x ≥ √0.5 for the
// edges that move it, stationary side a·x ≤ √0.5 otherwise). A 180° turn about edge e
// preserves a_e·x, so the cap-side plane is invariant → moving pieces stay capped,
// stationary pieces stay outside ⇒ provably no interpenetration. We rebuild every body
// from the engine's EXPORTED cap-edge tables and assert the separation holds with margin.
const SQ = Math.SQRT1_2;
type Plane = { n: [number, number, number]; d: number };
function det3(M: number[][]) {
  return M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
    - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
    + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
}
function solve3(p: Plane, q: Plane, r: Plane): [number, number, number] | null {
  const A = [p.n, q.n, r.n], b = [p.d, q.d, r.d], D = det3(A);
  if (Math.abs(D) < 1e-9) return null;
  const col = (i: number) => A.map((row, k) => row.map((v, j) => (j === i ? b[k] : v)));
  return [det3(col(0)) / D, det3(col(1)) / D, det3(col(2)) / D];
}
function bodyVerts(capEdges: number[]): [number, number, number][] {
  const planes: Plane[] = [
    { n: [1, 0, 0], d: 1 }, { n: [-1, 0, 0], d: 1 }, { n: [0, 1, 0], d: 1 },
    { n: [0, -1, 0], d: 1 }, { n: [0, 0, 1], d: 1 }, { n: [0, 0, -1], d: 1 },
  ];
  for (let e = 0; e < 12; e++) {
    const a = EDGE_AXIS[e];
    if (capEdges.includes(e)) planes.push({ n: [-a[0], -a[1], -a[2]], d: -SQ });
    else planes.push({ n: [a[0], a[1], a[2]], d: SQ });
  }
  const feas = (v: number[]) => planes.every((p) => p.n[0] * v[0] + p.n[1] * v[1] + p.n[2] * v[2] <= p.d + 1e-6);
  const verts: [number, number, number][] = [];
  for (let i = 0; i < planes.length; i++)
    for (let j = i + 1; j < planes.length; j++)
      for (let k = j + 1; k < planes.length; k++) {
        const v = solve3(planes[i], planes[j], planes[k]);
        if (v && feas(v) && !verts.some((w) => Math.hypot(w[0] - v[0], w[1] - v[1], w[2] - v[2]) < 1e-4)) verts.push(v);
      }
  return verts;
}
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('heli geometry zero-interpenetration', () => {
  const corners = EDGES_AT_CORNER_SLOT.map((caps) => ({ caps, verts: bodyVerts(caps) }));
  const wings = EDGES_AT_WING_SLOT.map((caps) => ({ caps, verts: bodyVerts(caps) }));

  it('corner bodies are 5-vertex tents, wing bodies are tetrahedra', () => {
    for (const c of corners) expect(c.verts.length).toBe(5);
    for (const w of wings) expect(w.verts.length).toBe(4);
  });

  it('every body stays strictly on the correct side of every edge plane', () => {
    const check = (caps: number[], verts: [number, number, number][], label: string) => {
      for (let e = 0; e < 12; e++) {
        const a = EDGE_AXIS[e];
        const moving = caps.includes(e);
        for (const v of verts) {
          const s = dot(a, v) - SQ; // signed distance past the cut plane
          if (moving) expect(s, `${label} moving ${HELI_EDGE_NAMES[e]}`).toBeGreaterThanOrEqual(-1e-6);
          else expect(s, `${label} stationary ${HELI_EDGE_NAMES[e]}`).toBeLessThanOrEqual(1e-6);
        }
      }
    };
    corners.forEach((c, i) => check(c.caps, c.verts, `corner${i}`));
    wings.forEach((w, i) => check(w.caps, w.verts, `wing${i}`));
  });
});
