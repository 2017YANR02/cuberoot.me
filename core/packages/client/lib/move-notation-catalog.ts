/**
 * Move inventories shared by notation guides. Parsers and players remain the
 * authority for execution; these arrays are the finite teaching catalog shown
 * beside the shared AlgPlayer.
 */

const WCA_CUBE_SUFFIXES = ['', "'", '2'] as const;
const CUBE_DEMO_SUFFIXES = [...WCA_CUBE_SUFFIXES, "2'"] as const;
const CUBE_LR_SUFFIXES = [...CUBE_DEMO_SUFFIXES, '3', "3'"] as const;
const ORDER_THREE_SUFFIXES = ['', "'"] as const;
const ORDER_FOUR_SUFFIXES = ['', "'", '2'] as const;

function expandRoots(roots: readonly string[], suffixes: readonly string[]): string[] {
  return roots.flatMap(root => suffixes.map(suffix => `${root}${suffix}`));
}

/** Visual group key: suffix variants and matching face/wide turns stay together. */
export function notationMoveGroup(move: string): string {
  if (move.endsWith('++') || move.endsWith('--')) return move.slice(0, -2);
  const clockRoot = /^([A-Z]+)\d+[+-]$/.exec(move)?.[1];
  if (clockRoot) return clockRoot;
  const root = move.replace(/(?:[23]'?|')$/, '');
  return root.match(/^\d*([UDLRFB])w?$/)?.[1] ?? root;
}

export const CUBE_FACE_ROOTS = ['U', 'D', 'L', 'R', 'F', 'B'] as const;
export const CUBE_WIDE_ROOTS = ['Uw', 'Dw', 'Lw', 'Rw', 'Fw', 'Bw'] as const;
export const CUBE_SLICE_ROOTS = ['E', 'M', 'S'] as const;
export const CUBE_ROTATION_ROOTS = ['x', 'y', 'z'] as const;

/** Exact NxN move families defined by WCA Regulations Article 12a. */
export const CUBE_WCA_FACE_MOVES = expandRoots(CUBE_FACE_ROOTS, WCA_CUBE_SUFFIXES);
export const CUBE_WCA_WIDE_MOVES = expandRoots(CUBE_WIDE_ROOTS, WCA_CUBE_SUFFIXES);
export const CUBE_WCA_ROTATION_MOVES = expandRoots(CUBE_ROTATION_ROOTS, WCA_CUBE_SUFFIXES);

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

/** Order-aware display inventory, grouped by face direction for one shared player. */
export function cubeMovesForOrder(order: number): readonly string[] {
  const faceAndWideMoves = CUBE_FACE_ROOTS.flatMap(root => [
    ...expandRoots(
      [root],
      order === 3 && (root === 'L' || root === 'R') ? CUBE_LR_SUFFIXES : CUBE_DEMO_SUFFIXES,
    ),
    ...expandRoots([`${root}w`], CUBE_DEMO_SUFFIXES),
    ...(order > 3 ? [
      ...expandRoots([`2${root}`], CUBE_DEMO_SUFFIXES),
      ...expandRoots([`3${root}w`], CUBE_DEMO_SUFFIXES),
    ] : []),
  ]);
  return [...faceAndWideMoves, ...CUBE_SLICE_MOVES, ...CUBE_ROTATION_MOVES];
}

/** Order-aware subset explicitly defined by WCA Regulations Article 12a. */
export function cubeWcaMovesForOrder(order: number): readonly string[] {
  const faceAndWideMoves = CUBE_FACE_ROOTS.flatMap(root => [
    ...expandRoots([root], WCA_CUBE_SUFFIXES),
    ...expandRoots([`${root}w`], WCA_CUBE_SUFFIXES),
    ...(order > 3 ? expandRoots([`3${root}w`], WCA_CUBE_SUFFIXES) : []),
  ]);
  return [...faceAndWideMoves, ...CUBE_WCA_ROTATION_MOVES];
}

const BIG_CUBE_INNER_ROOTS = ['2U', '2D', '2L', '2R', '2F', '2B'] as const;
const BIG_CUBE_THREE_WIDE_ROOTS = ['3Uw', '3Dw', '3Lw', '3Rw', '3Fw', '3Bw'] as const;
/** 3-layer outer-block turns are the numeric-prefix example valid on 4x4 and larger. */
export const BIG_CUBE_WCA_MOVES = expandRoots(BIG_CUBE_THREE_WIDE_ROOTS, WCA_CUBE_SUFFIXES);
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

export const MEGAMINX_WCA_MOVES = ['R++', 'R--', 'D++', 'D--', 'U', "U'"] as const;

/** One-hour examples cover every WCA Clock pin pattern; y2 demonstrates flipping. */
export const CLOCK_WCA_MOVES = [
  'UR1+', 'UR1-', 'DR1+', 'DR1-', 'DL1+', 'DL1-', 'UL1+', 'UL1-',
  'U1+', 'U1-', 'R1+', 'R1-', 'D1+', 'D1-', 'L1+', 'L1-',
  'ALL1+', 'ALL1-', 'y2',
] as const;

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
