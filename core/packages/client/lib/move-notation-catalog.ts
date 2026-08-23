/**
 * Move inventories shared by notation guides. Parsers and players remain the
 * authority for execution; these arrays are the finite teaching catalog shown
 * beside the shared AlgPlayer.
 */

const CUBE_DEMO_SUFFIXES = ['', "'", '2', "2'"] as const;
const CUBE_LR_SUFFIXES = [...CUBE_DEMO_SUFFIXES, '3', "3'"] as const;
const ORDER_THREE_SUFFIXES = ['', "'"] as const;
const ORDER_FOUR_SUFFIXES = ['', "'", '2'] as const;

function expandRoots(roots: readonly string[], suffixes: readonly string[]): string[] {
  return roots.flatMap(root => suffixes.map(suffix => `${root}${suffix}`));
}

/** Visual group key: U/U'/U2/U2' stay together without puzzle-specific UI code. */
export function notationMoveGroup(move: string): string {
  if (move.endsWith('++') || move.endsWith('--')) return move.slice(0, -2);
  return move.replace(/(?:[23]'?|')$/, '');
}

export const CUBE_FACE_ROOTS = ['U', 'D', 'L', 'R', 'F', 'B'] as const;
export const CUBE_WIDE_ROOTS = ['Uw', 'Dw', 'Lw', 'Rw', 'Fw', 'Bw'] as const;
export const CUBE_SLICE_ROOTS = ['E', 'M', 'S'] as const;
export const CUBE_ROTATION_ROOTS = ['x', 'y', 'z'] as const;

export const CUBE_FACE_MOVES = CUBE_FACE_ROOTS.flatMap(root =>
  expandRoots([root], root === 'L' || root === 'R' ? CUBE_LR_SUFFIXES : CUBE_DEMO_SUFFIXES));
export const CUBE_WIDE_MOVES = expandRoots(CUBE_WIDE_ROOTS, CUBE_DEMO_SUFFIXES);
export const CUBE_SLICE_MOVES = expandRoots(CUBE_SLICE_ROOTS, CUBE_DEMO_SUFFIXES);
export const CUBE_ROTATION_MOVES = expandRoots(CUBE_ROTATION_ROOTS, CUBE_DEMO_SUFFIXES);
export const CUBE_ALL_MOVES = [
  ...CUBE_FACE_MOVES,
  ...CUBE_WIDE_MOVES,
  ...CUBE_SLICE_MOVES,
  ...CUBE_ROTATION_MOVES,
];

const BIG_CUBE_INNER_ROOTS = ['2U', '2D', '2L', '2R', '2F', '2B'] as const;
const BIG_CUBE_THREE_WIDE_ROOTS = ['3Uw', '3Dw', '3Lw', '3Rw', '3Fw', '3Bw'] as const;
export const BIG_CUBE_MOVES = [
  ...expandRoots(BIG_CUBE_INNER_ROOTS, CUBE_DEMO_SUFFIXES),
  ...expandRoots(BIG_CUBE_THREE_WIDE_ROOTS, CUBE_DEMO_SUFFIXES),
];

export const PYRAMINX_WCA_ROOTS = ['U', 'L', 'R', 'B', 'u', 'l', 'r', 'b'] as const;
export const PYRAMINX_FACE_ROOTS = ['Dw', 'Lw', 'Rw', 'Fw'] as const;
export const PYRAMINX_ROTATION_ROOTS = ['y', 'Lv', 'Rv', 'Bv'] as const;
export const PYRAMINX_WCA_MOVES = expandRoots(PYRAMINX_WCA_ROOTS, ORDER_THREE_SUFFIXES);
export const PYRAMINX_EXTENSION_MOVES = [
  ...expandRoots(PYRAMINX_FACE_ROOTS, ORDER_THREE_SUFFIXES),
  ...expandRoots(PYRAMINX_ROTATION_ROOTS, ORDER_THREE_SUFFIXES),
];

export const SKEWB_WCA_ROOTS = ['R', 'U', 'L', 'B'] as const;
export const SKEWB_EXTENSION_GRIP_ROOTS = ['F', 'UL', 'UR', 'D'] as const;
export const SKEWB_ROTATION_ROOTS = ['x', 'y', 'z'] as const;
export const SKEWB_WCA_MOVES = expandRoots(SKEWB_WCA_ROOTS, ORDER_THREE_SUFFIXES);
export const SKEWB_EXTENSION_MOVES = [
  ...expandRoots(SKEWB_EXTENSION_GRIP_ROOTS, ORDER_THREE_SUFFIXES),
  ...expandRoots(SKEWB_ROTATION_ROOTS, ORDER_FOUR_SUFFIXES),
];

export const SQUARE1_TURN_VALUES = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6] as const;
export const SQUARE1_MOVES = [
  ...SQUARE1_TURN_VALUES.flatMap(top => SQUARE1_TURN_VALUES
    .filter(bottom => top !== 0 || bottom !== 0)
    .map(bottom => `(${top},${bottom})`)),
  '/',
];

export const FTO_FACE_ROOTS = ['U', 'F', 'R', 'L', 'D', 'Bl', 'Br', 'B'] as const;
export const FTO_WIDE_ROOTS = ['Uw', 'Fw', 'Rw', 'Lw', 'Dw', 'Blw', 'Brw', 'Bw'] as const;
export const FTO_SLICE_ROOTS = ['Us', 'Fs', 'Rs', 'Ls'] as const;
export const FTO_FACE_ROTATION_ROOTS = ['Uo', 'Fo', 'Ro', 'Lo'] as const;
export const FTO_VERTEX_ROTATION_ROOTS = ['Rt', 'Lt', 'Ft'] as const;
export const FTO_MACRO_ROOTS = ['S', 'H'] as const;

export const FTO_FACE_MOVES = expandRoots(FTO_FACE_ROOTS, ['', "'", '2']);
export const FTO_WIDE_MOVES = expandRoots(FTO_WIDE_ROOTS, ['', "'", '2']);
export const FTO_SLICE_MOVES = expandRoots(FTO_SLICE_ROOTS, ['', "'", '2']);
export const FTO_ROTATION_MOVES = [
  ...expandRoots(FTO_FACE_ROTATION_ROOTS, ORDER_THREE_SUFFIXES),
  ...expandRoots(FTO_VERTEX_ROTATION_ROOTS, ORDER_FOUR_SUFFIXES),
];
export const FTO_MACRO_MOVES = expandRoots(FTO_MACRO_ROOTS, ORDER_THREE_SUFFIXES);
