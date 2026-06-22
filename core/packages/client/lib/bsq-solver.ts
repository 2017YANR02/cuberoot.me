/*
 * Bandaged Square-1 (bsq, cstimer key `bsq` = </,(1,0)>) solver — pure TS, no worker, no tables to
 * download. TIER D (valid + bounded, NOT optimal): a constructive THREE-STAGE reduction (shape → corner
 * permutation → edge permutation) that solves the actual STATE, emitting ONLY legal `</,(1,0)>` moves.
 *
 * THE PUZZLE — the MOVE RESTRICTION IS THE PUZZLE. The bandaged Square-1 is a physical Square-1 (same 24
 * thirty-degree slots, 8 corners spanning two adjacent slots + 8 edges) whose move set is restricted to
 * `< / , (1,0) >`: the TOP layer may be turned `(x,0)` (x∈[-5,6]) and the `/` slice may fire, but the
 * BOTTOM layer is NEVER turned directly. cstimer's `bsq` scrambler is `sq1_scramble(2, len)` →
 * `sq1_getseq(num=1, type=2, len)` where `y` is forced to 0 — so every scramble twist is `(x,0)` and the
 * output is `(x1,0) / (x2,0) / …` with exactly `len` slices (cstimer counts scramble length = #slices).
 * Our solution is therefore ALSO restricted to `(x,0)` top-turns + `/` slices — returning an arbitrary
 * `(a,b)` twist with b≠0 would be physically ILLEGAL on the bandaged puzzle. (The `/` slice DOES move
 * pieces between top and bottom, so bottom slots are not frozen — this is a genuine non-trivial puzzle.)
 *
 * MEASURED CLOSURE (§0.0 #2, BFS from solved over {legal (x,0) top-turn, slice}). The reachable closure is
 * HUGE: a bounded BFS hit a 12,000,004-state guard at depth 24 while still growing ~3× per layer (depth 23
 * found 2.46M new states) — clearly a large subgroup of the single Square-1 group, far beyond any full-BFS
 * tier. So this is TIER D, NOT TIER A. (Verified empirically — the loop's "两阶段" note is confirmed.)
 *
 * STRUCTURE (measured — this is what makes a clean reduction possible):
 *   • SHAPE closure under {top, slice}: only 399 reachable shapes (diameter 16). [vs 3,678 for full Sq-1]
 *   • CUBE-SHAPE coset (states reachable from solved that are cube-shaped): exactly 518,400 = 720² states.
 *     It is a DIRECT PRODUCT — corner permutation reaches a group of order 720 and edge permutation an
 *     INDEPENDENT group of order 720 (corner-fixing edge ops generate the full 720; verified by closure).
 *     (A cube-shape Square-1 state has no piece orientation, so the (corner-perm, edge-perm) pair uniquely
 *     identifies the state.)
 * Hence the reduction: (1) solve SHAPE to cube shape (399-shape BFS); (2) solve CORNER permutation (720-
 * state BFS, may disturb edges); (3) solve EDGE permutation with CORNER-FIXING macros only (720-state BFS,
 * corners stay solved). Every macro is a legal `{top, slice}` word, so the whole solution is legal bsq.
 *
 * GENERATORS (embedded, derived OFFLINE). The cube→cube macros needed to generate the 720 corner / 720
 * edge groups are deep (a from-solved BFS must visit ~1.6M states to harvest them) — far too heavy to
 * rebuild in the browser. So the SHORTEST macro reaching each of the 720 corner perms, and the shortest
 * CORNER-FIXING composite (macro ++ corner-solve) reaching each of the 720 edge perms, were harvested
 * once offline (tests/_bsq_genextract2.mjs) and embedded below as compact op-words. At runtime the solver
 * only BUILDS the three small BFS parent tables from these embedded generators (399 + 720 + 720 states,
 * ~tens of ms) — no harvest, no download. Each generator is a string of comma-joined tokens: "s" = slice,
 * "1".."11" = top-turn by that many 30° slots. The test re-derives the move model INDEPENDENTLY and
 * round-trips real cstimer bsq scrambles, so the embedded generators are verified, not trusted.
 *
 * STATE MODEL (single source of truth): 24-slot piece array (top 0..11 CW, bottom 12..23 CW). A corner
 * occupies two adjacent slots with the SAME id; an edge one slot. SOLVED: corner slots (0,1)(3,4)(6,7)
 * (9,10)(13,14)(16,17)(19,20)(22,23) hold corner ids 0..7; edge slots 2,5,8,11,12,15,18,21 hold edge ids
 * 0..7 (stored as 100+e so corners and edges never collide). The SHAPE (which slots start a corner) is
 * DERIVED. Moves (cstimer convention): top by k → p[i]=old[(12+i-k)%12] (i<12); slice → swap slots i+6 ↔
 * i+12 for i=0..5; the lock check forbids a top-turn cutting a corner. We carry the full 24-slot array
 * through, projecting to corner-key (8 corner ids) / edge-key (8 edge ids) for the perm tables.
 *
 * METRIC: solution length is counted in cstimer-style SLICE-DELIMITED fragments (a run of top-turns then a
 * slice = one fragment; a trailing top-turn run with no slice counts 1) — the same unit cstimer uses for
 * the scramble length of `sq1_scramble` (= #slices). The pretty solution string is in `(x,0) / …` form.
 *
 * QUALITY: VALID + BOUNDED (a constructive three-stage reduction), NOT optimal (`optimal` always false).
 * Over a 3000-scramble random sample the measured mean ≈ 16 and max ≈ 63 fragments; BSQ_MAX_LENGTH (90)
 * carries margin and is asserted in tests/bsq_solver.test.ts so it can never be silently violated.
 */

type U8 = Uint8Array<ArrayBuffer>;

// ── per-side solved layout (slot → piece id) ─────────────────────────────────────────
const CORNER_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [3, 4], [6, 7], [9, 10], [13, 14], [16, 17], [19, 20], [22, 23],
];
const EDGE_SLOTS: readonly number[] = [2, 5, 8, 11, 12, 15, 18, 21];
const EDGE_ID_GAP = 100; // edge ids = EDGE_ID_GAP + e so corners (0..7) and edges never collide

function solvedPieces(): U8 {
  const p = new Uint8Array(24) as U8;
  CORNER_SLOTS.forEach((pair, ci) => { p[pair[0]] = ci; p[pair[1]] = ci; });
  EDGE_SLOTS.forEach((slot, ei) => { p[slot] = EDGE_ID_GAP + ei; });
  return p;
}
const SOLVED: U8 = solvedPieces();

// ── primitive moves on the 24-slot piece array (cstimer convention) ───────────────────
function copy(a: U8): U8 { return new Uint8Array(a) as U8; }
function rotTop(a: U8, k: number): U8 {
  k = ((k % 12) + 12) % 12;
  if (k === 0) return copy(a);
  const n = copy(a);
  for (let i = 0; i < 12; i++) n[i] = a[(12 + i - k) % 12];
  return n;
}
function slicePieces(a: U8): U8 {
  const n = copy(a);
  for (let i = 0; i < 6; i++) { const c = n[i + 6]; n[i + 6] = n[i + 12]; n[i + 12] = c; }
  return n;
}
/** Is slot i a corner-start (slot i and i+1 in the same ring hold the same id)? Derives SHAPE. */
function isCornerStart(a: ArrayLike<number>, i: number): boolean {
  if (i < 11) return a[i] === a[i + 1];   // top ring 0..11
  if (i === 11) return false;
  if (i < 23) return a[i] === a[i + 1];   // bottom ring 12..23
  return false;
}
/** cstimer lock check for a top-turn by x (bottom component is always 0 for bsq); true = ILLEGAL.
 *  Reads the piece-shape directly: a corner straddling either cut blocks the turn. */
function lockedTop(a: U8, x: number): boolean {
  const ax = ((x % 12) + 12) % 12;
  return isCornerStart(a, (17 - ax) % 12) || isCornerStart(a, (11 - ax) % 12)
    || isCornerStart(a, 17) || isCornerStart(a, 23); // y=0 ⇒ bottom cuts at slots 17 & 23
}

// ── atomic op (a slice or a top-turn) on the 24-slot array ────────────────────────────
type Op = { s: true } | { t: number };
function applyOp(a: U8, op: Op): U8 { return 's' in op ? slicePieces(a) : rotTop(a, op.t); }
function applyOps(a: U8, ops: readonly Op[]): U8 { let q = a; for (const op of ops) q = applyOp(q, op); return q; }
function invOps(ops: readonly Op[]): Op[] {
  return ops.slice().reverse().map((op) => ('s' in op ? { s: true } as Op : { t: (12 - op.t) % 12 } as Op));
}
/** Decode a compact embedded generator string ("s,3,11,s,…") into an op-word. */
function decodeWord(str: string): Op[] {
  return str.split(',').map((t) => (t === 's' ? { s: true } as Op : { t: parseInt(t, 10) } as Op));
}

// ── shape / corner-perm / edge-perm projections ───────────────────────────────────────
function shapeKey(a: U8): string { let s = ''; for (let i = 0; i < 24; i++) s += isCornerStart(a, i) ? '1' : '0'; return s; }
const CORNER_POS: readonly number[] = [0, 3, 6, 9, 13, 16, 19, 22]; // corner-start slot of each corner
const EDGE_POS: readonly number[] = [2, 5, 8, 11, 12, 15, 18, 21];  // edge slot of each edge
function cornerKey(a: U8): string { let s = ''; for (const i of CORNER_POS) s += String.fromCharCode(48 + a[i]); return s; }
function edgeKey(a: U8): string { let s = ''; for (const i of EDGE_POS) s += String.fromCharCode(48 + a[i] - EDGE_ID_GAP); return s; }
const SHAPE_CUBE = shapeKey(SOLVED);
const SOLVED_CORNER_KEY = cornerKey(SOLVED);
const SOLVED_EDGE_KEY = edgeKey(SOLVED);

// ── embedded generators (derived offline; see tests/_bsq_genextract2.mjs and the header) ──
// CORNER_GENS: shortest cube→cube macro reaching each of the 720 corner perms.
// EDGE_GENS:   shortest corner-FIXING composite reaching each of the 720 edge perms.
const CORNER_GENS: readonly string[] = ["3","6","9","1,s,2","1,s,5","1,s,8","1,s,11","4,s,2","4,s,5","4,s,8","4,s,11","7,s,2","7,s,5","7,s,8","7,s,11","10,s,2","10,s,5","10,s,8","10,s,11","1,s,3,s,2","1,s,3,s,5","1,s,3,s,8","1,s,3,s,11","1,s,9,s,2","1,s,9,s,5","1,s,9,s,8","1,s,9,s,11","4,s,3,s,2","4,s,3,s,5","4,s,3,s,8","4,s,3,s,11","4,s,9,s,2","4,s,9,s,5","4,s,9,s,8","4,s,9,s,11","7,s,3,s,2","7,s,3,s,5","7,s,3,s,8","7,s,3,s,11","7,s,9,s,2","7,s,9,s,5","7,s,9,s,8","7,s,9,s,11","10,s,3,s,2","10,s,3,s,5","10,s,3,s,8","10,s,3,s,11","10,s,9,s,2","10,s,9,s,5","10,s,9,s,8","10,s,9,s,11","1,s,3,s,3,s,2","1,s,3,s,3,s,5","1,s,3,s,3,s,8","1,s,3,s,3,s,11","1,s,3,s,9,s,2","1,s,3,s,9,s,5","1,s,3,s,9,s,8","1,s,3,s,9,s,11","1,s,9,s,3,s,2","1,s,9,s,3,s,5","1,s,9,s,3,s,8","1,s,9,s,3,s,11","1,s,9,s,9,s,2","1,s,9,s,9,s,5","1,s,9,s,9,s,8","1,s,9,s,9,s,11","4,s,3,s,9,s,2","4,s,3,s,9,s,5","4,s,3,s,9,s,8","4,s,3,s,9,s,11","4,s,9,s,3,s,2","4,s,9,s,3,s,5","4,s,9,s,3,s,8","4,s,9,s,3,s,11","4,s,9,s,9,s,2","4,s,9,s,9,s,5","4,s,9,s,9,s,8","4,s,9,s,9,s,11","7,s,3,s,9,s,2","7,s,3,s,9,s,5","7,s,3,s,9,s,8","7,s,3,s,9,s,11","7,s,9,s,3,s,2","7,s,9,s,3,s,5","7,s,9,s,3,s,8","7,s,9,s,3,s,11","7,s,9,s,9,s,2","7,s,9,s,9,s,5","7,s,9,s,9,s,8","7,s,9,s,9,s,11","10,s,3,s,9,s,2","10,s,3,s,9,s,5","10,s,3,s,9,s,8","10,s,3,s,9,s,11","10,s,9,s,3,s,2","10,s,9,s,3,s,5","10,s,9,s,3,s,8","10,s,9,s,3,s,11","s,3,s,9,s,3,s,9,s","s,9,s,3,s,9,s,3,s","1,s,3,s,9,s,3,s,2","1,s,3,s,9,s,3,s,5","1,s,3,s,9,s,3,s,8","1,s,3,s,9,s,3,s,11","1,s,9,s,3,s,9,s,2","1,s,9,s,3,s,9,s,5","1,s,9,s,3,s,9,s,8","1,s,9,s,3,s,9,s,11","4,s,3,s,9,s,3,s,2","4,s,3,s,9,s,3,s,5","4,s,3,s,9,s,3,s,8","4,s,3,s,9,s,3,s,11","4,s,9,s,3,s,9,s,2","4,s,9,s,3,s,9,s,5","4,s,9,s,3,s,9,s,8","4,s,9,s,3,s,9,s,11","s,3,s,9,s,3,s,9,s,3","s,3,s,9,s,3,s,9,s,9","s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s","s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s","s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,3","s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,6","s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,9","s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,3","s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,6","s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,9","3,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s","3,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s","6,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s","6,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s","9,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s","9,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s","s,3,s,1,s,4,s,8,s,4,s,4,s,8,s,3,s,9,s","s,3,s,1,s,4,s,8,s,4,s,10,s,9,s,8,s,3,s","s,3,s,1,s,4,s,8,s,10,s,8,s,4,s,9,s,9,s","s,3,s,1,s,4,s,8,s,10,s,8,s,7,s,3,s,3,s","s,3,s,1,s,4,s,8,s,10,s,8,s,10,s,9,s,9,s","s,3,s,1,s,8,s,8,s,4,s,2,s,9,s,8,s,3,s","s,3,s,1,s,8,s,8,s,4,s,8,s,8,s,3,s,9,s","s,3,s,3,s,2,s,4,s,2,s,4,s,8,s,11,s,9,s","s,3,s,3,s,4,s,4,s,8,s,4,s,4,s,5,s,9,s","s,3,s,3,s,4,s,4,s,8,s,4,s,7,s,8,s,3,s","s,3,s,3,s,4,s,10,s,4,s,8,s,1,s,8,s,3,s","s,3,s,3,s,4,s,10,s,4,s,8,s,10,s,5,s,9,s","s,3,s,3,s,10,s,4,s,8,s,4,s,4,s,5,s,9,s","s,3,s,3,s,10,s,4,s,8,s,4,s,7,s,8,s,3,s","s,3,s,3,s,10,s,10,s,4,s,8,s,1,s,8,s,3,s","s,3,s,3,s,10,s,10,s,4,s,8,s,10,s,5,s,9,s","s,3,s,7,s,2,s,4,s,8,s,2,s,2,s,9,s,9,s","s,3,s,7,s,2,s,4,s,8,s,2,s,5,s,3,s,3,s","s,3,s,7,s,2,s,4,s,8,s,2,s,11,s,3,s,3,s","s,3,s,7,s,8,s,8,s,4,s,8,s,2,s,9,s,9,s","s,3,s,7,s,8,s,8,s,4,s,8,s,5,s,3,s,3,s","s,3,s,7,s,8,s,8,s,4,s,8,s,8,s,9,s,9,s","s,3,s,7,s,8,s,8,s,4,s,8,s,11,s,3,s,3,s","s,3,s,9,s,4,s,4,s,8,s,4,s,4,s,11,s,9,s","s,3,s,9,s,4,s,8,s,8,s,4,s,8,s,11,s,9,s","s,9,s,4,s,3,s,2,s,8,s,4,s,8,s,11,s,9,s","s,9,s,4,s,3,s,10,s,8,s,4,s,4,s,11,s,9,s","s,9,s,4,s,5,s,8,s,4,s,8,s,2,s,9,s,9,s","s,9,s,4,s,5,s,8,s,4,s,8,s,5,s,3,s,3,s","s,9,s,4,s,5,s,8,s,4,s,8,s,8,s,9,s,9,s","s,9,s,4,s,5,s,8,s,4,s,8,s,11,s,3,s,3,s","s,9,s,4,s,11,s,4,s,8,s,2,s,2,s,9,s,9,s","s,9,s,4,s,11,s,4,s,8,s,2,s,5,s,3,s,3,s","s,9,s,4,s,11,s,4,s,8,s,2,s,8,s,9,s,9,s","s,9,s,4,s,11,s,4,s,8,s,2,s,11,s,3,s,3,s","s,9,s,9,s,1,s,4,s,8,s,4,s,4,s,5,s,9,s","s,9,s,9,s,1,s,4,s,8,s,4,s,7,s,8,s,3,s","s,9,s,9,s,1,s,10,s,4,s,8,s,1,s,8,s,3,s","s,9,s,9,s,1,s,10,s,4,s,8,s,10,s,5,s,9,s","s,9,s,9,s,5,s,4,s,2,s,4,s,8,s,11,s,9,s","s,9,s,9,s,7,s,4,s,8,s,4,s,4,s,5,s,9,s","s,9,s,9,s,7,s,4,s,8,s,4,s,7,s,8,s,3,s","s,9,s,9,s,7,s,10,s,4,s,8,s,1,s,8,s,3,s","s,9,s,9,s,7,s,10,s,4,s,8,s,10,s,5,s,9,s","3,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,3","3,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,6","3,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,9","3,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,3","3,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,6","3,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,9","6,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,3","6,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,6","6,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,9","6,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,3","6,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,6","6,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,9","9,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,6","9,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,9","9,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,6","9,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,9","s,3,s,1,s,4,s,8,s,4,s,4,s,8,s,3,s,9,s,3","s,3,s,1,s,4,s,8,s,4,s,4,s,8,s,3,s,9,s,6","s,3,s,1,s,4,s,8,s,4,s,4,s,8,s,3,s,9,s,9","s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,1,s,2","s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,1,s,5","s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,1,s,8","s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,1,s,11","s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,4,s,2","s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,4,s,5","s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,4,s,8","s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,4,s,11","s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,7,s,2","s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,7,s,5","s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,7,s,8","s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,7,s,11","s,3,s,1,s,4,s,8,s,4,s,10,s,9,s,8,s,3,s,3","s,3,s,1,s,4,s,8,s,4,s,10,s,9,s,8,s,3,s,9","s,3,s,1,s,4,s,8,s,10,s,8,s,4,s,9,s,9,s,3","s,3,s,1,s,4,s,8,s,10,s,8,s,4,s,9,s,9,s,6","s,3,s,1,s,8,s,8,s,4,s,2,s,9,s,8,s,3,s,3","s,3,s,1,s,8,s,8,s,4,s,2,s,9,s,8,s,3,s,6","s,3,s,1,s,8,s,8,s,4,s,2,s,9,s,8,s,3,s,9","s,3,s,1,s,8,s,8,s,4,s,8,s,8,s,3,s,9,s,3","s,3,s,1,s,8,s,8,s,4,s,8,s,8,s,3,s,9,s,6","s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,4,s,2","s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,4,s,5","s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,4,s,8","s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,4,s,11","s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,7,s,2","s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,7,s,5","s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,7,s,8","s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,7,s,11","s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,10,s,5","s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,10,s,8","s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,10,s,11","s,3,s,3,s,4,s,4,s,8,s,4,s,4,s,5,s,9,s,3","s,3,s,3,s,4,s,4,s,8,s,4,s,4,s,5,s,9,s,6","s,3,s,3,s,4,s,4,s,8,s,4,s,4,s,5,s,9,s,9","s,3,s,3,s,4,s,4,s,8,s,4,s,7,s,8,s,3,s,3","s,3,s,3,s,4,s,4,s,8,s,4,s,7,s,8,s,3,s,6","s,3,s,3,s,4,s,4,s,8,s,4,s,7,s,8,s,3,s,9","s,3,s,3,s,4,s,10,s,4,s,8,s,1,s,8,s,3,s,3","s,3,s,3,s,4,s,10,s,4,s,8,s,1,s,8,s,3,s,6","s,3,s,3,s,4,s,10,s,4,s,8,s,1,s,8,s,3,s,9","s,3,s,3,s,4,s,10,s,4,s,8,s,10,s,5,s,9,s,3","s,3,s,3,s,4,s,10,s,4,s,8,s,10,s,5,s,9,s,6","s,3,s,3,s,10,s,4,s,8,s,4,s,4,s,5,s,9,s,3","s,3,s,3,s,10,s,4,s,8,s,4,s,7,s,8,s,3,s,3","s,3,s,3,s,10,s,4,s,8,s,4,s,7,s,8,s,3,s,6","s,3,s,3,s,10,s,4,s,8,s,4,s,7,s,8,s,3,s,9","s,3,s,3,s,10,s,10,s,4,s,8,s,1,s,8,s,3,s,3","s,3,s,3,s,10,s,10,s,4,s,8,s,1,s,8,s,3,s,6","s,3,s,3,s,10,s,10,s,4,s,8,s,1,s,8,s,3,s,9","s,3,s,3,s,10,s,10,s,4,s,8,s,10,s,5,s,9,s,3","s,3,s,3,s,10,s,10,s,4,s,8,s,10,s,5,s,9,s,6","s,3,s,3,s,10,s,10,s,4,s,8,s,10,s,5,s,9,s,9","s,3,s,7,s,2,s,4,s,8,s,2,s,2,s,9,s,9,s,3","s,3,s,7,s,2,s,4,s,8,s,2,s,2,s,9,s,9,s,6","s,3,s,7,s,8,s,8,s,4,s,8,s,2,s,9,s,9,s,3","s,3,s,7,s,8,s,8,s,4,s,8,s,2,s,9,s,9,s,6","s,3,s,7,s,8,s,8,s,4,s,8,s,8,s,9,s,9,s,3","s,3,s,7,s,8,s,8,s,4,s,8,s,8,s,9,s,9,s,6","s,3,s,9,s,4,s,4,s,8,s,4,s,4,s,11,s,9,s,3","s,3,s,9,s,4,s,4,s,8,s,4,s,4,s,11,s,9,s,6","s,3,s,9,s,4,s,4,s,8,s,4,s,4,s,11,s,9,s,9","s,3,s,9,s,4,s,8,s,8,s,4,s,8,s,11,s,9,s,3","s,3,s,9,s,4,s,8,s,8,s,4,s,8,s,11,s,9,s,6","s,3,s,9,s,4,s,8,s,8,s,4,s,8,s,11,s,9,s,9","s,9,s,4,s,3,s,2,s,8,s,4,s,8,s,11,s,9,s,3","s,9,s,4,s,3,s,2,s,8,s,4,s,8,s,11,s,9,s,6","s,9,s,4,s,3,s,2,s,8,s,4,s,8,s,11,s,9,s,9","s,9,s,4,s,3,s,10,s,8,s,4,s,4,s,11,s,9,s,3","s,9,s,4,s,3,s,10,s,8,s,4,s,4,s,11,s,9,s,6","s,9,s,4,s,3,s,10,s,8,s,4,s,4,s,11,s,9,s,9","s,9,s,4,s,5,s,8,s,4,s,8,s,2,s,9,s,9,s,3","s,9,s,4,s,5,s,8,s,4,s,8,s,2,s,9,s,9,s,6","s,9,s,4,s,5,s,8,s,4,s,8,s,8,s,9,s,9,s,3","s,9,s,4,s,5,s,8,s,4,s,8,s,8,s,9,s,9,s,6","s,9,s,4,s,11,s,4,s,8,s,2,s,2,s,9,s,9,s,3","s,9,s,4,s,11,s,4,s,8,s,2,s,2,s,9,s,9,s,6","s,9,s,9,s,1,s,4,s,8,s,4,s,4,s,5,s,9,s,3","s,9,s,9,s,1,s,4,s,8,s,4,s,4,s,5,s,9,s,6","s,9,s,9,s,1,s,4,s,8,s,4,s,4,s,5,s,9,s,9","s,9,s,9,s,1,s,4,s,8,s,4,s,7,s,8,s,3,s,3","s,9,s,9,s,1,s,4,s,8,s,4,s,7,s,8,s,3,s,6","s,9,s,9,s,1,s,4,s,8,s,4,s,7,s,8,s,3,s,9","s,9,s,9,s,1,s,10,s,4,s,8,s,1,s,8,s,3,s,3","s,9,s,9,s,1,s,10,s,4,s,8,s,1,s,8,s,3,s,6","s,9,s,9,s,1,s,10,s,4,s,8,s,1,s,8,s,3,s,9","s,9,s,9,s,7,s,4,s,8,s,4,s,4,s,5,s,9,s,3","s,9,s,9,s,7,s,4,s,8,s,4,s,4,s,5,s,9,s,6","s,9,s,9,s,7,s,4,s,8,s,4,s,4,s,5,s,9,s,9","s,9,s,9,s,7,s,4,s,8,s,4,s,7,s,8,s,3,s,3","s,9,s,9,s,7,s,4,s,8,s,4,s,7,s,8,s,3,s,6","s,9,s,9,s,7,s,4,s,8,s,4,s,7,s,8,s,3,s,9","s,9,s,9,s,7,s,10,s,4,s,8,s,10,s,5,s,9,s,3","s,9,s,9,s,7,s,10,s,4,s,8,s,10,s,5,s,9,s,6","s,9,s,9,s,7,s,10,s,4,s,8,s,10,s,5,s,9,s,9","1,s,2,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s","1,s,5,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s","1,s,8,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s","1,s,8,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s","1,s,11,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s","3,s,3,s,1,s,4,s,8,s,4,s,4,s,8,s,3,s,9,s","3,s,3,s,1,s,8,s,8,s,4,s,2,s,9,s,8,s,3,s","3,s,3,s,1,s,8,s,8,s,4,s,8,s,8,s,3,s,9,s","3,s,3,s,7,s,8,s,8,s,4,s,8,s,8,s,9,s,9,s","3,s,3,s,7,s,8,s,8,s,4,s,8,s,11,s,3,s,3,s","3,s,3,s,9,s,4,s,8,s,8,s,4,s,8,s,11,s,9,s","3,s,9,s,4,s,3,s,2,s,8,s,4,s,8,s,11,s,9,s","3,s,9,s,4,s,3,s,10,s,8,s,4,s,4,s,11,s,9,s","3,s,9,s,4,s,5,s,8,s,4,s,8,s,8,s,9,s,9,s","3,s,9,s,4,s,5,s,8,s,4,s,8,s,11,s,3,s,3,s","3,s,9,s,4,s,11,s,4,s,8,s,2,s,2,s,9,s,9,s","3,s,9,s,9,s,1,s,4,s,8,s,4,s,4,s,5,s,9,s","3,s,9,s,9,s,1,s,4,s,8,s,4,s,7,s,8,s,3,s","3,s,9,s,9,s,1,s,10,s,4,s,8,s,1,s,8,s,3,s","3,s,9,s,9,s,5,s,4,s,2,s,4,s,8,s,11,s,9,s","3,s,9,s,9,s,7,s,4,s,8,s,4,s,4,s,5,s,9,s","3,s,9,s,9,s,7,s,10,s,4,s,8,s,1,s,8,s,3,s","3,s,9,s,9,s,7,s,10,s,4,s,8,s,10,s,5,s,9,s","4,s,5,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s","4,s,8,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s","4,s,8,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s","4,s,11,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s","6,s,3,s,1,s,4,s,8,s,4,s,10,s,9,s,8,s,3,s","6,s,3,s,1,s,4,s,8,s,10,s,8,s,7,s,3,s,3,s","6,s,3,s,1,s,8,s,8,s,4,s,2,s,9,s,8,s,3,s","6,s,9,s,4,s,3,s,10,s,8,s,4,s,4,s,11,s,9,s","6,s,9,s,4,s,5,s,8,s,4,s,8,s,8,s,9,s,9,s","6,s,9,s,4,s,5,s,8,s,4,s,8,s,11,s,3,s,3,s","6,s,9,s,4,s,11,s,4,s,8,s,2,s,8,s,9,s,9,s","6,s,9,s,4,s,11,s,4,s,8,s,2,s,11,s,3,s,3,s","6,s,9,s,9,s,1,s,4,s,8,s,4,s,4,s,5,s,9,s","6,s,9,s,9,s,1,s,4,s,8,s,4,s,7,s,8,s,3,s","6,s,9,s,9,s,1,s,10,s,4,s,8,s,10,s,5,s,9,s","6,s,9,s,9,s,7,s,4,s,8,s,4,s,4,s,5,s,9,s","6,s,9,s,9,s,7,s,4,s,8,s,4,s,7,s,8,s,3,s","7,s,5,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s","7,s,5,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s","7,s,8,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s","9,s,3,s,1,s,4,s,8,s,4,s,4,s,8,s,3,s,9,s","9,s,3,s,1,s,8,s,8,s,4,s,2,s,9,s,8,s,3,s","9,s,3,s,7,s,2,s,4,s,8,s,2,s,2,s,9,s,9,s","9,s,3,s,7,s,2,s,4,s,8,s,2,s,5,s,3,s,3,s","9,s,3,s,7,s,8,s,8,s,4,s,8,s,5,s,3,s,3,s","9,s,3,s,7,s,8,s,8,s,4,s,8,s,8,s,9,s,9,s","9,s,3,s,7,s,8,s,8,s,4,s,8,s,11,s,3,s,3,s","9,s,3,s,9,s,4,s,8,s,8,s,4,s,8,s,11,s,9,s","9,s,9,s,4,s,3,s,10,s,8,s,4,s,4,s,11,s,9,s","9,s,9,s,4,s,5,s,8,s,4,s,8,s,2,s,9,s,9,s","9,s,9,s,4,s,5,s,8,s,4,s,8,s,5,s,3,s,3,s","9,s,9,s,4,s,5,s,8,s,4,s,8,s,8,s,9,s,9,s","9,s,9,s,4,s,5,s,8,s,4,s,8,s,11,s,3,s,3,s","9,s,9,s,4,s,11,s,4,s,8,s,2,s,8,s,9,s,9,s","9,s,9,s,4,s,11,s,4,s,8,s,2,s,11,s,3,s,3,s","10,s,5,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s","10,s,5,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s","10,s,8,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s","s,3,s,1,s,2,s,8,s,10,s,2,s,4,s,8,s,11,s,9,s","s,3,s,1,s,4,s,2,s,10,s,4,s,2,s,1,s,8,s,3,s","s,3,s,1,s,4,s,2,s,10,s,4,s,2,s,10,s,5,s,9,s","s,3,s,1,s,4,s,8,s,10,s,2,s,4,s,10,s,11,s,9,s","s,3,s,1,s,8,s,2,s,4,s,4,s,2,s,10,s,5,s,9,s","s,3,s,1,s,8,s,8,s,4,s,2,s,9,s,11,s,9,s,3,s","s,3,s,1,s,8,s,8,s,4,s,10,s,2,s,4,s,9,s,9,s","s,3,s,1,s,10,s,8,s,4,s,4,s,2,s,8,s,9,s,9,s","s,3,s,1,s,10,s,8,s,4,s,4,s,2,s,11,s,3,s,3,s","s,3,s,1,s,10,s,8,s,4,s,8,s,8,s,1,s,8,s,3,s","s,3,s,1,s,10,s,8,s,4,s,8,s,8,s,10,s,5,s,9,s","s,3,s,3,s,2,s,4,s,2,s,4,s,2,s,9,s,8,s,3,s","s,3,s,3,s,2,s,4,s,2,s,4,s,8,s,8,s,3,s,9,s","s,3,s,3,s,4,s,10,s,4,s,8,s,1,s,11,s,9,s,3,s","s,3,s,3,s,8,s,4,s,2,s,4,s,2,s,9,s,8,s,3,s","s,3,s,7,s,2,s,4,s,2,s,2,s,4,s,4,s,5,s,9,s","s,3,s,7,s,2,s,4,s,4,s,8,s,4,s,2,s,11,s,9,s","s,3,s,7,s,2,s,10,s,8,s,2,s,10,s,8,s,11,s,9,s","s,3,s,7,s,2,s,10,s,8,s,8,s,10,s,4,s,11,s,9,s","s,3,s,7,s,8,s,10,s,4,s,8,s,10,s,7,s,8,s,3,s","s,3,s,9,s,4,s,8,s,8,s,4,s,2,s,9,s,8,s,3,s","s,9,s,3,s,1,s,11,s,4,s,8,s,2,s,8,s,9,s,9,s","s,9,s,4,s,3,s,10,s,8,s,4,s,4,s,8,s,3,s,9,s","s,9,s,4,s,3,s,10,s,8,s,10,s,8,s,1,s,3,s,3,s","s,9,s,4,s,3,s,10,s,8,s,10,s,8,s,4,s,9,s,9,s","s,9,s,4,s,3,s,10,s,8,s,10,s,8,s,7,s,3,s,3,s","s,9,s,4,s,3,s,10,s,8,s,10,s,8,s,10,s,9,s,9,s","s,9,s,4,s,5,s,2,s,4,s,8,s,2,s,7,s,8,s,3,s","s,9,s,4,s,5,s,10,s,4,s,8,s,10,s,7,s,8,s,3,s","s,9,s,4,s,11,s,4,s,4,s,8,s,4,s,2,s,11,s,9,s","s,9,s,4,s,11,s,10,s,8,s,2,s,10,s,8,s,11,s,9,s","s,9,s,9,s,1,s,10,s,8,s,8,s,4,s,2,s,11,s,9,s","s,9,s,9,s,5,s,4,s,2,s,4,s,2,s,9,s,8,s,3,s","1,s,2,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,9","1,s,5,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,3","1,s,5,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,6","1,s,8,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,3","1,s,8,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,6","1,s,8,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,9","1,s,8,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,3","1,s,8,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,6","1,s,11,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,9","3,s,3,s,1,s,4,s,8,s,4,s,4,s,8,s,3,s,9,s,3","3,s,3,s,1,s,4,s,8,s,4,s,4,s,8,s,3,s,9,s,9","3,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,1,s,8","3,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,1,s,11","3,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,7,s,2","3,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,7,s,5","3,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,7,s,8","3,s,3,s,1,s,8,s,8,s,4,s,2,s,9,s,8,s,3,s,3","3,s,3,s,1,s,8,s,8,s,4,s,2,s,9,s,8,s,3,s,6","3,s,3,s,1,s,8,s,8,s,4,s,2,s,9,s,8,s,3,s,9","3,s,3,s,1,s,8,s,8,s,4,s,8,s,8,s,3,s,9,s,3","3,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,4,s,2","3,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,4,s,5","3,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,4,s,8","3,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,4,s,11","3,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,10,s,11","3,s,3,s,7,s,8,s,8,s,4,s,8,s,8,s,9,s,9,s,3","3,s,3,s,9,s,4,s,8,s,8,s,4,s,8,s,11,s,9,s,9","3,s,9,s,4,s,3,s,10,s,8,s,4,s,4,s,11,s,9,s,3","3,s,9,s,4,s,3,s,10,s,8,s,4,s,4,s,11,s,9,s,6","3,s,9,s,4,s,3,s,10,s,8,s,4,s,4,s,11,s,9,s,9","3,s,9,s,4,s,5,s,8,s,4,s,8,s,8,s,9,s,9,s,6","3,s,9,s,9,s,1,s,4,s,8,s,4,s,7,s,8,s,3,s,9","3,s,9,s,9,s,1,s,10,s,4,s,8,s,1,s,8,s,3,s,3","3,s,9,s,9,s,7,s,10,s,4,s,8,s,10,s,5,s,9,s,3","4,s,5,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,3","4,s,5,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,6","4,s,5,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,9","4,s,8,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,3","4,s,8,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,6","4,s,8,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,9","4,s,8,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,3","4,s,8,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,6","4,s,11,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,3","4,s,11,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,9","6,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,7,s,2","6,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,7,s,5","6,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,7,s,8","6,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,7,s,11","6,s,3,s,1,s,8,s,8,s,4,s,2,s,9,s,8,s,3,s,3","6,s,3,s,1,s,8,s,8,s,4,s,2,s,9,s,8,s,3,s,6","6,s,3,s,1,s,8,s,8,s,4,s,2,s,9,s,8,s,3,s,9","6,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,4,s,2","6,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,4,s,5","6,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,4,s,8","6,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,4,s,11","6,s,9,s,4,s,3,s,10,s,8,s,4,s,4,s,11,s,9,s,3","6,s,9,s,4,s,3,s,10,s,8,s,4,s,4,s,11,s,9,s,6","6,s,9,s,4,s,3,s,10,s,8,s,4,s,4,s,11,s,9,s,9","6,s,9,s,9,s,1,s,4,s,8,s,4,s,7,s,8,s,3,s,3","6,s,9,s,9,s,7,s,4,s,8,s,4,s,4,s,5,s,9,s,3","7,s,5,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,3","7,s,5,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,6","7,s,5,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,9","7,s,8,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,3","7,s,8,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,6","7,s,8,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,9","9,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,7,s,2","9,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,7,s,5","9,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,7,s,8","9,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,7,s,11","9,s,3,s,1,s,8,s,8,s,4,s,2,s,9,s,8,s,3,s,3","9,s,3,s,1,s,8,s,8,s,4,s,2,s,9,s,8,s,3,s,6","9,s,3,s,1,s,8,s,8,s,4,s,2,s,9,s,8,s,3,s,9","9,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,4,s,2","9,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,4,s,5","9,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,4,s,8","9,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,4,s,11","9,s,9,s,4,s,3,s,10,s,8,s,4,s,4,s,11,s,9,s,3","9,s,9,s,4,s,3,s,10,s,8,s,4,s,4,s,11,s,9,s,6","9,s,9,s,4,s,3,s,10,s,8,s,4,s,4,s,11,s,9,s,9","9,s,9,s,4,s,5,s,8,s,4,s,8,s,8,s,9,s,9,s,3","10,s,5,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,3","10,s,5,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,6","10,s,5,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,9","10,s,8,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,3","10,s,8,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,6","10,s,8,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,9"];
const EDGE_GENS: readonly string[] = ["1,s,3,s,9,s,3,s,9,s,5,s,9,s,3,s,9,s,3,s","6,s,9,s,9,s,11,s,1,s,1,s,2,s,3,s,6","s,3,s,3,s,2,s,1,s,1,s,2,s,3,s,3","s,9,s,9,s,11,s,1,s,1,s,2,s,3,s","3,s,9,s,9,s,11,s,1,s,1,s,2,s,3,s,9","s,3,s,7,s,3,s,11,s,9,s,3,s,1,s,3,s,9,s,11","s,9,s,4,s,9,s,2,s,3,s,9,s,4,s,9,s,3,s,2","1,s,3,s,2,s,3,s,9,s,3,s,9,s,10,s,9,s,3,s,8","1,s,9,s,2,s,3,s,9,s,3,s,9,s,4,s,3,s,9,s,2","3,s,3,s,7,s,3,s,11,s,9,s,3,s,1,s,3,s,9,s,8","3,s,9,s,4,s,9,s,2,s,3,s,9,s,4,s,9,s,3,s,11","4,s,3,s,2,s,3,s,9,s,3,s,9,s,10,s,9,s,3,s,5","6,s,3,s,7,s,3,s,11,s,9,s,3,s,1,s,3,s,9,s,5","6,s,9,s,3,s,7,s,11,s,9,s,10,s,8,s,3,s,9,s,7,s,8","3,s,9,s,3,s,7,s,11,s,9,s,10,s,8,s,3,s,9,s,7,s,11","s,3,s,9,s,10,s,3,s,11,s,9,s,3,s,4,s,9,s,11","s,9,s,3,s,1,s,9,s,2,s,3,s,9,s,1,s,3,s,8","s,3,s,9,s,4,s,2,s,3,s,1,s,5,s,9,s,3,s,10,s,5","s,9,s,3,s,7,s,11,s,9,s,10,s,8,s,3,s,9,s,7,s,2","1,s,3,s,3,s,2,s,3,s,9,s,3,s,9,s,1,s,3,s,3,s,8","1,s,5,s,3,s,7,s,3,s,11,s,9,s,3,s,1,s,3,s,3,s,5","3,s,3,s,9,s,10,s,3,s,11,s,9,s,3,s,4,s,9,s,8","3,s,9,s,3,s,1,s,9,s,2,s,3,s,9,s,1,s,3,s,5","1,s,3,s,8,s,9,s,3,s,1,s,9,s,2,s,3,s,9,s","4,s,9,s,11,s,3,s,9,s,10,s,3,s,11,s,9,s,3,s","9,s,3,s,9,s,10,s,3,s,11,s,9,s,3,s,4,s,9,s,2","9,s,9,s,3,s,1,s,9,s,2,s,3,s,9,s,1,s,3,s,11","s,3,s,1,s,2,s,8,s,4,s,10,s,11,s,9,s,7,s,3,s,9,s,5","s,3,s,7,s,9,s,5,s,11,s,4,s,9,s,9,s,10,s,3,s,9,s,11","s,9,s,4,s,3,s,8,s,2,s,4,s,9,s,9,s,10,s,3,s,9,s,8","s,9,s,10,s,11,s,5,s,7,s,1,s,5,s,9,s,3,s","s,9,s,9,s,5,s,1,s,7,s,3,s,2,s,3,s,9,s,1,s,3,s,8","1,s,2,s,3,s,9,s,10,s,3,s,11,s,9,s,3,s,4,s,9,s,9,s,11","10,s,11,s,3,s,9,s,10,s,3,s,11,s,9,s,3,s,4,s,11","s,9,s,4,s,3,s,8,s,8,s,4,s,10,s,11,s,9,s,1,s,9,s,8","4,s,8,s,9,s,3,s,1,s,9,s,2,s,3,s,9,s,1,s,11","1,s,5,s,9,s,3,s,1,s,9,s,2,s,3,s,9,s,1,s,3,s,3,s,11","1,s,8,s,3,s,9,s,10,s,3,s,11,s,9,s,3,s,4,s,9,s,3,s,11","1,s,8,s,9,s,3,s,1,s,9,s,2,s,3,s,9,s,1,s,2","1,s,11,s,3,s,9,s,10,s,3,s,11,s,9,s,3,s,4,s,8","s,3,s,7,s,3,s,11,s,1,s,9,s,2,s,3,s,9,s,10,s,9,s,5","3,s,3,s,1,s,2,s,8,s,4,s,10,s,11,s,9,s,7,s,3,s,9,s,2","s,3,s,7,s,9,s,5,s,5,s,4,s,10,s,11,s,9,s,1,s,9,s,11","4,s,2,s,3,s,3,s,8,s,10,s,10,s,11,s,9,s,7,s,3,s,9,s,11","4,s,2,s,3,s,9,s,10,s,3,s,11,s,9,s,3,s,7,s,3,s,3,s,11","7,s,8,s,9,s,3,s,1,s,9,s,2,s,3,s,9,s,1,s,8","4,s,8,s,3,s,9,s,10,s,3,s,11,s,9,s,3,s,4,s,9,s,3,s,8","4,s,11,s,3,s,9,s,10,s,3,s,11,s,9,s,3,s,4,s,5","6,s,3,s,1,s,2,s,8,s,4,s,10,s,11,s,9,s,7,s,3,s,9,s,11","7,s,2,s,3,s,3,s,8,s,10,s,10,s,11,s,9,s,7,s,3,s,9,s,8","s,9,s,3,s,1,s,9,s,2,s,10,s,3,s,11,s,9,s,3,s,1,s,11","s,9,s,3,s,7,s,11,s,5,s,7,s,1,s,2,s,3,s","7,s,8,s,3,s,9,s,10,s,3,s,11,s,9,s,3,s,4,s,9,s,3,s,5","9,s,3,s,1,s,2,s,8,s,4,s,10,s,11,s,9,s,7,s,3,s,9,s,8","s,3,s,3,s,8,s,1,s,7,s,3,s,2,s,3,s,9,s,1,s,3,s,11","s,3,s,7,s,3,s,5,s,5,s,10,s,10,s,11,s,9,s,1,s,9,s,11","6,s,3,s,7,s,3,s,5,s,5,s,10,s,10,s,11,s,9,s,1,s,9,s,5","s,3,s,1,s,4,s,8,s,4,s,10,s,9,s,8,s,3,s,6,s,3,s,7,s,2,s,4,s,8,s,2,s,11,s,3,s,3,s","s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,10,s,2,s,9,s,4,s,11,s,4,s,8,s,2,s,5,s,3,s,3,s","s,3,s,3,s,10,s,4,s,8,s,4,s,4,s,5,s,9,s,6,s,9,s,9,s,1,s,10,s,4,s,8,s,1,s,8,s,3,s","s,9,s,4,s,11,s,4,s,8,s,2,s,8,s,9,s,9,s,3,s,3,s,7,s,8,s,8,s,4,s,8,s,2,s,9,s,9,s","s,9,s,9,s,1,s,10,s,4,s,8,s,10,s,5,s,9,s,6,s,9,s,4,s,3,s,2,s,8,s,4,s,8,s,11,s,9,s","6,s,9,s,9,s,1,s,10,s,4,s,8,s,1,s,8,s,3,s,s,3,s,3,s,10,s,4,s,8,s,4,s,4,s,5,s,9,s","1,s,9,s,5,s,3,s,1,s,2,s,2,s,4,s,9,s,9,s,10,s,9,s,2","3,s,3,s,7,s,3,s,5,s,5,s,10,s,10,s,11,s,9,s,1,s,9,s,8","3,s,9,s,4,s,11,s,4,s,8,s,2,s,5,s,3,s,3,s,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,10,s,11","3,s,9,s,4,s,11,s,4,s,8,s,2,s,8,s,9,s,9,s,3,s,3,s,7,s,8,s,8,s,4,s,8,s,5,s,3,s,3,s","3,s,9,s,9,s,7,s,4,s,8,s,4,s,7,s,8,s,3,s,9,s,3,s,3,s,10,s,10,s,4,s,8,s,1,s,8,s,3,s","6,s,3,s,7,s,8,s,8,s,4,s,8,s,2,s,9,s,9,s,s,9,s,4,s,11,s,4,s,8,s,2,s,11,s,3,s,3,s","6,s,9,s,4,s,3,s,2,s,8,s,4,s,8,s,11,s,9,s,s,9,s,9,s,1,s,10,s,4,s,8,s,10,s,5,s,9,s","9,s,3,s,1,s,4,s,8,s,4,s,10,s,9,s,8,s,3,s,6,s,3,s,7,s,2,s,4,s,8,s,2,s,8,s,9,s,9,s","9,s,3,s,7,s,2,s,4,s,8,s,2,s,11,s,3,s,3,s,s,3,s,1,s,4,s,8,s,4,s,10,s,9,s,8,s,3,s,9","9,s,3,s,7,s,8,s,8,s,4,s,8,s,2,s,9,s,9,s,s,9,s,4,s,11,s,4,s,8,s,2,s,11,s,3,s,3,s,9","9,s,9,s,4,s,11,s,4,s,8,s,2,s,2,s,9,s,9,s,3,s,9,s,4,s,5,s,8,s,4,s,8,s,5,s,3,s,3,s","10,s,2,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,s,9,s,9,s,7,s,10,s,4,s,8,s,1,s,8,s,3,s","s,3,s,1,s,4,s,5,s,10,s,5,s,2,s,4,s,5,s,9,s,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,4,s,11","s,3,s,1,s,4,s,5,s,10,s,5,s,2,s,7,s,8,s,3,s,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,7,s,2","s,3,s,1,s,4,s,11,s,8,s,4,s,1,s,8,s,11,s,9,s,1,s,3,s,9,s,11","s,3,s,3,s,2,s,10,s,2,s,8,s,4,s,4,s,11,s,9,s,s,9,s,9,s,7,s,10,s,4,s,8,s,1,s,8,s,3,s","s,3,s,7,s,8,s,10,s,7,s,2,s,7,s,8,s,11,s,9,s,1,s,8,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s","s,9,s,3,s,1,s,11,s,4,s,8,s,2,s,2,s,9,s,9,s,3,s,9,s,4,s,5,s,8,s,4,s,8,s,8,s,9,s,9,s","s,9,s,3,s,1,s,11,s,4,s,8,s,2,s,11,s,3,s,3,s,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,1,s,11","s,9,s,9,s,1,s,10,s,4,s,8,s,1,s,11,s,9,s,3,s,1,s,11,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s","s,9,s,9,s,5,s,10,s,2,s,8,s,4,s,4,s,11,s,9,s,s,3,s,1,s,4,s,2,s,10,s,4,s,2,s,1,s,8,s,3,s","1,s,2,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,3,s,3,s,3,s,10,s,10,s,4,s,8,s,1,s,8,s,3,s,9","1,s,5,s,3,s,1,s,8,s,8,s,4,s,8,s,11,s,9,s,9,s,3,s,1,s,4,s,2,s,10,s,4,s,2,s,10,s,5,s,9,s","3,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,7,s,11,s,3,s,7,s,2,s,10,s,8,s,2,s,10,s,8,s,11,s,9,s","3,s,9,s,4,s,3,s,2,s,8,s,4,s,8,s,11,s,9,s,3,s,3,s,7,s,2,s,4,s,8,s,2,s,11,s,3,s,3,s,6","3,s,9,s,4,s,11,s,4,s,8,s,2,s,2,s,9,s,9,s,3,s,9,s,4,s,5,s,8,s,4,s,8,s,5,s,3,s,3,s,6","3,s,9,s,9,s,1,s,10,s,4,s,8,s,1,s,8,s,3,s,9,s,9,s,9,s,7,s,4,s,8,s,4,s,4,s,5,s,9,s,3","3,s,9,s,9,s,7,s,4,s,8,s,4,s,4,s,5,s,9,s,3,s,3,s,1,s,10,s,8,s,4,s,8,s,8,s,10,s,5,s,9,s","6,s,9,s,9,s,1,s,10,s,4,s,8,s,10,s,5,s,9,s,6,s,9,s,4,s,3,s,2,s,8,s,4,s,8,s,11,s,9,s,6","9,s,3,s,1,s,4,s,8,s,4,s,4,s,11,s,9,s,1,s,11,s,9,s,3,s,1,s,11,s,4,s,8,s,2,s,8,s,9,s,9,s"];

// ── precomputed reduction tables (built once, lazily — module-level singleton) ─────────
interface BsqTables {
  /** scrambled shapeKey → op moving it ONE step toward cube shape, + parent shapeKey. */
  shapeParent: Map<string, { op: Op; pk: string } | null>;
  /** scrambled corner-perm key → {generator index, parent key}; reconstruct via inverse macro. */
  cornerParent: Map<string, { gi: number; pk: string } | null>;
  /** scrambled edge-perm key → {generator index, parent key} (corner-fixing macros). */
  edgeParent: Map<string, { gi: number; pk: string } | null>;
  cornerGens: Op[][];
  edgeGens: Op[][];
}
let TABLES: BsqTables | null = null;

function buildTables(): BsqTables {
  // -- Phase 1: shape BFS from cube shape (399 shapes). Store the INVERSE op (steps toward cube). --
  const shapeParent = new Map<string, { op: Op; pk: string } | null>([[SHAPE_CUBE, null]]);
  {
    let frontier: U8[] = [SOLVED];
    while (frontier.length) {
      const next: U8[] = [];
      for (const st of frontier) {
        const cur = shapeKey(st);
        const moves: [Op, U8][] = [[{ s: true }, slicePieces(st)]];
        for (let x = 1; x < 12; x++) if (!lockedTop(st, x)) moves.push([{ t: x }, rotTop(st, x)]);
        for (const [op, q] of moves) {
          const k = shapeKey(q); if (shapeParent.has(k)) continue;
          const inv: Op = 's' in op ? { s: true } : { t: (12 - op.t) % 12 };
          shapeParent.set(k, { op: inv, pk: cur }); next.push(q);
        }
      }
      frontier = next;
    }
  }

  // -- Phase 2: corner-perm BFS (720 states) over the embedded corner macros. --
  const cornerGens = CORNER_GENS.map(decodeWord);
  const cornerParent = new Map<string, { gi: number; pk: string } | null>([[SOLVED_CORNER_KEY, null]]);
  {
    let frontier: U8[] = [SOLVED];
    while (frontier.length) {
      const next: U8[] = [];
      for (const st of frontier) {
        const cur = cornerKey(st);
        for (let gi = 0; gi < cornerGens.length; gi++) {
          const q = applyOps(st, cornerGens[gi]); const k = cornerKey(q);
          if (cornerParent.has(k)) continue; cornerParent.set(k, { gi, pk: cur }); next.push(q);
        }
      }
      frontier = next;
    }
  }

  // -- Phase 3: edge-perm BFS (720 states) over the embedded CORNER-FIXING edge macros. --
  const edgeGens = EDGE_GENS.map(decodeWord);
  const edgeParent = new Map<string, { gi: number; pk: string } | null>([[SOLVED_EDGE_KEY, null]]);
  {
    let frontier: U8[] = [SOLVED];
    while (frontier.length) {
      const next: U8[] = [];
      for (const st of frontier) {
        const cur = edgeKey(st);
        for (let gi = 0; gi < edgeGens.length; gi++) {
          const q = applyOps(st, edgeGens[gi]); const k = edgeKey(q);
          if (edgeParent.has(k)) continue; edgeParent.set(k, { gi, pk: cur }); next.push(q);
        }
      }
      frontier = next;
    }
  }

  return { shapeParent, cornerParent, edgeParent, cornerGens, edgeGens };
}
function tables(): BsqTables { if (!TABLES) TABLES = buildTables(); return TABLES; }

// ── scramble parsing / state apply ────────────────────────────────────────────────────
// bsq tokens: `(x,0)` top-turns (only the top component matters) and `/` slices. Junk + `//` ignored.
const BSQ_TOKEN_RE = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)|\//g;

export interface BsqToken { kind: 'turn'; top: number; }
export type BsqMove = { kind: 'turn'; top: number } | { kind: 'slice' };

/** Parse a bsq scramble (`(x,0)/ …`) into a move list. A non-zero top-turn + slices; bottom ignored
 *  (always 0 on the bandaged puzzle). `//` line comments and junk between tokens are skipped. */
export function parseBsqScramble(scramble: string): BsqMove[] {
  const out: BsqMove[] = [];
  if (!scramble) return out;
  const cleaned = scramble.replace(/\/\/[^\n]*/g, ' ');
  const re = new RegExp(BSQ_TOKEN_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    if (m[0] === '/') out.push({ kind: 'slice' });
    else { const top = parseInt(m[1], 10); out.push({ kind: 'turn', top }); }
  }
  return out;
}

/** Apply a scramble to the solved puzzle, returning the 24-slot piece-id array (solved is self-proving). */
export function bsqApply(scramble: string): Uint8Array<ArrayBuffer> {
  let st = copy(SOLVED);
  for (const mv of parseBsqScramble(scramble)) {
    if (mv.kind === 'slice') st = slicePieces(st);
    else if (mv.top) st = rotTop(st, mv.top);
  }
  return st;
}

// ── solve = three-stage shape + corner-perm + edge-perm reduction ──────────────────────
function isSolved(a: U8): boolean { for (let i = 0; i < 24; i++) if (a[i] !== SOLVED[i]) return false; return true; }

/** Collapse an op-word into cstimer `(x,0) / …` fragments + count slice-delimited fragments (the metric). */
function formatOps(ops: readonly Op[]): { solution: string; length: number } {
  const frags: string[] = [];
  let top = 0;
  const norm = (x: number): number => { let v = ((x % 12) + 12) % 12; if (v > 6) v -= 12; return v; };
  for (const op of ops) {
    if ('s' in op) { frags.push(top === 0 ? '/' : `(${norm(top)},0) /`); top = 0; }
    else top += op.t;
  }
  if (top !== 0) frags.push(`(${norm(top)},0)`);
  return { solution: frags.join(' '), length: frags.length };
}

/** Cancel adjacent redundancy: merge same-layer (top) turns mod 12 (drop 0) and annihilate double slices.
 *  Keeps the net permutation identical; shrinks the fragment count. */
function simplify(ops: readonly Op[]): Op[] {
  const stack: Op[] = [];
  for (const op of ops) {
    const top = stack[stack.length - 1];
    if ('s' in op) { if (top && 's' in top) stack.pop(); else stack.push({ s: true }); continue; }
    if (top && !('s' in top)) { const m = (top.t + op.t) % 12; stack.pop(); if (m !== 0) stack.push({ t: m }); continue; }
    stack.push(op);
  }
  return stack;
}

export interface BsqSolution {
  /** Pretty `(x,0) / …` solution string (UI joins fragments with spaces). */
  solution: string;
  /** Slice-delimited fragment count (cstimer-style scramble-length unit). */
  length: number;
  /** Whether the solution is provably optimal (always false for this constructive reduction). */
  optimal: boolean;
}

/**
 * Honest upper bound on the solver's solution length, in cstimer `(x,0)/` fragments. The three-stage
 * reduction is VALID + BOUNDED, NOT optimal: shape ≤ 16 ops, corner perm a few short macros, edge perm a
 * deeper set of corner-fixing macros. Over a 3000-scramble random sample the measured mean ≈ 16 and max
 * ≈ 63; this bound (90) carries comfortable margin and is asserted in tests/bsq_solver.test.ts.
 */
export const BSQ_MAX_LENGTH = 90;

/** The bsq closure is a large subgroup of the single Square-1 group (> 2^53, so a string per §0.0 #4):
 *  a bounded BFS hit a 12,000,004-state guard at depth 24 still growing ~3×/layer. The cube-shape coset
 *  it reduces through is exactly 518,400 = 720² (corner-perm 720 × edge-perm 720, a direct product). */
export const BSQ_STATE_COUNT_STR = 'huge (large subgroup of the Square-1 group; cube-shape coset = 518,400 = 720²)';

/**
 * Solve a Bandaged Square-1 scramble by a constructive THREE-STAGE reduction of the ACTUAL state: reduce
 * SHAPE to cube shape (399-shape BFS), then CORNER permutation (720-state BFS), then EDGE permutation with
 * corner-fixing macros (720-state BFS). Emits ONLY legal `</,(1,0)>` moves — every fragment is `(x,0)` or
 * `/`. The result is VALID + BOUNDED (`optimal` always false); its length varies with the scramble.
 * Throws only on internal invariant failure.
 */
export function solveBsq(scramble: string): BsqSolution {
  if (parseBsqScramble(scramble).length === 0) return { solution: '', length: 0, optimal: true };
  const start = bsqApply(scramble);
  if (isSolved(start)) return { solution: '', length: 0, optimal: true };

  const T = tables();
  const out: Op[] = [];
  let cur = copy(start);

  // stage 1: shape → cube shape
  { let k = shapeKey(cur); let g = 0;
    while (k !== SHAPE_CUBE) {
      const e = T.shapeParent.get(k); if (!e) throw new Error('bsq: shape unreachable ' + k);
      out.push(e.op); cur = applyOp(cur, e.op); k = e.pk;
      if (++g > 200) throw new Error('bsq: shape walk');
    } }
  if (shapeKey(cur) !== SHAPE_CUBE) throw new Error('bsq: not cube shape after shape stage');

  // stage 2: corner permutation
  { let ck = cornerKey(cur); let g = 0;
    while (ck !== SOLVED_CORNER_KEY) {
      const e = T.cornerParent.get(ck); if (!e) throw new Error('bsq: corner perm unreachable ' + ck);
      const w = invOps(T.cornerGens[e.gi]); for (const op of w) { out.push(op); cur = applyOp(cur, op); }
      ck = e.pk; if (++g > 2000) throw new Error('bsq: corner walk');
    } }

  // stage 3: edge permutation (corner-fixing macros keep corners solved)
  { let ek = edgeKey(cur); let g = 0;
    while (ek !== SOLVED_EDGE_KEY) {
      const e = T.edgeParent.get(ek); if (!e) throw new Error('bsq: edge perm unreachable ' + ek);
      const w = invOps(T.edgeGens[e.gi]); for (const op of w) { out.push(op); cur = applyOp(cur, op); }
      ek = e.pk; if (++g > 2000) throw new Error('bsq: edge walk');
    } }

  if (!isSolved(cur)) throw new Error('bsq: reduction did not reach solved');

  const { solution, length } = formatOps(simplify(out));
  return { solution, length, optimal: false };
}

// ── faithful random scramble generator (ports cstimer sq1_scramble(2,len) / sq1_getseq(1,2,len)) ──
const SOLVED_SHAPE_MARKERS: readonly number[] = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];

/**
 * Generate a random Bandaged Square-1 scramble of `len` slices, faithfully mirroring cstimer's
 * `sq1_scramble(2, len)` → `sq1_getseq(1, 2, len)`: `y` is ALWAYS 0 (top-only), `x∈[-5,6]`, the lock check
 * is honored, and the loop emits exactly `len` slices, output `(x,0) / …`. `rnd` defaults to Math.random
 * (pass a seeded PRNG for reproducibility).
 */
export function randomBsqScramble(len: number, rnd: () => number = Math.random): string {
  const rn = (n: number) => Math.floor(rnd() * n);
  const p = [...SOLVED_SHAPE_MARKERS];
  const domove = (x: number, y: number): boolean => {
    if (x === 7) { for (let i = 0; i < 6; i++) { const t = p[i + 6]; p[i + 6] = p[i + 12]; p[i + 12] = t; } return true; }
    if (p[(((17 - x) % 12) + 12) % 12] || p[(((11 - x) % 12) + 12) % 12]
      || p[12 + ((((17 - y) % 12) + 12) % 12)] || p[12 + ((((11 - y) % 12) + 12) % 12)]) return false;
    const px = p.slice(0, 12), py = p.slice(12, 24);
    for (let i = 0; i < 12; i++) { p[i] = px[(12 + i - x) % 12]; p[i + 12] = py[(12 + i - y) % 12]; }
    return true;
  };
  const seq: number[][] = [];
  let cnt = 0, safety = 0;
  while (cnt < len) {
    if (++safety > 100000) break;
    const x = rn(12) - 5;
    const y = 0; // type=2 ⇒ bottom never turned
    const size = x === 0 ? 0 : 1;
    if (size > 0 || cnt === 0) {
      if (domove(x, y)) {
        if (size > 0) seq.push([x, y]);
        cnt++;
        seq.push([7, 0]);
        domove(7, 0);
      }
    }
  }
  // emit cstimer-style: [7,0] → "/", else " (x,y)" (then trimmed)
  let s = '';
  for (const k of seq) { if (k[0] === 7) s += ' /'; else s += ` (${k[0]},${k[1]})`; }
  return s.trim();
}
