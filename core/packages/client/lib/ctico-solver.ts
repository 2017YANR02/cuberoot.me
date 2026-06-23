/*
 * Icosamate (ctico) solver — pure TS, no worker, NO tables to download. TIER D (valid + bounded, NOT
 * optimal): a from-scratch commutator/3-cycle reduction.
 *
 * THE PUZZLE — a deep-cut VERTEX-TURNING icosahedron (Icosamate / mf8 icosahedron). cstimer scrambles it
 * with `adjScramble(["UL","UR","UrUl","FlFr","LBl","RBr"], [0x3f×6], len, minxsuff)` (utilscramble.js:567),
 * emitting 24 tokens = 6 vertex axes × minxsuff {"", "2", "'", "2'"} — every token is an ORDER-5 turn of a
 * vertex cap (power +1/+2/-1/-2). The 6 axes are 6 of the icosahedron's 12 vertices (the other 6 are the
 * antipodes, redundant). adj is all 0x3f, so the only constraint is no immediate same-axis repeat.
 *
 * MOVE MODEL — derived from poly3dlib geometry: `makePuzzle(20,[],[],[-5,0])` (= getFamousPuzzle('ctico')
 * polyParam) builds an 80-facelet icosahedron (4 per face). cstimer has no ctico parser, so a bare token
 * `UL` parses (via the default makePuzzleParser) to the SHALLOW layer-1 cap move `getTwistyIdx('1'+token)`
 * (the deep layer-0 move only generates the order-60 rotation group). From that geometry the pieces are:
 *   • 12 VERTEX pieces — radius-1.0705 facelets in groups of 5 around each vertex, orientation ∈ Z5
 *     (slots ordered CCW around the outward vertex normal so every turn acts as a clean Z5 shift).
 *   • 20 FACE-CENTER pieces — the one radius-1.0 facelet per face, NO orientation (single sticker). One is
 *     fixed by all 6 shallow axes; all 20 are tracked uniformly as a permutation.
 * The hardcoded GEN_* below are that reduction (vp[dest]=src vertex, vo[dest]=Z5 twist added, fp[dest]=src
 * face-center); tests/ctico_solver.test.ts INDEPENDENTLY re-derives them from poly3dlib via node:vm and
 * asserts the piece model is bit-exact against cstimer's real moveTable over random sequences — that
 * geometry is the oracle (cstimer has no Icosamate solver, only a random scrambler).
 *
 * GROUP STRUCTURE (verified by Schreier-Sims on the 24 facelet generators):
 *   |G| = 12!·5^12·20!/80 = 3,556,408,552,733,836,800,000,000,000,000,000 ≈ 3.556×10^33.
 *   • vertices: 12! positions × 5^12 orientations (Σ orientation ≡ 0 mod 5 is a true invariant).
 *   • both permutations are always EVEN (each order-5 turn is a 5-cycle on vertices and two 5-cycles on
 *     face-centers), so NO parity prefix is needed and pure 3-cycles suffice.
 *
 * THE REDUCTION (deterministic, four phases; verified 100%-solve over real cstimer scrambles in the test).
 * Gadget BANKS are built once at module load by conjugating short base gadgets with short setups (no large
 * table; tens of thousands of tiny words, well under a couple seconds):
 *   PHASE 1 — VERTEX PERMUTATION: buffer (vertex 0) cycle-solving with pure vertex 3-cycle gadgets (a base
 *     [S·A^a·S', B^b] commutator, conjugated to cover (src,dst,helper) triples). Face-centers are free
 *     (solved last); the helper is always an unsolved vertex so solved vertices are never disturbed.
 *   PHASE 2 — VERTEX ORIENTATION (Z5): pure 2-vertex twists (Σ ≡ 0 mod 5, fixing face-centers) from
 *     [vertex-clean-seed, turn] commutators conjugated for full (a,b,oa,ob) coverage; cascade-zero each
 *     vertex against the next — the Σ ≡ 0 invariant guarantees the last vertex auto-resolves.
 *   PHASE 3 — FACE-CENTERS: buffer (face 0) cycle-solving with pure face-center 3-cycle gadgets that FIX
 *     all vertices (perm + orientation), conjugated to full (src,dst,helper) coverage.
 *   A cheap simplifier then merges consecutive same-axis tokens mod 5.
 *
 * METRIC: each token = ONE move at a chosen power (cstimer face-turn metric). Solution length = token count
 * after simplify. This is a BOUNDED reduction, NOT optimal: measured over 1000+ real cstimer scrambles the
 * length runs long; CTICO_MAX_LENGTH carries margin and is asserted in the test so it can never be silently
 * violated. The offline sampled distribution (stats/scramble/dist_ctico.json) is a smooth spread.
 *
 * ATTRIBUTION: move semantics + scrambler mirrored from cstimer (cs0x7f/cstimer, utilscramble.js
 * adjScramble); geometry/oracle from cstimer's poly3dlib (makePuzzle). The reduction (parity-free vertex
 * 3-cycles + Z5 twists + vertex-fixing face-center 3-cycles) is implemented from scratch here; the
 * Icosamate commutator method is community folklore (twisty-polyhedra, ValentinKostin/icosamate, slateman).
 *
 * QUALITY: VALID + BOUNDED (a constructive reduction), NOT optimal (`optimal` always false).
 */

const NV = 12; // vertex pieces
const NF = 20; // face-center pieces

// ── piece-level generators for the 6 axis turns (derived from poly3dlib, bit-exact vs cstimer) ──
// vp[dest]=src vertex, vo[dest]=Z5 orientation added, fp[dest]=src face-center.
interface CticoGen { vp: number[]; vo: number[]; fp: number[]; }
const GEN_VP: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 3, 1, 10, 4, 5, 6, 7, 2, 9, 8, 11], [2, 1, 4, 0, 5, 3, 6, 7, 8, 9, 10, 11], [8, 0, 2, 3, 1, 5, 4, 7, 6, 9, 10, 11],
  [1, 5, 2, 3, 4, 11, 6, 7, 8, 9, 0, 10], [10, 1, 0, 3, 4, 5, 2, 7, 8, 6, 9, 11], [0, 2, 6, 3, 4, 1, 7, 5, 8, 9, 10, 11],
];
const GEN_VO: ReadonlyArray<ReadonlyArray<number>> = [
  [1, 0, 4, 1, 0, 0, 0, 0, 4, 0, 1, 0], [4, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0], [1, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [2, 0, 0, 1, 0, 4, 0, 0, 0, 0, 0, 4], [1, 0, 2, 0, 0, 0, 0, 0, 1, 1, 1, 0], [0, 2, 1, 0, 1, 1, 0, 1, 0, 0, 0, 0],
];
const GEN_FP: ReadonlyArray<ReadonlyArray<number>> = [
  [1, 15, 17, 3, 4, 5, 2, 7, 0, 8, 10, 11, 12, 6, 13, 9, 16, 14, 18, 19], [2, 0, 3, 17, 19, 5, 6, 7, 4, 9, 10, 11, 12, 13, 14, 8, 15, 1, 18, 16],
  [8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19], [3, 17, 2, 18, 4, 5, 6, 7, 8, 0, 10, 11, 9, 13, 15, 1, 14, 16, 12, 19],
  [15, 1, 2, 3, 0, 5, 8, 6, 9, 13, 10, 4, 11, 7, 14, 12, 16, 17, 18, 19], [6, 1, 4, 2, 5, 19, 11, 7, 8, 9, 10, 18, 12, 13, 14, 15, 16, 0, 17, 3],
];
const GENERATORS: ReadonlyArray<CticoGen> = GEN_VP.map((vp, g) => ({ vp: vp.slice(), vo: GEN_VO[g].slice(), fp: GEN_FP[g].slice() }));

/** The 6 cstimer ctico scramble axes (vertex names), in generator order. */
export const CTICO_AXIS_NAMES: ReadonlyArray<string> = ['UL', 'UR', 'UrUl', 'FlFr', 'LBl', 'RBr'];
// Power → cstimer suffix. power = number of base turns applied (mod 5): "":+1, "2":+2, "2'":-2(=3), "'":-1(=4).
const POWER_SUFFIX: Record<number, string> = { 1: '', 2: '2', 3: "2'", 4: "'" };
/** The 24 cstimer ctico scramble tokens (axis × power), e.g. "UL", "UL2", "UL2'", "UL'". */
export const CTICO_MOVE_NAMES: ReadonlyArray<string> = CTICO_AXIS_NAMES.flatMap((a) => [1, 2, 3, 4].map((p) => a + POWER_SUFFIX[p]));
const TOKEN_SET = new Set(CTICO_MOVE_NAMES);
// token string -> { axis, power }
const TOKEN_INFO = new Map<string, { axis: number; power: number }>();
CTICO_AXIS_NAMES.forEach((a, axis) => { for (const p of [1, 2, 3, 4]) TOKEN_INFO.set(a + POWER_SUFFIX[p], { axis, power: p }); });

/** Reachable-state count = 12!·5^12·20!/80 (Schreier-Sims verified), preformatted string (> 2^53). */
export const CTICO_STATE_COUNT_STR = '3,556,408,552,733,836,800,000,000,000,000,000';
/**
 * Hard upper bound on solution length (cstimer face-turn metric). The reduction's measured max over 1000+
 * real cstimer ctico scrambles is well under this; the margin is asserted in tests/ctico_solver.test.ts
 * (so the cap can never be silently violated).
 */
export const CTICO_MAX_LENGTH = 2000;

// ── state model ────────────────────────────────────────────────────────────────
export interface CticoState { vp: number[]; vo: number[]; fp: number[]; }
export const CTICO_SOLVED: CticoState = {
  vp: Array.from({ length: NV }, (_, i) => i),
  vo: new Array<number>(NV).fill(0),
  fp: Array.from({ length: NF }, (_, i) => i),
};
function cloneSolved(): CticoState { return { vp: CTICO_SOLVED.vp.slice(), vo: CTICO_SOLVED.vo.slice(), fp: CTICO_SOLVED.fp.slice() }; }

function applyGen(ps: CticoState, pg: CticoGen): CticoState {
  const vp = new Array<number>(NV), vo = new Array<number>(NV), fp = new Array<number>(NF);
  for (let d = 0; d < NV; d++) { vp[d] = ps.vp[pg.vp[d]]; vo[d] = (ps.vo[pg.vp[d]] + pg.vo[d]) % 5; }
  for (let d = 0; d < NF; d++) fp[d] = ps.fp[pg.fp[d]];
  return { vp, vo, fp };
}
/** Apply a word of base-axis generators (each entry 0..5 = one +72° turn of that axis). */
function applyWord(ps: CticoState, wd: ReadonlyArray<number>): CticoState {
  for (const g of wd) ps = applyGen(ps, GENERATORS[g]);
  return ps;
}
function stateKey(ps: CticoState): string { return ps.vp.join(',') + '|' + ps.vo.join('') + '|' + ps.fp.join(','); }
const SOLVED_KEY = stateKey(CTICO_SOLVED);

// ── public parse / apply ─────────────────────────────────────────────────────────
/** Parse a scramble into move-name tokens. Throws Error('bad: <tok>') on an invalid token. */
export function parseCticoScramble(scramble: string): string[] {
  const out: string[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    if (!TOKEN_SET.has(tok)) throw new Error(`bad: ${tok}`);
    out.push(tok);
  }
  return out;
}
/** Expand a token string into base-axis generator indices (axis repeated `power` times). */
function tokenToBase(tok: string): number[] {
  const info = TOKEN_INFO.get(tok)!;
  const o: number[] = [];
  for (let i = 0; i < info.power; i++) o.push(info.axis);
  return o;
}
/** Apply a scramble to the solved puzzle and return its piece-state (for rendering / keys). */
export function cticoApply(scramble: string): CticoState {
  let st = cloneSolved();
  for (const tok of parseCticoScramble(scramble)) st = applyWord(st, tokenToBase(tok));
  return st;
}

// ── word algebra (base-axis words; axis^-1 = axis applied 4 times) ───────────────
const inv = (wd: ReadonlyArray<number>): number[] => { const o: number[] = []; for (let i = wd.length - 1; i >= 0; i--) { const a = wd[i]; o.push(a, a, a, a); } return o; };
const conj = (s: ReadonlyArray<number>, b: ReadonlyArray<number>): number[] => [...s, ...b, ...inv(s)];
const comm = (a: ReadonlyArray<number>, b: ReadonlyArray<number>): number[] => [...a, ...b, ...inv(a), ...inv(b)];
const pw = (a: number, p: number): number[] => { const o: number[] = []; for (let i = 0; i < p; i++) o.push(a); return o; };

function effect(ps: CticoState) {
  const vM: number[] = [], vT: number[] = [], fM: number[] = [];
  for (let i = 0; i < NV; i++) { if (ps.vp[i] !== i) vM.push(i); else if (ps.vo[i] !== 0) vT.push(i); }
  for (let i = 0; i < NF; i++) if (ps.fp[i] !== i) fM.push(i);
  return { vM, vT, fM };
}
/** Collapse consecutive same-axis tokens mod 5 (drop runs that net to identity). */
function simplifyBase(seq: ReadonlyArray<number>): number[] {
  let s = seq.slice();
  let changed = true;
  while (changed) {
    changed = false;
    const runs: { a: number; n: number }[] = [];
    for (const a of s) { if (runs.length && runs[runs.length - 1].a === a) runs[runs.length - 1].n++; else runs.push({ a, n: 1 }); }
    const out: number[] = [];
    for (const r of runs) { const n = ((r.n % 5) + 5) % 5; for (let k = 0; k < n; k++) out.push(r.a); }
    if (out.length !== s.length) changed = true;
    s = out;
  }
  return s;
}
/** Render a base-axis word as cstimer tokens (each axis run → one token at its net power). */
function baseToTokens(seq: ReadonlyArray<number>): string[] {
  const s = simplifyBase(seq);
  const runs: { a: number; n: number }[] = [];
  for (const a of s) { if (runs.length && runs[runs.length - 1].a === a) runs[runs.length - 1].n++; else runs.push({ a, n: 1 }); }
  const out: string[] = [];
  for (const r of runs) { const p = ((r.n % 5) + 5) % 5; if (p !== 0) out.push(CTICO_AXIS_NAMES[r.a] + POWER_SUFFIX[p]); }
  return out;
}

// ── setups (short axis-words, deduped by resulting state) ───────────────────────
function buildSetups(maxLen: number, noRepeat: boolean): number[][] {
  const out: number[][] = [[]];
  let frontier: { ps: CticoState; wd: number[] }[] = [{ ps: CTICO_SOLVED, wd: [] }];
  const seen = new Set<string>([SOLVED_KEY]);
  for (let d = 0; d < maxLen; d++) {
    const next: { ps: CticoState; wd: number[] }[] = [];
    for (const { ps, wd } of frontier) {
      const last = wd.length ? wd[wd.length - 1] : -1;
      for (let g = 0; g < 6; g++) {
        if (noRepeat && g === last) continue;
        const ns = applyGen(ps, GENERATORS[g]);
        const k = stateKey(ns);
        if (seen.has(k)) continue;
        seen.add(k);
        const nw = wd.concat(g);
        out.push(nw); next.push({ ps: ns, wd: nw });
      }
    }
    frontier = next;
  }
  return out;
}

// ── the one face-center fixed by every shallow turn (never moves; always solved) ──
// It can never be the src/dst of a 3-cycle, so it is excluded from the face-center phase and from the
// face-C3 pair-coverage target. (Derived from the geometry; verified in the test.)
const FIXED_FACECENTER = (() => {
  for (let f = 0; f < NF; f++) { if (GENERATORS.every((g) => g.fp[f] === f)) return f; }
  return -1;
})();

// ── gadget banks (built once, memoized) ─────────────────────────────────────────
interface Banks {
  vertexC3: Map<string, number[]>;    // "src,dst,helper" -> word (pure vertex 3-cycle, vertex src→dst, faces free)
  vertexTwist: Map<string, number[]>; // "a,b,oa,ob" -> word (pure 2-vertex twist fixing faces: a+=oa, b+=ob)
  faceC3: Map<string, number[]>;      // "src,dst,helper" -> word (pure face-center 3-cycle fixing all vertices)
}
let BANKS: Banks | null = null;
function buildBanks(): Banks {
  const S2 = buildSetups(2, false), S3 = buildSetups(3, false), S4 = buildSetups(4, false), S5 = buildSetups(5, false);

  // ── vertex 3-cycle bank (vT=0, face-centers free) ──
  // bases = every clean vertex 3-cycle [S·A^a·S', B^b]; conjugate each with S5 until ALL (src,dst,helper)
  // triples are covered (12·11·10 = 1320). Full triple coverage means the cycle-solver always finds a gadget
  // with an UNSOLVED helper → strict progress, no oscillation. The vertices have no fixed piece.
  const v3bases: number[][] = [];
  for (let A = 0; A < 6; A++) for (let a = 1; a <= 4; a++) for (const S of S2) {
    const P = conj(S, pw(A, a));
    for (let B = 0; B < 6; B++) for (let b = 1; b <= 4; b++) {
      const w = comm(P, pw(B, b));
      const e = effect(applyWord(CTICO_SOLVED, w));
      if (e.vM.length === 3 && e.vT.length === 0) v3bases.push(w);
    }
  }
  const vertexC3 = new Map<string, number[]>();
  for (const bb of v3bases) {
    for (const S of S5) {
      const w = conj(S, bb); const ps = applyWord(CTICO_SOLVED, w); const e = effect(ps);
      if (e.vM.length === 3 && e.vT.length === 0) {
        const ws = simplifyBase(w);
        for (const dst of e.vM) {
          const src = ps.vp[dst];
          const helper = e.vM.find((x) => x !== dst && x !== src)!;
          const k = `${src},${dst},${helper}`;
          const cur = vertexC3.get(k);
          if (!cur || cur.length > ws.length) vertexC3.set(k, ws);
        }
      }
    }
    if (vertexC3.size >= NV * (NV - 1) * (NV - 2)) break; // full triple coverage
  }

  // ── vertex 2-twist bank (Z5, fixing face-centers) ──
  // vClean = [A^a,B^b]^k whose face-permutation is identity (vertex-only effect); then [vClean, turn] gives
  // a pure 2-vertex twist fixing faces. Use base powers 1..4 + conjugation for full (a,b,oa,ob) coverage.
  const vCleanSeeds: number[][] = [];
  for (let A = 0; A < 6; A++) for (let B = 0; B < 6; B++) {
    if (A === B) continue;
    for (let a = 1; a <= 4; a++) for (let b = 1; b <= 4; b++) {
      const base = comm(pw(A, a), pw(B, b));
      let cur: number[] = [];
      for (let k = 1; k <= 5; k++) {
        cur = cur.concat(base);
        const e = effect(applyWord(CTICO_SOLVED, cur));
        if (e.fM.length === 0 && (e.vM.length > 0 || e.vT.length > 0)) vCleanSeeds.push(cur.slice());
      }
    }
  }
  const vtBases: number[][] = [];
  for (const seed of vCleanSeeds) {
    for (let C = 0; C < 6; C++) for (let p = 1; p <= 4; p++) {
      const w = comm(seed, pw(C, p));
      const ps = applyWord(CTICO_SOLVED, w); const e = effect(ps);
      if (e.vM.length === 0 && e.fM.length === 0 && e.vT.length === 2 && (ps.vo[e.vT[0]] + ps.vo[e.vT[1]]) % 5 === 0) vtBases.push(w);
    }
  }
  const vertexTwist = new Map<string, number[]>();
  const VT_TARGET = NV * (NV - 1) * 4; // every ordered (a,b) × 4 nonzero (oa,ob) with oa+ob≡0
  for (const tb of vtBases) {
    let acc: number[] = [];
    for (let k = 1; k <= 4; k++) {
      acc = acc.concat(tb);
      for (const S of S3) {
        const w = conj(S, acc); const ps = applyWord(CTICO_SOLVED, w); const e = effect(ps);
        if (e.vM.length === 0 && e.fM.length === 0 && e.vT.length === 2) {
          const ws = simplifyBase(w);
          const [a, b] = e.vT;
          for (const [x, y] of [[a, b], [b, a]]) {
            const kk = `${x},${y},${ps.vo[x]},${ps.vo[y]}`;
            const cur = vertexTwist.get(kk);
            if (!cur || cur.length > ws.length) vertexTwist.set(kk, ws);
          }
        }
      }
    }
    if (vertexTwist.size >= VT_TARGET) break;
  }

  // ── face-center 3-cycle bank (fixing all vertices) ──
  // faceClean = [A^a,B^b]^k with vertex-effect identity (face-only); [faceClean, turn] -> face 3-cycle.
  // Conjugate every such base with S4 until all (src,dst) pairs among the 19 MOVABLE centers are covered
  // (19·18 = 342; the fixed center never participates).
  const faceSeeds: number[][] = [];
  for (let A = 0; A < 6; A++) for (let B = 0; B < 6; B++) {
    if (A === B) continue;
    for (let a = 1; a <= 4; a++) for (let b = 1; b <= 4; b++) {
      const base = comm(pw(A, a), pw(B, b));
      let cur: number[] = [];
      for (let k = 1; k <= 5; k++) {
        cur = cur.concat(base);
        const e = effect(applyWord(CTICO_SOLVED, cur));
        if (e.vM.length === 0 && e.vT.length === 0 && e.fM.length > 0 && e.fM.length <= 4) { faceSeeds.push(cur.slice()); break; }
      }
    }
  }
  const f3bases: number[][] = [];
  for (const seed of faceSeeds) for (let C = 0; C < 6; C++) for (let p = 1; p <= 4; p++) {
    const fb = comm(seed, pw(C, p));
    const e = effect(applyWord(CTICO_SOLVED, fb));
    if (e.fM.length === 3 && e.vM.length === 0 && e.vT.length === 0) f3bases.push(fb);
  }
  const faceC3 = new Map<string, number[]>();
  // Full triple coverage over the MOVABLE 19 face-centers = 19·18·17 (the fixed center never participates),
  // so the cycle-solver always finds a gadget with an UNSOLVED helper → strict progress.
  const movableFaces = NF - (FIXED_FACECENTER >= 0 ? 1 : 0);
  const F3_TRIPLE_TARGET = movableFaces * (movableFaces - 1) * (movableFaces - 2);
  for (const bb of f3bases) {
    for (const S of S4) {
      const w = conj(S, bb); const ps = applyWord(CTICO_SOLVED, w); const e = effect(ps);
      if (e.fM.length === 3 && e.vM.length === 0 && e.vT.length === 0) {
        const ws = simplifyBase(w);
        for (const dst of e.fM) {
          const src = ps.fp[dst];
          const helper = e.fM.find((x) => x !== dst && x !== src)!;
          const k = `${src},${dst},${helper}`;
          const cur = faceC3.get(k);
          if (!cur || cur.length > ws.length) faceC3.set(k, ws);
        }
      }
    }
    if (faceC3.size >= F3_TRIPLE_TARGET) break;
  }

  return { vertexC3, vertexTwist, faceC3 };
}
function banks(): Banks { if (!BANKS) BANKS = buildBanks(); return BANKS; }

// ── generic 3-cycle permutation solver (operates on a live state via applyGen) ────
// Solve the `field` permutation ('vp' or 'fp') of a live state using a 3-cycle bank keyed "src,dst,helper".
// Each gadget word, applied to the puzzle, performs a pure 3-cycle on that field (and nothing else relevant
// to this field). We cycle-solve: repeatedly take the lowest unsolved position `dst` (its piece p≠dst lives
// elsewhere), find the position `src` currently HOLDING piece `dst` (st.field[src]===dst), and apply the
// gadget keyed (src,dst,helper) — that brings piece dst home. The helper is an UNSOLVED position outside
// {src,dst,skip}, so a placed piece is never disturbed → strict progress (the unsolved count drops by ≥1
// each gadget that uses an unsolved helper). With full pair-coverage and ≥3 unsolved positions an unsolved
// helper with a gadget always exists. Returns true on success (state field becomes identity), false if a
// needed gadget is missing. The fixed `skip` position (face-center) never participates.
function solveField(
  B: Banks, st: { vp: number[]; vo: number[]; fp: number[] }, field: 'vp' | 'fp', n: number, skip: number,
  bank: Map<string, number[]>, push: (wd: ReadonlyArray<number>) => void,
): boolean {
  let guard = 0;
  while (true) {
    let dst = -1;
    for (let i = 0; i < n; i++) { if (i === skip) continue; if (st[field][i] !== i) { dst = i; break; } }
    if (dst < 0) return true;
    if (guard++ > n * n + 100) return false;
    // src = position currently holding piece `dst` (piece dst belongs at position dst).
    let src = -1;
    for (let i = 0; i < n; i++) if (st[field][i] === dst) { src = i; break; }
    if (src < 0) return false;
    // The bank key (a,b,helper) is a 3-cycle whose directed effect moves the piece at position `a` to
    // position `b` (i.e. on solved it leaves field[b]=a). To bring piece dst home we need a→src, b→dst, with
    // an UNSOLVED helper outside {src,dst,skip} so no placed piece is disturbed (→ strict progress).
    let word: number[] | null = null;
    for (let h = 0; h < n; h++) {
      if (h === src || h === dst || h === skip) continue;
      if (st[field][h] === h) continue; // unsolved helper only
      const w = bank.get(`${src},${dst},${h}`);
      if (w) { word = w; break; }
    }
    if (!word) { // fall back to any helper (may briefly unsolve it; still bounded by guard)
      for (let h = 0; h < n; h++) {
        if (h === src || h === dst || h === skip) continue;
        const w = bank.get(`${src},${dst},${h}`);
        if (w) { word = w; break; }
      }
    }
    if (!word) return false;
    push(word);
  }
}

export interface CticoSolution {
  /** Solution as space-separated moves; empty when already solved. */
  solution: string;
  /** Move count; 0 when already solved. */
  length: number;
  /** Always false — the reduction is valid + bounded, not optimal. */
  optimal: false;
}

/**
 * Solve an Icosamate (ctico) scramble with the commutator reduction (valid + bounded, NOT optimal). Throws
 * on an invalid token, or 'unsolvable' if the reduction fails to reach solved (never happens for a real
 * ctico state — the test asserts 100% solve over real cstimer scrambles and re-verifies every solution
 * against the independent geometry oracle).
 */
export function solveCtico(scramble: string): CticoSolution {
  const B = banks();
  const st = cticoApply(scramble); // mutated in place so solveField sees updates
  const sol: number[] = [];
  const push = (wd: ReadonlyArray<number>) => {
    for (const g of wd) {
      const ns = applyGen(st, GENERATORS[g]);
      for (let i = 0; i < NV; i++) { st.vp[i] = ns.vp[i]; st.vo[i] = ns.vo[i]; }
      for (let i = 0; i < NF; i++) st.fp[i] = ns.fp[i];
      sol.push(g);
    }
  };

  // COUNT CORRECTOR — vertex orientation is count-locked: vo-sum ≡ (total base-turn count) mod 5 (a genuine
  // cocycle, not removable by re-framing). All reduction gadgets are commutators/conjugates (base-count
  // ≡ 0 mod 5), so they never change vo-sum; left alone, the final vo-sum would equal the scramble's count
  // mod 5 (usually ≠ 0), leaving one vertex un-orientable. We prepend k = (-count) mod 5 single base-turns
  // (of axis 0) to the solution so the total count ≡ 0 mod 5; the subsequent reduction solves whatever state
  // results, and vo-sum then lands at 0 so the last vertex auto-resolves.
  let scrCount = 0;
  for (const tok of parseCticoScramble(scramble)) scrCount += TOKEN_INFO.get(tok)!.power;
  const corr = ((5 - (scrCount % 5)) % 5);
  if (corr) push(pw(0, corr));

  // PHASE 1 — vertex permutation (3-cycle cycle-solve; no fixed vertex, so skip = -1).
  if (!solveField(B, st, 'vp', NV, -1, B.vertexC3, push)) throw new Error('unsolvable');

  // PHASE 2 — vertex orientation (Z5, Σ ≡ 0 mod 5; cascade-zero each vertex against the next).
  let guard = 0;
  while (true) {
    const bad: number[] = [];
    for (let i = 0; i < NV; i++) if (st.vo[i] !== 0) bad.push(i);
    if (bad.length === 0) break;
    if (guard++ > 60) throw new Error('unsolvable');
    const a = bad[0], b = bad[1];
    const oa = (5 - st.vo[a]) % 5, ob = (5 - oa) % 5; // a → 0 ; b absorbs the rest, paired next round
    const g = B.vertexTwist.get(`${a},${b},${oa},${ob}`);
    if (!g) throw new Error('unsolvable');
    push(g);
  }

  // PHASE 3 — face-centers (3-cycle cycle-solve; the one fixed face-center never participates).
  if (!solveField(B, st, 'fp', NF, FIXED_FACECENTER, B.faceC3, push)) throw new Error('unsolvable');

  if (stateKey(st) !== SOLVED_KEY) throw new Error('unsolvable');
  const toks = baseToTokens(sol);
  return { solution: toks.join(' '), length: toks.length, optimal: false };
}

// ── cstimer-mirroring random scramble generator ─────────────────────────────────
// Faithful mirror of cstimer `adjScramble(faces, adj, len, suffixes)` for ctico (utilscramble.js:9,567).
// adj is all 0x3f, so after pushing a face we clear ALL six adj bits then set our own → only an immediate
// same-axis repeat is blocked. suffixes = ["", "2", "'", "2'"] (minxsuff). Injectable rnd.
const CTICO_ADJ = 0x3f;
const CTICO_SUFFIXES: ReadonlyArray<string> = ['', '2', "'", "2'"];
/** A faithful cstimer-style random ctico scramble of `len` tokens. */
export function randomCticoScramble(len: number, rnd: () => number = Math.random): string {
  let used = 0;
  const ret: string[] = [];
  for (let j = 0; j < len; j++) {
    let face = 0;
    do { face = Math.floor(rnd() * CTICO_AXIS_NAMES.length); } while ((used >> face) & 1);
    ret.push(CTICO_AXIS_NAMES[face] + CTICO_SUFFIXES[Math.floor(rnd() * CTICO_SUFFIXES.length)]);
    used &= ~CTICO_ADJ;
    used |= 1 << face;
  }
  return ret.join(' ');
}

// ── examples by solution length (sampling random states + solving — NOT enumeration) ──
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/**
 * Up to `perBin` example scrambles for each solution length, by sampling random states, solving them, and
 * bucketing each scramble by its returned solution length. The state space (~3.556×10^33) is far too large
 * to enumerate, so this is sampled (deterministic via a seeded PRNG). Returns { length: [scr…] }.
 */
export function cticoExamplesByLength(perBin = 6): Record<number, string[]> {
  const rnd = mulberry32(0xC71C0);
  const out: Record<number, string[]> = {};
  const TRIES = perBin * 120 + 600;
  for (let i = 0; i < TRIES; i++) {
    const scramble = randomCticoScramble(15, rnd);
    let len: number;
    try { len = solveCtico(scramble).length; } catch { continue; }
    if (len <= 0) continue;
    const arr = out[len] ?? (out[len] = []);
    if (arr.length < perBin) arr.push(scramble);
  }
  return out;
}

// ── render helper: facelet colors for the net SVG (derived from the piece model) ──
// 12 vertex pieces × 5 facelets (CCW) + 20 face-center pieces × 1 facelet = 80 facelets.
export const CTICO_VERTEX_FACELETS: ReadonlyArray<ReadonlyArray<number>> = [
  [60, 7, 2, 32, 36], [12, 8, 0, 4, 68], [24, 34, 1, 11, 16], [64, 71, 5, 62, 56], [20, 17, 9, 15, 76], [72, 78, 14, 69, 65],
  [29, 25, 18, 23, 44], [41, 45, 22, 77, 74], [39, 33, 27, 28, 52], [50, 53, 30, 46, 43], [59, 61, 38, 54, 48], [57, 49, 40, 75, 66],
];
export const CTICO_FACECENTER_FACELETS: ReadonlyArray<number> = [3, 6, 10, 13, 19, 21, 26, 31, 35, 37, 42, 47, 51, 55, 58, 63, 67, 70, 73, 79];
export const CTICO_FACE_OF: ReadonlyArray<number> = [
  0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 9, 9, 9, 9,
  10, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 13, 13, 13, 13, 14, 14, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19,
];

/** The color (face index 0..19) shown on each of the 80 facelets for a given scramble. */
export function cticoFaceletColors(scramble: string): number[] {
  const st = cticoApply(scramble);
  const out = new Array<number>(80);
  for (let vi = 0; vi < NV; vi++) {
    const src = st.vp[vi], ori = st.vo[vi];
    for (let si = 0; si < 5; si++) {
      const srcSlot = ((si - ori) % 5 + 5) % 5;
      out[CTICO_VERTEX_FACELETS[vi][si]] = CTICO_FACE_OF[CTICO_VERTEX_FACELETS[src][srcSlot]];
    }
  }
  for (let ci = 0; ci < NF; ci++) out[CTICO_FACECENTER_FACELETS[ci]] = CTICO_FACE_OF[CTICO_FACECENTER_FACELETS[st.fp[ci]]];
  return out;
}
