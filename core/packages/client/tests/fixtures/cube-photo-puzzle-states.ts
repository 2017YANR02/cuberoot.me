import { SkewbStateWCA } from '@cuberoot/shared/skewb-pyramid-svg';
import { toWca } from '@cuberoot/shared/skewb-notation';
import { PyraminxState } from '@cuberoot/puzzle-render-core/pyraminx-svg';
import { applySq1Move, applySq1Scramble, invertSq1Alg, type Sq1State } from '@cuberoot/shared/sq1-notation';
import type { CubeColor } from '@cuberoot/shared/cube-photo/recognize';
import type { PuzzlePhotoColors } from '@/lib/cube-photo/puzzle-lookup';

const scheme: Record<string, CubeColor> = { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' };
export function skewbColors(alg: string): PuzzlePhotoColors {
  const state = new SkewbStateWCA(); state.applyAlgorithm(toWca(alg, 'sarah'));
  const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
  return Object.fromEntries(faces.map((face, i) => [face, state.image[i].map(v => scheme[faces[v]])]));
}
export function pyraColors(alg: string): PuzzlePhotoColors {
  const state = new PyraminxState(); state.applyAlgorithm(alg);
  const faces = ['F', 'D', 'L', 'R'], colors: CubeColor[] = ['green', 'yellow', 'red', 'blue'];
  return Object.fromEntries(faces.map((face, i) => [face, state.image[i].map(v => colors[Math.floor(v / 9)])]));
}

// Independently describe each canonical piece by its clockwise side colors.
const pieceSides = ['FL', 'L', 'LB', 'B', 'BR', 'R', 'RF', 'F', 'F', 'RF', 'R', 'BR', 'B', 'LB', 'L', 'FL'];
const sidePositions: Record<string, number[]> = { F: [0, 11, 9, 22, 12, 13], R: [9, 8, 6, 13, 15, 16], B: [6, 5, 3, 16, 18, 19], L: [3, 2, 0, 19, 21, 22] };
const home = applySq1Scramble('');
export function sq1Colors(state: Sq1State): PuzzlePhotoColors {
  const colors: PuzzlePhotoColors = { U: Array(8).fill('white'), D: Array(8).fill('yellow') };
  for (const face of ['F', 'R', 'B', 'L']) {
    const sides = sidePositions[face].map(slot => {
      const original = home.pieces[slot], piece = state.pieces[slot];
      return scheme[pieceSides[piece][pieceSides[original].indexOf(face)]];
    });
    const middle = face === 'F' ? ['F', state.sliceSolved ? 'F' : 'B'] : face === 'B' ? [state.sliceSolved ? 'B' : 'F', 'B'] : [face, face];
    colors[face] = [...sides.slice(0, 3), ...middle.map(f => scheme[f]), ...sides.slice(3)];
  }
  return colors;
}
export function alignedSq1(alg: string): Sq1State {
  const initial = applySq1Scramble(invertSq1Alg(alg));
  for (let top = -5; top <= 6; top++) for (let bot = -5; bot <= 6; bot++) {
    const state = applySq1Move(initial, { kind: 'turn', top, bot });
    if (state.pieces.every((piece, i) => (piece < 8) === (i < 12) && pieceSides[piece].length === pieceSides[home.pieces[i]].length
      && (piece === state.pieces[(i + 1) % 12 + (i < 12 ? 0 : 12)]) === (home.pieces[i] === home.pieces[(i + 1) % 12 + (i < 12 ? 0 : 12)]))) return state;
  }
  throw new Error('Fixture does not have oriented cubeshape');
}
