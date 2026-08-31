/**
 * Compatibility facade for older Web-only imports. Timer 3×3 method masks,
 * execution and scheduling live in @cuberoot/puzzle-solvers; FTO keeps its
 * distinct Web adapter because its alphabet is unrelated to the 3×3 panel.
 */
export * from '@cuberoot/puzzle-solvers/timer-333-step';

import {
  solveFto as solveFtoImpl,
  verifyScrambleSolution as verifyFto,
} from './fto';

export type PuzzleSolverId = 'fto';

export interface PuzzleSolverEntry {
  id: PuzzleSolverId;
  nameEn: string;
  nameZh: string;
  event: string;
}

export const PUZZLE_SOLVER_REGISTRY: PuzzleSolverEntry[] = [
  { id: 'fto', nameEn: 'FTO', nameZh: 'FTO', event: 'fto' },
];

export function solveFto(scramble: string): { moves: string; length: number } {
  return solveFtoImpl(scramble);
}

export function verifyFtoSolution(scramble: string, solution: string): boolean {
  return verifyFto(scramble, solution);
}
