/**
 * Method definitions for step-by-step solvers (CFOP / Roux / Petrus / ZZ /
 * EODR). Mask strings are copied verbatim from cstimer
 * `tools/gsolver.js` (`cfmeta`, `sabmeta`, `petrusmeta`, `zzmeta`,
 * `eodrmeta`).
 *
 * Only CFOP is wired into the UI for now; the other tables exist so
 * future agents can plug them in by adding the same `solveCFOP`-style
 * driver without re-deriving the masks.
 */

import { cubeMove, applyScramble, MOVES_FULL, MOVES_NO_D, MOVES_ROUX_SB, MOVES_ZZ_F2L } from './cube3x3';
import { GSolver, solveParallel, matches, type ParallelTarget } from './gsolver';
import { parseScramble } from '../cube/moves';
import { solveThistle, type ThistleResult } from './thistle';

export interface StepDef {
  /** Allowed moves for this step (move-name → axis/face byte). */
  move: Record<string, number>;
  /** IDA* depth bound for this step. */
  maxl: number;
  /** Optional pre-step "free moves" tried as a one-move prefix. */
  fmov?: string[];
  /** Display name. */
  head: string;
  /**
   * Map from mask-string target to a bitflag used to track which sub-goals
   * are now solved. The bitflags compose with OR; a solver whose mask is
   * already a subset of the running mask is skipped.
   */
  step: Record<string, number>;
}

export const CFOP_METHOD: StepDef[] = [
  {
    move: MOVES_FULL,
    maxl: 8,
    head: 'Cross',
    step: {
      '----U--------R--R-----F--F--D-DDD-D-----L--L-----B--B-': 0x0,
    },
  },
  {
    move: MOVES_NO_D,
    maxl: 10,
    head: 'F2L-1',
    step: {
      '----U-------RR-RR-----FF-FF-DDDDD-D-----L--L-----B--B-': 0x1,
      '----U--------R--R----FF-FF-DD-DDD-D-----LL-LL----B--B-': 0x2,
      '----U--------RR-RR----F--F--D-DDD-DD----L--L----BB-BB-': 0x4,
      '----U--------R--R-----F--F--D-DDDDD----LL-LL-----BB-BB': 0x8,
    },
  },
  {
    move: MOVES_NO_D,
    maxl: 10,
    head: 'F2L-2',
    step: {
      '----U-------RR-RR----FFFFFFDDDDDD-D-----LL-LL----B--B-': 0x3,
      '----U-------RRRRRR----FF-FF-DDDDD-DD----L--L----BB-BB-': 0x5,
      '----U--------RR-RR---FF-FF-DD-DDD-DD----LL-LL---BB-BB-': 0x6,
      '----U-------RR-RR-----FF-FF-DDDDDDD----LL-LL-----BB-BB': 0x9,
      '----U--------R--R----FF-FF-DD-DDDDD----LLLLLL----BB-BB': 0xa,
      '----U--------RR-RR----F--F--D-DDDDDD---LL-LL----BBBBBB': 0xc,
    },
  },
  {
    move: MOVES_NO_D,
    maxl: 10,
    head: 'F2L-3',
    step: {
      '----U-------RRRRRR---FFFFFFDDDDDD-DD----LL-LL---BB-BB-': 0x7,
      '----U-------RR-RR----FFFFFFDDDDDDDD----LLLLLL----BB-BB': 0xb,
      '----U-------RRRRRR----FF-FF-DDDDDDDD---LL-LL----BBBBBB': 0xd,
      '----U--------RR-RR---FF-FF-DD-DDDDDD---LLLLLL---BBBBBB': 0xe,
    },
  },
  {
    move: MOVES_NO_D,
    maxl: 10,
    head: 'F2L-4',
    step: {
      '----U-------RRRRRR---FFFFFFDDDDDDDDD---LLLLLL---BBBBBB': 0xf,
    },
  },
];

// --- Stubs for other methods (mask data only; not surfaced in UI yet) ---

export const ROUX_METHOD: StepDef[] = [
  {
    move: MOVES_FULL,
    maxl: 10,
    fmov: ['x ', 'x2', "x'"],
    head: 'Step 1',
    step: {
      '---------------------F--F--D--D--D-----LLLLLL-----B--B': 0x0,
    },
  },
  {
    move: MOVES_ROUX_SB,
    maxl: 16,
    head: 'Step 2',
    step: {
      '------------RRRRRR---F-FF-FD-DD-DD-D---LLLLLL---B-BB-B': 0x1,
    },
  },
];

export const PETRUS_METHOD: StepDef[] = [
  {
    move: MOVES_FULL,
    maxl: 8,
    head: '2x2x2',
    step: {
      '---------------------FF-FF-DD-DD--------LL-LL---------': 0x1,
      '------------------------------DD-DD----LL-LL-----BB-BB': 0x2,
    },
  },
  {
    move: MOVES_FULL,
    maxl: 10,
    head: '2x2x3',
    step: {
      '---------------------FF-FF-DD-DD-DD----LLLLLL----BB-BB': 0x3,
    },
  },
];

export const ZZ_METHOD: StepDef[] = [
  {
    move: MOVES_FULL,
    maxl: 10,
    head: 'EOLine',
    step: {
      '-H-HUH-H-----R-------HFH-F--D-HDH-D-----L-------HBH-B-': 0x0,
    },
  },
  {
    move: MOVES_ZZ_F2L,
    maxl: 16,
    head: 'ZZF2L1',
    step: {
      '-H-HUH-H----RRRRRR---HFF-FF-DDHDD-DD----L-------BBHBB-': 0x1,
      '-H-HUH-H-----R-------FFHFF-DD-DDHDD----LLLLLL---HBB-BB': 0x2,
    },
  },
  {
    move: MOVES_ZZ_F2L,
    maxl: 16,
    head: 'ZZF2L2',
    step: {
      '-H-HUH-H----RRRRRR---FFFFFFDDDDDDDDD---LLLLLL---BBBBBB': 0x3,
    },
  },
];

export const EODR_METHOD: StepDef[] = [
  {
    move: MOVES_FULL,
    maxl: 7,
    head: 'EO',
    step: {
      '-H-HUH-H-----R-------HFH----H-HDH-H-----L-------HBH---': 0x0,
    },
  },
  {
    move: MOVES_FULL,
    maxl: 10,
    head: 'DR',
    step: {
      'UUUUUUUUU---RRR------FFF---UUUUUUUUU---RRR------FFF---': 0x1,
    },
  },
];

// --- Driver ---

interface CompiledStep {
  head: string;
  maxl: number;
  fmov: string[];
  targets: ParallelTarget[];
}

const compiledCache = new WeakMap<StepDef[], CompiledStep[]>();

function compile(method: StepDef[]): CompiledStep[] {
  const cached = compiledCache.get(method);
  if (cached) return cached;
  const out: CompiledStep[] = [];
  for (const step of method) {
    const targets: ParallelTarget[] = [];
    for (const target in step.step) {
      targets.push({
        solver: new GSolver([target], cubeMove, step.move),
        mask: step.step[target],
        target,
      });
    }
    out.push({
      head: step.head,
      maxl: step.maxl,
      fmov: step.fmov ?? [],
      targets,
    });
  }
  compiledCache.set(method, out);
  return out;
}

/** Convert a scramble string into the cstimer-style two-char move tokens
 *  that `cubeMove` accepts (face + suffix). Wide / slice / rotation moves
 *  in the scramble are skipped (consistent with `applyScramble`). */
function scrambleToTokens(scramble: string): string[] {
  const out: string[] = [];
  for (const mv of parseScramble(scramble)) {
    if (mv.isRotation || mv.layers !== 1) continue;
    const f = mv.face;
    if (f !== 'U' && f !== 'R' && f !== 'F' && f !== 'D' && f !== 'L' && f !== 'B') continue;
    if (mv.amount === 1) out.push(f + ' ');
    else if (mv.amount === 2 || mv.amount === -2) out.push(f + '2');
    else out.push(f + "'");
  }
  return out;
}

export interface SolveStage {
  head: string;
  /** Empty array means "skip" (already solved before the step started). */
  moves: string[];
  /** True if no solution was found within `maxl`. */
  failed?: boolean;
}

export interface SolveResult {
  stages: SolveStage[];
  totalMoves: number;
}

/**
 * Drive a method end-to-end. The "state" passed to each step's parallel
 * solver is the *target mask* permuted by (scramble + all previously
 * found solution moves). Stops early if a stage fails to find a solution
 * within its depth bound.
 */
export function solveMethod(scramble: string, method: StepDef[]): SolveResult {
  const compiled = compile(method);
  const prefix = scrambleToTokens(scramble); // accumulates: scramble + sol1 + sol2 + ...
  const stages: SolveStage[] = [];
  let total = 0;
  let mask = 0;
  for (const step of compiled) {
    const { sol, mask: newMask } = solveParallel(
      cubeMove,
      prefix,
      step.targets,
      mask,
      step.maxl,
      step.fmov,
    );
    if (sol === undefined) {
      stages.push({ head: step.head, moves: [], failed: true });
      break;
    }
    mask = newMask;
    for (const m of sol) prefix.push(m);
    stages.push({ head: step.head, moves: sol });
    total += sol.length;
  }
  return { stages, totalMoves: total };
}

export function solveCFOP(scramble: string): SolveResult {
  return solveMethod(scramble, CFOP_METHOD);
}

export function solveRoux(scramble: string): SolveResult {
  return solveMethod(scramble, ROUX_METHOD);
}

export function solvePetrus(scramble: string): SolveResult {
  return solveMethod(scramble, PETRUS_METHOD);
}

export function solveZZ(scramble: string): SolveResult {
  return solveMethod(scramble, ZZ_METHOD);
}

export function solveEODR(scramble: string): SolveResult {
  return solveMethod(scramble, EODR_METHOD);
}

export type MethodId = 'cfop' | 'roux' | 'petrus' | 'zz' | 'eodr' | 'thistle';

export const METHOD_REGISTRY: { id: MethodId; def: StepDef[] | null; nameEn: string; nameZh: string }[] = [
  { id: 'cfop', def: CFOP_METHOD, nameEn: 'CFOP', nameZh: 'CFOP' },
  { id: 'roux', def: ROUX_METHOD, nameEn: 'Roux', nameZh: 'Roux' },
  { id: 'petrus', def: PETRUS_METHOD, nameEn: 'Petrus', nameZh: 'Petrus' },
  { id: 'zz', def: ZZ_METHOD, nameEn: 'ZZ', nameZh: 'ZZ' },
  { id: 'eodr', def: EODR_METHOD, nameEn: 'EODR', nameZh: 'EODR' },
  // Thistle is driven by its own solver (not the mask engine); `def` is null.
  { id: 'thistle', def: null, nameEn: 'Thistle', nameZh: 'Thistle' },
];

function thistleToSolveResult(r: ThistleResult): SolveResult {
  return {
    stages: r.stages.map(s => ({ head: s.head, moves: s.moves, failed: s.failed })),
    totalMoves: r.totalMoves,
  };
}

export function solveByMethodId(scramble: string, id: MethodId): SolveResult {
  if (id === 'thistle') return thistleToSolveResult(solveThistle(scramble));
  const entry = METHOD_REGISTRY.find(m => m.id === id);
  if (!entry || !entry.def) throw new Error(`unknown method: ${id}`);
  return solveMethod(scramble, entry.def);
}

// ---- 2x2x2 first-step (single-stage) ----
//
// Reuses the Petrus first-stage targets (DFL and DBL corners). Returns the
// shortest 2x2x2 sub-block solution across those two corners. Single
// stage; intended as a small hint on the 333 panel.
const SOLVE_222_TARGETS: { mask: string; corner: string }[] = [
  { mask: '---------------------FF-FF-DD-DD--------LL-LL---------', corner: 'DFL' },
  { mask: '------------------------------DD-DD----LL-LL-----BB-BB', corner: 'DBL' },
];

let solver222: GSolver | null = null;

function get222Solver(): GSolver {
  if (!solver222) {
    solver222 = new GSolver(SOLVE_222_TARGETS.map(t => t.mask), cubeMove, MOVES_FULL);
  }
  return solver222;
}

export interface Solve222Result {
  /** Shortest 2x2x2 corner block found ('DFL' / 'DBL'), or null if none. */
  corner: string | null;
  moves: string[];
  length: number;
}

export function solve222Step(scramble: string): Solve222Result {
  const solver = get222Solver();
  const prefix = scrambleToTokens(scramble);
  const MAXL = 9;
  // Try each corner; gsolver's BFS visits all targets in parallel
  // automatically (since solver was constructed with both as solvedStates),
  // but we still need to pick the right starting state — apply scramble to
  // either target. Either works since BFS terminates on any target match;
  // we use the first.
  let start = SOLVE_222_TARGETS[0].mask;
  for (const m of prefix) start = cubeMove(start, m);
  const sol = solver.search(start, 0, MAXL);
  if (sol === undefined) return { corner: null, moves: [], length: -1 };

  // Determine which corner the solution actually solved by applying
  // scramble + sol to the cube and matching against each target.
  let state = applyScramble(scramble);
  for (const m of sol) state = cubeMove(state, m);
  let cornerLabel: string | null = null;
  for (const t of SOLVE_222_TARGETS) {
    if (matches(state, t.mask)) { cornerLabel = t.corner; break; }
  }
  return { corner: cornerLabel, moves: sol, length: sol.length };
}

// --- Self-test ---

/**
 * Sanity-check the engine on a known scramble. Asserts:
 *  - All 5 CFOP stages return a solution (no failures within depth bound).
 *  - After applying scramble + every stage's moves, the cube fully matches
 *    the F2L-4 target (cross + 4 F2L pairs solved).
 *
 * Returns a string summary; throws on failure.
 */
export function __gsolverSelfTest(): string {
  const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
  const result = solveCFOP(scramble);
  if (result.stages.length !== CFOP_METHOD.length) {
    throw new Error(`expected ${CFOP_METHOD.length} stages, got ${result.stages.length}`);
  }
  for (const s of result.stages) {
    if (s.failed) throw new Error(`stage ${s.head} failed`);
  }
  // Apply scramble + all stage moves to the actual cube; check the final
  // state matches the F2L-4 mask (cross + 4 pairs).
  let state = applyScramble(scramble);
  for (const s of result.stages) {
    for (const m of s.moves) state = cubeMove(state, m);
  }
  const f2l4Target = Object.keys(CFOP_METHOD[CFOP_METHOD.length - 1].step)[0];
  if (!matches(state, f2l4Target)) {
    throw new Error(`final state does not match F2L-4 target: ${state}`);
  }
  // Spot-check the other 4 methods compile + run on the same scramble; we
  // don't assert their final state here (different goals per method) but
  // every stage must find a solution within its depth bound.
  const otherIds: MethodId[] = ['roux', 'petrus', 'zz', 'eodr', 'thistle'];
  const otherSummaries: string[] = [];
  for (const id of otherIds) {
    const r = solveByMethodId(scramble, id);
    for (const s of r.stages) {
      if (s.failed) throw new Error(`method=${id} stage=${s.head} failed`);
    }
    otherSummaries.push(`${id}=${r.totalMoves}`);
  }
  // 222 first-step also runs on the same scramble; expect a non-null corner.
  const s222 = solve222Step(scramble);
  if (s222.length < 0) throw new Error(`solve222Step failed`);
  return `OK: ${result.totalMoves} total moves; stages=` +
    result.stages.map(s => `${s.head}=${s.moves.length}`).join(',') +
    ` | others: ` + otherSummaries.join(',') +
    ` | 222=${s222.length}(${s222.corner})`;
}
