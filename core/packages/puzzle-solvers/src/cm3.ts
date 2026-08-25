/*
 * Cmetrick (full / cm3) solver — pure TS, no worker, NO tables to download. TIER D (valid + bounded,
 * NOT optimal): a from-scratch SIGN-then-COMMUTATOR reduction. This is the 3×3 scaling of the
 * Cmetrick Mini (cm2): the Mini is 4 balls fully BFS-able (165,888 states); the full Cmetrick is a
 * 3×3 grid of 9 balls whose reachable state space is 165,112,971,264 = 24⁹/24 ≈ 1.65×10¹¹
 * (jaapsch.net/puzzles/cmetrick.htm), FAR beyond any full-BFS or packed-table tier — so the solver
 * core is a constructive reduction, NOT a distance table. The cube-rotation-group machinery
 * (ROT_MATS / MUL / X·Y generators / applyMove) is identical to cm2-solver and reused verbatim here.
 *
 * THE PUZZLE — 9 balls in a 3×3 grid (row-major indices 0..8: row0={0,1,2}, row1={3,4,5},
 * row2={6,7,8}). Each ball is a sphere showing the 6 colors of a cube → its state is an element of
 * the cube rotation group (order 24). Synchronized gears couple a whole ROW or COLUMN:
 *   • a ROW move rolls all 3 balls in that row 90° about the vertical (Y) axis;
 *   • a COLUMN move rolls all 3 balls in that column 90° about the horizontal (X) axis.
 * Solved = all 9 balls in the identity orientation. The ball at (row r, col c) is moved by exactly
 * one row generator (its row's U/E/D about Y) and one column generator (its column's R/M/L about X).
 *
 * MOVE MODEL derived from cstimer `scramble/megascramble.js:28`
 *   "cm3": [[[["U<","U>","U2"],["E<","E>","E2"],["D<","D>","D2"]],
 *            [["R^","Rv","R2"],["M^","Mv","M2"],["L^","Lv","L2"]]]]   driven by mega(value[0],[""],N).
 * → token alphabet is EXACTLY 18 tokens (suffix is ""):
 *   U< U> U2 E< E> E2 D< D> D2 R^ Rv R2 M^ Mv M2 L^ Lv L2.
 *   - axis 0 = ROWS: U = row0 {0,1,2}, E = row1 (middle) {3,4,5}, D = row2 {6,7,8}; `<` = +90° about
 *     Y, `>` = −90° about Y (inverse), `2` = 180° about Y (self-inverse).  [same Y convention as cm2]
 *   - axis 1 = COLUMNS: R = right col {2,5,8}, M = middle col {1,4,7}, L = left col {0,3,6}; `^` =
 *     +90° about X, `v` = −90° about X (inverse), `2` = 180° about X (self-inverse).  [same X as cm2]
 * The 18 move permutations below are re-derived field-for-field from the cube's 3D rotation matrices
 * (closure of {RX,RY,RZ} from I3, exactly as cm2-solver enumerates them), so a cstimer-generated cm3
 * scramble is interpreted as the identical physical state and our solution actually solves it. The
 * test (tests/cm3_solver.test.ts) re-builds the rotation group + the 18 effects from scratch
 * INDEPENDENTLY and round-trips real cstimer cm3 scrambles — that independent geometry is the oracle.
 *
 * PRIOR ART (jaapsch.net/puzzles/cmetrick.htm, canonical): Cmetrick full = 165,112,971,264 = 24⁹/24
 * positions; God's number 15 quarter-turns, mean 12.254 QTM. The classic solving method is a
 * layer-by-layer reduction using the centre ball (#4) as a reference. There is NO cstimer solver and
 * NO published geometry library for cm3, so the reduction here is implemented from scratch (informed
 * by jaapsch's reference). It is NOT near-optimal and NOT provably optimal — it returns a VALID
 * solution within a hard cap.
 *
 * THE REDUCTION (two phases, both verified empirically by 100%-solve round-trip on real cstimer
 * scrambles in the test; no large table is ever built — the whole machine is ~24-element group tables
 * plus nine tiny single-ball gadget maps built by a confined BFS in ~15 ms):
 *
 *   The rotation group G (order 24) has an even subgroup H = A4 (order 12, the rotations reachable by
 *   COMMUTATORS) with G/H ≅ Z2 — i.e. every orientation carries a parity ("sign") bit. Two facts make
 *   the reduction clean and correct:
 *     (1) A 4-move commutator [rowMove, colMove] (e.g. `U< R^ U> Rv`) net-rotates EXACTLY the one ball
 *         at that row∩col intersection, leaving the other 8 untouched — but only by an EVEN (H)
 *         element (commutators live in H). Using just the one row + one column through a target ball
 *         as alphabet, a short confined BFS finds, for that ball, a sequence reaching EVERY non-trivial
 *         H element while fixing all other balls (the "single-ball gadget").
 *     (2) A single quarter row/column turn flips the sign bit of its 3 balls (a half turn flips none).
 *
 *   • PHASE 1 — solve the 9 SIGN BITS. Each of the 6 lines (3 rows + 3 cols) is a parity flip of its 3
 *     balls; pick the smallest subset of line-quarter-turns whose combined flip clears every odd ball
 *     to even (a 6-bit GF(2) search over the 64 subsets). After Phase 1 all 9 balls lie in H.
 *   • PHASE 2 — solve each ball's orientation with its single-ball gadget (which stays in H and fixes
 *     all other balls), so balls are solved one at a time without disturbing solved ones or the sign
 *     bits. When the last ball lands on identity the whole puzzle is solved.
 *   A cheap simplifier then merges consecutive same-line turns and drops net-identity runs.
 *
 * METRIC: a `2` (180°) token counts as ONE move (cstimer face-turn metric, like cm2). Solution length
 * is in that metric. Over both random move-sequences and real cstimer cm3 scrambles the measured max
 * is ~47; CM3_MAX_LENGTH (60) carries margin and is asserted in the test so it can never be silently
 * violated. The offline sampled distribution (stats/scramble/dist_cm3.json) is a smooth unimodal
 * spread (mean ≈ 33, median ≈ 35, max ≈ 41 on real scrambles) — not a degenerate single bar.
 *
 * QUALITY: VALID + BOUNDED (a constructive two-phase reduction), NOT optimal (`optimal` always false).
 */

// ── Cube rotation group (order 24) built from 3×3 rotation matrices (verbatim from cm2-solver) ──
type Vec3 = readonly [number, number, number];
type Mat3 = readonly [Vec3, Vec3, Vec3];
function matMul(a: Mat3, b: Mat3): Mat3 {
  const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i][j] += a[i][k] * b[k][j];
  return r as unknown as Mat3;
}
const I3: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
// 90° right-handed rotations.
const RX: Mat3 = [[1, 0, 0], [0, 0, -1], [0, 1, 0]];
const RY: Mat3 = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];
const RZ: Mat3 = [[0, -1, 0], [1, 0, 0], [0, 0, 1]];

// Enumerate the 24 rotation matrices = closure of {RX,RY,RZ} from I3.
const ROT_MATS: Mat3[] = [];
const MAT_IDX = new Map<string, number>();
{
  const key = (m: Mat3) => JSON.stringify(m);
  MAT_IDX.set(key(I3), 0); ROT_MATS.push(I3);
  let frontier: Mat3[] = [I3];
  while (frontier.length) {
    const next: Mat3[] = [];
    for (const m of frontier) {
      for (const g of [RX, RY, RZ]) {
        const m2 = matMul(g, m);
        const k = key(m2);
        if (!MAT_IDX.has(k)) { MAT_IDX.set(k, ROT_MATS.length); ROT_MATS.push(m2); next.push(m2); }
      }
    }
    frontier = next;
  }
}
const ROT_COUNT = ROT_MATS.length; // 24
const matIdx = (m: Mat3) => MAT_IDX.get(JSON.stringify(m))!;
const IDENT = matIdx(I3);

/** Composition table: MUL[g][o] = index of "apply orientation o, then rotate by g" = idx(G·O). */
const MUL: number[][] = ROT_MATS.map((G) => ROT_MATS.map((O) => matIdx(matMul(G, O))));
/** Inverse of each orientation index. */
const INV: number[] = ROT_MATS.map((_, o) => {
  for (let g = 0; g < ROT_COUNT; g++) if (MUL[g][o] === IDENT) return g;
  return IDENT;
});

// Generators (as rotation-group indices).
const Y1 = matIdx(RY);
const Yinv = matIdx(matMul(RY, matMul(RY, RY)));
const Y2 = matIdx(matMul(RY, RY));
const X1 = matIdx(RX);
const Xinv = matIdx(matMul(RX, matMul(RX, RX)));
const X2 = matIdx(matMul(RX, RX));

// ── orientation parity (sign bit): rotation group ≅ S4 acting on the 4 body diagonals; even = A4 ──
const DIAGS: ReadonlyArray<Vec3> = [[1, 1, 1], [1, 1, -1], [1, -1, 1], [-1, 1, 1]];
function diagPerm(o: number): number[] {
  const M = ROT_MATS[o];
  const out: number[] = [];
  for (const d of DIAGS) {
    const v: Vec3 = [
      M[0][0] * d[0] + M[0][1] * d[1] + M[0][2] * d[2],
      M[1][0] * d[0] + M[1][1] * d[1] + M[1][2] * d[2],
      M[2][0] * d[0] + M[2][1] * d[1] + M[2][2] * d[2],
    ];
    for (let i = 0; i < 4; i++) {
      const e = DIAGS[i];
      if ((v[0] === e[0] && v[1] === e[1] && v[2] === e[2]) || (v[0] === -e[0] && v[1] === -e[1] && v[2] === -e[2])) { out.push(i); break; }
    }
  }
  return out;
}
function permSign(p: number[]): number {
  let s = 1;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) s = -s;
  return s;
}
const SIGN: number[] = ROT_MATS.map((_, o) => permSign(diagPerm(o))); // +1 even (H), −1 odd
const isEven = (o: number) => SIGN[o] === 1;

// ── 3×3 grid geometry ───────────────────────────────────────────────────────────
// row-major indices 0..8. ROW[r] = 3 balls of row r (rolled about Y). COL letters R/M/L = columns.
const ROW: ReadonlyArray<ReadonlyArray<number>> = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];
const COL_R = [2, 5, 8], COL_M = [1, 4, 7], COL_L = [0, 3, 6];

// ── move table (the 18 cstimer tokens, face-turn metric) ───────────────────────────
interface Cm3Move { name: string; balls: ReadonlyArray<number>; g: number; inverse: string; }
const MOVES: ReadonlyArray<Cm3Move> = [
  { name: 'U<', balls: ROW[0], g: Y1, inverse: 'U>' },
  { name: 'U>', balls: ROW[0], g: Yinv, inverse: 'U<' },
  { name: 'U2', balls: ROW[0], g: Y2, inverse: 'U2' },
  { name: 'E<', balls: ROW[1], g: Y1, inverse: 'E>' },
  { name: 'E>', balls: ROW[1], g: Yinv, inverse: 'E<' },
  { name: 'E2', balls: ROW[1], g: Y2, inverse: 'E2' },
  { name: 'D<', balls: ROW[2], g: Y1, inverse: 'D>' },
  { name: 'D>', balls: ROW[2], g: Yinv, inverse: 'D<' },
  { name: 'D2', balls: ROW[2], g: Y2, inverse: 'D2' },
  { name: 'R^', balls: COL_R, g: X1, inverse: 'Rv' },
  { name: 'Rv', balls: COL_R, g: Xinv, inverse: 'R^' },
  { name: 'R2', balls: COL_R, g: X2, inverse: 'R2' },
  { name: 'M^', balls: COL_M, g: X1, inverse: 'Mv' },
  { name: 'Mv', balls: COL_M, g: Xinv, inverse: 'M^' },
  { name: 'M2', balls: COL_M, g: X2, inverse: 'M2' },
  { name: 'L^', balls: COL_L, g: X1, inverse: 'Lv' },
  { name: 'Lv', balls: COL_L, g: Xinv, inverse: 'L^' },
  { name: 'L2', balls: COL_L, g: X2, inverse: 'L2' },
];
const MOVE_BY_NAME = new Map<string, Cm3Move>(MOVES.map((mv) => [mv.name, mv]));

/** Valid scramble tokens (the exact cstimer cm3 alphabet, 18 tokens). */
export const CM3_MOVE_NAMES: ReadonlyArray<string> = MOVES.map((m) => m.name);

/** Solved state: all 9 balls in the identity orientation. */
export const CM3_SOLVED: ReadonlyArray<number> = [IDENT, IDENT, IDENT, IDENT, IDENT, IDENT, IDENT, IDENT, IDENT];

/** Reachable-state count (jaapsch.net): 24⁹/24, preformatted string (> 2^31, exact). */
export const CM3_STATE_COUNT_STR = '165,112,971,264';
/**
 * Hard upper bound on solution length (cstimer face-turn metric). The reduction's measured max over
 * both random move-sequences and real cstimer cm3 scrambles is ~47; 60 carries margin and is asserted
 * in tests/cm3_solver.test.ts (so the cap can never be silently violated — unlike the 336 mistake).
 */
export const CM3_MAX_LENGTH = 60;

// ── apply one move to a 9-ball state ───────────────────────────────────────────
function applyMove(cur: ReadonlyArray<number>, mv: Cm3Move): number[] {
  const next = cur.slice();
  for (const b of mv.balls) next[b] = MUL[mv.g][cur[b]];
  return next;
}
const keyOf = (c: ReadonlyArray<number>) => c.join(',');

// ── public parse / apply ──────────────────────────────────────────────────────
const TOKEN_RE = /^(U<|U>|U2|E<|E>|E2|D<|D>|D2|R\^|Rv|R2|M\^|Mv|M2|L\^|Lv|L2)$/;

/** Parse a scramble into move names. Throws Error('bad: <tok>') on an invalid token. */
export function parseCm3Scramble(scramble: string): string[] {
  const out: string[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    if (!TOKEN_RE.test(tok) || !MOVE_BY_NAME.has(tok)) throw new Error(`bad: ${tok}`);
    out.push(tok);
  }
  return out;
}

/** Apply a scramble to the solved puzzle and return its raw 9-ball state (for rendering / keys). */
export function cm3Apply(scramble: string): number[] {
  let c: number[] = [...CM3_SOLVED];
  for (const tok of parseCm3Scramble(scramble)) c = applyMove(c, MOVE_BY_NAME.get(tok)!);
  return c;
}

// ── single-ball gadgets (built once, memoized) ─────────────────────────────────
// For ball b at (row r, col c): a confined BFS over the alphabet {row r's 3 turns} ∪ {col c's 3 turns}
// (which keeps every move inside row r ∪ col c) finds, for each EVEN (H) rotation delta achievable at
// ball b while leaving ALL OTHER balls identity, a shortest such word. These are the Phase-2 macros.
function rowMovesOf(b: number): string[] {
  const L = ['U', 'E', 'D'][Math.floor(b / 3)];
  return ['<', '>', '2'].map((p) => L + p);
}
function colMovesOf(b: number): string[] {
  const c = b % 3;
  const L = c === 0 ? 'L' : c === 1 ? 'M' : 'R';
  return ['^', 'v', '2'].map((p) => L + p);
}
function buildGadget(b: number): Map<number, string[]> {
  const alpha = [...rowMovesOf(b), ...colMovesOf(b)].map((n) => MOVE_BY_NAME.get(n)!);
  const table = new Map<number, string[]>();
  const seen = new Set<string>([keyOf(CM3_SOLVED)]);
  let frontier: { st: number[]; seq: string[] }[] = [{ st: [...CM3_SOLVED], seq: [] }];
  const MAXLEN = 9; // ample: confined subgroup is tiny, all 11 non-trivial H deltas appear by len 5
  while (frontier.length) {
    const next: { st: number[]; seq: string[] }[] = [];
    for (const { st, seq } of frontier) {
      if (seq.length >= MAXLEN) continue;
      for (const mv of alpha) {
        const ns = applyMove(st, mv);
        const k = keyOf(ns);
        if (seen.has(k)) continue;
        seen.add(k);
        // single-ball-b change?
        let changedBall = -1, changedCount = 0;
        for (let i = 0; i < 9; i++) if (ns[i] !== IDENT) { changedBall = i; changedCount++; }
        if (changedCount === 1 && changedBall === b) {
          const v = ns[b];
          if (!table.has(v)) table.set(v, [...seq, mv.name]);
        }
        next.push({ st: ns, seq: [...seq, mv.name] });
      }
    }
    frontier = next;
  }
  return table;
}
let GADGETS: Map<number, string[]>[] | null = null;
function gadgets(): Map<number, string[]>[] {
  if (!GADGETS) GADGETS = Array.from({ length: 9 }, (_, b) => buildGadget(b));
  return GADGETS;
}

// ── Phase 1: solve the 9 sign bits with line-quarter-turn flips (GF(2), 6 generators) ──
const LINES: ReadonlyArray<ReadonlyArray<number>> = [ROW[0], ROW[1], ROW[2], COL_L, COL_M, COL_R];
const LINE_FLIP_MOVE = ['U<', 'E<', 'D<', 'L^', 'M^', 'R^']; // a quarter turn on each line flips its 3 sign bits
/** Smallest subset of the 6 line-flips whose combined parity-flip equals `target` (9-bit vector). */
function solveSignBits(target: number[]): string[] | null {
  let best: { seq: string[]; cnt: number } | null = null;
  for (let mask = 0; mask < 64; mask++) {
    const v = new Array<number>(9).fill(0);
    let cnt = 0;
    for (let i = 0; i < 6; i++) if ((mask >> i) & 1) { cnt++; for (const b of LINES[i]) v[b] ^= 1; }
    if (v.every((x, j) => x === target[j]) && (!best || cnt < best.cnt)) {
      const seq: string[] = [];
      for (let i = 0; i < 6; i++) if ((mask >> i) & 1) seq.push(LINE_FLIP_MOVE[i]);
      best = { seq, cnt };
    }
  }
  return best ? best.seq : null;
}

// ── solution simplifier: merge consecutive same-line turns, drop net-identity ───
const lineKey = (n: string) => n[0]; // U / E / D / R / M / L
const powOf = (n: string): number => {
  const s = n.slice(1);
  if (s === '<' || s === '^') return 1;
  if (s === '>' || s === 'v') return 3;
  if (s === '2') return 2;
  return 0;
};
function makeToken(line: string, p: number): string | null {
  p = ((p % 4) + 4) % 4;
  if (p === 0) return null;
  const isRow = line === 'U' || line === 'E' || line === 'D';
  const suf = isRow ? ({ 1: '<', 2: '2', 3: '>' } as Record<number, string>)[p]
    : ({ 1: '^', 2: '2', 3: 'v' } as Record<number, string>)[p];
  return line + suf;
}
function simplify(seq: string[]): string[] {
  let s = seq.slice();
  let changed = true;
  while (changed) {
    changed = false;
    const out: string[] = [];
    for (const m of s) {
      if (out.length && lineKey(out[out.length - 1]) === lineKey(m)) {
        const prev = out.pop()!;
        const merged = makeToken(lineKey(m), powOf(prev) + powOf(m));
        if (merged) out.push(merged);
        changed = true;
      } else out.push(m);
    }
    s = out;
  }
  return s;
}

export interface Cm3Solution {
  /** Solution as space-separated moves; empty when already solved. */
  solution: string;
  /** Move count; 0 when already solved. */
  length: number;
  /** Always false — the reduction is valid + bounded, not optimal. */
  optimal: false;
}

/**
 * Solve a Cmetrick (cm3) scramble with the sign-then-commutator reduction (valid + bounded, NOT
 * optimal). Throws on an invalid token, or 'unsolvable' if the reduction fails to reach solved (should
 * never happen for a real cm3 state — the test asserts 100% solve over real cstimer scrambles).
 */
export function solveCm3(scramble: string): Cm3Solution {
  let st = cm3Apply(scramble);
  const sol: string[] = [];
  // Phase 1: clear sign bits.
  const bits = st.map((g) => (isEven(g) ? 0 : 1));
  const p1 = solveSignBits(bits);
  if (p1 === null) throw new Error('unsolvable');
  for (const m of p1) { st = applyMove(st, MOVE_BY_NAME.get(m)!); sol.push(m); }
  // Phase 2: solve each ball with its single-ball gadget (stays in H, fixes other balls).
  const G = gadgets();
  for (let b = 0; b < 9; b++) {
    if (st[b] === IDENT) continue;
    const need = INV[st[b]]; // left-multiply ball b by INV[st[b]] → identity
    const seq = G[b].get(need);
    if (!seq) throw new Error('unsolvable');
    for (const m of seq) { st = applyMove(st, MOVE_BY_NAME.get(m)!); sol.push(m); }
  }
  if (!st.every((g) => g === IDENT)) throw new Error('unsolvable');
  const simplified = simplify(sol);
  return { solution: simplified.join(' '), length: simplified.length, optimal: false };
}

// ── cstimer-mirroring random scramble generator ─────────────────────────────────
// Faithful mirror of cstimer mega(turns, [""], len) for cm3 (scramble/scramble.js:5 + megascramble.js:28).
// turns = [axis0, axis1]; each axis = 3 groups; each group = 3 powers. No-immediate-repeat-same-group rule
// (donemoves bitmask over the group index, reset when the axis changes). Injectable rnd for reproducibility.
const CM3_TURNS: ReadonlyArray<ReadonlyArray<ReadonlyArray<string>>> = [
  [['U<', 'U>', 'U2'], ['E<', 'E>', 'E2'], ['D<', 'D>', 'D2']],
  [['R^', 'Rv', 'R2'], ['M^', 'Mv', 'M2'], ['L^', 'Lv', 'L2']],
];
/** A faithful cstimer-style random cm3 scramble of `len` tokens. */
export function randomCm3Scramble(len: number, rnd: () => number = Math.random): string {
  let donemoves = 0;
  let lastaxis = -1;
  const s: string[] = [];
  for (let i = 0; i < len; i++) {
    let first = 0, second = 0;
    do {
      first = Math.floor(rnd() * CM3_TURNS.length);
      second = Math.floor(rnd() * CM3_TURNS[first].length);
      if (first !== lastaxis) { donemoves = 0; lastaxis = first; }
    } while (((donemoves >> second) & 1) !== 0);
    donemoves |= 1 << second;
    const group = CM3_TURNS[first][second];
    s.push(group[Math.floor(rnd() * group.length)]);
  }
  return s.join(' ');
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
 * and bucketing the scramble by its returned solution length. The state space is far too large to
 * enumerate, so this is sampled (deterministic via a seeded PRNG). Returns { length: [scramble, …] }.
 */
export function cm3ExamplesByLength(perBin = 12): Record<number, string[]> {
  const rnd = mulberry32(0xC3EE);
  const out: Record<number, string[]> = {};
  const TRIES = perBin * 400 + 4000;
  for (let i = 0; i < TRIES; i++) {
    const scramble = randomCm3Scramble(16, rnd);
    let len: number;
    try { len = solveCm3(scramble).length; } catch { continue; }
    if (len <= 0) continue;
    const arr = out[len] ?? (out[len] = []);
    if (arr.length < perBin) arr.push(scramble);
  }
  return out;
}

// ── test / diagnostic helpers ───────────────────────────────────────────────────
/** Exposed for the test's geometry cross-check (rotation closure must be 24). */
export const CM3_ROTATION_COUNT = ROT_COUNT;
