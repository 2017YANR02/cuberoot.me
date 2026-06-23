/*
 * Curvy Copter (helicv) solver — pure TS, no worker, NO tables to download. TIER D (valid + bounded,
 * NOT optimal): a from-scratch commutator/3-cycle reduction with per-orbit wing buffers + a parity
 * prefix that also fixes the curvy-copter edge pieces.
 *
 * THE PUZZLE — a curvy-cut cousin of the Helicopter Cube. cstimer scrambles helicv with the SAME
 * `adjScramble` over the SAME 12 edge-axis tokens as heli (utilscramble.js:473-475 — heli and helicv
 * fall through to one identical call: UF UR UB UL FR BR BL FL DF DR DB DL, every token a single 180°
 * edge twist, an INVOLUTION, never jumbling). So helicv shares heli's scramble distribution. BUT — and
 * this was verified bit-exact against the geometry, NOT assumed — the CURVED cuts give helicv a
 * genuinely richer piece model than heli:
 *   poly3dlib makePuzzle(6,[-5],[-5,[2√2,-√5]],[-5]) builds a 72-FACELET cube (heli is 48), whose
 *   moveTable splits into THREE piece types:
 *     • 8 CORNERS (3 stickers each, orientation ∈ Z3) — identical to heli's corners.
 *     • 24 FACE pieces ("wings") in 4 ORBITS of 6 — identical orbit structure to heli's wings.
 *     • 12 EDGE pieces in 12 ORBITS of 2 (the NEW curvy-copter pieces heli has no analogue of). An
 *       orbit of size 2 has exactly two states (home / single swap) ⇒ ONE bit per edge.
 *   |G| = 8!·3^7·(6!)^4·2^12 / 2^5 = 3,033,257,372,496,691,200,000 ≈ 3.03×10^21 = heli's |G| × 256
 *   (Schreier-Sims over the 72-facelet moveTable; the /2^5 are five GF(2) parity constraints coupling
 *   corner-perm parity + the 4 face-orbit parities + the 12 edge-swap bits — the first is heli's
 *   "sum of 4 orbit parities is even", the other four couple the edges in).
 *
 * MOVE MODEL — derived from that geometry: the 8 corners (facelets at a vertex, ordered CCW around the
 * outward vertex normal so every turn is a clean Z3 shift), the 24 face pieces (4 orbits of 6), and the
 * 24 edge facelets (12 orbits of 2) are reduced to piece-level permutations. The hardcoded GENERATORS
 * below are that reduction; tests/helicv_solver.test.ts INDEPENDENTLY re-derives them from poly3dlib via
 * node:vm and asserts the piece model is bit-exact against cstimer's real moveTable over random
 * sequences — that geometry is the oracle (cstimer has no Curvy Copter solver, only a scrambler).
 *
 * THE REDUCTION (deterministic; verified 100%-solve over real cstimer helicv scrambles in the test).
 * Gadget BANKS built once at module load by conjugating base gadgets (no large table):
 *   PHASE 0 — PARITY + EDGES: a BFS over the 17-bit signature (corner parity + 4 face-orbit parities +
 *     12 edge-swap bits, each move = a fixed XOR mask; 4096 reachable signatures) finds a short raw-move
 *     prefix zeroing ALL of them. Because every edge orbit is just one bit, this SOLVES all 12 edges
 *     outright — there is no separate edge phase, and the corner/face gadgets below are all built to
 *     leave the edges untouched (the bank filters require `eM.length === 0`).
 *   PHASE 1 — CORNER PERMUTATION: buffer (corner 0) cycle-solving with pure corner 3-cycle gadgets.
 *   PHASE 2 — CORNER ORIENTATION: pure 2-corner twists (Σ ≡ 0 mod 3) from commutators of two 3-cycles.
 *   PHASE 3 — FACE PIECES (wings): each of the 4 orbits solved independently with its own buffer via
 *     pure 3-cycle gadgets. Orbit parities are even after phase 0, so this always closes.
 *   A cheap simplifier then cancels adjacent identical tokens (every move is an involution).
 *
 * METRIC: each token = ONE move (cstimer face-turn metric). This is a BOUNDED reduction, NOT optimal:
 * measured over 1000+ real cstimer scrambles the length is mean ≈ 206, max ≤ 290; HELICV_MAX_LENGTH
 * (400) carries margin and is asserted in the test so it can never be silently violated. The offline
 * sampled distribution (stats/scramble/dist_helicv.json) is a smooth unimodal spread.
 *
 * ATTRIBUTION: move semantics + scrambler mirrored from cstimer (cs0x7f/cstimer, utilscramble.js
 * adjScramble — the very same call heli uses); geometry/oracle from cstimer's poly3dlib (makePuzzle).
 * The reduction is implemented from scratch here; the helicopter/curvy-copter commutator method is
 * community folklore (speedsolving / ruwix). Sibling solver: lib/heli-solver.ts (same scramble group,
 * 48-facelet subset model — helicv is NOT a code copy of it because of the 12 extra edge pieces).
 *
 * QUALITY: VALID + BOUNDED (a constructive reduction), NOT optimal (`optimal` always false).
 */

// ── piece-level generators for the 12 edge twists (derived from poly3dlib, bit-exact vs cstimer) ──
// Each generator: cp[dest]=source corner, co[dest]=Z3 orientation added, wp[dest]=source face piece,
// ep[dest]=source edge piece.
interface HelicvGen { cp: number[]; co: number[]; wp: number[]; ep: number[]; }
const GENERATORS: ReadonlyArray<HelicvGen> = [
  { cp: [0, 3, 2, 1, 4, 5, 6, 7], co: [0, 2, 0, 1, 0, 0, 0, 0], wp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 13, 12, 15, 16, 17, 20, 19, 18, 21, 22, 23], ep: [0, 1, 3, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { cp: [0, 1, 3, 2, 4, 5, 6, 7], co: [0, 0, 1, 2, 0, 0, 0, 0], wp: [0, 1, 2, 3, 4, 5, 7, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 18, 20, 21, 22, 23], ep: [1, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { cp: [2, 1, 0, 3, 4, 5, 6, 7], co: [1, 0, 2, 0, 0, 0, 0, 0], wp: [5, 1, 2, 3, 4, 0, 11, 7, 8, 9, 10, 6, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 20, 22, 23] },
  { cp: [1, 0, 2, 3, 4, 5, 6, 7], co: [2, 1, 0, 0, 0, 0, 0, 0], wp: [4, 1, 2, 3, 0, 5, 6, 7, 8, 9, 10, 11, 16, 13, 14, 15, 12, 17, 18, 19, 20, 21, 22, 23], ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { cp: [0, 1, 2, 5, 4, 3, 6, 7], co: [0, 0, 0, 1, 0, 2, 0, 0], wp: [0, 1, 2, 3, 4, 5, 6, 8, 7, 9, 10, 11, 12, 14, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23], ep: [0, 1, 2, 3, 5, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { cp: [0, 1, 4, 3, 2, 5, 6, 7], co: [0, 0, 2, 0, 1, 0, 0, 0], wp: [0, 5, 2, 3, 4, 1, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 23, 20, 21, 22, 19], ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 18, 20, 21, 22, 23] },
  { cp: [7, 1, 2, 3, 4, 5, 6, 0], co: [0, 0, 0, 0, 0, 0, 0, 0], wp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 10, 12, 13, 14, 15, 17, 16, 18, 19, 20, 21, 22, 23], ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 16, 18, 19, 20, 21, 22, 23] },
  { cp: [0, 6, 2, 3, 4, 5, 1, 7], co: [0, 1, 0, 0, 0, 0, 2, 0], wp: [0, 1, 4, 3, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 22, 21, 20, 23], ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { cp: [0, 1, 2, 3, 4, 6, 5, 7], co: [0, 0, 0, 0, 0, 2, 1, 0], wp: [0, 1, 3, 2, 4, 5, 6, 7, 9, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], ep: [0, 1, 2, 3, 4, 5, 6, 7, 9, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { cp: [0, 1, 2, 3, 5, 4, 6, 7], co: [0, 0, 0, 0, 1, 2, 0, 0], wp: [0, 3, 2, 1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 14, 13, 16, 17, 18, 19, 20, 21, 22, 23], ep: [0, 1, 2, 3, 4, 5, 7, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { cp: [0, 1, 2, 3, 7, 5, 6, 4], co: [0, 0, 0, 0, 2, 0, 0, 1], wp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 16, 15, 18, 19, 20, 23, 22, 21], ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 22] },
  { cp: [0, 1, 2, 3, 4, 5, 7, 6], co: [0, 0, 0, 0, 0, 0, 1, 2], wp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 21, 23], ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 16, 17, 18, 19, 20, 21, 22, 23] },
];

/** The 12 cstimer helicv scramble tokens (edge names), in generator order. Identical to heli's. */
export const HELICV_MOVE_NAMES: ReadonlyArray<string> = ['UF', 'UR', 'UB', 'UL', 'FR', 'BR', 'BL', 'FL', 'DF', 'DR', 'DB', 'DL'];
const NAME_TO_IDX = new Map(HELICV_MOVE_NAMES.map((n, i) => [n, i]));

/** The 4 face-piece ("wing") orbits (a face piece only moves within its orbit). */
const WING_ORBITS: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10, 11],
  [12, 13, 14, 15, 16, 17],
  [18, 19, 20, 21, 22, 23],
];
/** The 12 edge-piece orbits (each of size 2 — home or single swap). */
const EDGE_ORBITS: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15], [16, 17], [18, 19], [20, 21], [22, 23],
];

/** Reachable-state count = 8!·3^7·(6!)^4·2^12/2^5 (Schreier-Sims verified), preformatted (> 2^53). */
export const HELICV_STATE_COUNT_STR = '3,033,257,372,496,691,200,000';
/**
 * Hard upper bound on solution length (cstimer face-turn metric). The reduction's measured max over
 * 1000+ real cstimer helicv scrambles is ≤ 290; 400 carries margin and is asserted in
 * tests/helicv_solver.test.ts (so the cap can never be silently violated).
 */
export const HELICV_MAX_LENGTH = 400;

// ── state model ────────────────────────────────────────────────────────────────
export interface HelicvState { cp: number[]; co: number[]; wp: number[]; ep: number[]; }
export const HELICV_SOLVED: HelicvState = {
  cp: [0, 1, 2, 3, 4, 5, 6, 7],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  wp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
  ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
};
function cloneSolved(): HelicvState {
  return { cp: HELICV_SOLVED.cp.slice(), co: HELICV_SOLVED.co.slice(), wp: HELICV_SOLVED.wp.slice(), ep: HELICV_SOLVED.ep.slice() };
}

function applyGen(ps: HelicvState, pg: HelicvGen): HelicvState {
  const cp = new Array<number>(8), co = new Array<number>(8), wp = new Array<number>(24), ep = new Array<number>(24);
  for (let d = 0; d < 8; d++) { cp[d] = ps.cp[pg.cp[d]]; co[d] = (ps.co[pg.cp[d]] + pg.co[d]) % 3; }
  for (let d = 0; d < 24; d++) wp[d] = ps.wp[pg.wp[d]];
  for (let d = 0; d < 24; d++) ep[d] = ps.ep[pg.ep[d]];
  return { cp, co, wp, ep };
}
function applyWord(ps: HelicvState, wd: ReadonlyArray<number>): HelicvState {
  for (const g of wd) ps = applyGen(ps, GENERATORS[g]);
  return ps;
}
function stateKey(ps: HelicvState): string {
  return ps.cp.join(',') + '|' + ps.co.join('') + '|' + ps.wp.join(',') + '|' + ps.ep.join(',');
}
const SOLVED_KEY = stateKey(HELICV_SOLVED);

// ── public parse / apply ─────────────────────────────────────────────────────────
const TOKEN_SET = new Set(HELICV_MOVE_NAMES);
/** Parse a scramble into move names. Throws Error('bad: <tok>') on an invalid token. */
export function parseHelicvScramble(scramble: string): string[] {
  const out: string[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    if (!TOKEN_SET.has(tok)) throw new Error(`bad: ${tok}`);
    out.push(tok);
  }
  return out;
}
/** Apply a scramble to the solved puzzle and return its piece-state (for rendering / keys). */
export function helicvApply(scramble: string): HelicvState {
  let st = cloneSolved();
  for (const tok of parseHelicvScramble(scramble)) st = applyGen(st, GENERATORS[NAME_TO_IDX.get(tok)!]);
  return st;
}

// ── gadget banks (built once, memoized) ─────────────────────────────────────────
const inv = (wd: number[]) => [...wd].reverse(); // generators are involutions, so word⁻¹ = reverse
const conj = (s: number[], b: number[]) => s.concat(b, inv(s));
const comm = (a: number[], b: number[]) => a.concat(b, inv(a), inv(b));
const toWord = (s: string) => s.split(/\s+/).filter(Boolean).map((t) => NAME_TO_IDX.get(t)!);

function effect(ps: HelicvState) {
  const cM: number[] = [], cT: number[] = [];
  for (let i = 0; i < 8; i++) { if (ps.cp[i] !== i) cM.push(i); else if (ps.co[i] !== 0) cT.push(i); }
  const wM: number[] = [];
  for (let i = 0; i < 24; i++) if (ps.wp[i] !== i) wM.push(i);
  const eM: number[] = [];
  for (let i = 0; i < 24; i++) if (ps.ep[i] !== i) eM.push(i);
  return { cM, cT, wM, eM };
}
/** All setup words up to length `k` (no immediate-repeat), each a distinct resulting state. */
function buildSetups(k: number): number[][] {
  const out: number[][] = [[]];
  let frontier: { ps: HelicvState; wd: number[] }[] = [{ ps: HELICV_SOLVED, wd: [] }];
  const seen = new Set<string>([SOLVED_KEY]);
  for (let d = 0; d < k; d++) {
    const next: { ps: HelicvState; wd: number[] }[] = [];
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
  cornerC3: Map<string, number[]>;    // "src,dst,helper" -> pure corner 3-cycle (no wing/edge change)
  cornerTwist: Map<string, number[]>; // "a,b,oa,ob" -> pure 2-corner twist
  wingC3: Map<string, number[]>;      // "src,dst,helper" -> pure face-piece 3-cycle (no edge change)
  parityWord: Map<number, number[]>;  // 17-bit signature -> raw-move prefix zeroing it
}
let BANKS: Banks | null = null;
function buildBanks(): Banks {
  const BASE_C3 = toWord('UF UR UF UL UF UR UF UL');
  const set5 = buildSetups(5), set3 = buildSetups(3);

  // corner 3-cycle bank, indexed by (src,dst,helper): word makes cp[dst]=src, NO wing/edge disturbance.
  const cornerC3 = new Map<string, number[]>();
  for (const s of set5) for (const b of [BASE_C3, BASE_C3.concat(BASE_C3)]) {
    const wd = conj(s, b); const ps = applyWord(HELICV_SOLVED, wd); const e = effect(ps);
    if (e.wM.length === 0 && e.eM.length === 0 && e.cM.length === 3 && e.cT.length === 0) {
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
    const wd = comm(a, b); const e = effect(applyWord(HELICV_SOLVED, wd));
    if (e.wM.length === 0 && e.eM.length === 0 && e.cM.length === 0 && e.cT.length === 2) twistBases.push(wd);
  }
  for (const tb of twistBases) for (const s of set3) {
    const wd = conj(s, tb); const ps = applyWord(HELICV_SOLVED, wd); const e = effect(ps);
    if (e.wM.length === 0 && e.eM.length === 0 && e.cM.length === 0 && e.cT.length === 2) {
      const a = e.cT[0], b = e.cT[1];
      for (const [x, y] of [[a, b], [b, a]]) {
        const k = `${x},${y},${ps.co[x]},${ps.co[y]}`;
        const cur = cornerTwist.get(k);
        if (!cur || cur.length > wd.length) cornerTwist.set(k, wd);
      }
    }
  }
  // face-piece 3-cycle bank, indexed by (src,dst,helper): NO corner/edge disturbance.
  const wingC3 = new Map<string, number[]>();
  const wingBases: number[][] = [];
  const seenWB = new Set<string>();
  for (const a of set3) for (let b = 0; b < 12; b++) {
    const wd = comm(a, [b]); const e = effect(applyWord(HELICV_SOLVED, wd));
    if (e.cM.length === 0 && e.cT.length === 0 && e.eM.length === 0 && e.wM.length === 3) {
      const kk = wd.join(',');
      if (!seenWB.has(kk)) { seenWB.add(kk); wingBases.push(wd); }
    }
  }
  for (const b of wingBases) for (const s of set3) {
    const wd = conj(s, b); const ps = applyWord(HELICV_SOLVED, wd); const e = effect(ps);
    if (e.cM.length === 0 && e.cT.length === 0 && e.eM.length === 0 && e.wM.length === 3) {
      for (const dst of e.wM) {
        const src = ps.wp[dst];
        const helper = e.wM.find((x) => x !== dst && x !== src)!;
        const k = `${src},${dst},${helper}`;
        const cur = wingC3.get(k);
        if (!cur || cur.length > wd.length) wingC3.set(k, wd);
      }
    }
  }
  // parity bank: BFS over the 17-bit signature (corner parity + 4 face-orbit parities + 12 edge bits).
  const moveParity = GENERATORS.map((_, g) => parityOf(applyGen(HELICV_SOLVED, GENERATORS[g])));
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
function permParity(arr: ReadonlyArray<number>): number {
  const seen = new Array<boolean>(arr.length).fill(false);
  let par = 0;
  for (let i = 0; i < arr.length; i++) { if (seen[i]) continue; let c = 0, x = i; while (!seen[x]) { seen[x] = true; x = arr[x]; c++; } par ^= (c - 1) & 1; }
  return par;
}
function orbitPermParity(ps: HelicvState, orb: ReadonlyArray<number>): number {
  const pos: Record<number, number> = {};
  orb.forEach((w, i) => { pos[w] = i; });
  return permParity(orb.map((w) => pos[ps.wp[w]]));
}
/** 17-bit signature: corner perm parity | 4 face-orbit parities | 12 edge-swap bits. */
function parityOf(ps: HelicvState): number {
  let s = permParity(ps.cp);
  for (let oi = 0; oi < 4; oi++) s |= orbitPermParity(ps, WING_ORBITS[oi]) << (1 + oi);
  for (let oi = 0; oi < 12; oi++) { const b = EDGE_ORBITS[oi][0]; s |= (ps.ep[b] === b ? 0 : 1) << (5 + oi); }
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

export interface HelicvSolution {
  /** Solution as space-separated moves; empty when already solved. */
  solution: string;
  /** Move count; 0 when already solved. */
  length: number;
  /** Always false — the reduction is valid + bounded, not optimal. */
  optimal: false;
}

/**
 * Solve a Curvy Copter (helicv) scramble with the parity-prefix (which also fixes the 12 edge pieces) +
 * commutator reduction (valid + bounded, NOT optimal). Throws on an invalid token, or 'unsolvable' if
 * the reduction fails to reach solved (never happens for a real helicv state — the test asserts 100%
 * solve over real cstimer scrambles and re-verifies every solution against the independent geometry).
 */
export function solveHelicv(scramble: string): HelicvSolution {
  const B = banks();
  let st = helicvApply(scramble);
  const sol: number[] = [];
  const push = (wd: ReadonlyArray<number>) => { for (const g of wd) { st = applyGen(st, GENERATORS[g]); sol.push(g); } };

  // PHASE 0 — zero corner parity + all 4 face-orbit parities + all 12 edge-swap bits (solves edges).
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

  // PHASE 3 — face pieces, per orbit (each orbit even after phase 0).
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
  return { solution: simplified.map((g) => HELICV_MOVE_NAMES[g]).join(' '), length: simplified.length, optimal: false };
}

// ── cstimer-mirroring random scramble generator ─────────────────────────────────
// Faithful mirror of cstimer `adjScramble(faces, adj, len)` for helicv (scramble/utilscramble.js:9,
// 473-475 — heli and helicv share the identical call). suffixes default to [""], so a token is just the
// edge name. Injectable rnd.
const HELICV_ADJ: ReadonlyArray<number> = [0x09a, 0x035, 0x06a, 0x0c5, 0x303, 0x606, 0xc0c, 0x909, 0xa90, 0x530, 0xa60, 0x5c0];
/** A faithful cstimer-style random helicv scramble of `len` tokens. */
export function randomHelicvScramble(len: number, rnd: () => number = Math.random): string {
  let used = 0;
  const ret: string[] = [];
  for (let j = 0; j < len; j++) {
    let face = 0;
    do { face = Math.floor(rnd() * HELICV_MOVE_NAMES.length); } while ((used >> face) & 1);
    ret.push(HELICV_MOVE_NAMES[face]);
    used &= ~HELICV_ADJ[face];
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
 * and bucketing the scramble by its returned solution length. The state space (~3.03×10^21) is far too
 * large to enumerate, so this is sampled (deterministic via a seeded PRNG). Returns { length: [scr…] }.
 */
export function helicvExamplesByLength(perBin = 6): Record<number, string[]> {
  const rnd = mulberry32(0x6CD1);
  const out: Record<number, string[]> = {};
  const TRIES = perBin * 120 + 600;
  for (let i = 0; i < TRIES; i++) {
    const scramble = randomHelicvScramble(20, rnd);
    let len: number;
    try { len = solveHelicv(scramble).length; } catch { continue; }
    if (len <= 0) continue;
    const arr = out[len] ?? (out[len] = []);
    if (arr.length < perBin) arr.push(scramble);
  }
  return out;
}

// ── render helper: facelet model for the net SVG (corner/wing/edge facelet layout, from geometry) ──
/** corners[ci] = 3 facelet ids (CCW); HELICV_WING_FACELETS[wi] / HELICV_EDGE_FACELETS[ei] = facelet id;
 *  HELICV_FACE_OF[facelet] = face 0..5. (All derived from poly3dlib geometry.) */
export const HELICV_CORNERS: ReadonlyArray<ReadonlyArray<number>> = [[48, 0, 60], [24, 1, 49], [62, 2, 12], [13, 3, 25], [61, 15, 36], [37, 17, 26], [39, 28, 50], [64, 42, 52]];
export const HELICV_WING_FACELETS: ReadonlyArray<number> = [11, 23, 35, 38, 51, 63, 8, 16, 30, 40, 55, 65, 10, 22, 27, 41, 53, 69, 9, 14, 29, 47, 54, 66];
export const HELICV_EDGE_FACELETS: ReadonlyArray<number> = [5, 18, 7, 32, 21, 34, 19, 43, 31, 45, 33, 56, 4, 58, 44, 59, 57, 67, 20, 68, 6, 70, 46, 71];
export const HELICV_FACE_OF: ReadonlyArray<number> = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];

/** The color (face index 0..5) shown on each of the 72 facelets for a given scramble. */
export function helicvFaceletColors(scramble: string): number[] {
  const st = helicvApply(scramble);
  const out = new Array<number>(72);
  for (let ci = 0; ci < 8; ci++) {
    const src = st.cp[ci], ori = st.co[ci];
    for (let si = 0; si < 3; si++) {
      const srcSlot = ((si - ori) % 3 + 3) % 3;
      out[HELICV_CORNERS[ci][si]] = HELICV_FACE_OF[HELICV_CORNERS[src][srcSlot]];
    }
  }
  for (let wi = 0; wi < 24; wi++) out[HELICV_WING_FACELETS[wi]] = HELICV_FACE_OF[HELICV_WING_FACELETS[st.wp[wi]]];
  for (let ei = 0; ei < 24; ei++) out[HELICV_EDGE_FACELETS[ei]] = HELICV_FACE_OF[HELICV_EDGE_FACELETS[st.ep[ei]]];
  return out;
}
