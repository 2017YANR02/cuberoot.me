/**
 * Megaminx solver — partial port (Option C: heuristic "solvedness" count).
 *
 * The full cstimer megaminx solver (D:\cube\cstimer\src\js\solver\megaminx.js,
 * ~1050 lines) is a multi-phase IDA* with custom move tables for KLM (last
 * F2L slot) + LL. Porting it faithfully is a large effort and the megaminx
 * state space (132 stickers) does not fit the simple Map<string, number>
 * pruning used by gsolver.ts.
 *
 * For now we ship a cheap heuristic: apply the scramble to a solved megaminx
 * via the already-ported applyMegaScramble, then count how many face-stickers
 * are out of place vs solved. This gives the user a "% solved" indicator
 * without any search.
 *
 * TODO: full IDA* port of cstimer/src/js/solver/megaminx.js (KLM + LL phases,
 * move tables, pruning). Until then, surface only the solvedness percent.
 */

import { applyMegaScramble, megaSolved, type MegaState, type MegaFace } from '../cube/megaminx_state';

export interface MegaSolveResult {
  solvedPercent: number;
  misplaced: number;
  total: number;
}

const FACES: readonly MegaFace[] = [
  'U', 'R', 'F', 'L', 'BL', 'BR', 'DR', 'DL', 'DBL', 'B', 'DBR', 'D',
];

function countMisplaced(state: MegaState, solved: MegaState): number {
  let bad = 0;
  for (const f of FACES) {
    const sa = state[f];
    const sb = solved[f];
    for (let i = 0; i < 11; i++) {
      if (sa[i] !== sb[i]) bad++;
    }
  }
  return bad;
}

/** Heuristic megaminx solvedness — see file-top comment for caveats. */
export function solveMega(scramble: string): MegaSolveResult {
  const total = 12 * 11; // 132 stickers
  try {
    const state = applyMegaScramble(scramble);
    const solved = megaSolved();
    const misplaced = countMisplaced(state, solved);
    const solvedStickers = total - misplaced;
    const solvedPercent = Math.round((solvedStickers / total) * 100);
    return { solvedPercent, misplaced, total };
  } catch {
    return { solvedPercent: 0, misplaced: total, total };
  }
}
