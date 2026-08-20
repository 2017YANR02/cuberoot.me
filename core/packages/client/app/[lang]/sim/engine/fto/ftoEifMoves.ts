import {
  FTO_EIF_ACTION_SEQUENCES,
  parseFtoEifAlgorithm,
  parseFtoEifToken,
  type FtoEifBaseMove,
} from '@cuberoot/shared/fto-notation';
import type { FtoAnimationMove, FtoLayerMove, FtoVertexRotationMove } from './ftoAnimation';
import type { FtoMove } from './ftoState';

/** LowCubes EIF face names mapped to the corresponding faces in the shared `/sim` engine. */
export const EIF_TO_ENGINE_FACE = {
  U: 1,
  F: 7,
  R: 6,
  L: 5,
  D: 4,
  Bl: 2,
  Br: 3,
  B: 0,
} as const;

const VERTEX_AXES = {
  Rt: [-1 / Math.SQRT2, 1 / Math.sqrt(3), -1 / Math.sqrt(6)],
  Lt: [1 / Math.SQRT2, 1 / Math.sqrt(3), -1 / Math.sqrt(6)],
  Ft: [0, 1 / Math.sqrt(3), Math.sqrt(2 / 3)],
} as const;

const FACE_ROOTS = new Set(Object.keys(EIF_TO_ENGINE_FACE));
const SLICE_ROOTS = new Set(['Us', 'Fs', 'Rs', 'Ls']);
const WIDE_ROOTS = new Set(['Uw', 'Fw', 'Rw', 'Lw', 'Dw', 'Blw', 'Brw', 'Bw']);
const WHOLE_ROOTS = new Set(['Uo', 'Fo', 'Ro', 'Lo']);

function faceForRoot(root: string): number | null {
  const face = root.startsWith('Bl') ? 'Bl'
    : root.startsWith('Br') ? 'Br'
      : root[0];
  return EIF_TO_ENGINE_FACE[face as keyof typeof EIF_TO_ENGINE_FACE] ?? null;
}

function baseMove(root: FtoEifBaseMove, dir: 1 | -1 = -1): FtoAnimationMove {
  const face = faceForRoot(root);
  if (face === null) throw new Error(`Unknown EIF base move: ${root}`);
  if (root.endsWith('s')) {
    return { kind: 'layer', face, layer: 'slice', dir, token: root } satisfies FtoLayerMove;
  }
  return { face, dir } satisfies FtoMove;
}

function repeatedMove(move: FtoAnimationMove, count: number): FtoAnimationMove[] {
  return Array.from({ length: count }, () => ({ ...move }));
}

/** One valid EIF token becomes one visual timeline group; macros contain several turns. */
export function ftoEifTokenMoves(token: string): FtoAnimationMove[] | null {
  const parts = parseFtoEifToken(token);
  if (!parts) return null;

  if (parts.root === 'S' || parts.root === 'H') {
    const key = parts.suffix === "'" ? `${parts.root}'` : parts.root;
    return FTO_EIF_ACTION_SEQUENCES[key].map(move => baseMove(move));
  }

  if (parts.root === 'Rt' || parts.root === 'Lt' || parts.root === 'Ft') {
    return [{
      kind: 'vertex-rotation',
      axis: VERTEX_AXES[parts.root],
      quarterTurns: parts.suffix === "'" ? -1 : parts.suffix === '2' ? 2 : 1,
      token: parts.token,
    } satisfies FtoVertexRotationMove];
  }

  const face = faceForRoot(parts.root);
  if (face === null) return null;
  const dir: 1 | -1 = parts.suffix === "'" ? 1 : -1;
  const repeat = parts.suffix === '2' ? 2 : 1;

  if (FACE_ROOTS.has(parts.root)) return repeatedMove({ face, dir } satisfies FtoMove, repeat);
  const layer = SLICE_ROOTS.has(parts.root) ? 'slice'
    : WIDE_ROOTS.has(parts.root) ? 'wide'
      : WHOLE_ROOTS.has(parts.root) ? 'whole'
        : null;
  if (!layer) return null;
  return repeatedMove({ kind: 'layer', face, layer, dir, token: parts.token } satisfies FtoLayerMove, repeat);
}

export interface FtoEifMoveGroups {
  tokens: string[];
  groups: FtoAnimationMove[][];
  invalid: string[];
}

export function parseFtoEifMoveGroups(algorithm: string): FtoEifMoveGroups {
  const parsed = parseFtoEifAlgorithm(algorithm);
  return {
    tokens: parsed.tokens,
    groups: parsed.tokens.map(token => ftoEifTokenMoves(token)!),
    invalid: parsed.invalid,
  };
}
