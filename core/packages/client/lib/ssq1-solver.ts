/*
 * Super Square-1 (ssq1, cstimer key `ssq1t`) solver — pure TS, no worker, no tables to download.
 * TIER D (valid + bounded, NOT near-optimal): a constructive INVERSE reduction. Honest quality bucket
 * = "sampled-bounded" (mirrors sq2's honesty: the returned solution is guaranteed valid and bounded,
 * but is the inverse of the scramble, not a near-optimal short solution).
 *
 * WHY a reduction and not a search (measured, not assumed): the Super Square-1 is genuinely TWO
 * coupled Square-1 mechanisms. Bounded BFS over even ONE combined side explodes (per-depth fan-out ≈
 * ×6, see the test). A single-phase IDA* over the full 24-slot permutation of ONE Square-1 (~3.39×10¹²
 * states) is fast on shallow states but blows up on the deeper states real scrambles reach (the
 * pruning table covers only ~half the diameter). And the elegant sq2-style "short 3-cycle conjugator
 * table" does NOT port: a real Square-1 has 60° corners + 30° edges, so the shape-solved subgroup
 * admits NO short pure 3-cycles (verified: zero corner- or edge-only 3-cycles within depth 9, and the
 * corner-fixed edge subgroup grows to only ~100 elements by depth 11). The clean corner-permutation
 * coordinate IS tractable (closes at 8! with diameter 7), but the matching edge phase needs algorithms
 * far too long to mine in-browser. So we use the one construction that is BOTH unconditionally correct
 * AND O(n) fast: invert the scramble.
 *
 * MECHANISM (verified against cstimer's generator). cstimer's `ssq1t` generator
 * (tools/cstimer-scramble/scramble/utilscramble.js: ssq1t_scramble → sq1_getseq → sq1_domove) builds
 * two independent Square-1 move sequences s and t, then emits `len` 4-tuples
 *   "(" + s[2i][0] + "," + t[2i][0] + "," + t[2i][1] + "," + s[2i][1] + ")/ "
 * i.e. a tuple (a,b,c,d)/ drives: P0 top-turn a + P0 bottom-turn d; P1 top-turn b + P1 bottom-turn c;
 * then the slice "/" slices BOTH P0 and P1. This solver mirrors that move model EXACTLY (faithful by
 * construction: the generator runs cstimer's `sq1_domove` index math on two `p` arrays).
 *
 * STATE MODEL (single source of truth):
 *   Each side is a Square-1 with 24 thirty-degree SLOTS (top 0..11 CW, bottom 12..23 CW). 8 corners
 *   (60°, span 2 consecutive slots) + 8 edges (30°, 1 slot). Per side we store a 24-entry piece-id
 *   array `p` (PERMUTATION): a corner home-id occupies its TWO slots with the SAME id; an edge occupies
 *   one slot with a singleton id. SOLVED layout (per side, slot→id):
 *     corner slots (0,1)(3,4)(6,7)(9,10) top, (13,14)(16,17)(19,20)(22,23) bottom → corner ids 0..7;
 *     edge slots 2,5,8,11 top, 12,15,18,21 bottom → edge ids 100..107.
 *   Side 0 uses these ids; side 1 offsets by +SIDE1_OFFSET so the combined solved state is unambiguous
 *   (flat 48-slot array in `ssq1Apply`). The SHAPE (which slots hold a corner-start) is DERIVED from
 *   `p` (two equal adjacent ids = a corner) and read only for the lock check — no separate shape array.
 *
 *   Moves (cstimer convention, both layers of a side):
 *     • top-turn by k:  p[i]=old[(12+i-k)%12]   for i in 0..11
 *     • bottom-turn by k: p[12+i]=old[12+((12+i-k)%12)]
 *     • slice (a side): for i in 0..5 swap slots i+6 ↔ i+12.
 *     • LOCK CHECK before a (ktop,kbot) turn: ILLEGAL iff a corner straddles either cut, i.e.
 *       shape[(17-ktop)%12]||shape[(11-ktop)%12]||shape[12+(17-kbot)%12]||shape[12+(11-kbot)%12]
 *       (verbatim cstimer sq1_domove). The slice is always legal.
 *   A scramble tuple (a,b,c,d)/ → turn P0 by (a,d) + turn P1 by (b,c), then slice BOTH.
 *
 * STATE SPACE: one Square-1 has 3,393,693,768,000 states (Jaap's standard count). Two coupled ones ⇒
 *   ≈ the product, ≈1.15×10²⁵ — far beyond any full-BFS / packed-table tier. > 2^53 so the constant is
 *   a string (§0.0 #4).
 *
 * ALGORITHM (always terminates, bounded length, 100% solve-rate): solution = scramble⁻¹. The scramble
 * is T1 T2 … Tn where Ti = (turns aᵢ,bᵢ,cᵢ,dᵢ) then a slice. Its inverse is inv(Tn) … inv(T1) where
 * inv(Ti) = slice (involution) then (−aᵢ,−bᵢ,−cᵢ,−dᵢ). We emit that flat op stream and re-pack it into
 * (a,b,c,d)/ tuples (turns accumulate until each slice). Each inverse move is ALWAYS legal because it
 * undoes a move that was legal in the scramble (the puzzle is exactly retracing its path). The merged
 * tuple count is n+1 (one leading slice tuple), so SSQ1_MAX_LENGTH = 2·scrambleLen + a margin is a
 * STRUCTURAL bound the solver can never violate (no fallback rung to break it — the 336 lesson).
 *
 * tests/ssq1_solver.test.ts re-derives the move permutations INDEPENDENTLY (two-array model) and
 * round-trips real cstimer scrambles (scramble ∘ solution = solved) — that is the validity oracle.
 *
 * METRIC: solution length is counted in cstimer-style (a,b,c,d)/ TUPLES (one segment of layer-turns
 * then a slice = one tuple; a trailing partial tuple counts 1) — the same unit cstimer uses for
 * scramble length. The pretty solution string is in (a,b,c,d)/ form.
 */

type U8 = Uint8Array<ArrayBuffer>;

// ── per-side solved layout (slot → piece id) ─────────────────────────────────────────
const CORNER_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [3, 4], [6, 7], [9, 10], [13, 14], [16, 17], [19, 20], [22, 23],
];
const EDGE_SLOTS: readonly number[] = [2, 5, 8, 11, 12, 15, 18, 21];
const CORNER_EDGE_GAP = 100; // edge ids = CORNER_EDGE_GAP + e so corners (0..7) and edges never collide
const SIDE1_OFFSET = 50;     // side 1 piece ids shifted so the combined flat 48-array is unambiguous

function solvedSidePieces(sideOffset: number): U8 {
  const p = new Uint8Array(24) as U8;
  CORNER_SLOTS.forEach((pair, ci) => { p[pair[0]] = sideOffset + ci; p[pair[1]] = sideOffset + ci; });
  EDGE_SLOTS.forEach((slot, ei) => { p[slot] = sideOffset + CORNER_EDGE_GAP + ei; });
  return p;
}
const SOLVED_P0 = solvedSidePieces(0);
const SOLVED_P1 = solvedSidePieces(SIDE1_OFFSET);

// ── primitive moves on one 24-id side array (cstimer convention) ──────────────────────
function rotTop(arr: U8, k: number): U8 {
  k = ((k % 12) + 12) % 12;
  if (k === 0) return new Uint8Array(arr) as U8;
  const n = new Uint8Array(arr) as U8;
  for (let i = 0; i < 12; i++) n[i] = arr[(12 + i - k) % 12];
  return n;
}
function rotBot(arr: U8, k: number): U8 {
  k = ((k % 12) + 12) % 12;
  if (k === 0) return new Uint8Array(arr) as U8;
  const n = new Uint8Array(arr) as U8;
  for (let i = 0; i < 12; i++) n[12 + i] = arr[12 + ((12 + i - k) % 12)];
  return n;
}
function sliceSide(arr: U8): U8 {
  const n = new Uint8Array(arr) as U8;
  for (let i = 0; i < 6; i++) { const c = n[i + 6]; n[i + 6] = n[i + 12]; n[i + 12] = c; }
  return n;
}
/** Is slot i a corner-start (slot i and i+1 in the same ring hold the same id)? Derives SHAPE. */
function isCornerStart(arr: ArrayLike<number>, i: number): boolean {
  if (i < 11) return arr[i] === arr[i + 1];      // top ring 0..11
  if (i === 11) return false;
  if (i < 23) return arr[i] === arr[i + 1];      // bottom ring 12..23
  return false;
}
/** cstimer lock check for a (ktop,kbot) turn given the side array (true = ILLEGAL). */
function lockedSide(arr: U8, ktop: number, kbot: number): boolean {
  const a = ((ktop % 12) + 12) % 12;
  const b = ((kbot % 12) + 12) % 12;
  return isCornerStart(arr, (17 - a) % 12) || isCornerStart(arr, (11 - a) % 12)
    || isCornerStart(arr, 12 + ((17 - b) % 12)) || isCornerStart(arr, 12 + ((11 - b) % 12));
}

// ── a Tuple = one (a,b,c,d) layer-turn pack; the slice is applied separately ──────────
//   a = P0 top, d = P0 bottom, b = P1 top, c = P1 bottom.
export interface SsqTuple { a: number; b: number; c: number; d: number; }
export interface SsqState { p0: U8; p1: U8; }

function solvedState(): SsqState { return { p0: new Uint8Array(SOLVED_P0) as U8, p1: new Uint8Array(SOLVED_P1) as U8 }; }

/** Is the (ktop,kbot) layer turn of `side` legal at this state? (slice is always legal) */
export function ssq1TupleLegal(st: SsqState, t: SsqTuple): boolean {
  if ((t.a !== 0 || t.d !== 0) && lockedSide(st.p0, t.a, t.d)) return false;
  if ((t.b !== 0 || t.c !== 0) && lockedSide(st.p1, t.b, t.c)) return false;
  return true;
}

/** Apply only the layer turns of a tuple (no slice). */
function applyTurns(st: SsqState, t: SsqTuple): SsqState {
  let p0 = st.p0, p1 = st.p1;
  if (t.a) p0 = rotTop(p0, t.a);
  if (t.d) p0 = rotBot(p0, t.d);
  if (t.b) p1 = rotTop(p1, t.b);
  if (t.c) p1 = rotBot(p1, t.c);
  return { p0, p1 };
}
function applySliceBoth(st: SsqState): SsqState { return { p0: sliceSide(st.p0), p1: sliceSide(st.p1) }; }
/** Apply one full scramble tuple (a,b,c,d)/ = layer turns then slice BOTH sides. */
function applyTuple(st: SsqState, t: SsqTuple): SsqState { return applySliceBoth(applyTurns(st, t)); }

// ── scramble parsing / state apply ────────────────────────────────────────────────────
const TUPLE_RE = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)\s*\//g;

/** Parse a "(a,b,c,d)/ …" scramble into tuple structs (each followed by a slice). Junk ignored. */
export function parseSsq1Scramble(scramble: string): SsqTuple[] {
  const out: SsqTuple[] = [];
  if (!scramble) return out;
  const cleaned = scramble.replace(/\/\/[^\n]*/g, ' ');
  const re = new RegExp(TUPLE_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    out.push({ a: parseInt(m[1], 10), b: parseInt(m[2], 10), c: parseInt(m[3], 10), d: parseInt(m[4], 10) });
  }
  return out;
}

/** Apply a scramble to the solved puzzle, returning full per-side state. */
export function ssq1ApplyState(scramble: string): SsqState {
  let st = solvedState();
  for (const t of parseSsq1Scramble(scramble)) st = applyTuple(st, t);
  return st;
}

/** Apply a scramble → flat 48-slot piece array (P0 slots 0..23, P1 slots 24..47) for the SVG. */
export function ssq1Apply(scramble: string): Uint8Array<ArrayBuffer> {
  const st = ssq1ApplyState(scramble);
  const out = new Uint8Array(48) as U8;
  out.set(st.p0, 0);
  out.set(st.p1, 24);
  return out;
}

// ── solve = inverse reduction ─────────────────────────────────────────────────────────
function normTurn(x: number): number { let v = ((x % 12) + 12) % 12; if (v > 6) v -= 12; return v; }

// A primitive op of the solution stream: a slice, or a layer-turn pack.
type Prim = { slice: true } | { turn: SsqTuple };

/** Collapse adjacent redundancy in a primitive op stream WITHOUT changing the net permutation:
 *  merge consecutive turn-packs (mod 12, drop all-zero), annihilate double slices (slice∘slice = id).
 *  This shortens the inverse where the scramble had cancellations (e.g. the generator's leading
 *  no-op slice pad), giving genuine length variation while staying exactly correct. */
function simplifyPrims(prims: readonly Prim[]): Prim[] {
  const stack: Prim[] = [];
  for (const p of prims) {
    const top = stack[stack.length - 1];
    if ('slice' in p) {
      if (top && 'slice' in top) stack.pop(); else stack.push(p);
      continue;
    }
    if (top && 'turn' in top) {
      const merged: SsqTuple = {
        a: normTurn(top.turn.a + p.turn.a), b: normTurn(top.turn.b + p.turn.b),
        c: normTurn(top.turn.c + p.turn.c), d: normTurn(top.turn.d + p.turn.d),
      };
      stack.pop();
      if (merged.a || merged.b || merged.c || merged.d) stack.push({ turn: merged });
      continue;
    }
    if (p.turn.a || p.turn.b || p.turn.c || p.turn.d) stack.push(p);
  }
  return stack;
}

/** Re-pack a primitive op stream into (a,b,c,d)/ tuples: layer turns accumulate until each slice
 *  (which closes a tuple); a trailing nonzero turn-pack closes a final no-slice tuple. */
function packTuples(prims: readonly Prim[]): { tuples: SsqTuple[]; trailingSlice: boolean[] } {
  const tuples: SsqTuple[] = [];
  const trailingSlice: boolean[] = [];
  let a = 0, b = 0, c = 0, d = 0, pending = false;
  for (const p of prims) {
    if ('slice' in p) { tuples.push({ a, b, c, d }); trailingSlice.push(true); a = b = c = d = 0; pending = false; }
    else { a += p.turn.a; b += p.turn.b; c += p.turn.c; d += p.turn.d; pending = true; }
  }
  if (pending && (normTurn(a) || normTurn(b) || normTurn(c) || normTurn(d))) {
    tuples.push({ a, b, c, d }); trailingSlice.push(false);
  }
  return { tuples, trailingSlice };
}

/** Pretty "(a,b,c,d)/" string + tuple count from packed tuples. */
function formatTuples(tuples: readonly SsqTuple[], trailingSlice: readonly boolean[]): { pretty: string; length: number } {
  const frags: string[] = [];
  for (let i = 0; i < tuples.length; i++) {
    const t = tuples[i];
    const a = normTurn(t.a), b = normTurn(t.b), c = normTurn(t.c), d = normTurn(t.d);
    frags.push(trailingSlice[i] ? `(${a},${b},${c},${d})/` : `(${a},${b},${c},${d})`);
  }
  return { pretty: frags.join(' '), length: frags.length };
}

export interface Ssq1Solution { solution: string; length: number; optimal: boolean; }

/**
 * STRUCTURAL upper bound on the solution length, in (a,b,c,d)/ tuples. The inverse of an n-tuple
 * scramble is n+1 tuples (one leading slice tuple). cstimer's `ssq1t` length is 10, so a solution is
 * ≤ 11 tuples; SSQ1_MAX_LENGTH carries comfortable margin and is asserted in the test over a high
 * sample so it can never be silently violated.
 */
export const SSQ1_MAX_LENGTH = 40;

/** Two coupled Square-1 mechanisms ⇒ ≈ product of the per-side reachable-state counts
 *  (3,393,693,768,000² ≈ 1.15×10²⁵). > 2^53 so MUST be a string (§0.0 #4); an estimate. */
export const SSQ1_STATE_COUNT_STR = '≈1.15×10²⁵ (two coupled Square-1 mechanisms)';

function isSolvedState(st: SsqState): boolean {
  for (let i = 0; i < 24; i++) if (st.p0[i] !== SOLVED_P0[i]) return false;
  for (let i = 0; i < 24; i++) if (st.p1[i] !== SOLVED_P1[i]) return false;
  return true;
}

/**
 * Solve a Super Square-1 scramble by inverse reduction. Returns a VALID, BOUNDED "(a,b,c,d)/" solution
 * (`optimal` always false — this is the simplified scramble inverse, not a near-optimal short solution).
 * Throws only on internal invariant failure.
 */
export function solveSsq1(scramble: string): Ssq1Solution {
  const tuplesIn = parseSsq1Scramble(scramble);
  if (tuplesIn.length === 0) return { solution: '', length: 0, optimal: true };
  const start = ssq1ApplyState(scramble);
  if (isSolvedState(start)) return { solution: '', length: 0, optimal: true };

  // inverse of T1..Tn = inv(Tn)..inv(T1); inv(Ti) = slice (involution) then (-a,-b,-c,-d).
  const prims: Prim[] = [];
  for (let i = tuplesIn.length - 1; i >= 0; i--) {
    prims.push({ slice: true });
    const t = tuplesIn[i];
    prims.push({ turn: { a: -t.a, b: -t.b, c: -t.c, d: -t.d } });
  }
  const { tuples, trailingSlice } = packTuples(simplifyPrims(prims));

  // verify: apply the packed tuples to `start` → solved (each tuple applies layer turns then, if the
  // flag says so, a slice; the final no-slice tuple omits the slice).
  let chk = start;
  for (let i = 0; i < tuples.length; i++) { chk = applyTurns(chk, tuples[i]); if (trailingSlice[i]) chk = applySliceBoth(chk); }
  if (!isSolvedState(chk)) throw new Error('ssq1: inverse solution did not reach solved');

  const { pretty, length } = formatTuples(tuples, trailingSlice);
  return { solution: pretty, length, optimal: false };
}

// ── faithful random scramble generator (ports cstimer ssq1t_scramble / sq1_getseq / sq1_domove) ──
const SOLVED_SHAPE: readonly number[] = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];

/** Port of cstimer sq1_getseq for ONE side (type 0 → free x,y ∈ [-5,6]). Mutates a fresh SHAPE `p` and
 *  returns the recorded move list (turn pairs, each followed by a [7,0] slice marker). Honors the lock
 *  check, exactly as cstimer's sq1_domove (so it never emits an illegal scramble). */
function getSeqOne(len: number, rn: (n: number) => number): number[][] {
  const p: number[] = [...SOLVED_SHAPE];
  const seq: number[][] = [];
  const domove = (x: number, y: number): boolean => {
    if (x === 7) {
      for (let i = 0; i < 6; i++) { const tmp = p[i + 6]; p[i + 6] = p[i + 12]; p[i + 12] = tmp; }
      return true;
    }
    if (p[((17 - x) % 12 + 12) % 12] || p[((11 - x) % 12 + 12) % 12]
      || p[12 + (((17 - y) % 12 + 12) % 12)] || p[12 + (((11 - y) % 12 + 12) % 12)]) return false;
    const px = p.slice(0, 12), py = p.slice(12, 24);
    for (let i = 0; i < 12; i++) { p[i] = px[(12 + i - x) % 12]; p[i + 12] = py[(12 + i - y) % 12]; }
    return true;
  };
  let cnt = 0, safety = 0;
  while (cnt < len) {
    if (++safety > 100000) break;
    const x = rn(12) - 5;
    const y = rn(12) - 5;
    const size = (x === 0 ? 0 : 1) + (y === 0 ? 0 : 1);
    if (size > 0 || cnt === 0) {
      if (domove(x, y)) {
        if (size > 0) seq.push([x, y]);
        cnt++;
        seq.push([7, 0]);
        domove(7, 0);
      }
    }
  }
  return seq;
}

/**
 * Generate a random Super Square-1 scramble of `len` tuples, faithfully mirroring cstimer's
 * `ssq1t_scramble` (two independent sq1_getseq(.,0,len) sequences woven into 4-tuples). `rnd` defaults
 * to Math.random; pass a seeded PRNG for reproducibility.
 */
export function randomSsq1Scramble(len: number, rnd: () => number = Math.random): string {
  const rn = (n: number) => Math.floor(rnd() * n);
  let s = getSeqOne(len, rn);
  let t = getSeqOne(len, rn);
  if (s[0] && s[0][0] === 7) s = [[0, 0], ...s];
  if (t[0] && t[0][0] === 7) t = [[0, 0], ...t];
  const parts: string[] = [];
  for (let i = 0; i < len; i++) {
    const si = s[2 * i] ?? [0, 0];
    const ti = t[2 * i] ?? [0, 0];
    // (a,b,c,d) = (s_top, t_top, t_bot, s_bot)
    parts.push(`(${si[0]},${ti[0]},${ti[1]},${si[1]})/`);
  }
  return parts.join(' ');
}
