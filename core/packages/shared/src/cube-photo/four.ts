import { parseScramble } from '@cuberoot/puzzle-solvers/cube-moves';
import { invertMoveString, expandAllInnerSlices } from '../alg_notation';
import { solved, type CubeFaces, type FaceArr } from '../timer/reconstruct/state';
import { faceletToCubie } from '../cube_facelet';

const FACES = 'URFDLB';
const EXPAND = [0, 1, 1, 2, 3, 4, 4, 5, 3, 4, 4, 5, 6, 7, 7, 8];
const REDUCE = [0, 1, 3, 4, 5, 7, 12, 13, 15];
export function expandReducedFour(facelet: string): string {
  return [...FACES].map((_, f) => EXPAND.map(i => facelet[f * 9 + i]).join('')).join('');
}
export function fourFaces(facelet: string): CubeFaces | null {
  if (!/^[URFDLB]{96}$/.test(facelet) || [...FACES].some(f => [...facelet].filter(c => c === f).length !== 16)) return null;
  const state = solved(4);
  [...FACES].forEach((f, i) => { state[f as keyof CubeFaces] = facelet.slice(i * 16, i * 16 + 16).split('') as FaceArr; });
  return state;
}
/** All centers and wing pairs must agree before treating the cube as reduced. */
export function reduceFour(state: CubeFaces): string | null {
  const faces = [...FACES].map(f => state[f as keyof CubeFaces]);
  if (faces.some(face => face.length !== 16 || [6, 9, 10].some(i => face[i] !== face[5])
    || [[1, 2], [4, 8], [7, 11], [13, 14]].some(([a, b]) => face[a] !== face[b]))) return null;
  return faces.map(face => REDUCE.map(i => face[i]).join('')).join('');
}
const parity = (p: number[]) => p.reduce((sum, v, i) => sum + p.slice(i + 1).filter(w => v > w).length, 0) % 2;
export function fourParity(state: CubeFaces): { oll: boolean; pll: boolean } | null {
  const reduced = reduceFour(state);
  if (!reduced) return null;
  try {
    const c = faceletToCubie(reduced);
    if (new Set(c.cp).size !== 8 || new Set(c.ep).size !== 12 || c.co.reduce((a, b) => a + b, 0) % 3) return null;
    return { oll: c.eo.reduce((a, b) => a ^ b, 0) !== 0, pll: parity(c.cp) !== parity(c.ep) };
  } catch { return null; }
}
export function fourLowerSolved(state: CubeFaces): boolean {
  return state.D.every(c => c === state.D[5])
    && (['F', 'R', 'B', 'L'] as const).every(f => state[f].slice(4).every(c => c === state[f][5]));
}
export function fourTopOriented(state: CubeFaces): boolean { return state.U.every(c => c === state.U[5]); }


// The reconstruction parser treats a numeric prefix as wide width. Algorithm
// libraries also use single inner layers (2R) and all-inner slices (m/e/s).
export function parseFourMoves(alg: string) {
  return expandAllInnerSlices(alg).split(/\s+/).filter(Boolean).flatMap(token => {
    const inner = /^([23])([URFDLB])(2'?|')?$/.exec(token);
    if (inner) {
      const [, depth, face, suffix = ''] = inner;
      const wide = depth + face + 'w' + suffix;
      const outer = (Number(depth) === 2 ? face : '2' + face + 'w') + suffix;
      return parseScramble(wide + ' ' + invertMoveString(outer));
    }
    if (!/^(?:[URFDLB]w?|[234][URFDLB]w|[urfdlbxyz])(?:2'?|')?$/.test(token)) throw new Error('Unsupported 4x4 move');
    return parseScramble(token);
  });
}
