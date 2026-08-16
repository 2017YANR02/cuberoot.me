import type { Sq1State } from '@cuberoot/shared/sq1-notation';
import {
  SQ1_SHAPES,
  type Sq1ShapeDefinition,
} from '@cuberoot/shared/sq1-shapes';

export {
  SQ1_SHAPES,
  SQ1_SHAPE_NAMES,
  canonicalSq1CsCaseKey,
  canonicalSq1CsCaseName,
  canonicalSq1ShapeSourceName,
  displaySq1ShapeName,
  type Sq1ShapeDefinition,
  type Sq1ShapeId,
} from '@cuberoot/shared/sq1-shapes';

const SHAPE_BY_ID = new Map<string, Sq1ShapeDefinition>(
  SQ1_SHAPES.flatMap((shape) => [[shape.id, shape], [shape.drawId, shape]]),
);

export function sq1ShapeById(id: string): Sq1ShapeDefinition | undefined {
  return SHAPE_BY_ID.get(id);
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
