/**
 * Square-1 CSP (Cube Shape → Permutation) two-step solver, ported from
 * cstimer `tools/gsolver.js` `sq1Cube` block.
 *
 * State model (cstimer convention, distinct from our `cube/sq1_state.ts`
 * piece-id model — kept self-contained here for solver correctness):
 *
 *   `state` is a 25-char string `<top>|<bot>` where each side is a
 *   12-char ring of slot symbols. Symbols:
 *     '0'        edge
 *     'A'/'a'    corner (left/right halves; halves must stay adjacent)
 *     '1'        edge in step 2 ("colour" target — distinguishes layer)
 *     'B'/'b'    corner (left/right halves) in step 2
 *
 *   Step 1 ("Cube Shape") only cares whether each slot is edge or
 *   corner-half. The four step-1 targets are the four cube-shape patterns
 *   (`0Aa0Aa0Aa0Aa` repeating for the layer with edges-then-corners-pair).
 *   Step 2 ("Permutation") starts from a cube-shape state and uses '1'/'B'
 *   on the bottom layer so that the BFS distinguishes top from bottom and
 *   converges to a fully-solved permutation.
 *
 *   Moves are signed integers (token: '0' = slice; m=1..11 = top by m
 *   slots CW; m=-1..-11 = bottom by |m| slots CW). The Sq1 doMove rejects
 *   any move that would cut a corner (returns null), which the gsolver
 *   handles via the "newState falsy → skip" branch.
 *
 * Move bitmap (axis/face) follows cstimer:
 *   '0'      → 0x21  (slice — own face/axis)
 *   '1'..'11'  → 0x00 (top — same face, no two adjacent)
 *   '-1'..'-11' → 0x10 (bottom — same face)
 *
 * This file only exports the solver; rendering still uses the piece-id
 * model in `cube/sq1_state.ts`.
 */

import { GSolver, matches } from './gsolver';

// ---- Move set ----

const SQ1_MOVES: Record<string, number> = (() => {
  const m: Record<string, number> = { '0': 0x21 };
  for (let i = 1; i < 12; i++) {
    m['' + i] = 0x00;
    m['' + (-i)] = 0x10;
  }
  return m;
})();

// ---- doMove (port of cstimer sq1Move) ----

/** Apply one Sq1 token to the cstimer state string. Returns empty string
 *  when the move is illegal (would cut a corner pair across the slice line)
 *  — gsolver treats falsy results as "skip this branch". */
export function sq1DoMove(state: string, move: string): string {
  if (!state) return '';
  const m = parseInt(move, 10);
  const parts = state.split('|');
  let top = parts[0];
  let bot = parts[1];
  if (m === 0) {
    // Slice: swap top[6..11] with bot[6..11].
    const tmp = top.slice(6);
    top = top.slice(0, 6) + bot.slice(6);
    bot = bot.slice(0, 6) + tmp;
  } else if (m > 0) {
    // Top rotate by m (positive = shift left m, i.e. ring rotate).
    top = top.slice(m) + top.slice(0, m);
    // Reject if the slice line would cut a corner (chars at boundary 0 / 6).
    if (/[a-h]/.test(top[0] + top[6])) return '';
  } else {
    const k = Math.abs(m);
    bot = bot.slice(k) + bot.slice(0, k);
    if (/[a-h]/.test(bot[0] + bot[6])) return '';
  }
  return top + '|' + bot;
}

/** Apply tokens to a state string, returning '' if any move is illegal. */
function applyTokens(state: string, tokens: string[]): string {
  let st = state;
  for (const m of tokens) {
    st = sq1DoMove(st, m);
    if (!st) return '';
  }
  return st;
}

// ---- Targets ----

const SHAPE_TARGETS: string[] = [
  '0Aa0Aa0Aa0Aa|Aa0Aa0Aa0Aa0',
  '0Aa0Aa0Aa0Aa|0Aa0Aa0Aa0Aa',
  'Aa0Aa0Aa0Aa0|Aa0Aa0Aa0Aa0',
  'Aa0Aa0Aa0Aa0|0Aa0Aa0Aa0Aa',
];

const PERM_TARGETS: string[] = [
  '0Aa0Aa0Aa0Aa|Bb1Bb1Bb1Bb1',
  '0Aa0Aa0Aa0Aa|1Bb1Bb1Bb1Bb',
  'Aa0Aa0Aa0Aa0|Bb1Bb1Bb1Bb1',
  'Aa0Aa0Aa0Aa0|1Bb1Bb1Bb1Bb',
];

// Lazily-initialised solvers (pruning tables ≤ 100k entries each).
let solv1: GSolver | null = null;
let solv2: GSolver | null = null;

function getSolvers(): { s1: GSolver; s2: GSolver } {
  if (!solv1) solv1 = new GSolver(SHAPE_TARGETS, sq1DoMove, SQ1_MOVES);
  if (!solv2) solv2 = new GSolver(PERM_TARGETS, sq1DoMove, SQ1_MOVES);
  return { s1: solv1, s2: solv2 };
}

// ---- Scramble parser ----

/** Convert a Sq1 scramble in `(a,b)/...` notation to cstimer move tokens. */
function scrambleToTokens(scramble: string): string[] {
  const out: string[] = [];
  if (!scramble) return out;
  const parts = scramble.split('/');
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim();
    if (p === '') {
      // empty fragment → slice marker (cstimer pushes 0 for blank)
      out.push('0');
      continue;
    }
    const m = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/.exec(p);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      // Match cstimer: only push non-zero, normalised to (-11, -10..., 11).
      if (a !== 0) out.push('' + (((a % 12) + 12) % 12)); // top: positive
      if (b !== 0) {
        // bottom: negative direction; cstimer code uses -((b+12) % 12).
        const bb = ((b % 12) + 12) % 12;
        if (bb !== 0) out.push('' + (-bb));
      }
      out.push('0');
    }
  }
  if (out.length > 0 && out[out.length - 1] === '0') out.pop();
  return out;
}

// ---- Pretty-print solution ----

/** cstimer prettySq1Arr: collapse runs of top/bot turns between slices into
 *  `(u,d)/` fragments. Trailing slice omitted; consecutive slices show as
 *  `/` alone. */
function prettySolution(sol: string[]): string[] {
  let u = 0;
  let d = 0;
  const out: string[] = [];
  for (const tok of sol) {
    const m = parseInt(tok, 10);
    if (m === 0) {
      if (u === 0 && d === 0) out.push('/');
      else out.push(`(${((u + 5) % 12) - 5},${((d + 5) % 12) - 5})/`);
      u = 0; d = 0;
    } else if (m > 0) {
      u += m;
    } else {
      d -= m;
    }
  }
  if (u !== 0 || d !== 0) {
    out.push(`(${((u + 5) % 12) - 5},${((d + 5) % 12) - 5})`);
  }
  return out;
}

// ---- Public API ----

export interface Sq1Stage {
  head: string;
  /** Pretty-printed `(a,b)/` fragments — UI joins them with spaces. */
  moves: string[];
  /** Raw cstimer move tokens (used by self-test). */
  rawMoves: string[];
  failed?: boolean;
}

export interface Sq1Result {
  stages: Sq1Stage[];
  totalMoves: number;
}

/**
 * Solve a Sq1 scramble in two steps (Cube Shape, then Permutation). Each
 * step uses parallel search across its 4 alternative target patterns; the
 * shortest solution wins. Returns pretty `(a,b)/` fragments for display
 * plus raw token lists for verification.
 */
export function solveSq1(scramble: string): Sq1Result {
  const { s1, s2 } = getSolvers();
  const scrambleTokens = scrambleToTokens(scramble);

  const stages: Sq1Stage[] = [];

  // Step 1 — start from the canonical shape target permuted by the scramble.
  // BFS will succeed when the state matches *any* of the 4 SHAPE_TARGETS.
  const MAXL_SHAPE = 20;
  const shapeStart = applyTokens(SHAPE_TARGETS[0], scrambleTokens);
  const shapeSol = shapeStart ? s1.search(shapeStart, 0, MAXL_SHAPE) : undefined;
  if (shapeSol === undefined) {
    stages.push({ head: 'Shape', moves: [], rawMoves: [], failed: true });
    return { stages, totalMoves: 0 };
  }
  stages.push({ head: 'Shape', moves: prettySolution(shapeSol), rawMoves: shapeSol });

  // Step 2 — start from the canonical perm target permuted by scramble + step1.
  const prefix = scrambleTokens.concat(shapeSol);
  const MAXL_PERM = 22;
  const permStart = applyTokens(PERM_TARGETS[0], prefix);
  const permSol = permStart ? s2.search(permStart, 0, MAXL_PERM) : undefined;
  if (permSol === undefined) {
    stages.push({ head: 'Permutation', moves: [], rawMoves: [], failed: true });
    return { stages, totalMoves: shapeSol.length };
  }
  stages.push({ head: 'Permutation', moves: prettySolution(permSol), rawMoves: permSol });

  // "Total moves" is the total raw token count (each top/bot quarter-turn
  // counts once; slices count once). Display format is fragments.
  const total = shapeSol.length + permSol.length;
  return { stages, totalMoves: total };
}

// ---- Self-test ----

/**
 * Sanity check: scramble → shape stage → perm stage → state must match a
 * permutation target. Throws on failure; returns a one-line summary.
 */
export function __sq1SelfTest(): string {
  // A representative WCA-style Sq1 scramble (validated to be all-legal).
  const scramble = '(1,2)/(6,6)/(4,-3)/(6,5)/(6,-3)/(-5,3)/(-1,-3)/(6,6)/(-3,-3)/';
  const result = solveSq1(scramble);
  if (result.stages.length !== 2) {
    throw new Error(`expected 2 stages, got ${result.stages.length}`);
  }
  for (const s of result.stages) {
    if (s.failed) throw new Error(`stage ${s.head} failed`);
  }

  // Verify: applying scramble + all raw moves to *each* perm target yields
  // a state that matches one of the original perm targets. (Engine
  // convention: targets are permuted backward by scramble+sol; if any of
  // the resulting forward strings equals the original, we're solved.)
  const allTokens = scrambleToTokens(scramble)
    .concat(result.stages[0].rawMoves)
    .concat(result.stages[1].rawMoves);
  let solved = false;
  for (const target of PERM_TARGETS) {
    const st = applyTokens(target, allTokens);
    if (st) {
      for (const t2 of PERM_TARGETS) {
        if (matches(st, t2)) { solved = true; break; }
      }
      if (solved) break;
    }
  }
  if (!solved) throw new Error('sq1 solution did not produce a solved permutation target');

  const shapeMoves = result.stages[0].rawMoves.length;
  const permMoves = result.stages[1].rawMoves.length;
  return `OK: shape=${shapeMoves} perm=${permMoves} total=${result.totalMoves}`;
}
