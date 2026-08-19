import { ftoMoveToString, type FtoMove } from './ftoState';

export type FtoLayer = 'slice' | 'wide' | 'whole';

export interface FtoLayerMove {
  kind: 'layer';
  face: number;
  layer: FtoLayer;
  dir: 1 | -1;
  token: string;
}

export interface FtoVertexRotationMove {
  kind: 'vertex-rotation';
  axis: readonly [number, number, number];
  quarterTurns: -1 | 1 | 2;
  token: string;
}

/** Native face moves plus the extra layers and rotations used by LowCubes EIF notation. */
export type FtoAnimationMove = FtoMove | FtoLayerMove | FtoVertexRotationMove;

export function ftoAnimationMoveToString(move: FtoAnimationMove): string {
  return 'kind' in move ? move.token : ftoMoveToString(move);
}

export function invertFtoAnimationMoves(moves: readonly FtoAnimationMove[]): FtoAnimationMove[] {
  return moves.slice().reverse().map((move) => {
    if (!('kind' in move)) return { ...move, dir: move.dir === 1 ? -1 : 1 };
    if (move.kind === 'vertex-rotation') {
      return {
        ...move,
        quarterTurns: move.quarterTurns === 2 ? 2 : move.quarterTurns === 1 ? -1 : 1,
      };
    }
    return { ...move, dir: move.dir === 1 ? -1 : 1 };
  });
}
