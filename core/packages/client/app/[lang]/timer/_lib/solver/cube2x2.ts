/**
 * Web compatibility adapter for the shared Timer 2x2 hint engine.
 *
 * The historical facelet/GSolver copy has moved to the canonical 2x2 state
 * package, so Android/iOS and Web now receive one exact answer payload.
 */
import {
  cube222MetricOfScramble,
  solve222TimerHints,
} from '@cuberoot/puzzle-solvers/cube222';

export function solve2x2(scramble: string): { moves: string[]; length: number } {
  return solve222TimerHints(scramble).full;
}

export function solve2x2Face(scramble: string): { face: string; moves: string[] }[] {
  return solve222TimerHints(scramble).faces;
}

export function __cube2x2SelfTest(): string {
  const scramble = "R U R' U' F' U F R2";
  const full = solve2x2(scramble);
  if (cube222MetricOfScramble(`${scramble} ${full.moves.join(' ')}`, 'htm') !== 0) {
    throw new Error('2x2 full solve failed');
  }
  const faces = solve2x2Face(scramble);
  if (faces.length !== 6) throw new Error(`expected 6 faces, got ${faces.length}`);
  return `OK 2x2: full=${full.length}, faces=${faces.map((face) => `${face.face}:${face.moves.length}`).join(',')}`;
}
