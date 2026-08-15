import { describe, expect, it } from 'vitest';
import { applySq1Scramble } from '@cuberoot/shared/sq1-notation';
import {
  SQ1_SHAPES,
  displaySq1ShapeName,
  sq1ShapeByPattern,
  sq1StateShapes,
} from '@/lib/sq1-shapes';
import {
  inferSq1CubeshapeStart,
  isSq1Sliceable,
  sq1CountPositionGroups,
  sq1ShapePreviewState,
  traceSq1Algorithm,
} from '@/lib/sq1-tools';

describe('SQ1 shape definitions', () => {
  it('keeps the complete Squanmate list and unique stable keys', () => {
    expect(SQ1_SHAPES).toHaveLength(29);
    expect(new Set(SQ1_SHAPES.map((shape) => shape.id)).size).toBe(29);
    expect(new Set(SQ1_SHAPES.map((shape) => shape.name)).size).toBe(29);
  });

  it('matches every shape after cyclic rotations', () => {
    for (const shape of SQ1_SHAPES) {
      const rotated = shape.pattern.slice(2) + shape.pattern.slice(0, 2);
      expect(sq1ShapeByPattern(rotated)?.id).toBe(shape.id);
    }
  });

  it('recognizes solved layers as square', () => {
    const shapes = sq1StateShapes(applySq1Scramble(''));
    expect(shapes.top?.name).toBe('Square');
    expect(shapes.bottom?.name).toBe('Square');
  });

  it('normalizes historical labels and uses L / R', () => {
    expect(displaySq1ShapeName('Right Paw')).toBe('R pawn');
    expect(displaySq1ShapeName('Left Muffin')).toBe('L Mushroom');
    expect(displaySq1ShapeName('Pair')).toBe('Paired edges');
  });

  it('matches Squanmate count-position fixtures', () => {
    const groups = (id: string) => {
      const shape = SQ1_SHAPES.find((item) => item.id === id)!;
      return sq1CountPositionGroups(shape).map((group) => [...group].sort((a, b) => a - b));
    };
    expect(groups('square')).toEqual([[-3, 0, 3, 6], [-5, -2, 1, 4]]);
    expect(groups('barrel')).toEqual([[-3, 0, 3, 6], [-4, -2, 2, 4]]);
    expect(groups('mushroom')).toEqual([[0, 6], [-5, 1]]);
  });

  it('renders every count-position shape relative to the selected slice position', () => {
    for (const shape of SQ1_SHAPES) {
      const positions = sq1CountPositionGroups(shape).flat();
      for (const position of positions) {
        expect(sq1StateShapes(sq1ShapePreviewState(shape, position)).top?.id).toBe(shape.id);
        expect(sq1CountPositionGroups(shape, position).flat()).toContain(0);
      }
    }
  });

  it('rejects unknown notation and impossible slices', () => {
    expect(traceSq1Algorithm('hello')).toEqual({ ok: false, reason: 'invalid-notation' });
    const result = traceSq1Algorithm('(2, 0) /');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unsliceable');
  });

  it('requires a sliceable final state before reporting parity', () => {
    expect(isSq1Sliceable(applySq1Scramble('(2, 0)'))).toBe(false);
    expect(isSq1Sliceable(applySq1Scramble(''))).toBe(true);
  });

  it('imports cubeshape algorithms ending in either supported cube alignment', () => {
    const aligned = inferSq1CubeshapeStart('/');
    expect(aligned.ok).toBe(true);
    if (aligned.ok) {
      const shapes = sq1StateShapes(aligned.start);
      expect([shapes.top?.name, shapes.bottom?.name]).toEqual(['Kite', 'Kite']);
    }

    const offset = inferSq1CubeshapeStart('/-2/-3/');
    expect(offset.ok).toBe(true);
    if (offset.ok) {
      const shapes = sq1StateShapes(offset.start);
      expect([shapes.top?.name, shapes.bottom?.name]).toEqual(['Mushroom', 'Square']);
      expect(offset.setup.startsWith('(1, -1)')).toBe(true);
    }
  });

  it('rejects genuinely invalid cubeshape input', () => {
    expect(inferSq1CubeshapeStart('not an algorithm')).toMatchObject({
      ok: false,
      error: { reason: 'invalid-notation' },
    });
  });
});
