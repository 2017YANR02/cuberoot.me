/**
 * Scramble generators for non-NxN puzzles.
 *
 * Pyraminx and Skewb use *random-state*: we mix the puzzle into a (near-)
 * uniformly distributed state by applying many random body moves, run the
 * existing IDA* solver to get an optimal solution, then emit the inverse of
 * that solution as the scramble. Because the random walk on these small
 * puzzles (~933K pyra body states, ~3.1M skewb states) mixes very quickly,
 * 30+ random moves produce a state that is statistically indistinguishable
 * from uniform, and the optimal solve gives an optimal-length scramble — the
 * defining property of WCA random-state scrambles.
 *
 * Square-1 is random-state (ported from cstimer in `./sq1_rs`).
 * Megaminx / Clock remain random-move (separate problem).
 */

import { generatePyraTimerScramble } from '@cuberoot/puzzle-solvers/pyra';
import { solveSkewb } from '@/lib/skewb-face-solver';
import { scrambleSq1RandomState } from './sq1_rs';

const SUFFIX2 = ['', "'"];

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Invert one solver-format move ("R " ↔ "R'", lowercase tips identical).
 * Solver moves use a trailing space for CW (per cstimer convention).
 */
function invertSolverMove(m: string): string {
  const head = m[0];
  const isPrime = m.length > 1 && m[1] === "'";
  return head + (isPrime ? ' ' : "'");
}

/** Emit a solver-format move in WCA notation (drop trailing space). */
function formatSolverMove(m: string): string {
  return m[1] === "'" ? m : m[0];
}

/**
 * Pyraminx — random-state. Mix the body via 30 random moves, optimally solve
 * with the IDA* solver, then output the inverse of the solution. Tips are
 * randomized independently as a fixed 4-tip suffix (each tip gets one of
 * {none, CW, CCW} uniformly).
 */
export function scramblePyra(rng: () => number): string {
  return generatePyraTimerScramble(rng);
}

/**
 * Skewb — random-state. Mix via 30 random moves, optimally solve with the
 * IDA* solver, output the inverse of the solution.
 */
export function scrambleSkewb(rng: () => number): string {
  const faces = ['R', 'U', 'L', 'B'] as const;
  const recorded: string[] = [];
  let lastFace = '';
  for (let i = 0; i < 30; i++) {
    let f: string;
    let attempts = 0;
    do {
      f = pick(faces, rng);
      attempts++;
      if (attempts > 30) break;
    } while (f === lastFace);
    const prime = pick(SUFFIX2, rng) === "'";
    recorded.push(f + (prime ? "'" : ''));
    lastFace = f;
  }
  const sol = solveSkewb(recorded.join(' ')).moves;
  const out: string[] = [];
  for (let i = sol.length - 1; i >= 0; i--) {
    out.push(formatSolverMove(invertSolverMove(sol[i])));
  }
  return out.join(' ');
}

/**
 * Square-1 — random-state (cstimer CSP port). Falls back to random
 * `(top,bot)` pairs only if the port throws — should never happen.
 */
export function scrambleSq1(rng: () => number): string {
  try {
    const s = scrambleSq1RandomState(rng);
    if (s && s.length > 0) return s;
  } catch {
    // fall through
  }
  const groups: string[] = [];
  for (let i = 0; i < 12; i++) {
    const top = pickInt(-5, 6, rng, true);
    const bot = pickInt(-5, 6, rng, true);
    groups.push(`(${top},${bot})`);
  }
  return groups.join(' / ');
}

function pickInt(lo: number, hi: number, rng: () => number, nonzero: boolean): number {
  while (true) {
    const v = lo + Math.floor(rng() * (hi - lo + 1));
    if (!nonzero || v !== 0) return v;
  }
}

/**
 * Megaminx — Pochmann notation. 7 lines × 10 moves each:
 *   R++ D++ R-- D++ R++ D-- R++ D-- R++ D++   U
 * We just emit random direction (++/--) per move with the U tag at line end.
 */
export function scrambleMega(rng: () => number): string {
  const lines: string[] = [];
  for (let l = 0; l < 7; l++) {
    const tokens: string[] = [];
    for (let i = 0; i < 5; i++) {
      tokens.push('R' + (rng() < 0.5 ? '++' : '--'));
      tokens.push('D' + (rng() < 0.5 ? '++' : '--'));
    }
    tokens.push(rng() < 0.5 ? "U" : "U'");
    lines.push(tokens.join(' '));
  }
  return lines.join('\n');
}

/**
 * Clock — random pin states + dial twists, simplified WCA notation.
 * UR0+ DR0+ DL0+ UL0+ U0+ R0+ D0+ L0+ ALL0+ y2 ...
 */
export function scrambleClock(rng: () => number): string {
  const pins = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'];
  const tokens: string[] = [];
  for (const p of pins) {
    const n = -5 + Math.floor(rng() * 12); // -5..6
    tokens.push(`${p}${n >= 0 ? n + '+' : (-n) + '-'}`);
  }
  tokens.push('y2');
  for (const p of ['U', 'R', 'D', 'L', 'ALL']) {
    const n = -5 + Math.floor(rng() * 12);
    tokens.push(`${p}${n >= 0 ? n + '+' : (-n) + '-'}`);
  }
  return tokens.join(' ');
}
