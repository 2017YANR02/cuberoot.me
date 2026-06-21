/*
 * Crazy 3×3 (crz3a / 疯狂 3×3) NEAR-OPTIMAL solver — TIER D.
 *
 * The Crazy 3×3 uses the STANDARD 3×3 move set (cstimer megascramble.js:27
 * `"crz3a": [[["U","D"],["R","L"],["F","B"]],cubesuff]`, cubesuff = ["","2","'"]):
 * the "crazy" is purely presentation, the underlying mechanism is an ordinary
 * Rubik's cube with ~4.3×10¹⁹ states. There is nothing event-specific to solve —
 * so instead of a new engine/table we REUSE the site's own client-side kociemba
 * two-phase solver (app/[lang]/scramble/solver/_kociemba/*, the same code path the
 * 3×3 "derive scramble" flow uses; NON-COEP, runnable in a plain Node/vitest
 * context). `solveCrz3a(scramble)` parses the scramble, applies it to a solved
 * cube, and runs the two-phase IDA* search → a SOLUTION (not a scramble).
 *
 * NEAR-OPTIMAL: ~4.3×10¹⁹ states is far too many for a full BFS / God's-number
 * table, so this is the kociemba two-phase output — provably valid
 * (scramble∘solution = solved, the contract) but NOT provably shortest. Typical
 * solutions are ~18-23 HTM. METRIC = HTM face turns (each token = 1 move).
 *
 * The move+prune tables are built once, lazily, and memoized at module scope (the
 * first call takes ~3-5s on a warm CPU; subsequent calls reuse the tables).
 * Validity is cross-checked against an independent 3×3 apply in
 * tests/crz3a_solver.test.ts.
 */

import {
  parseMoves,
  applySequence,
  solvedCubie,
  isSolvedCubie,
  formatMoves,
} from '@/app/[lang]/scramble/solver/_kociemba/cube';
import { buildMoveTables, type MoveTables } from '@/app/[lang]/scramble/solver/_kociemba/movetables';
import { buildPruneTables, type PruneTables } from '@/app/[lang]/scramble/solver/_kociemba/prune';
import { solveCube } from '@/app/[lang]/scramble/solver/_kociemba/search';

/**
 * kociemba two-phase defaults to maxTotalLen 23 (phase-1 ≤12 + phase-2 ≤18 with a
 * 200ms best-effort early-out at the default target). A loose ceiling of 26 covers
 * the rare longer-than-target solution; we assert ≤ this in tests (a sanity bound
 * on the near-optimal length, NOT an optimality claim).
 */
export const CRZ3A_SOLUTION_LENGTH_BOUND = 26;

/** The crz3a token alphabet === the standard 3×3 HTM move set. */
export const CRZ3A_MOVE_NAMES: ReadonlyArray<string> = [
  'U', 'U2', "U'", 'D', 'D2', "D'", 'R', 'R2', "R'",
  'L', 'L2', "L'", 'F', 'F2', "F'", 'B', 'B2', "B'",
];

export interface Crz3aSolution {
  /** Near-optimal solution as space-separated HTM moves; empty when already solved. */
  solution: string;
  /** Move count (kociemba two-phase length, HTM face-turn metric). */
  length: number;
}

// Module-scope memoized tables (built once on first solve).
let MT: MoveTables | null = null;
let PT: PruneTables | null = null;
function ensureTables(): { mt: MoveTables; pt: PruneTables } {
  if (!MT || !PT) {
    MT = buildMoveTables();
    PT = buildPruneTables(MT);
  }
  return { mt: MT, pt: PT };
}

/**
 * Near-optimally solve a Crazy 3×3 scramble with the site's kociemba two-phase
 * solver. Async so the (one-time) table build + the IDA* search stay off the
 * synchronous render path. Throws on an unknown / malformed token.
 *
 * Note: we run `solveCube(...)` and `formatMoves(sol)` directly — NOT
 * `scrambleFromState` (which inverts the solution to produce a scramble). The
 * returned moves are the SOLUTION, so scramble∘solution = solved.
 */
export async function solveCrz3a(scramble: string): Promise<Crz3aSolution> {
  const trimmed = scramble.trim();
  // parseMoves validates the standard 3×3 alphabet (U/D/L/R/F/B + 2/'); throws on a bad token.
  const moves = parseMoves(trimmed);
  const state = applySequence(solvedCubie(), moves);
  if (isSolvedCubie(state)) return { solution: '', length: 0 };
  const { mt, pt } = ensureTables();
  const sol = solveCube(state, mt, pt);
  const solution = formatMoves(sol);
  const length = sol.length;
  return { solution, length };
}
