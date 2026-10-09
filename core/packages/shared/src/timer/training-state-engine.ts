/** Worker-only state-to-scramble engine shared by random and seeded training. */
import { formatMoves, type CubieCube } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { buildMoveTables } from '@cuberoot/puzzle-solvers/kociemba/movetables';
import { buildPruneTables } from '@cuberoot/puzzle-solvers/kociemba/prune';
import { scrambleFromState } from '@cuberoot/puzzle-solvers/kociemba/search';
import { randomRouxCubie } from '@cuberoot/puzzle-solvers/kociemba/randomstate';

let tables: { move: ReturnType<typeof buildMoveTables>; prune: ReturnType<typeof buildPruneTables> } | null = null;
export function trainingScrambleFromState(state: CubieCube): string {
  if (!tables) {
    const move = buildMoveTables();
    tables = { move, prune: buildPruneTables(move) };
  }
  // First bounded solution: no wall-clock-dependent optimization for seeded output.
  return formatMoves(scrambleFromState(state, tables.move, tables.prune, { maxTotalLen: 30, targetLen: 30 }));
}

export function generateRouxTrainingCandidate(key: 'roux-lse' | 'roux-l10p', random = Math.random): string {
  return trainingScrambleFromState(randomRouxCubie(key === 'roux-l10p', random));
}
