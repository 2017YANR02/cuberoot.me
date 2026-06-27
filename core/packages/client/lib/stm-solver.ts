/*
 * 3×3×3 STM (Slice Turn Metric) OPTIMAL solver — Korf-style IDA* over Kociemba/Korf pattern databases,
 * rebuilt over the 27 STM generators. Pure TS (runs in Node OR the browser). State machine + geometry
 * validation live in stm-cube.ts; this file is the coordinate encoders + PDBs + admissible IDA*.
 *
 * OPTIMALITY (the whole point). The heuristic is h = max(cornerPDB, edgeAPDB, edgeBPDB), each an EXACT
 * BFS distance over the full 27-move STM set for its piece subset:
 *   • cornerPDB  — the 8 corners (perm 8! × orient 3⁷ = 88,179,840 states). Slice moves do NOT move
 *     corners (they are interior layers), so a corner-only solve uses face moves only; the BFS over all
 *     27 generators discovers exactly this. Admissible: any full STM solution contains ≥ cornerPDB[ ]
 *     face moves, hence ≥ that many moves total.
 *   • edgeAPDB / edgeBPDB — two disjoint 6-edge subsets (perm 12P6 × orient 2⁶ = 42,577,920 each).
 *     Slices DO move edges; the BFS over 27 generators is the exact min STM moves to home those 6 edges.
 * max() (NEVER sum) is required: a single move can progress corners AND both edge groups, so the PDBs
 * are not additive. max of admissible lower bounds is an admissible, consistent heuristic ⇒ IDA* returns
 * a provably shortest STM solution. The GOAL TEST is the FULL state INCLUDING the 6 centers — the center
 * permutation group under STM has only 24 elements (the cube-reorientation group) and diameter 2, so it
 * is never the search bottleneck, but it MUST be in the goal or an "optimal" solution could leave the
 * centers rotated (wrong for STM). A cheap extra term (centers-not-home ⇒ h≥1) is folded in for free.
 *
 * TABLE SIZES (1 byte/entry, measured): corner 88.2 MB + 2 × edge 42.6 MB = 173.4 MB raw. The offline
 * build (build_stm_pdbs in scramble-stats-build) writes them gzip-packed. Recommended runtime = a Node
 * service (the repo already runs a server-side cube48opt daemon with multi-GB tables); 173 MB resident is
 * trivial there but heavy for a browser tab.
 *
 * HONEST PERFORMANCE LABEL (all measured, 6-core node, ~6M nodes/s):
 *   • The engine is PROVABLY OPTIMAL and VALIDATED: it returns the same length as an independent
 *     brute-BFS optimal oracle on every shallow scramble tested (tests/stm_solver.test.ts), the
 *     heuristic is consistent (verified over 300k transitions), and the state machine matches cubing.js.
 *   • PRACTICAL UP TO ~DEPTH 12: optimal-depth ≤10 solves in <0.1 s; depth ≈11-12 in ~1-6 s.
 *   • The hardest deep states are CORRECT BUT IMPRACTICALLY SLOW with this browser-feasible heuristic.
 *     Korf's max(corner, 2×6-edge) is weak in STM: every cheap projection has a small diameter (corner
 *     11, 6-edge 9, edge-orient 6, corner-orient 6) while the cube diameter is ~18-20. Worst case
 *     SUPERFLIP has h = 6 vs optimal 16 and did NOT finish in 1e9 nodes / 159 s; a random 30-move (≈depth
 *     16-18) scramble likewise exceeded 5e8 nodes / 122 s. This is a fundamental heuristic-STRENGTH wall,
 *     not a bug — the search stays admissible/optimal, it just explodes.
 *   • TO MAKE DEEP CASES FAST (next phase): replace the two 6-edge PDBs with two 7-edge PDBs
 *     (12P7 × 2⁷ = 510 MB each → Node-only ~1.1 GB; diameter ≈11-12) which lifts h by ~2-3 (≈13ˣ fewer
 *     nodes per ply). Even stronger: an 8-edge PDB (5 GB) or symmetry-reduced corner+center PDB. These
 *     are documented in the report; this file ships the correct engine + the 6-edge PDBs.
 */

import {
  type CubieState, MOVE_OPS, NUM_MOVES, applyMoveState, solvedState, isSolvedState,
  STM_MOVE_NAMES, MOVE_BASE, parseStmScramble,
} from './stm-cube';

// ── factorials / combinatorial primitives ───────────────────────────────────────────
const FACT: number[] = (() => { const f = [1]; for (let i = 1; i <= 12; i++) f[i] = f[i - 1] * i; return f; })();

// ── corner coordinate (perm 8! + orient 3^7) ─────────────────────────────────────────
const N_CORNER_PERM = FACT[8];        // 40320
const N_CORNER_ORI = 2187;            // 3^7
export const N_CORNER = N_CORNER_PERM * N_CORNER_ORI; // 88,179,840

function permToRank(p: ArrayLike<number>, n: number): number {
  let r = 0;
  for (let i = 0; i < n; i++) {
    let cnt = 0;
    for (let j = i + 1; j < n; j++) if (p[j] < p[i]) cnt++;
    r = r * (n - i) + cnt;
  }
  return r;
}
const _elemBuf = new Int8Array(12);
function rankToPerm(rank: number, n: number, out: Int8Array): void {
  for (let i = 0; i < n; i++) _elemBuf[i] = i;
  let r = rank, count = n;
  for (let i = 0; i < n; i++) {
    const f = FACT[n - 1 - i];
    const d = Math.floor(r / f); r %= f;
    out[i] = _elemBuf[d];
    // shift down remaining (small n, cheap, no splice allocation)
    for (let j = d; j < count - 1; j++) _elemBuf[j] = _elemBuf[j + 1];
    count--;
  }
}
function cornerOriRank(co: ArrayLike<number>): number { let r = 0; for (let i = 0; i < 7; i++) r = r * 3 + co[i]; return r; }
function cornerOriUnrank(rank: number, out: Int8Array): void {
  let r = rank, s = 0;
  for (let i = 6; i >= 0; i--) { out[i] = r % 3; s += out[i]; r = Math.floor(r / 3); }
  out[7] = ((3 - (s % 3)) % 3);
}
export function cornerIndex(s: CubieState): number {
  return permToRank(s.cp, 8) * N_CORNER_ORI + cornerOriRank(s.co);
}

// ── 6-edge coordinate (which 6 tracked edges; perm of their positions among 12 + orient 2^6) ──────────
// We track a SUBSET of 6 edges. State = (positions of the 6 tracked edges among the 12 slots, in order)
// + their flips. Encoding: choice/perm of 6-of-12 positions via a "partial permutation rank" + 2^6 ori.
const N_EDGE6_POS = FACT[12] / FACT[6]; // 12P6 = 665,280
const N_EDGE6_ORI = 1 << 6;             // 64
export const N_EDGE6 = N_EDGE6_POS * N_EDGE6_ORI; // 42,577,920

// partial-permutation rank: positions[0..5] are the 12-slot indices currently holding tracked edges
// 0..5 (in tracked order). Rank over ordered selections of 6 distinct values from 12.
function edge6PosRank(pos: ArrayLike<number>): number {
  // ordered selection rank: standard "k-permutation" lexicographic index.
  let r = 0;
  const used = new Uint8Array(12);
  for (let i = 0; i < 6; i++) {
    let smaller = 0;
    for (let v = 0; v < pos[i]; v++) if (!used[v]) smaller++;
    r = r * (12 - i) + smaller;
    used[pos[i]] = 1;
  }
  return r;
}

// ── PDB type + builder ────────────────────────────────────────────────────────────────
export interface Pdb {
  dist: Uint8Array;     // exact STM distance to solved for the projected coordinate
  size: number;
  maxDepth: number;
}

// Per-piece-subset move data, projected from the full 27 STM move ops. PDB BFS runs over a compact
// "mini-state" (corner perm+orient, or the 6 tracked edges' positions+flips) so we never carry the
// whole cube during the multi-million-state BFS.
const CORNER_MOVES = MOVE_OPS.map((op) => ({ cpFrom: op.cpFrom, coAdd: op.coAdd }));
const EDGE_MOVES = MOVE_OPS.map((op) => ({ epFrom: op.epFrom, eoAdd: op.eoAdd }));

// Index a 12-edge state by a tracked subset of 6 edge ids.
function edge6Index(ep: ArrayLike<number>, eo: ArrayLike<number>, tracked: number[]): number {
  // find positions of each tracked edge id; record position + flip in tracked order.
  const pos = new Int8Array(6); const flip = new Int8Array(6);
  // invert ep: slot holding edge id e
  for (let slot = 0; slot < 12; slot++) {
    const id = ep[slot];
    const t = tracked.indexOf(id);
    if (t >= 0) { pos[t] = slot; flip[t] = eo[slot]; }
  }
  let ori = 0; for (let i = 0; i < 6; i++) ori = ori * 2 + flip[i];
  return edge6PosRank(pos) * N_EDGE6_ORI + ori;
}

// Factored corner transition tables (precomputed once): the full corner index = permRank*2187 + oriRank
// transforms as permMove[permRank][mi]*2187 + oriMove[oriRank][mi]. Both factors are valid STANDALONE
// transitions: the permutation move is independent of orientation, and the orientation-coordinate move
// (co'[i] = co[cpFrom[i]] + coAdd[i], a fixed permute-and-add per move) is independent of the perm.
let CORNER_PERM_MOVE: Int32Array | null = null; // [40320*27]
let CORNER_ORI_MOVE: Int32Array | null = null;  // [2187*27]
function buildCornerMoveTables(): void {
  if (CORNER_PERM_MOVE) return;
  const pm = new Int32Array(N_CORNER_PERM * NUM_MOVES);
  const cp = new Int8Array(8), ncp = new Int8Array(8);
  for (let p = 0; p < N_CORNER_PERM; p++) {
    rankToPerm(p, 8, cp);
    for (let mi = 0; mi < NUM_MOVES; mi++) {
      const f = CORNER_MOVES[mi].cpFrom;
      for (let i = 0; i < 8; i++) ncp[i] = cp[f[i]];
      pm[p * NUM_MOVES + mi] = permToRank(ncp, 8);
    }
  }
  const om = new Int32Array(N_CORNER_ORI * NUM_MOVES);
  const co = new Int8Array(8), nco = new Int8Array(8);
  for (let o = 0; o < N_CORNER_ORI; o++) {
    cornerOriUnrank(o, co);
    for (let mi = 0; mi < NUM_MOVES; mi++) {
      const m = CORNER_MOVES[mi];
      for (let i = 0; i < 8; i++) nco[i] = (co[m.cpFrom[i]] + m.coAdd[i]) % 3;
      om[o * NUM_MOVES + mi] = cornerOriRank(nco);
    }
  }
  CORNER_PERM_MOVE = pm; CORNER_ORI_MOVE = om;
}

// Build the corner PDB via BFS from solved over all 27 generators (factored O(1) neighbour, typed
// ping-pong frontier — no per-node splice or growing arrays).
export function buildCornerPdb(opts?: { onProgress?: (depth: number, seen: number) => void }): Pdb {
  buildCornerMoveTables();
  const pm = CORNER_PERM_MOVE!, om = CORNER_ORI_MOVE!;
  const dist = new Uint8Array(N_CORNER).fill(255);
  const startIdx = 0; // solved perm rank 0, ori rank 0
  dist[startIdx] = 0;
  let frontier = new Int32Array(1); frontier[0] = startIdx; let frontierLen = 1;
  let nextBuf = new Int32Array(1 << 20);
  let depth = 0, seen = 1, maxDepth = 0;
  while (frontierLen) {
    let nextLen = 0;
    for (let fi = 0; fi < frontierLen; fi++) {
      const idx = frontier[fi];
      const p = (idx / N_CORNER_ORI) | 0, o = idx % N_CORNER_ORI;
      const pBase = p * NUM_MOVES, oBase = o * NUM_MOVES;
      for (let mi = 0; mi < NUM_MOVES; mi++) {
        const ni = pm[pBase + mi] * N_CORNER_ORI + om[oBase + mi];
        if (dist[ni] === 255) {
          dist[ni] = depth + 1; seen++;
          if (nextLen >= nextBuf.length) { const b = new Int32Array(nextBuf.length * 2); b.set(nextBuf); nextBuf = b; }
          nextBuf[nextLen++] = ni;
        }
      }
    }
    if (!nextLen) break;
    if (frontier.length < nextLen) frontier = new Int32Array(nextLen);
    frontier.set(nextBuf.subarray(0, nextLen));
    frontierLen = nextLen;
    depth++; maxDepth = depth;
    opts?.onProgress?.(depth, seen);
  }
  return { dist, size: N_CORNER, maxDepth };
}

// Factored edge6 transition tables: the full edge6 index = posRank*64 + flip transforms as
//   posRank' = EDGE6_POS_MOVE[posRank][mi]   (12P6 ordered-selection transition; independent of flips)
//   flip'    = flip XOR EDGE6_FLIPMASK[posRank][mi]   (6-bit mask; depends on POSITION since the eoAdd a
//             tracked edge picks up depends on which slot it arrives in — but is independent of the flip
//             bits themselves, so the mask is a pure function of (posRank, move)).
// Both built once over 665,280 positions (cheap) ⇒ the 42.6M-state BFS is O(1) per neighbour.
let EDGE6_POS_MOVE: Int32Array | null = null;   // [665280*27]
let EDGE6_FLIPMASK: Uint8Array | null = null;   // [665280*27], 6-bit mask
function buildEdge6MoveTables(): void {
  if (EDGE6_POS_MOVE) return;
  const slotTo: Int8Array[] = EDGE_MOVES.map((m) => { const t = new Int8Array(12); for (let i = 0; i < 12; i++) t[m.epFrom[i]] = i; return t; });
  const slotFlip: Int8Array[] = EDGE_MOVES.map((m) => Int8Array.from(m.eoAdd));
  const pm = new Int32Array(N_EDGE6_POS * NUM_MOVES);
  const fm = new Uint8Array(N_EDGE6_POS * NUM_MOVES);
  const pos = new Int8Array(6), npos = new Int8Array(6);
  for (let pr = 0; pr < N_EDGE6_POS; pr++) {
    unrankEdge6Pos(pr, pos);
    const base = pr * NUM_MOVES;
    for (let mi = 0; mi < NUM_MOVES; mi++) {
      const st = slotTo[mi], sf = slotFlip[mi];
      let mask = 0;
      for (let t = 0; t < 6; t++) { const dst = st[pos[t]]; npos[t] = dst; mask = (mask << 1) | sf[dst]; }
      pm[base + mi] = edge6PosRank(npos);
      fm[base + mi] = mask; // bit (5-t) ... mask built MSB-first matching oriOf's MSB-first packing
    }
  }
  EDGE6_POS_MOVE = pm; EDGE6_FLIPMASK = fm;
}

// Build a 6-edge PDB (tracked = 6 edge ids) via BFS from solved over all 27 generators (factored O(1)
// neighbour, typed ping-pong frontier).
export function buildEdge6Pdb(tracked: number[], opts?: { onProgress?: (depth: number, seen: number) => void }): Pdb {
  buildEdge6MoveTables();
  const pm = EDGE6_POS_MOVE!, fm = EDGE6_FLIPMASK!;
  const dist = new Uint8Array(N_EDGE6).fill(255);
  const s = solvedState();
  const startIdx = edge6Index(s.ep, s.eo, tracked);
  dist[startIdx] = 0;
  let frontier = new Int32Array(1); frontier[0] = startIdx; let frontierLen = 1;
  let nextBuf = new Int32Array(1 << 20);
  let depth = 0, seen = 1, maxDepth = 0;
  while (frontierLen) {
    let nextLen = 0;
    for (let fi = 0; fi < frontierLen; fi++) {
      const idx = frontier[fi];
      const pr = (idx / N_EDGE6_ORI) | 0, fl = idx % N_EDGE6_ORI;
      const base = pr * NUM_MOVES;
      for (let mi = 0; mi < NUM_MOVES; mi++) {
        const ni = pm[base + mi] * N_EDGE6_ORI + (fl ^ fm[base + mi]);
        if (dist[ni] === 255) {
          dist[ni] = depth + 1; seen++;
          if (nextLen >= nextBuf.length) { const b = new Int32Array(nextBuf.length * 2); b.set(nextBuf); nextBuf = b; }
          nextBuf[nextLen++] = ni;
        }
      }
    }
    if (!nextLen) break;
    if (frontier.length < nextLen) frontier = new Int32Array(nextLen);
    frontier.set(nextBuf.subarray(0, nextLen));
    frontierLen = nextLen;
    depth++; maxDepth = depth;
    opts?.onProgress?.(depth, seen);
  }
  return { dist, size: N_EDGE6, maxDepth };
}
// edge6PosRank builds r MSB-first with ascending step radices (12-i): r=((s0)*11+s1)*10+...  where each
// "digit" is the count of smaller UNUSED slots. Invert with descending radices and reconstruct the
// chosen slot from the (count-of-smaller-unused) digit.
function unrankEdge6Pos(posRank: number, pos: Int8Array): void {
  const radices = [12, 11, 10, 9, 8, 7];
  const digits = new Int32Array(6);
  let r = posRank;
  for (let i = 5; i >= 0; i--) { digits[i] = r % radices[i]; r = Math.floor(r / radices[i]); }
  const used = new Uint8Array(12);
  for (let i = 0; i < 6; i++) {
    let cnt = -1, v = 0;
    for (v = 0; v < 12; v++) { if (!used[v]) { cnt++; if (cnt === digits[i]) break; } }
    pos[i] = v; used[v] = 1;
  }
}

// Two disjoint 6-edge groups (Korf): A = {0..5} = UR UF UL UB DR DF ; B = {6..11} = DL DB FR FL BL BR.
export const EDGE_GROUP_A = [0, 1, 2, 3, 4, 5];
export const EDGE_GROUP_B = [6, 7, 8, 9, 10, 11];

// ── center coordinate (24 reachable cube reorientations) + transition table ──────────────
// The 6-center permutation reaches only 24 arrangements under STM (the cube-reorientation group).
// We index them by discovery order (BFS from solved) and precompute centerMove[24*27].
let CENTER_INDEX_MAP: Map<string, number> | null = null;
let CENTER_MOVE: Int32Array | null = null; // [24*27]
let CENTER_SOLVED = 0;
function buildCenterTable(): void {
  if (CENTER_MOVE) return;
  const idxMap = new Map<string, number>();
  const states: Int8Array[] = [];
  const solved = solvedState().center;
  const key = (c: Int8Array) => c.join(',');
  idxMap.set(key(solved), 0); states.push(solved); CENTER_SOLVED = 0;
  // BFS to enumerate all 24 + record transitions
  const trans: number[][] = [];
  for (let head = 0; head < states.length; head++) {
    const c = states[head];
    trans[head] = new Array(NUM_MOVES);
    for (let mi = 0; mi < NUM_MOVES; mi++) {
      const cf = MOVE_OPS[mi].centerFrom;
      const nc = new Int8Array(6);
      for (let i = 0; i < 6; i++) nc[i] = c[cf[i]];
      const k = key(nc);
      let id = idxMap.get(k);
      if (id === undefined) { id = states.length; idxMap.set(k, id); states.push(nc); }
      trans[head][mi] = id;
    }
  }
  const cm = new Int32Array(states.length * NUM_MOVES);
  for (let s = 0; s < states.length; s++) for (let mi = 0; mi < NUM_MOVES; mi++) cm[s * NUM_MOVES + mi] = trans[s][mi];
  CENTER_MOVE = cm; CENTER_INDEX_MAP = idxMap;
}
function centerIndexOf(c: ArrayLike<number>): number { buildCenterTable(); return CENTER_INDEX_MAP!.get(Array.from(c).join(','))!; }

// ── compact coordinate (ci, ai, bi, centerIdx) + incremental move transitions ────────────
// IDA* searches over the 4 compact coordinates updated O(1) per move via the SAME move tables built for
// the PDBs (CORNER_PERM/ORI_MOVE, EDGE6_POS_MOVE/FLIPMASK, CENTER_MOVE) — never re-derives from the full
// cube. This is the standard min2phase/Korf speedup and is what makes deep STM IDA* tractable.
function ensureMoveTables(): void { buildCornerMoveTables(); buildEdge6MoveTables(); buildCenterTable(); }
function cornerMoveIdx(ci: number, mi: number): number {
  const p = (ci / N_CORNER_ORI) | 0, o = ci % N_CORNER_ORI;
  return CORNER_PERM_MOVE![p * NUM_MOVES + mi] * N_CORNER_ORI + CORNER_ORI_MOVE![o * NUM_MOVES + mi];
}
function edge6MoveIdx(ei: number, mi: number): number {
  const pr = (ei / N_EDGE6_ORI) | 0, fl = ei % N_EDGE6_ORI;
  return EDGE6_POS_MOVE![pr * NUM_MOVES + mi] * N_EDGE6_ORI + (fl ^ EDGE6_FLIPMASK![pr * NUM_MOVES + mi]);
}

// ── solver state bundle ──────────────────────────────────────────────────────────────
export interface StmTables { corner: Pdb; edgeA: Pdb; edgeB: Pdb; }

export function heuristic(s: CubieState, t: StmTables): number {
  const hc = t.corner.dist[cornerIndex(s)];
  const ha = t.edgeA.dist[edge6Index(s.ep, s.eo, EDGE_GROUP_A)];
  const hb = t.edgeB.dist[edge6Index(s.ep, s.eo, EDGE_GROUP_B)];
  let h = hc; if (ha > h) h = ha; if (hb > h) h = hb;
  if (h === 0) { // corners+edges solved; centers may need ≤2
    for (let i = 0; i < 6; i++) if (s.center[i] !== i) return 1;
  }
  return h;
}

export interface StmSolveResult { solution: string; length: number; nodes: number; }

const AXIS_OF_BASE = [0, 0, 1, 1, 2, 2, 1, 0, 2]; // U D R L F B M E S → y,y,x,x,z,z,x,y,z

/**
 * OPTIMAL STM solve via IDA* over the compact (corner, edgeA, edgeB, center) coordinates, updated O(1)
 * per move with precomputed transition tables. h = max(corner,edgeA,edgeB) admissible PDB heuristic;
 * goal test = all four coordinates solved (centers home included). Returns the provably-shortest STM
 * solution, or null if none ≤ maxDepth. `maxNodes` aborts (returns null) if exceeded.
 */
export function solveStmOptimal(scramble: string | CubieState, t: StmTables, maxDepth = 25, maxNodes = Infinity): StmSolveResult | null {
  ensureMoveTables();
  const start = typeof scramble === 'string' ? applyScramble(scramble) : scramble;
  const ci0 = cornerIndex(start);
  const ai0 = edge6Index(start.ep, start.eo, EDGE_GROUP_A);
  const bi0 = edge6Index(start.ep, start.eo, EDGE_GROUP_B);
  const ce0 = centerIndexOf(start.center);
  const cD = t.corner.dist, aD = t.edgeA.dist, bD = t.edgeB.dist;
  const hOf = (ci: number, ai: number, bi: number, ce: number): number => {
    let h = cD[ci]; const a = aD[ai]; if (a > h) h = a; const b = bD[bi]; if (b > h) h = b;
    if (h === 0 && ce !== CENTER_SOLVED) return 1;
    return h;
  };
  if (hOf(ci0, ai0, bi0, ce0) === 0) return { solution: '', length: 0, nodes: 0 };

  let nodes = 0;
  const MAXP = 30;
  const pathMoves = new Int32Array(MAXP);
  const cm = CENTER_MOVE!;
  let aborted = false;

  function dfs(ci: number, ai: number, bi: number, ce: number, g: number, bound: number, lastBase: number): boolean {
    nodes++;
    if (nodes > maxNodes) { aborted = true; return false; }
    const h = hOf(ci, ai, bi, ce);
    if (g + h > bound) return false;
    if (h === 0) return true; // all coords solved (h includes the center≥1 term)
    for (let mi = 0; mi < NUM_MOVES; mi++) {
      const base = MOVE_BASE[mi];
      if (base === lastBase) continue;
      if (lastBase >= 0 && AXIS_OF_BASE[base] === AXIS_OF_BASE[lastBase] && base < lastBase) continue;
      const nci = cornerMoveIdx(ci, mi);
      const nai = edge6MoveIdx(ai, mi);
      const nbi = edge6MoveIdx(bi, mi);
      const nce = cm[ce * NUM_MOVES + mi];
      pathMoves[g] = mi;
      if (dfs(nci, nai, nbi, nce, g + 1, bound, base)) return true;
      if (aborted) return false;
    }
    return false;
  }

  let bound = hOf(ci0, ai0, bi0, ce0);
  while (bound <= maxDepth) {
    if (dfs(ci0, ai0, bi0, ce0, 0, bound, -1)) {
      // pathMoves[0..bound-1] but actual length is the depth where it returned; reconstruct by replay.
      // The recursion sets pathMoves[g]=mi at depth g; solution length = first g where h became 0.
      // Easiest: rebuild length by following until solved on the compact coords.
      const sol: string[] = [];
      let ci = ci0, ai = ai0, bi = bi0, ce = ce0, g = 0;
      while (hOf(ci, ai, bi, ce) !== 0) {
        const mi = pathMoves[g++];
        sol.push(STM_MOVE_NAMES[mi]);
        ci = cornerMoveIdx(ci, mi); ai = edge6MoveIdx(ai, mi); bi = edge6MoveIdx(bi, mi); ce = cm[ce * NUM_MOVES + mi];
      }
      return { solution: sol.join(' '), length: sol.length, nodes };
    }
    if (aborted) return null;
    bound++;
  }
  return null;
}

function applyScramble(scramble: string): CubieState {
  let s = solvedState();
  for (const mi of parseStmScramble(scramble)) s = applyMoveState(s, mi);
  return s;
}

/**
 * Table-free OPTIMAL solver via breadth-first search over the full cube state (centers included). BFS
 * is optimal by construction, so this is an INDEPENDENT optimality oracle for shallow scrambles — it
 * needs no PDBs and is used in tests to validate solveStmOptimal. Practical only to ~depth 6 (the
 * frontier grows ~13× per ply); returns null beyond `limit` or `maxNodes` (so it stays memory-bounded —
 * the visited Map is the cost). When it DOES return, the length is optimal.
 */
export function solveStmBruteBFS(scramble: string | CubieState, limit = 6, maxNodes = 6_000_000): StmSolveResult | null {
  const start = typeof scramble === 'string' ? applyScramble(scramble) : scramble;
  if (isSolvedState(start)) return { solution: '', length: 0, nodes: 1 };
  const key = (s: CubieState) => `${s.cp}|${s.co}|${s.ep}|${s.eo}|${s.center}`;
  const parent = new Map<string, { k: string; mi: number } | null>();
  parent.set(key(start), null);
  let frontier: { s: CubieState; k: string }[] = [{ s: start, k: key(start) }];
  let depth = 0, nodes = 1;
  while (frontier.length && depth < limit) {
    if (parent.size > maxNodes) return null; // memory guard — caller treats null as "too deep, skip"
    const next: { s: CubieState; k: string }[] = [];
    for (const { s, k } of frontier) {
      for (let mi = 0; mi < NUM_MOVES; mi++) {
        const ns = applyMoveState(s, mi); nodes++;
        const nk = key(ns);
        if (parent.has(nk)) continue;
        parent.set(nk, { k, mi });
        if (isSolvedState(ns)) {
          // reconstruct
          const moves: number[] = [];
          // walk back: ns came from k via mi; then k's parent etc.
          let stepKey = nk;
          while (true) {
            const p = parent.get(stepKey)!;
            if (!p) break;
            moves.push(p.mi); stepKey = p.k;
          }
          moves.reverse();
          return { solution: moves.map((m) => STM_MOVE_NAMES[m]).join(' '), length: moves.length, nodes };
        }
        next.push({ s: ns, k: nk });
      }
    }
    frontier = next; depth++;
  }
  return null;
}

// Re-export for build script / tests
export { cornerOriUnrank, edge6Index, centerIndexOf };
