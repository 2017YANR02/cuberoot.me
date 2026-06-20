import { describe, it, expect } from 'vitest';
import {
  solveSuperFloppy,
  parseSuperFloppyScramble,
  superFloppyGraphStats,
  superFloppyApply,
  superFloppyExamplesByLength,
  superFloppyAllScramblesByLength,
  SUPERFLOPPY_GODS_NUMBER,
  SUPERFLOPPY_LENGTH_DISTRIBUTION,
  SUPERFLOPPY_TOTAL_STATES,
} from '@/lib/superfloppy-solver';
import { renderSuperFloppyScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/superfloppy_svg';

// ── Independent reference model ───────────────────────────────────────────────
// Re-derived straight from the Super Floppy geometry, NOT from the solver's own apply. We model the
// puzzle as a 3×3×3 where only the 4 equatorial faces R/L/U/D turn; the flat slab is the z=0 layer.
// Its 4 corners start at (±1,±1,0) and roam to (±1,0,±1)/(0,±1,±1) when lifted → 12 corner slots;
// its 4 edges stay at (±1,0,0)/(0,±1,0) and only reorient. A face turn is a literal 3D rotation of
// the in-layer cubies. The slot→slot corner cycles are RECOMPUTED here from the rotation matrices —
// so if the solver's hard-coded CORNER_PERM were wrong (wrong cycle / direction), this BFS would
// reach a different closure and the assertions would fail. Round-trip / optimality use this
// reference's applySeq, never the solver's apply.

type Pt = readonly [number, number, number];
const rotX = (p: Pt): Pt => [p[0], -p[2], p[1]]; // about +x +90
const rotY = (p: Pt): Pt => [p[2], p[1], -p[0]]; // about +y +90

// Face → (which axis-coord must equal val to be in the layer, the rotation function).
const FACES: ReadonlyArray<{ axis: 0 | 1; val: number; rot: (p: Pt) => Pt }> = [
  { axis: 0, val: 1, rot: rotX },                        // R: x==1, about +x +90
  { axis: 0, val: -1, rot: (p) => rotX(rotX(rotX(p))) }, // L: x==-1, about +x -90
  { axis: 1, val: 1, rot: rotY },                        // U: y==1, about +y +90
  { axis: 1, val: -1, rot: (p) => rotY(rotY(rotY(p))) }, // D: y==-1, about +y -90
];

// 12 corner slots and 4 edge slots as coordinates (homes 0..3 first).
const CORNER_SLOTS: ReadonlyArray<Pt> = [
  [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0],   // in-plane NE SE NW SW = homes 0..3
  [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1],   // R-up R-down L-up L-down
  [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1],   // U-up U-down D-up D-down
];
const EDGE_SLOTS: ReadonlyArray<Pt> = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0],     // R L U D
];
const k3 = (p: Pt) => p.join(',');
const cornerIdx = new Map(CORNER_SLOTS.map((p, i) => [k3(p), i]));

// Recompute the corner slot permutation (slot→slot) for each face from the 3D rotation.
const REF_CPERM: number[][] = FACES.map((F) => {
  const perm = CORNER_SLOTS.map((_, i) => i);
  for (let i = 0; i < CORNER_SLOTS.length; i++) {
    const p = CORNER_SLOTS[i];
    if (p[F.axis] === F.val) {
      const np = F.rot(p);
      const ni = cornerIdx.get(k3(np));
      if (ni === undefined) throw new Error(`face slot ${p} → ${np} not a known slot`);
      perm[i] = ni;
    }
  }
  return perm;
});

// State: corner occupancy (slot→cornerId or -1) + edge orientations [eo0..3].
interface State { occ: number[]; eo: number[]; }
const solved = (): State => ({ occ: [0, 1, 2, 3, -1, -1, -1, -1, -1, -1, -1, -1], eo: [0, 0, 0, 0] });
const keyOf = (s: State) => s.occ.join(',') + '|' + s.eo.join('');

const FACE_LETTER = 'RLUD';
// apply one base 90° turn (face 0..3) once to a state in place.
function applyBase(s: State, face: number): void {
  const perm = REF_CPERM[face];
  const next = new Array<number>(12).fill(-1);
  for (let slot = 0; slot < 12; slot++) if (s.occ[slot] >= 0) next[perm[slot]] = s.occ[slot];
  for (let i = 0; i < 12; i++) s.occ[i] = next[i];
  s.eo[face] = (s.eo[face] + 1) & 3;
}
const TOKEN_DEF: Record<string, { face: number; pow: number }> = {};
for (let f = 0; f < 4; f++) {
  for (let pow = 1; pow <= 3; pow++) {
    TOKEN_DEF[FACE_LETTER[f] + (pow === 1 ? '' : pow === 2 ? '2' : "'")] = { face: f, pow };
  }
}
const TOKENS = Object.keys(TOKEN_DEF);
function applyToken(s: State, tok: string): void {
  const d = TOKEN_DEF[tok];
  for (let k = 0; k < d.pow; k++) applyBase(s, d.face);
}
function applySeq(seq: string[]): State {
  const s = solved();
  for (const tok of seq) applyToken(s, tok);
  return s;
}

// ── Independent integer-encoded full BFS → optimal distance per state ──────────
// Uses its own rank/unrank + its own move tables built from REF_CPERM (the rotation-derived perms),
// so it is a genuine cross-check of the solver's full graph. Int8 dist over P(12,4)·4⁴.
const N_CORNER = 11880, N_EDGE = 256, N_INDEX = N_CORNER * N_EDGE;
const MULT = [990, 90, 9, 1];
function cRank(occ: number[]): number {
  const so = [-1, -1, -1, -1];
  for (let s = 0; s < 12; s++) { const c = occ[s]; if (c >= 0) so[c] = s; }
  const av = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  let r = 0;
  for (let c = 0; c < 4; c++) { const ai = av.indexOf(so[c]); r += ai * MULT[c]; av.splice(ai, 1); }
  return r;
}
function cUnrank(r: number): number[] {
  const av = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const occ = new Array<number>(12).fill(-1);
  let rem = r;
  for (let c = 0; c < 4; c++) { const ai = Math.floor(rem / MULT[c]); rem %= MULT[c]; const s = av[ai]; av.splice(ai, 1); occ[s] = c; }
  return occ;
}
let REF_DIST: Int8Array | null = null;
function referenceDist(): Int8Array {
  if (REF_DIST) return REF_DIST;
  const cmv: Int32Array[] = [], emv: Int32Array[] = [];
  for (let f = 0; f < 4; f++) {
    const perm = REF_CPERM[f];
    const t = new Int32Array(N_CORNER);
    for (let r = 0; r < N_CORNER; r++) {
      const occ = cUnrank(r);
      const nx = new Array<number>(12).fill(-1);
      for (let s = 0; s < 12; s++) if (occ[s] >= 0) nx[perm[s]] = occ[s];
      t[r] = cRank(nx);
    }
    cmv.push(t);
    const e = new Int32Array(N_EDGE);
    for (let x = 0; x < N_EDGE; x++) { const eo = [x & 3, (x >> 2) & 3, (x >> 4) & 3, (x >> 6) & 3]; eo[f] = (eo[f] + 1) & 3; e[x] = eo[0] + eo[1] * 4 + eo[2] * 16 + eo[3] * 64; }
    emv.push(e);
  }
  const dist = new Int8Array(N_INDEX).fill(-1);
  dist[0] = 0;
  let fr: number[] = [0], d = 0;
  while (fr.length) {
    const nx: number[] = [];
    for (const u of fr) {
      const c0 = (u / N_EDGE) | 0, e0 = u % N_EDGE;
      for (let f = 0; f < 4; f++) {
        let c = c0, e = e0;
        for (let pow = 1; pow <= 3; pow++) {
          c = cmv[f][c]; e = emv[f][e];
          const v = c * N_EDGE + e;
          if (dist[v] === -1) { dist[v] = d + 1; nx.push(v); }
        }
      }
    }
    fr = nx; d++;
  }
  REF_DIST = dist;
  return dist;
}
// Optimal distance of a reference State.
function refDistOf(s: State): number {
  return referenceDist()[cRank(s.occ) * N_EDGE + (s.eo[0] + s.eo[1] * 4 + s.eo[2] * 16 + s.eo[3] * 64)];
}

// Tiny deterministic PRNG (seeded) so failures are reproducible.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('superfloppy-solver graph', () => {
  it('reaches exactly 3,041,280 states with the proven god-number-13 histogram', () => {
    const { total, histogram } = superFloppyGraphStats();
    expect(total).toBe(3041280);
    expect(total).toBe(11880 * 256); // P(12,4) × 4^4
    expect(total).toBe(SUPERFLOPPY_TOTAL_STATES);
    expect(histogram).toEqual([...SUPERFLOPPY_LENGTH_DISTRIBUTION]);
    expect(histogram.length - 1).toBe(SUPERFLOPPY_GODS_NUMBER);
    expect(SUPERFLOPPY_GODS_NUMBER).toBe(13);
    expect(histogram.reduce((a, b) => a + b, 0)).toBe(3041280);
  });

  it('our histogram matches an independent (rotation-derived) BFS', () => {
    const dist = referenceDist();
    const hist: number[] = [];
    let total = 0;
    for (let i = 0; i < dist.length; i++) { const d = dist[i]; if (d < 0) continue; total++; hist[d] = (hist[d] ?? 0) + 1; }
    expect(total).toBe(3041280);
    expect(hist).toEqual(superFloppyGraphStats().histogram);
  });
});

describe('solveSuperFloppy', () => {
  it('handles solved / empty input', () => {
    expect(solveSuperFloppy('')).toEqual({ solution: '', length: 0 });
    expect(solveSuperFloppy("R R'")).toEqual({ solution: '', length: 0 });
    expect(solveSuperFloppy('R R R R')).toEqual({ solution: '', length: 0 });
    expect(solveSuperFloppy('U2 U2')).toEqual({ solution: '', length: 0 });
  });

  it('single-move scrambles solve in one move', () => {
    expect(solveSuperFloppy('R')).toEqual({ solution: "R'", length: 1 });
    expect(solveSuperFloppy("L'")).toEqual({ solution: 'L', length: 1 });
    expect(solveSuperFloppy('U2')).toEqual({ solution: 'U2', length: 1 });
    expect(solveSuperFloppy('D')).toEqual({ solution: "D'", length: 1 });
  });

  it('rejects invalid tokens', () => {
    expect(() => solveSuperFloppy('R X')).toThrow();
    expect(() => solveSuperFloppy('F')).toThrow();   // F/B are not Super Floppy axes
    expect(() => solveSuperFloppy("B'")).toThrow();
    expect(() => parseSuperFloppyScramble('R3')).toThrow();
    expect(() => parseSuperFloppyScramble('U2x')).toThrow();
  });

  it('solutions are valid and optimal across random scrambles (independent check)', () => {
    const rnd = mulberry32(0x5F100FC0);
    for (let trial = 0; trial < 400; trial++) {
      const len = 1 + Math.floor(rnd() * 22);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scramble = seq.join(' ');

      const { solution, length } = solveSuperFloppy(scramble);

      // optimal: reported length equals the independent optimal distance of the scrambled state
      const scrambled = applySeq(seq);
      expect(length).toBe(refDistOf(scrambled));
      expect(length).toBeLessThanOrEqual(SUPERFLOPPY_GODS_NUMBER);

      // valid: applying scramble then solution (via the independent reference) returns to solved
      const afterSol = applySeq([...seq, ...(solution ? solution.split(' ') : [])]);
      expect(keyOf(afterSol)).toBe(keyOf(solved()));
    }
  });
});

describe('superFloppyApply', () => {
  it('matches the independent reference state across random scrambles', () => {
    const rnd = mulberry32(0xBADCAB1E);
    for (let trial = 0; trial < 300; trial++) {
      const len = 1 + Math.floor(rnd() * 22);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const refState = applySeq(seq);
      const got = superFloppyApply(seq.join(' '));
      expect(got.corners).toEqual(refState.occ);
      expect(got.edges).toEqual(refState.eo);
    }
  });
});

describe('superFloppyExamplesByLength', () => {
  it('generates valid, optimal example scrambles for every depth 1..13', () => {
    const ex = superFloppyExamplesByLength(12);
    for (let d = 1; d <= SUPERFLOPPY_GODS_NUMBER; d++) {
      const list = ex[d];
      expect(list, `depth ${d}`).toBeTruthy();
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(12);
      const seen = new Set<string>();
      for (const scr of list) {
        const toks = scr.split(' ');
        expect(toks.length).toBe(d);
        expect(() => parseSuperFloppyScramble(scr)).not.toThrow();
        // optimal solve length == d (solver and independent reference agree)
        expect(solveSuperFloppy(scr).length).toBe(d);
        expect(refDistOf(applySeq(toks))).toBe(d);
        seen.add(keyOf(applySeq(toks)));
      }
      expect(seen.size).toBe(list.length); // distinct states
    }
  });

  it('full enumeration covers every non-trivial state exactly once (counts == distribution)', () => {
    const all = superFloppyAllScramblesByLength();
    let total = 0;
    for (let d = 1; d <= SUPERFLOPPY_GODS_NUMBER; d++) {
      const list = all[d];
      expect(list.length, `depth ${d} count`).toBe(SUPERFLOPPY_LENGTH_DISTRIBUTION[d]);
      total += list.length;
    }
    expect(total).toBe(3041279); // all 3,041,280 states minus the identity (solved)
    // spot-check a deterministic spread (full Set over 3M strings would be heavy): every sampled
    // scramble solves in exactly its bucket length, and lengths are distinct per state by depth.
    const rnd = mulberry32(0x5F1A11);
    for (let d = 1; d <= SUPERFLOPPY_GODS_NUMBER; d++) {
      const list = all[d];
      for (let s = 0; s < 5; s++) {
        const scr = list[Math.floor(rnd() * list.length)];
        expect(solveSuperFloppy(scr).length).toBe(d);
      }
    }
  });
});

describe('renderSuperFloppyScrambleSvg', () => {
  const fills = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);

  it('solved → canonical: 1 center + 4 edge faces + 4 home corners + 8 empty slots', () => {
    const svg = renderSuperFloppyScrambleSvg('');
    // 1 center rect + 4 edge rects (+4 marker circles) + 12 corner rects = 17 rects, 4 marker circles.
    const f = fills(svg);
    expect(f.length).toBe(21); // 17 rect fills + 4 marker circle fills
    // 4 in-plane corners show 4 distinct corner colors; 8 lifted slots show the empty color.
    const empty = '#E6E6E6';
    const emptyCount = f.filter((c) => c === empty).length;
    expect(emptyCount).toBe(8); // exactly the 8 lifted slots are empty when solved
  });

  it('a turn breaks canonical uniformity; round-trip restores it', () => {
    const solvedFills = fills(renderSuperFloppyScrambleSvg(''));
    const rFills = fills(renderSuperFloppyScrambleSvg('R'));
    expect(rFills).not.toEqual(solvedFills);
    // applying R then R' returns to the canonical solved render (self-proving net consistency)
    expect(fills(renderSuperFloppyScrambleSvg("R R'"))).toEqual(solvedFills);
    // a full face cycle (R^4) is identity too
    expect(fills(renderSuperFloppyScrambleSvg('R R R R'))).toEqual(solvedFills);
  });

  it('net tracks the solver: scramble ∘ optimal solution renders the solved net', () => {
    const rnd = mulberry32(0x5F1C0DE);
    const solvedFills = fills(renderSuperFloppyScrambleSvg(''));
    for (let trial = 0; trial < 60; trial++) {
      const len = 1 + Math.floor(rnd() * 14);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scramble = seq.join(' ');
      const f = fills(renderSuperFloppyScrambleSvg(scramble));
      expect(f.length).toBe(21);
      const { solution } = solveSuperFloppy(scramble);
      const combined = solution ? `${scramble} ${solution}` : scramble;
      expect(fills(renderSuperFloppyScrambleSvg(combined)), `net after solving "${scramble}"`).toEqual(solvedFills);
    }
  });
});
