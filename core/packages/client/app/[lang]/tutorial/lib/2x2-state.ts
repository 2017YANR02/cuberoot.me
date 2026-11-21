import { Alg, Move } from 'cubing/alg';
import { AllFaces, CubeData, Face, parseAlgorithm } from '@cuberoot/visualcube';

// Tutorial palette: yellow up, red front, blue left, orange back.
export const TWO_BY_TWO_ORIENTATION = "z2 y'";
const colors = ['Y', 'G', 'R', 'W', 'B', 'O'] as const;

/** Read room-relative facelets, including rotations, before applying any display masks. */
export function twoByTwoState(moves: string) {
  const cube = new CubeData(2, Object.fromEntries(AllFaces.map(face => [face, Array<string>(4).fill(colors[face])])));
  const turns = Array.from(new Alg(moves).expand().childAlgNodes()).flatMap(node => {
    if (!(node instanceof Move)) return [];
    // A dragged turn may contain more than one revolution.
    const amount = ((node.amount % 4) + 4) % 4;
    return amount ? [node.quantum.toString() + ['', '', '2', "'"][amount]] : [];
  });
  for (const move of parseAlgorithm(turns.join(' '))) cube.turn(move);
  return cube.faces as Record<Face, string[]>;
}

export function isWhiteFirstLayer(state: ReturnType<typeof twoByTwoState>) {
  return state[Face.D].every(color => color === 'W')
    && [Face.R, Face.F, Face.L, Face.B].every(face => state[face][2] === state[face][3]);
}
