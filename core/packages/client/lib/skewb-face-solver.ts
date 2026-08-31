/**
 * Web compatibility adapter for the shared Timer Skewb hint engine.
 *
 * Keep existing imports stable while Web and Mobile consume the same
 * csTimer-compatible face coordinate from `@cuberoot/puzzle-solvers`.
 */
import {
  TIMER_SKEWB_FACE_MOVES,
  applyTimerSkewbFaceScramble,
  solveTimerSkewb,
  solveTimerSkewbFaces,
  timerSkewbFaceMove,
} from '@cuberoot/puzzle-solvers/timer-small-hints';
import {
  SOLVED_SKEWB_FACELET,
  skewbFaceletFromMoves,
  solveSkewbFacelet,
} from '@cuberoot/puzzle-solvers/skewb';

export const SOLVED_SKEWB = SOLVED_SKEWB_FACELET;
export const MOVES_SKEWB = TIMER_SKEWB_FACE_MOVES;
export const skewbMove = timerSkewbFaceMove;
export const applySkewbScramble = applyTimerSkewbFaceScramble;
export const solveSkewb = solveTimerSkewb;
export const solveSkewbFace = solveTimerSkewbFaces;

export function __skewbSelfTest(): string {
  const scramble = "R U' L' B R' L U' B'";
  const full = solveSkewb(scramble);
  const final = skewbFaceletFromMoves(`${scramble} ${full.moves.join(' ')}`);
  if (solveSkewbFacelet(final).length !== 0) {
    throw new Error(`skewb full solve failed: ${final}`);
  }
  const faces = solveSkewbFace(scramble);
  if (faces.length !== 6) throw new Error(`expected 6 faces, got ${faces.length}`);
  return `OK Skewb: full=${full.length}, faces=${faces.map((face) => `${face.face}:${face.moves.length}`).join(',')}`;
}
