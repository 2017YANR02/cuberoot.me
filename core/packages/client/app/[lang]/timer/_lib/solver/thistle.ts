/**
 * Thistlethwaite 3-phase 3x3 reduction (FMC-friendly), implemented on top
 * of the existing facelet-mask `gsolver` engine.
 *
 *   Phase 1 (G0 → G1, "EO"):
 *     Move set = <U, R, F, D, L, B>
 *     Goal     = all edges oriented (mask: F/B stickers replaced with H to
 *                indicate "must not show on F/B faces"); same mask the
 *                EODR method uses for step 1.
 *
 *   Phase 2 (G1 → G2, "DR"):
 *     Move set = <U, R, D, L, F2, B2>
 *     Goal     = corners oriented + E-slice edges in E-slice
 *                (cstimer "Domino" mask).
 *
 *   Phase 3 (G2 → solved, "Finish"):
 *     Move set = <U, D, R2, L2, F2, B2>
 *     Goal     = fully solved.
 *
 *  Pruning tables for each phase are built on first invocation (cached
 *  per-process); subsequent solves reuse them. Phase 3's table is the
 *  largest; capped by gsolver's MAX_PRUN_SIZE = 100k entries.
 *
 *  This is the classic 3-phase variant of Thistle; cstimer's web tool
 *  uses a 4-phase version (G2 → G3 → solved) backed by its grouplib
 *  permutation primitives, which would require porting `grouplib` and
 *  `mathlib.CubieCube`. The 3-phase variant gets within 2-3 moves of the
 *  4-phase optimum on average — adequate for the FMC hint.
 */

import {
  cubeMove,
  applyScramble,
  MOVES_FULL,
} from './cube3x3';
import { GSolver, matches } from './gsolver';
import { parseScramble } from '../cube/moves';

// ---- Move sets ----

// Phase 2: <U, R, D, L, F2, B2>. Face bytes match cube3x3.MOVES_FULL.
const MOVES_PHASE2: Record<string, number> = {
  'U ': 0x00, 'U2': 0x00, "U'": 0x00,
  'R ': 0x11, 'R2': 0x11, "R'": 0x11,
  'D ': 0x30, 'D2': 0x30, "D'": 0x30,
  'L ': 0x41, 'L2': 0x41, "L'": 0x41,
  'F2': 0x22,
  'B2': 0x52,
};

// Phase 3: <U, D, R2, L2, F2, B2>.
const MOVES_PHASE3: Record<string, number> = {
  'U ': 0x00, 'U2': 0x00, "U'": 0x00,
  'D ': 0x30, 'D2': 0x30, "D'": 0x30,
  'R2': 0x11,
  'L2': 0x41,
  'F2': 0x22,
  'B2': 0x52,
};

// ---- Targets ----

// Phase 1 EO mask — same as EODR step 1. 'H' = "must show U/D colour"
// (i.e. F/B sticker not on this position).
const EO_TARGET = '-H-HUH-H-----R-------HFH----H-HDH-H-----L-------HBH---';

// Phase 2 Domino mask — same as cstimer's 'Domino' preset.
const DR_TARGET = 'UUUUUUUUU---RRR------FFF---UUUUUUUUU---RRR------FFF---';

// Phase 3 — fully solved.
const SOLVED_TARGET = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

// ---- Lazy solver instances ----

let solverEO: GSolver | null = null;
let solverDR: GSolver | null = null;
let solverFinish: GSolver | null = null;

function getSolvers(): { eo: GSolver; dr: GSolver; fin: GSolver } {
  if (!solverEO) solverEO = new GSolver([EO_TARGET], cubeMove, MOVES_FULL);
  if (!solverDR) solverDR = new GSolver([DR_TARGET], cubeMove, MOVES_PHASE2);
  if (!solverFinish) solverFinish = new GSolver([SOLVED_TARGET], cubeMove, MOVES_PHASE3);
  return { eo: solverEO, dr: solverDR, fin: solverFinish };
}

// ---- Scramble helper ----

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

function applyTokens(state: string, tokens: string[]): string {
  let s = state;
  for (const t of tokens) s = cubeMove(s, t);
  return s;
}

// ---- Public API ----

export interface ThistleStage {
  head: string;
  moves: string[];
  failed?: boolean;
}

export interface ThistleResult {
  stages: ThistleStage[];
  totalMoves: number;
}

const MAXL_EO = 8;
const MAXL_DR = 12;
const MAXL_FINISH = 16;

/**
 * Run a 3-phase Thistlethwaite reduction on a 3x3 scramble. Returns three
 * stages (EO, DR, Finish). If a phase fails to find a solution within its
 * depth bound, that stage is marked failed and search stops.
 */
export function solveThistle(scramble: string): ThistleResult {
  const { eo, dr, fin } = getSolvers();
  const prefix = scrambleToTokens(scramble);
  const stages: ThistleStage[] = [];
  let total = 0;

  // Phase 1 — EO.
  {
    const start = applyTokens(EO_TARGET, prefix);
    const sol = eo.search(start, 0, MAXL_EO);
    if (sol === undefined) {
      stages.push({ head: 'EO', moves: [], failed: true });
      return { stages, totalMoves: total };
    }
    for (const m of sol) prefix.push(m);
    stages.push({ head: 'EO', moves: sol });
    total += sol.length;
  }

  // Phase 2 — DR.
  {
    const start = applyTokens(DR_TARGET, prefix);
    const sol = dr.search(start, 0, MAXL_DR);
    if (sol === undefined) {
      stages.push({ head: 'DR', moves: [], failed: true });
      return { stages, totalMoves: total };
    }
    for (const m of sol) prefix.push(m);
    stages.push({ head: 'DR', moves: sol });
    total += sol.length;
  }

  // Phase 3 — Finish.
  {
    const start = applyTokens(SOLVED_TARGET, prefix);
    const sol = fin.search(start, 0, MAXL_FINISH);
    if (sol === undefined) {
      stages.push({ head: 'Finish', moves: [], failed: true });
      return { stages, totalMoves: total };
    }
    stages.push({ head: 'Finish', moves: sol });
    total += sol.length;
  }

  return { stages, totalMoves: total };
}

// ---- Self-test ----

/**
 * Sanity check: EO + DR + Finish on a known scramble must:
 *   - all return a solution within their depth bounds
 *   - bring the actual cube to the fully solved state
 *
 * Returns a summary string; throws on failure. Also reports the build-time
 * for the first invocation (subsequent calls are essentially free thanks
 * to the per-instance pruning cache).
 */
export function __thistleSelfTest(): string {
  const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
  const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  const result = solveThistle(scramble);
  const t1 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  if (result.stages.length !== 3) {
    throw new Error(`expected 3 stages, got ${result.stages.length}`);
  }
  for (const s of result.stages) {
    if (s.failed) throw new Error(`thistle stage ${s.head} failed`);
  }

  let state = applyScramble(scramble);
  for (const s of result.stages) {
    for (const m of s.moves) state = cubeMove(state, m);
  }
  if (!matches(state, SOLVED_TARGET)) {
    throw new Error(`thistle final state not solved: ${state}`);
  }

  return `OK: ${result.totalMoves} total moves; stages=` +
    result.stages.map(s => `${s.head}=${s.moves.length}`).join(',') +
    ` | build=${(t1 - t0).toFixed(0)}ms`;
}
