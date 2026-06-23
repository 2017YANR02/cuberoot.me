/*
 * Helicopter Cube (heli) solver — pure TS, no worker, NO tables to download. TIER D (valid + bounded,
 * NOT optimal): a from-scratch commutator/3-cycle reduction with per-orbit wing buffers.
 *
 * THE PUZZLE — a 3×3×3-shaped cube cut along its EDGES (the √0.5 edge-midpoint cut), so the only moves
 * are 180° rotations about each of the 12 edge axes. Each such turn is an INVOLUTION. The pieces are
 * 8 CORNERS (each shows 3 stickers, orientation ∈ Z3) + 24 WINGS (face triangles, each shows 1 sticker,
 * no orientation). cstimer scrambles heli (and helicv) with `adjScramble` over the 12 edge names
 * (utilscramble.js:473-475), emitting EXACTLY the 12 tokens UF UR UB UL FR BR BL FL DF DR DB DL with NO
 * power suffix — every token is a single 180° edge twist. (cstimer only ever does full turns, so the
 * scrambles never jumble; this solver only needs that non-jumbling group.)
 *
 * MOVE MODEL — derived from poly3dlib geometry: `makePuzzle(6,[-5],[-5,Math.sqrt(0.5)],[-5])` builds a
 * 48-facelet cube (8 per face) whose `moveTable` gives each edge twist as a facelet permutation; each
 * edge token resolves via `getTwistyIdx('1'+edge)`. From that geometry the 8 corners (the facelets at a
 * cube vertex, ordered CCW around the outward vertex normal so every turn acts as a clean Z3 shift) +
 * the 24 wings are derived, and the 12 generators are reduced to piece-level permutations
 * (cp[dest]=src corner, co[dest]=Z3 twist added, wp[dest]=src wing). The hardcoded GENERATORS below are
 * that reduction; tests/heli_solver.test.ts INDEPENDENTLY re-derives them from poly3dlib via node:vm
 * and asserts the piece model is bit-exact against cstimer's real moveTable over random sequences — that
 * geometry is the oracle (cstimer has no heli solver, only a random scrambler).
 *
 * GROUP STRUCTURE (verified by Schreier-Sims on the 12 generators):
 *   |G| = 8! · 3^7 · (6!)^4 / 2 = 11,848,661,611,315,200,000 ≈ 1.18×10^19.
 *   • corners: 8! positions × 3^7 orientations (Σ orientation ≡ 0 mod 3); corner perm PARITY is free.
 *   • wings: the 24 wings split into 4 ORBITS of 6 (a wing only ever moves within its orbit). Each edge
 *     turn applies one transposition to TWO different orbits, so the 4 orbit-permutation parities are
 *     coupled: their SUM is always even (and corner parity is independent). That is the (6!)^4/2.
 *
 * THE REDUCTION (deterministic, four phases; verified 100%-solve over real cstimer scrambles in the
 * test). All gadget BANKS are built once at module load by conjugating two base gadgets with short
 * setups (no large table; ~tens of thousands of tiny words, well under a second):
 *   PHASE 0 — PARITY: a quick BFS over the 5-bit parity signature (corner parity + 4 orbit parities,
 *     each move = a fixed XOR mask) finds a short raw-move prefix zeroing all parities. After this the
 *     corner perm is even and every wing orbit has even permutation, so 3-cycles suffice for the rest.
 *   PHASE 1 — CORNER PERMUTATION: buffer (corner 0) cycle-solving with pure corner 3-cycle gadgets
 *     (base `UF UR UF UL UF UR UF UL`, a length-8 rotating 3-cycle, conjugated to cover all 8·7·6
 *     ordered (src,dst,helper) triples). The helper is always an unsolved corner so solved corners are
 *     never disturbed.
 *   PHASE 2 — CORNER ORIENTATION: pure 2-corner twists (Σ 0 mod 3) from commutators of two 3-cycles,
 *     conjugated to cover every corner pair, applied to zero each misoriented corner in turn.
 *   PHASE 3 — WINGS: each of the 4 orbits solved independently with its own buffer via pure wing
 *     3-cycle gadgets (base from a commutator [setup, edge], conjugated to full per-orbit (src,dst,
 *     helper) coverage). Orbit parities are even after phase 0, so this always closes.
 *   A cheap simplifier then cancels adjacent identical tokens (every move is an involution).
 *
 * METRIC: each token = ONE move (cstimer face-turn metric). Solution length is in that metric. This is a
 * BOUNDED reduction, NOT optimal: measured over 1000+ real cstimer scrambles the length is mean ≈ 212,
 * max 282; HELI_MAX_LENGTH (400) carries margin and is asserted in the test so it can never be silently
 * violated. The offline sampled distribution (stats/scramble/dist_heli.json) is a smooth unimodal
 * spread — not a degenerate single bar and not pinned on the cap.
 *
 * ATTRIBUTION: move semantics + scrambler mirrored from cstimer (cs0x7f/cstimer, utilscramble.js
 * adjScramble); geometry/oracle from cstimer's poly3dlib (makePuzzle). The reduction (per-orbit wing
 * buffers + parity prefix + corner commutators) is implemented from scratch here; the helicopter
 * commutator method is community folklore (speedsolving / ruwix).
 *
 * QUALITY: VALID + BOUNDED (a constructive reduction), NOT optimal (`optimal` always false).
 */

// ── piece-level generators for the 12 edge twists (derived from poly3dlib, bit-exact vs cstimer) ──
// Each generator: cp[dest]=source corner, co[dest]=Z3 orientation added, wp[dest]=source wing.
interface HeliGen { cp: number[]; co: number[]; wp: number[]; }
const GENERATORS: ReadonlyArray<HeliGen> = [
  { cp: [0, 3, 2, 1, 4, 5, 6, 7], co: [0, 2, 0, 1, 0, 0, 0, 0], wp: [0, 9, 8, 3, 4, 5, 6, 7, 2, 1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { cp: [0, 1, 3, 2, 4, 5, 6, 7], co: [0, 0, 1, 2, 0, 0, 0, 0], wp: [5, 4, 2, 3, 1, 0, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { cp: [2, 1, 0, 3, 4, 5, 6, 7], co: [1, 0, 2, 0, 0, 0, 0, 0], wp: [21, 1, 2, 20, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 3, 0, 22, 23] },
  { cp: [1, 0, 2, 3, 4, 5, 6, 7], co: [2, 1, 0, 0, 0, 0, 0, 0], wp: [0, 1, 17, 16, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 3, 2, 18, 19, 20, 21, 22, 23] },
  { cp: [0, 1, 2, 5, 4, 3, 6, 7], co: [0, 0, 0, 1, 0, 2, 0, 0], wp: [0, 1, 2, 3, 4, 10, 8, 7, 6, 9, 5, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { cp: [0, 1, 4, 3, 2, 5, 6, 7], co: [0, 0, 2, 0, 1, 0, 0, 0], wp: [0, 1, 2, 3, 22, 5, 6, 20, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 7, 21, 4, 23] },
  { cp: [7, 1, 2, 3, 4, 5, 6, 0], co: [0, 0, 0, 0, 0, 0, 0, 0], wp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 23, 18, 21, 20, 19, 22, 17] },
  { cp: [0, 6, 2, 3, 4, 5, 1, 7], co: [0, 1, 0, 0, 0, 0, 2, 0], wp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 18, 10, 16, 12, 13, 14, 15, 11, 17, 9, 19, 20, 21, 22, 23] },
  { cp: [0, 1, 2, 3, 4, 6, 5, 7], co: [0, 0, 0, 0, 0, 2, 1, 0], wp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 12, 11, 10, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { cp: [0, 1, 2, 3, 5, 4, 6, 7], co: [0, 0, 0, 0, 1, 2, 0, 0], wp: [0, 1, 2, 3, 4, 5, 14, 12, 8, 9, 10, 11, 7, 13, 6, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { cp: [0, 1, 2, 3, 7, 5, 6, 4], co: [0, 0, 0, 0, 2, 0, 0, 1], wp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 23, 22, 16, 17, 18, 19, 20, 21, 15, 14] },
  { cp: [0, 1, 2, 3, 4, 5, 7, 6], co: [0, 0, 0, 0, 0, 0, 1, 2], wp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 19, 14, 18, 16, 17, 15, 13, 20, 21, 22, 23] },
];

/** The 12 cstimer heli scramble tokens (edge names), in generator order. */
export const HELI_MOVE_NAMES: ReadonlyArray<string> = ['UF', 'UR', 'UB', 'UL', 'FR', 'BR', 'BL', 'FL', 'DF', 'DR', 'DB', 'DL'];
const NAME_TO_IDX = new Map(HELI_MOVE_NAMES.map((n, i) => [n, i]));

/** The 4 wing orbits (a wing only moves within its orbit); used by the per-orbit wing solver. */
const WING_ORBITS: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 5, 10, 13, 19, 21],
  [1, 4, 9, 15, 18, 22],
  [2, 6, 8, 14, 17, 23],
  [3, 7, 11, 12, 16, 20],
];

/** Reachable-state count = 8!·3^7·(6!)^4/2 (Schreier-Sims verified), preformatted string (> 2^53). */
export const HELI_STATE_COUNT_STR = '11,848,661,611,315,200,000';
/**
 * Hard upper bound on solution length (cstimer face-turn metric). The reduction's measured max over
 * 1000+ real cstimer heli scrambles is 282; 400 carries margin and is asserted in
 * tests/heli_solver.test.ts (so the cap can never be silently violated).
 */
export const HELI_MAX_LENGTH = 400;

// ── state model ────────────────────────────────────────────────────────────────
export interface HeliState { cp: number[]; co: number[]; wp: number[]; }
export const HELI_SOLVED: HeliState = {
  cp: [0, 1, 2, 3, 4, 5, 6, 7],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  wp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
};
function cloneSolved(): HeliState { return { cp: HELI_SOLVED.cp.slice(), co: HELI_SOLVED.co.slice(), wp: HELI_SOLVED.wp.slice() }; }

function applyGen(ps: HeliState, pg: HeliGen): HeliState {
  const cp = new Array<number>(8), co = new Array<number>(8), wp = new Array<number>(24);
  for (let d = 0; d < 8; d++) { cp[d] = ps.cp[pg.cp[d]]; co[d] = (ps.co[pg.cp[d]] + pg.co[d]) % 3; }
  for (let d = 0; d < 24; d++) wp[d] = ps.wp[pg.wp[d]];
  return { cp, co, wp };
}
function applyWord(ps: HeliState, wd: ReadonlyArray<number>): HeliState {
  for (const g of wd) ps = applyGen(ps, GENERATORS[g]);
  return ps;
}
function stateKey(ps: HeliState): string { return ps.cp.join(',') + '|' + ps.co.join('') + '|' + ps.wp.join(','); }
const SOLVED_KEY = stateKey(HELI_SOLVED);

// ── public parse / apply ─────────────────────────────────────────────────────────
const TOKEN_SET = new Set(HELI_MOVE_NAMES);
/** Parse a scramble into move names. Throws Error('bad: <tok>') on an invalid token. */
export function parseHeliScramble(scramble: string): string[] {
  const out: string[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    if (!TOKEN_SET.has(tok)) throw new Error(`bad: ${tok}`);
    out.push(tok);
  }
  return out;
}
/** Apply a scramble to the solved puzzle and return its piece-state (for rendering / keys). */
export function heliApply(scramble: string): HeliState {
  let st = cloneSolved();
  for (const tok of parseHeliScramble(scramble)) st = applyGen(st, GENERATORS[NAME_TO_IDX.get(tok)!]);
  return st;
}

// ── gadget banks (built once, memoized) ─────────────────────────────────────────
const inv = (wd: number[]) => [...wd].reverse(); // generators are involutions, so word⁻¹ = reverse
const conj = (s: number[], b: number[]) => s.concat(b, inv(s));
const comm = (a: number[], b: number[]) => a.concat(b, inv(a), inv(b));
const toWord = (s: string) => s.split(/\s+/).filter(Boolean).map((t) => NAME_TO_IDX.get(t)!);

function effect(ps: HeliState) {
  const cM: number[] = [], cT: number[] = [];
  for (let i = 0; i < 8; i++) { if (ps.cp[i] !== i) cM.push(i); else if (ps.co[i] !== 0) cT.push(i); }
  const wM: number[] = [];
  for (let i = 0; i < 24; i++) if (ps.wp[i] !== i) wM.push(i);
  return { cM, cT, wM };
}
/** All setup words up to length `k` (no immediate-repeat), each a distinct resulting state. */
function buildSetups(k: number): number[][] {
  const out: number[][] = [[]];
  let frontier: { ps: HeliState; wd: number[] }[] = [{ ps: HELI_SOLVED, wd: [] }];
  const seen = new Set<string>([SOLVED_KEY]);
  for (let d = 0; d < k; d++) {
    const next: { ps: HeliState; wd: number[] }[] = [];
    for (const { ps, wd } of frontier) {
      const last = wd.length ? wd[wd.length - 1] : -1;
      for (let g = 0; g < 12; g++) {
        if (g === last) continue;
        const ns = applyGen(ps, GENERATORS[g]);
        const k2 = stateKey(ns);
        if (seen.has(k2)) continue;
        seen.add(k2);
        const nw = wd.concat(g);
        out.push(nw); next.push({ ps: ns, wd: nw });
      }
    }
    frontier = next;
  }
  return out;
}

interface Banks {
  cornerC3: Map<string, number[]>;   // "src,dst,helper" -> word (pure corner 3-cycle, piece src→dst)
  cornerTwist: Map<string, number[]>; // "a,b,oa,ob" -> word (pure 2-corner twist: a+=oa, b+=ob)
  wingC3: Map<string, number[]>;      // "src,dst,helper" -> word (pure wing 3-cycle, piece src→dst)
  parityWord: Map<number, number[]>;  // 5-bit parity signature -> raw-move prefix zeroing it
}
let BANKS: Banks | null = null;
function buildBanks(): Banks {
  const BASE_C3 = toWord('UF UR UF UL UF UR UF UL');
  const BASE_W3 = toWord('UF UR UF FR UF UR UF FR');
  const set5 = buildSetups(5), set3 = buildSetups(3);

  // corner 3-cycle bank, indexed by (src,dst,helper): word makes cp[dst]=src.
  const cornerC3 = new Map<string, number[]>();
  for (const s of set5) for (const b of [BASE_C3, BASE_C3.concat(BASE_C3)]) {
    const wd = conj(s, b); const ps = applyWord(HELI_SOLVED, wd); const e = effect(ps);
    if (e.wM.length === 0 && e.cM.length === 3 && e.cT.length === 0) {
      for (const dst of e.cM) {
        const src = ps.cp[dst];
        const helper = e.cM.find((x) => x !== dst && x !== src)!;
        const k = `${src},${dst},${helper}`;
        const cur = cornerC3.get(k);
        if (!cur || cur.length > wd.length) cornerC3.set(k, wd);
      }
    }
  }
  // corner 2-twist bank: commutators of two short sequences, conjugated for full pair coverage.
  const cornerTwist = new Map<string, number[]>();
  const twistBases: number[][] = [];
  for (const a of set3) for (const b of set3) {
    if (!a.length || !b.length) continue;
    const wd = comm(a, b); const e = effect(applyWord(HELI_SOLVED, wd));
    if (e.wM.length === 0 && e.cM.length === 0 && e.cT.length === 2) twistBases.push(wd);
  }
  for (const tb of twistBases) for (const s of set3) {
    const wd = conj(s, tb); const ps = applyWord(HELI_SOLVED, wd); const e = effect(ps);
    if (e.wM.length === 0 && e.cM.length === 0 && e.cT.length === 2) {
      const a = e.cT[0], b = e.cT[1];
      for (const [x, y] of [[a, b], [b, a]]) {
        const k = `${x},${y},${ps.co[x]},${ps.co[y]}`;
        const cur = cornerTwist.get(k);
        if (!cur || cur.length > wd.length) cornerTwist.set(k, wd);
      }
    }
  }
  // wing 3-cycle bank, indexed by (src,dst,helper).
  const wingC3 = new Map<string, number[]>();
  const wingBases: number[][] = [];
  const seenWB = new Set<string>();
  for (const a of set3) for (let b = 0; b < 12; b++) {
    const wd = comm(a, [b]); const e = effect(applyWord(HELI_SOLVED, wd));
    if (e.cM.length === 0 && e.cT.length === 0 && e.wM.length === 3) {
      const kk = wd.join(',');
      if (!seenWB.has(kk)) { seenWB.add(kk); wingBases.push(wd); }
    }
  }
  for (const b of wingBases) for (const s of set3) {
    const wd = conj(s, b); const ps = applyWord(HELI_SOLVED, wd); const e = effect(ps);
    if (e.cM.length === 0 && e.cT.length === 0 && e.wM.length === 3) {
      for (const dst of e.wM) {
        const src = ps.wp[dst];
        const helper = e.wM.find((x) => x !== dst && x !== src)!;
        const k = `${src},${dst},${helper}`;
        const cur = wingC3.get(k);
        if (!cur || cur.length > wd.length) wingC3.set(k, wd);
      }
    }
  }
  // parity bank: BFS over the 5-bit signature (corner parity + 4 orbit parities); each move = XOR mask.
  const moveParity = GENERATORS.map((_, g) => parityOf(applyGen(HELI_SOLVED, GENERATORS[g])));
  const parityWord = new Map<number, number[]>([[0, []]]);
  let frontier = [0];
  while (frontier.length) {
    const next: number[] = [];
    for (const s of frontier) {
      const w = parityWord.get(s)!;
      for (let g = 0; g < 12; g++) {
        const ns = s ^ moveParity[g];
        if (parityWord.has(ns)) continue;
        parityWord.set(ns, w.concat(g)); next.push(ns);
      }
    }
    frontier = next;
  }
  return { cornerC3, cornerTwist, wingC3, parityWord };
}
function banks(): Banks { if (!BANKS) BANKS = buildBanks(); return BANKS; }

// ── parity helpers ───────────────────────────────────────────────────────────────
function cornerParity(ps: HeliState): number {
  const p = ps.cp, seen = new Array<boolean>(8).fill(false);
  let par = 0;
  for (let i = 0; i < 8; i++) { if (seen[i]) continue; let c = 0, x = i; while (!seen[x]) { seen[x] = true; x = p[x]; c++; } par ^= (c - 1) & 1; }
  return par;
}
function orbitParity(ps: HeliState, oi: number): number {
  const orb = WING_ORBITS[oi];
  const pos: Record<number, number> = {};
  orb.forEach((w, i) => { pos[w] = i; });
  const perm = orb.map((w) => pos[ps.wp[w]]);
  const seen = new Array<boolean>(6).fill(false);
  let par = 0;
  for (let i = 0; i < 6; i++) { if (seen[i]) continue; let c = 0, x = i; while (!seen[x]) { seen[x] = true; x = perm[x]; c++; } par ^= (c - 1) & 1; }
  return par;
}
function parityOf(ps: HeliState): number {
  let s = cornerParity(ps);
  for (let oi = 0; oi < 4; oi++) s |= orbitParity(ps, oi) << (oi + 1);
  return s;
}

// ── solution simplifier: cancel adjacent identical tokens (each move is an involution) ──
function simplify(seq: number[]): number[] {
  let s = seq.slice();
  let changed = true;
  while (changed) {
    changed = false;
    const out: number[] = [];
    for (const g of s) {
      if (out.length && out[out.length - 1] === g) { out.pop(); changed = true; }
      else out.push(g);
    }
    s = out;
  }
  return s;
}

// ── solver phases ──────────────────────────────────────────────────────────────
function findCornerC3(B: Banks, src: number, dst: number, avoid: Set<number>): number[] | null {
  for (let t = 0; t < 8; t++) { if (t === src || t === dst || avoid.has(t)) continue; const g = B.cornerC3.get(`${src},${dst},${t}`); if (g) return g; }
  for (let t = 0; t < 8; t++) { if (t === src || t === dst) continue; const g = B.cornerC3.get(`${src},${dst},${t}`); if (g) return g; }
  return null;
}
function findWingC3(B: Banks, orb: ReadonlyArray<number>, src: number, dst: number, solved: Set<number>): number[] | null {
  for (const t of orb) { if (t === src || t === dst || solved.has(t)) continue; const g = B.wingC3.get(`${src},${dst},${t}`); if (g) return g; }
  for (const t of orb) { if (t === src || t === dst) continue; const g = B.wingC3.get(`${src},${dst},${t}`); if (g) return g; }
  return null;
}

export interface HeliSolution {
  /** Solution as space-separated moves; empty when already solved. */
  solution: string;
  /** Move count; 0 when already solved. */
  length: number;
  /** Always false — the reduction is valid + bounded, not optimal. */
  optimal: false;
}

/**
 * Solve a Helicopter Cube (heli) scramble with the parity-prefix + commutator reduction (valid +
 * bounded, NOT optimal). Throws on an invalid token, or 'unsolvable' if the reduction fails to reach
 * solved (never happens for a real heli state — the test asserts 100% solve over real cstimer scrambles
 * and re-verifies every solution against the independent geometry oracle).
 */
export function solveHeli(scramble: string): HeliSolution {
  const B = banks();
  let st = heliApply(scramble);
  const sol: number[] = [];
  const push = (wd: ReadonlyArray<number>) => { for (const g of wd) { st = applyGen(st, GENERATORS[g]); sol.push(g); } };

  // PHASE 0 — zero corner parity + all 4 orbit parities.
  const pw = B.parityWord.get(parityOf(st));
  if (!pw) throw new Error('unsolvable');
  push(pw);

  // PHASE 1 — corner permutation (buffer = corner 0).
  let guard = 0;
  while (true) {
    let bad = -1;
    for (let i = 0; i < 8; i++) if (st.cp[i] !== i) { bad = i; break; }
    if (bad < 0) break;
    if (guard++ > 60) throw new Error('unsolvable');
    const solved = new Set<number>();
    for (let i = 0; i < 8; i++) if (st.cp[i] === i) solved.add(i);
    let g: number[] | null;
    if (st.cp[0] !== 0) g = findCornerC3(B, 0, st.cp[0], solved); // send buffer's piece to its home
    else g = findCornerC3(B, bad, 0, solved);                    // inject an unsolved piece into buffer
    if (!g) throw new Error('unsolvable');
    push(g);
  }

  // PHASE 2 — corner orientation (Σ ≡ 0 mod 3; zero each misoriented corner against another).
  guard = 0;
  while (true) {
    const bad: number[] = [];
    for (let i = 0; i < 8; i++) if (st.co[i] !== 0) bad.push(i);
    if (bad.length === 0) break;
    if (guard++ > 30) throw new Error('unsolvable');
    const a = bad[0], b = bad[1];
    const oa = (3 - st.co[a]) % 3, ob = (3 - oa) % 3; // a → 0 ; b absorbs the rest, paired next round
    const g = B.cornerTwist.get(`${a},${b},${oa},${ob}`);
    if (!g) throw new Error('unsolvable');
    push(g);
  }

  // PHASE 3 — wings, per orbit (each orbit even after phase 0).
  for (let oi = 0; oi < 4; oi++) {
    const orb = WING_ORBITS[oi];
    const buf = orb[0];
    guard = 0;
    while (true) {
      let bad = -1;
      for (const w of orb) if (st.wp[w] !== w) { bad = w; break; }
      if (bad < 0) break;
      if (guard++ > 60) throw new Error('unsolvable');
      const solved = new Set<number>();
      for (const w of orb) if (st.wp[w] === w) solved.add(w);
      let g: number[] | null;
      if (st.wp[buf] !== buf) g = findWingC3(B, orb, buf, st.wp[buf], solved);
      else g = findWingC3(B, orb, bad, buf, solved);
      if (!g) throw new Error('unsolvable');
      push(g);
    }
  }

  if (stateKey(st) !== SOLVED_KEY) throw new Error('unsolvable');
  const simplified = simplify(sol);
  return { solution: simplified.map((g) => HELI_MOVE_NAMES[g]).join(' '), length: simplified.length, optimal: false };
}

// ── cstimer-mirroring random scramble generator ─────────────────────────────────
// Faithful mirror of cstimer `adjScramble(faces, adj, len)` for heli (scramble/utilscramble.js:9,473).
// Picks a face not yet `used`; after pushing it, clears the bits of its adjacent faces from `used` then
// sets its own bit. suffixes default to [""], so a heli token is just the edge name. Injectable rnd.
const HELI_ADJ: ReadonlyArray<number> = [0x09a, 0x035, 0x06a, 0x0c5, 0x303, 0x606, 0xc0c, 0x909, 0xa90, 0x530, 0xa60, 0x5c0];
/** A faithful cstimer-style random heli scramble of `len` tokens. */
export function randomHeliScramble(len: number, rnd: () => number = Math.random): string {
  let used = 0;
  const ret: string[] = [];
  for (let j = 0; j < len; j++) {
    let face = 0;
    do { face = Math.floor(rnd() * HELI_MOVE_NAMES.length); } while ((used >> face) & 1);
    ret.push(HELI_MOVE_NAMES[face]);
    used &= ~HELI_ADJ[face];
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
 * Up to `perBin` example scrambles for each solution length, by sampling random states, solving them,
 * and bucketing the scramble by its returned solution length. The state space (~1.18×10^19) is far too
 * large to enumerate, so this is sampled (deterministic via a seeded PRNG). Returns { length: [scr…] }.
 */
export function heliExamplesByLength(perBin = 6): Record<number, string[]> {
  const rnd = mulberry32(0x4ED1);
  const out: Record<number, string[]> = {};
  const TRIES = perBin * 120 + 600;
  for (let i = 0; i < TRIES; i++) {
    const scramble = randomHeliScramble(20, rnd);
    let len: number;
    try { len = solveHeli(scramble).length; } catch { continue; }
    if (len <= 0) continue;
    const arr = out[len] ?? (out[len] = []);
    if (arr.length < perBin) arr.push(scramble);
  }
  return out;
}

// ── render helper: facelet model for the net SVG (corner/wing facelet layout, derived from geometry) ──
/** corners[ci] = 3 facelet ids (CCW); wingFacelets[wi] = facelet id; faceOf[facelet] = face 0..5. */
export const HELI_CORNERS: ReadonlyArray<ReadonlyArray<number>> = [[32, 0, 40], [16, 1, 33], [42, 2, 8], [9, 3, 17], [41, 11, 24], [25, 13, 18], [27, 20, 34], [44, 30, 36]];
export const HELI_WING_FACELETS: ReadonlyArray<number> = [4, 5, 6, 7, 10, 12, 14, 15, 19, 21, 22, 23, 26, 28, 29, 31, 35, 37, 38, 39, 43, 45, 46, 47];
export const HELI_FACE_OF: ReadonlyArray<number> = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5];

/** The color (face index 0..5) shown on each of the 48 facelets for a given scramble. */
export function heliFaceletColors(scramble: string): number[] {
  const st = heliApply(scramble);
  const out = new Array<number>(48);
  for (let ci = 0; ci < 8; ci++) {
    const src = st.cp[ci], ori = st.co[ci];
    for (let si = 0; si < 3; si++) {
      const srcSlot = ((si - ori) % 3 + 3) % 3;
      out[HELI_CORNERS[ci][si]] = HELI_FACE_OF[HELI_CORNERS[src][srcSlot]];
    }
  }
  for (let wi = 0; wi < 24; wi++) out[HELI_WING_FACELETS[wi]] = HELI_FACE_OF[HELI_WING_FACELETS[st.wp[wi]]];
  return out;
}
