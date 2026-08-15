import {
  SQ1_TOKEN_RE,
  applySq1Scramble,
  canonicalSq1Alg,
  invertSq1Alg,
  parseSq1Tokens,
  type Sq1State,
  type Sq1Token,
} from '@cuberoot/shared/sq1-notation';
import { cstimerSq1ShapeScramble } from '@/lib/cstimer-scramble';
import { sq1StateShapes, type Sq1ShapeDefinition } from '@/lib/sq1-shapes';

export interface Sq1TraceStep {
  index: number;
  move: string;
  algorithm: string;
  state: Sq1State;
}

export type Sq1TraceResult =
  | { ok: true; steps: Sq1TraceStep[]; tokens: Sq1Token[] }
  | { ok: false; reason: 'invalid-notation' | 'unsliceable'; step?: number };

export type Sq1Layer = 'top' | 'bottom';
export type Sq1RotationDirection = 'negative' | 'positive';

export type Sq1ParityFactorKey =
  | 'top-corner-order'
  | 'top-edge-order'
  | 'bottom-corner-order'
  | 'bottom-edge-order'
  | 'top-edges-in-odd-edge-positions'
  | 'top-corners-in-odd-corner-positions';

export interface Sq1ParityFactor {
  key: Sq1ParityFactorKey;
  count: number;
  pieceIds: number[];
  sides?: Sq1ParitySide[];
}

export interface Sq1ParityBreakdown {
  odd: boolean;
  total: number;
  factors: Sq1ParityFactor[];
}

export type Sq1ParitySide = 'F' | 'L' | 'B' | 'R';

export type Sq1CubeshapeInference =
  | {
      ok: true;
      setup: string;
      start: Sq1State;
      forward: Extract<Sq1TraceResult, { ok: true }>;
    }
  | {
      ok: false;
      error: Extract<Sq1TraceResult, { ok: false }>;
    };

export type Sq1TrainingParity = 'odd' | 'even';
export type Sq1MiddleMode = 'random' | 'never' | 'always';
export type Sq1ShapeTrainerRepeatAction = 'repeat' | 'same-parity' | 'opposite-parity' | 'swap-layers';

export interface Sq1ShapeTrainingVariant {
  top: string;
  bottom: string;
}

export interface Sq1ShapePairGroup<T extends Sq1ShapeTrainingVariant> {
  key: string;
  caseIndex: number;
  variants: T[];
}

export interface Sq1GeneratedShapeScramble {
  scramble: string;
  top: string;
  bottom: string;
  parity: Sq1TrainingParity;
  middleFlipped: boolean;
  state: Sq1State;
}

export interface Sq1ShapeScrambleRequest {
  pairKey: string;
  allowedOrientations: ReadonlyArray<Sq1ShapeTrainingVariant>;
  parity?: Sq1TrainingParity;
  middle: Sq1MiddleMode;
  previousScramble?: string;
}

export function sq1ShapeTrainerRepeatAction(key: string): Sq1ShapeTrainerRepeatAction | null {
  switch (key.toLowerCase()) {
    case 'r': return 'repeat';
    case 's': return 'same-parity';
    case 'o': return 'opposite-parity';
    case 'f': return 'swap-layers';
    default: return null;
  }
}

/** cstimer `sqrcsp` indices, in its own fixed 90-case order. */
export const SQ1_CSP_PAIR_KEYS = [
  '8 / Star',
  '7-1 / Star',
  '6-2 / Star',
  '4-4 / Star',
  '5-3 / Star',
  'Scallop / Square',
  'R pawn / Square',
  'Shield / Square',
  'Barrel / Square',
  'R fist / Square',
  'Mushroom / Square',
  'L pawn / Square',
  'Square / Square',
  'L fist / Square',
  'Kite / Square',
  'Kite / Scallop',
  'Kite / R pawn',
  'Kite / Shield',
  'Barrel / Kite',
  'Kite / R fist',
  'Kite / Mushroom',
  'Kite / L pawn',
  'Kite / L fist',
  'Kite / Kite',
  'Barrel / Scallop',
  'Barrel / R pawn',
  'Barrel / Shield',
  'Barrel / Barrel',
  'Barrel / R fist',
  'Barrel / Mushroom',
  'Barrel / L pawn',
  'Barrel / L fist',
  'Scallop / Scallop',
  'R pawn / Scallop',
  'Scallop / Shield',
  'R fist / Scallop',
  'Mushroom / Scallop',
  'L pawn / Scallop',
  'L fist / Scallop',
  'R pawn / Shield',
  'Shield / Shield',
  'R fist / Shield',
  'Mushroom / Shield',
  'L pawn / Shield',
  'L fist / Shield',
  'Mushroom / R pawn',
  'Mushroom / R fist',
  'Mushroom / Mushroom',
  'L pawn / Mushroom',
  'L fist / Mushroom',
  'R pawn / R pawn',
  'L pawn / R pawn',
  'R fist / R pawn',
  'L pawn / R fist',
  'L pawn / L pawn',
  'L fist / R pawn',
  'L fist / L pawn',
  'R fist / R fist',
  'L fist / R fist',
  'L fist / L fist',
  '6 / Paired edges',
  'Paired edges / R 4-2',
  '4-1-1 / Paired edges',
  'Paired edges / R 5-1',
  'L 4-2 / Paired edges',
  'L 5-1 / Paired edges',
  '3-3 / Paired edges',
  '3-1-2 / Paired edges',
  '3-2-1 / Paired edges',
  '2-2-2 / Paired edges',
  '6 / Perpendicular edges',
  'Perpendicular edges / R 4-2',
  '4-1-1 / Perpendicular edges',
  'Perpendicular edges / R 5-1',
  'L 4-2 / Perpendicular edges',
  'L 5-1 / Perpendicular edges',
  '3-3 / Perpendicular edges',
  '3-1-2 / Perpendicular edges',
  '3-2-1 / Perpendicular edges',
  '2-2-2 / Perpendicular edges',
  '6 / Parallel edges',
  'Parallel edges / R 4-2',
  '4-1-1 / Parallel edges',
  'Parallel edges / R 5-1',
  'L 4-2 / Parallel edges',
  'L 5-1 / Parallel edges',
  '3-3 / Parallel edges',
  '3-1-2 / Parallel edges',
  '3-2-1 / Parallel edges',
  '2-2-2 / Parallel edges',
] as const;

const SQ1_CSP_INDEX_BY_PAIR = new Map<string, number>(
  SQ1_CSP_PAIR_KEYS.map((key, index) => [key, index]),
);

export function sq1ShapePairKey(top: string, bottom: string): string {
  return [top, bottom].sort().join(' / ');
}

export function sq1CspCaseIndex(top: string, bottom: string): number | null {
  return SQ1_CSP_INDEX_BY_PAIR.get(sq1ShapePairKey(top, bottom)) ?? null;
}

export function groupSq1ShapePairs<T extends Sq1ShapeTrainingVariant>(
  variants: readonly T[],
): Sq1ShapePairGroup<T>[] {
  const grouped = new Map<string, T[]>();
  for (const variant of variants) {
    const key = sq1ShapePairKey(variant.top, variant.bottom);
    if (!SQ1_CSP_INDEX_BY_PAIR.has(key)) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), variant]);
  }
  return [...grouped].map(([key, items]) => ({
    key,
    caseIndex: SQ1_CSP_INDEX_BY_PAIR.get(key)!,
    variants: items,
  }));
}

export function filterSq1ShapePairGroups<T extends Sq1ShapeTrainingVariant>(
  groups: readonly Sq1ShapePairGroup<T>[],
  selectedTop: ReadonlySet<string>,
  selectedBottom: ReadonlySet<string>,
  excluded: ReadonlySet<string>,
): Sq1ShapePairGroup<T>[] {
  return groups.flatMap((group) => {
    if (excluded.has(group.key)) return [];
    const variants = group.variants.filter((variant) =>
      selectedTop.has(variant.top) && selectedBottom.has(variant.bottom),
    );
    return variants.length ? [{ ...group, variants }] : [];
  });
}

/** Pick the unordered pair first, so DB duplicate/parity rows cannot bias it. */
export function pickSq1ShapePair<T extends Sq1ShapeTrainingVariant>(
  groups: readonly Sq1ShapePairGroup<T>[],
  random: () => number = Math.random,
): Sq1ShapePairGroup<T> | null {
  if (!groups.length) return null;
  const index = Math.min(groups.length - 1, Math.floor(random() * groups.length));
  return groups[index];
}

function tokenText(token: Sq1Token): string {
  return token.kind === 'slice' ? '/' : `(${token.top}, ${token.bot})`;
}

function parseStrict(text: string): Sq1Token[] | null {
  const withoutComments = text.replace(/\/\/[^\n]*/g, ' ');
  const leftovers = withoutComments.replace(new RegExp(SQ1_TOKEN_RE.source, 'g'), '').trim();
  const tokens = parseSq1Tokens(text);
  if (leftovers || (withoutComments.trim() && tokens.length === 0)) return null;
  return tokens;
}

function isSq1LayerSliceable(pieces: readonly number[]): boolean {
  return pieces.length === 12
    && pieces[11] !== pieces[0]
    && pieces[5] !== pieces[6];
}

export function isSq1Sliceable(state: Sq1State): boolean {
  return state.pieces.length === 24
    && isSq1LayerSliceable(state.pieces.slice(0, 12))
    && isSq1LayerSliceable(state.pieces.slice(12, 24));
}

/** Strict parser plus slice-boundary validation, using the shared state engine for every step. */
export function traceSq1Algorithm(algorithm: string, setup = ''): Sq1TraceResult {
  const setupTokens = parseStrict(setup);
  const tokens = parseStrict(algorithm);
  if (!setupTokens || !tokens) return { ok: false, reason: 'invalid-notation' };

  const setupParts: string[] = [];
  for (let index = 0; index < setupTokens.length; index++) {
    const token = setupTokens[index];
    const state = applySq1Scramble(setupParts.join(' '));
    if (token.kind === 'slice' && !isSq1Sliceable(state)) {
      return { ok: false, reason: 'unsliceable', step: index + 1 };
    }
    setupParts.push(tokenText(token));
  }

  const canonicalSetup = setupParts.join(' ');
  const parts: string[] = [];
  const steps: Sq1TraceStep[] = [{
    index: 0,
    move: '',
    algorithm: '',
    state: applySq1Scramble(canonicalSetup),
  }];

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const before = applySq1Scramble([canonicalSetup, parts.join(' ')].filter(Boolean).join(' '));
    if (token.kind === 'slice' && !isSq1Sliceable(before)) {
      return { ok: false, reason: 'unsliceable', step: index + 1 };
    }
    const move = tokenText(token);
    parts.push(move);
    const canonical = parts.join(' ');
    steps.push({
      index: index + 1,
      move,
      algorithm: canonicalSq1Alg(canonical),
      state: applySq1Scramble([canonicalSetup, canonical].filter(Boolean).join(' ')),
    });
  }

  return { ok: true, steps, tokens };
}

/**
 * Infer the starting state of a cubeshape algorithm.
 * Squanmate accepts the two conventional cubeshape end alignments: solved and
 * the same cube shape offset by (1, -1). Try both before rejecting the input.
 */
export function inferSq1CubeshapeStart(algorithm: string): Sq1CubeshapeInference {
  const inverse = invertSq1Alg(algorithm);
  let firstError: Extract<Sq1TraceResult, { ok: false }> | null = null;

  for (const endingSetup of ['', '(1, -1)']) {
    const reverse = traceSq1Algorithm(inverse, endingSetup);
    if (!reverse.ok) {
      firstError ??= reverse;
      continue;
    }

    const setup = [endingSetup, inverse].filter(Boolean).join(' ');
    const forward = traceSq1Algorithm(algorithm, setup);
    if (!forward.ok) {
      firstError ??= forward;
      continue;
    }

    return {
      ok: true,
      setup,
      start: reverse.steps.at(-1)!.state,
      forward,
    };
  }

  return { ok: false, error: firstError ?? { ok: false, reason: 'invalid-notation' } };
}

function expandShape(pattern: string): number[] {
  const slots: number[] = [];
  for (let index = 0; index < pattern.length; index++) {
    slots.push(index);
    if (pattern[index] === 'c') slots.push(index);
  }
  return slots;
}

function rotateSlots(slots: readonly number[], amount: number): number[] {
  const offset = ((amount % 12) + 12) % 12;
  return [...slots.slice(12 - offset), ...slots.slice(0, 12 - offset)];
}

/** Rotate one layer without introducing a second SQ1 state engine. */
export function rotateSq1StateLayer(
  state: Sq1State,
  layer: Sq1Layer,
  amount: number,
): Sq1State {
  if (!Number.isInteger(amount) || state.pieces.length !== 24) return state;
  const top = state.pieces.slice(0, 12);
  const bottom = state.pieces.slice(12, 24);
  return {
    ...state,
    pieces: layer === 'top'
      ? [...rotateSlots(top, amount), ...bottom]
      : [...top, ...rotateSlots(bottom, amount)],
  };
}

/**
 * Squanmate's +/- controls jump to the nearest sliceable position in that
 * direction. The half-turn is represented as +6 in both directions.
 */
export function nextSq1SliceableLayerRotation(
  state: Sq1State,
  layer: Sq1Layer,
  direction: Sq1RotationDirection,
): number | null {
  if (state.pieces.length !== 24) return null;
  const candidates = direction === 'positive'
    ? [1, 2, 3, 4, 5, 6]
    : [-1, -2, -3, -4, -5];
  for (const amount of candidates) {
    const rotated = rotateSq1StateLayer(state, layer, amount);
    const pieces = layer === 'top'
      ? rotated.pieces.slice(0, 12)
      : rotated.pieces.slice(12, 24);
    if (isSq1LayerSliceable(pieces)) return amount;
  }
  return null;
}

const TOP_CORNERS = new Set([0, 2, 4, 6]);
const TOP_EDGES = new Set([1, 3, 5, 7]);
const BOTTOM_CORNERS = new Set([9, 11, 13, 15]);
const BOTTOM_EDGES = new Set([8, 10, 12, 14]);

const PIECE_SIDE: Readonly<Record<number, Sq1ParitySide>> = {
  0: 'F', 1: 'L', 2: 'L', 3: 'B', 4: 'B', 5: 'R', 6: 'R', 7: 'F',
  8: 'F', 9: 'F', 10: 'R', 11: 'R', 12: 'B', 13: 'B', 14: 'L', 15: 'L',
};

const ODD_PARITY_SIDE_SEQUENCES = new Set([
  'LFB', 'LBR', 'LRF',
  'RLB', 'RFL', 'RBF',
  'BLF', 'BRL', 'BFR',
  'FBL', 'FRB', 'FLR',
]);

function collapseSq1Pieces(slots: readonly number[]): number[] {
  return slots.filter((piece, index) => index === 0 || piece !== slots[index - 1]);
}

function piecesInParityCountOrder(state: Sq1State): number[] {
  const p = state.pieces;
  return [
    ...collapseSq1Pieces(p.slice(6, 12)),
    ...collapseSq1Pieces(p.slice(0, 6)),
    ...collapseSq1Pieces(p.slice(12, 18)),
    ...collapseSq1Pieces(p.slice(18, 24)),
  ];
}

function orderFactor(
  key: Sq1ParityFactorKey,
  pieces: readonly number[],
  accepted: ReadonlySet<number>,
): Sq1ParityFactor | null {
  const pieceIds = pieces.filter((piece) => accepted.has(piece)).slice(0, 3);
  const sides = pieceIds.map((piece) => PIECE_SIDE[piece]).filter(Boolean);
  if (pieceIds.length !== 3 || sides.length !== 3) return null;
  return {
    key,
    count: ODD_PARITY_SIDE_SEQUENCES.has(sides.join('')) ? 1 : 0,
    pieceIds,
    sides,
  };
}

function oddPositionFactor(
  key: Sq1ParityFactorKey,
  pieces: readonly number[],
  kind: ReadonlySet<number>,
  topKind: ReadonlySet<number>,
): Sq1ParityFactor {
  const pieceIds = pieces
    .filter((piece) => kind.has(piece))
    .filter((piece, index) => index % 2 === 0 && topKind.has(piece));
  return { key, count: pieceIds.length, pieceIds };
}

/**
 * Cale Schoon's six-factor parity count as implemented by Squanmate.
 * The count order depends on the slice seam, so a non-sliceable state has no
 * valid result and deliberately returns null.
 */
export function sq1ParityBreakdown(state: Sq1State): Sq1ParityBreakdown | null {
  if (!isSq1Sliceable(state)) return null;
  const pieces = piecesInParityCountOrder(state);
  if (pieces.length !== 16 || pieces.some((piece) => !(piece in PIECE_SIDE))) return null;

  const corners = new Set([...TOP_CORNERS, ...BOTTOM_CORNERS]);
  const edges = new Set([...TOP_EDGES, ...BOTTOM_EDGES]);
  const orderFactors = [
    orderFactor('top-corner-order', pieces, TOP_CORNERS),
    orderFactor('top-edge-order', pieces, TOP_EDGES),
    orderFactor('bottom-corner-order', pieces, BOTTOM_CORNERS),
    orderFactor('bottom-edge-order', pieces, BOTTOM_EDGES),
  ];
  if (orderFactors.some((factor) => factor == null)) return null;

  const factors: Sq1ParityFactor[] = [
    ...(orderFactors as Sq1ParityFactor[]),
    oddPositionFactor('top-edges-in-odd-edge-positions', pieces, edges, TOP_EDGES),
    oddPositionFactor('top-corners-in-odd-corner-positions', pieces, corners, TOP_CORNERS),
  ];
  const total = factors.reduce((sum, factor) => sum + factor.count, 0);
  return { odd: total % 2 === 1, total, factors };
}

function sq1LayerPatternAtSeam(slots: readonly number[]): string | null {
  if (slots.length !== 12 || slots[11] === slots[0]) return null;
  let pattern = '';
  let index = 0;
  while (index < slots.length) {
    const corner = index < 11 && slots[index] === slots[index + 1];
    pattern += corner ? 'c' : 'e';
    index += corner ? 2 : 1;
  }
  return pattern;
}

function rotationToDefaultShape(slots: readonly number[], shape: Sq1ShapeDefinition): number | null {
  for (let amount = -5; amount <= 6; amount++) {
    const rotated = rotateSlots(slots, amount);
    if (isSq1LayerSliceable(rotated) && sq1LayerPatternAtSeam(rotated) === shape.pattern) return amount;
  }
  return null;
}

/** Squanmate parity semantics: reorient both shapes to their defaults, then count. */
export function sq1ParityAtDefaultLayerPositions(state: Sq1State): Sq1TrainingParity | null {
  const shapes = sq1StateShapes(state);
  if (!shapes.top || !shapes.bottom) return null;
  const topRotation = rotationToDefaultShape(state.pieces.slice(0, 12), shapes.top);
  const bottomRotation = rotationToDefaultShape(state.pieces.slice(12, 24), shapes.bottom);
  if (topRotation == null || bottomRotation == null) return null;
  const normalized = rotateSq1StateLayer(
    rotateSq1StateLayer(state, 'top', topRotation),
    'bottom',
    bottomRotation,
  );
  const parity = sq1ParityBreakdown(normalized);
  return parity?.odd ? 'odd' : parity ? 'even' : null;
}

/**
 * Ask the vendored cstimer engine for fresh random full states until the
 * requested Squanmate orientation, relative parity, and middle-layer policy
 * all match. Even Repeat therefore gets a genuinely new scramble.
 */
export async function generateSq1ShapeScramble(
  request: Sq1ShapeScrambleRequest,
  nextScramble: (caseIndex: number) => Promise<string> = cstimerSq1ShapeScramble,
): Promise<Sq1GeneratedShapeScramble> {
  const caseIndex = SQ1_CSP_INDEX_BY_PAIR.get(request.pairKey);
  if (caseIndex == null || request.allowedOrientations.length === 0) {
    throw new Error('No legal Square-1 shape orientation is available');
  }
  const previous = request.previousScramble ? canonicalSq1Alg(request.previousScramble) : '';

  for (let attempt = 0; attempt < 96; attempt++) {
    const scramble = canonicalSq1Alg(await nextScramble(caseIndex));
    if (!scramble || scramble === previous) continue;
    const state = applySq1Scramble(scramble);
    const shapes = sq1StateShapes(state);
    if (!shapes.top || !shapes.bottom) continue;
    const top = shapes.top.name;
    const bottom = shapes.bottom.name;
    if (sq1ShapePairKey(top, bottom) !== request.pairKey) continue;
    if (!request.allowedOrientations.some((orientation) =>
      orientation.top === top && orientation.bottom === bottom,
    )) continue;

    const parity = sq1ParityAtDefaultLayerPositions(state);
    if (!parity || (request.parity && parity !== request.parity)) continue;
    const middleFlipped = !state.sliceSolved;
    if (request.middle === 'never' && middleFlipped) continue;
    if (request.middle === 'always' && !middleFlipped) continue;
    return { scramble, top, bottom, parity, middleFlipped, state };
  }

  throw new Error('Could not generate a Square-1 scramble matching the selected options');
}

const SQ1_CORNER_IDS = [0, 2, 4, 6, 9, 11, 13, 15] as const;
const SQ1_EDGE_IDS = [1, 3, 5, 7, 8, 10, 12, 14] as const;

/** Build a drawable state for one canonical layer shape without duplicating the SVG engine. */
export function sq1ShapePreviewState(shape: Sq1ShapeDefinition, rotation = 0): Sq1State {
  let cornerIndex = 0;
  let edgeIndex = 0;
  const top: number[] = [];
  for (const piece of shape.pattern) {
    if (piece === 'c') {
      const id = SQ1_CORNER_IDS[cornerIndex++];
      top.push(id, id);
    } else {
      top.push(SQ1_EDGE_IDS[edgeIndex++]);
    }
  }

  const bottom = [
    ...SQ1_CORNER_IDS.slice(cornerIndex).flatMap((id) => [id, id]),
    ...SQ1_EDGE_IDS.slice(edgeIndex),
  ];
  return { pieces: [...rotateSlots(top, rotation), ...bottom], sliceSolved: true };
}

function piecesCrossed(pattern: string, amount: number): number | null {
  if (amount === 0) return 0;
  const values = [...pattern].map((piece) => piece === 'c' ? 2 : 1);
  const travel = Math.abs(amount);
  const ordered = amount > 0 ? [...values].reverse() : values;
  let sum = 0;
  for (let index = 0; index < ordered.length; index++) {
    sum += ordered[index];
    if (sum === travel) return index + 1;
    if (sum > travel) return null;
  }
  return null;
}

/**
 * Sliceable top-layer count positions split into Squanmate's two invariant groups.
 * A rotation changes groups exactly when it moves an odd number of physical pieces past the cut.
 */
export function sq1CountPositionGroups(
  shape: Sq1ShapeDefinition,
  referenceRotation = 0,
): [number[], number[]] {
  const slots = expandShape(shape.pattern);
  const groups: [number[], number[]] = [[], []];
  for (let amount = -5; amount <= 6; amount++) {
    const crossed = piecesCrossed(shape.pattern, amount);
    if (crossed == null) continue;
    const rotated = rotateSlots(slots, amount);
    if (rotated[11] === rotated[0] || rotated[5] === rotated[6]) continue;
    groups[crossed % 2].push(amount);
  }
  if (referenceRotation === 0) return groups;
  const relative = (amount: number) => ((amount - referenceRotation + 5) % 12 + 12) % 12 - 5;
  return groups.map((values) => values.map(relative).sort((a, b) => a - b)) as [number[], number[]];
}
