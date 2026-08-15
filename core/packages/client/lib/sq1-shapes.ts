import type { Sq1State } from '@cuberoot/shared/sq1-notation';

export interface Sq1ShapeDefinition {
  /** Stable Squanmate-style key used in URL state and tool controls. */
  id: string;
  /** Existing drawing-tool preset id; retained so saved links do not break. */
  drawId: string;
  /** Name published by Squanmate. */
  sourceName: string;
  /** CubeRoot display name: only Left / Right are shortened to L / R. */
  name: string;
  /** Clockwise piece-type order from Squanmate (`c` corner, `e` edge). */
  pattern: string;
  /** Orientation used by the existing SQ1 drawing presets. */
  drawPattern: string;
}

/**
 * Squanmate's 29 single-layer shapes, in the order shown on its All shapes page.
 * This is the single source for SQ1 shape names in the guide, trainer and tools.
 */
export const SQ1_SHAPES = [
  { id: 'four-four', drawId: '44', sourceName: '4-4', name: '4-4', pattern: 'eceeeeceee', drawPattern: 'eeceeeecee' },
  { id: 'five-three', drawId: '53', sourceName: '5-3', name: '5-3', pattern: 'eceeeeecee', drawPattern: 'eeceeeceee' },
  { id: 'six-two', drawId: '62', sourceName: '6-2', name: '6-2', pattern: 'ceeeeeecee', drawPattern: 'eeeceeceee' },
  { id: 'seven-one', drawId: '71', sourceName: '7-1', name: '7-1', pattern: 'ceeeeeeece', drawPattern: 'eeececeeee' },
  { id: 'eight', drawId: '8', sourceName: '8', name: '8', pattern: 'ceeeeeeeec', drawPattern: 'eeeecceeee' },
  { id: 'two-two-two', drawId: '222', sourceName: '2-2-2', name: '2-2-2', pattern: 'eeceeceec', drawPattern: 'ceeceecee' },
  { id: 'three-three', drawId: '33', sourceName: '3-3', name: '3-3', pattern: 'eecceeece', drawPattern: 'eeeceeecc' },
  { id: 'three-two-one', drawId: '321', sourceName: '3-2-1', name: '3-2-1', pattern: 'eeeceecec', drawPattern: 'ececeeece' },
  { id: 'three-one-two', drawId: '312', sourceName: '3-1-2', name: '3-1-2', pattern: 'ceeceeece', drawPattern: 'eeececeec' },
  { id: 'left-four-two', drawId: '42l', sourceName: 'Left 4-2', name: 'L 4-2', pattern: 'ceeeeceec', drawPattern: 'ceecceeee' },
  { id: 'right-four-two', drawId: '42r', sourceName: 'Right 4-2', name: 'R 4-2', pattern: 'ceeceeeec', drawPattern: 'eeeecceec' },
  { id: 'four-one-one', drawId: '411', sourceName: '4-1-1', name: '4-1-1', pattern: 'eceeeecec', drawPattern: 'ecececeee' },
  { id: 'left-five-one', drawId: '51l', sourceName: 'Left 5-1', name: 'L 5-1', pattern: 'ceeeeecec', drawPattern: 'ececceeee' },
  { id: 'right-five-one', drawId: '51r', sourceName: 'Right 5-1', name: 'R 5-1', pattern: 'ceceeeeec', drawPattern: 'eeeeccece' },
  { id: 'six', drawId: '6', sourceName: '6', name: '6', pattern: 'ceeeeeecc', drawPattern: 'eeccceeee' },
  { id: 'square', drawId: 'square', sourceName: 'Square', name: 'Square', pattern: 'cececece', drawPattern: 'ecececec' },
  { id: 'kite', drawId: 'kite', sourceName: 'Kite', name: 'Kite', pattern: 'ceceecec', drawPattern: 'ececcece' },
  { id: 'barrel', drawId: 'barrel', sourceName: 'Barrel', name: 'Barrel', pattern: 'ceecceec', drawPattern: 'ceecceec' },
  { id: 'shield', drawId: 'shield', sourceName: 'Shield', name: 'Shield', pattern: 'eeccceec', drawPattern: 'eeccceec' },
  { id: 'left-fist', drawId: 'left-fist', sourceName: 'Left fist', name: 'L fist', pattern: 'cececeec', drawPattern: 'ceeccece' },
  { id: 'right-fist', drawId: 'right-fist', sourceName: 'Right fist', name: 'R fist', pattern: 'ceececec', drawPattern: 'ececceec' },
  { id: 'left-pawn', drawId: 'left-paw', sourceName: 'Left pawn', name: 'L pawn', pattern: 'cceeecec', drawPattern: 'ececccee' },
  { id: 'right-pawn', drawId: 'right-paw', sourceName: 'Right pawn', name: 'R pawn', pattern: 'ceceeecc', drawPattern: 'eecccece' },
  { id: 'mushroom', drawId: 'mushroom', sourceName: 'Mushroom', name: 'Mushroom', pattern: 'cceeecce', drawPattern: 'ecceccee' },
  { id: 'scallop', drawId: 'scallop', sourceName: 'Scallop', name: 'Scallop', pattern: 'cceeeecc', drawPattern: 'eeccccee' },
  { id: 'paired-edges', drawId: 'twins', sourceName: 'Paired edges', name: 'Paired edges', pattern: 'cccccee', drawPattern: 'cceeccc' },
  { id: 'perpendicular-edges', drawId: 'l', sourceName: 'Perpendicular edges', name: 'Perpendicular edges', pattern: 'ccccece', drawPattern: 'cececcc' },
  { id: 'parallel-edges', drawId: 'i', sourceName: 'Parallel edges', name: 'Parallel edges', pattern: 'cccecce', drawPattern: 'ecceccc' },
  { id: 'star', drawId: 'star', sourceName: 'Star', name: 'Star', pattern: 'cccccc', drawPattern: 'cccccc' },
] as const satisfies readonly Sq1ShapeDefinition[];

export type Sq1ShapeId = (typeof SQ1_SHAPES)[number]['id'];

export const SQ1_SHAPE_NAMES = SQ1_SHAPES.map((shape) => shape.name);

const SHAPE_BY_ID = new Map<string, Sq1ShapeDefinition>(
  SQ1_SHAPES.flatMap((shape) => [[shape.id, shape], [shape.drawId, shape]]),
);

export function sq1ShapeById(id: string): Sq1ShapeDefinition | undefined {
  return SHAPE_BY_ID.get(id);
}

/** Normalize historical CubeRoot / CubeZone labels to the Squanmate naming table. */
export function displaySq1ShapeName(name: string): string {
  return name
    .replace(/\bLeft\b/gi, 'L')
    .replace(/\bRight\b/gi, 'R')
    .replace(/\bMuffin\b/gi, 'Mushroom')
    .replace(/\bPawns?\b|\bPaw\b/gi, 'pawn')
    .replace(/\bFist\b/gi, 'fist')
    .replace(/\bPaired Edges\b/gi, 'Paired edges')
    .replace(/\bPerpendicular Edges\b/gi, 'Perpendicular edges')
    .replace(/\bParallel Edges\b/gi, 'Parallel edges')
    .replace(/\bPair\b/gi, 'Paired edges');
}

function isCyclicMatch(a: string, b: string): boolean {
  return a.length === b.length && `${a}${a}`.includes(b);
}

export function sq1ShapeByPattern(pattern: string): Sq1ShapeDefinition | undefined {
  return SQ1_SHAPES.find((shape) => isCyclicMatch(shape.pattern, pattern));
}

/** Convert one 12-wedge layer from Sq1State into a cyclic `c` / `e` pattern. */
export function sq1LayerPattern(slots: readonly number[]): string | null {
  if (slots.length !== 12) return null;
  const start = slots.findIndex((piece, index) => piece !== slots[(index + 11) % 12]);
  if (start < 0) return null;

  let pattern = '';
  let consumed = 0;
  while (consumed < 12) {
    const index = (start + consumed) % 12;
    const corner = slots[index] === slots[(index + 1) % 12];
    pattern += corner ? 'c' : 'e';
    consumed += corner ? 2 : 1;
  }
  return consumed === 12 ? pattern : null;
}

export function sq1StateShapes(state: Sq1State): {
  top: Sq1ShapeDefinition | undefined;
  bottom: Sq1ShapeDefinition | undefined;
} {
  const topPattern = sq1LayerPattern(state.pieces.slice(0, 12));
  const bottomPattern = sq1LayerPattern(state.pieces.slice(12, 24));
  return {
    top: topPattern ? sq1ShapeByPattern(topPattern) : undefined,
    bottom: bottomPattern ? sq1ShapeByPattern(bottomPattern) : undefined,
  };
}
