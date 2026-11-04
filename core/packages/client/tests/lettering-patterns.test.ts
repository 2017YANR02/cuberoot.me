import { describe, expect, it } from 'vitest';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import {
  availableLetteringGlyphs,
  buildLetteringAlg,
  buildLetteringSegments,
  buildLetteringWordAlg,
  getLetteringPattern,
  getLetteringWordPattern,
  LETTERING_GLYPHS,
  LETTERING_ORDER,
  LETTERING_ORDERS,
  type LetteringGlyph,
  type LetteringOrder,
} from '@/app/[lang]/lettering/_lib/lettering-alg';

function frontFace(alg: string, order: LetteringOrder): string[] {
  const cube = new Cube(order);
  cube.twister.setup(alg);
  const state = cube.serialize();
  const faceArea = order * order;
  const front = state.slice(2 * faceArea, 3 * faceArea);
  cube.dispose();
  return Array.from(
    { length: order },
    (_, row) => front.slice(row * order, (row + 1) * order),
  );
}

function cubeState(alg: string, order: LetteringOrder): string {
  const cube = new Cube(order);
  cube.twister.setup(alg);
  const state = cube.serialize();
  cube.dispose();
  return state;
}

function expectedFront(glyph: LetteringGlyph, order: LetteringOrder): string[] {
  return expectedPatternFront(getLetteringPattern(glyph, order), order);
}

function expectedPatternFront(pattern: readonly string[], order: LetteringOrder): string[] {
  const offset = (order - pattern.length) / 2;
  return Array.from({ length: order }, (_, row) => {
    return Array.from({ length: order }, (__, column) => {
      const patternRow = row - offset;
      const patternColumn = column - offset;
      return patternRow >= 0
        && patternRow < pattern.length
        && patternColumn >= 0
        && patternColumn < pattern.length
        && pattern[patternRow][patternColumn] === '1'
        ? 'D'
        : 'F';
    }).join('');
  });
}

describe('cube lettering construction', () => {
  it('can batch parallel centre columns into one row commutator', () => {
    const rowAlg = [
      '6-6R', '5-5R', '4-4R', '3-3R', '2-2R',
      '2-2U',
      "2-2R'", "3-3R'", "4-4R'", "5-5R'", "6-6R'",
      "2-2U'",
    ].join(' ');
    expect(frontFace(rowAlg, 7)).toEqual([
      'FFFFFFF',
      'FDDDDDF',
      'FFFFFFF',
      'FFFFFFF',
      'FFFFFFF',
      'FFFFFFF',
      'FFFFFFF',
    ]);
    expect(cubeState('2-6R 2-2U 2-6R\' 2-2U\'', 7)).toBe(cubeState(rowAlg, 7));
  });

  it('can batch parallel centre rows into one column commutator', () => {
    const columnAlg = [
      '4-4R',
      '2-2U', '3-3U', '4-4U', '5-5U', '6-6U',
      "4-4R'",
      "6-6U'", "5-5U'", "4-4U'", "3-3U'", "2-2U'",
    ].join(' ');
    expect(frontFace(columnAlg, 7)).toEqual([
      'FFFFFFF',
      'FFFDFFF',
      'FFFDFFF',
      'FFFDFFF',
      'FFFDFFF',
      'FFFDFFF',
      'FFFFFFF',
    ]);
    expect(cubeState('4-4R 2-6U 4-4R\' 2-6U\'', 7)).toBe(cubeState(columnAlg, 7));
  });

  it('can fill a rectangular centre block with two grouped ranges', () => {
    expect(frontFace('2-6R 2-3U 2-6R\' 2-3U\'', 7)).toEqual([
      'FFFFFFF',
      'FDDDDDF',
      'FDDDDDF',
      'FFFFFFF',
      'FFFFFFF',
      'FFFFFFF',
      'FFFFFFF',
    ]);
  });

  it('scales glyphs to fill each higher-order centre grid', () => {
    for (const order of LETTERING_ORDERS) {
      const glyph: LetteringGlyph = order === 5 ? '工' : '王';
      expect(getLetteringPattern(glyph, order)).toHaveLength(order - 2);
      expect(getLetteringPattern(glyph, order).every(row => row.length === order - 2)).toBe(true);
    }
  });

  it('keeps high-order strokes one cell wide', () => {
    const pattern = getLetteringPattern('王', 21);
    expect(pattern.filter(row => row === '1'.repeat(19))).toHaveLength(3);
  });

  it('keeps the requested seven-cell sheng and shi definitions', () => {
    expect(LETTERING_GLYPHS['生']).toEqual([
      '0000000',
      '0101000',
      '0111110',
      '1001000',
      '0011100',
      '0001000',
      '0111110',
    ]);
    expect(LETTERING_GLYPHS['世']).toEqual([
      '0000000',
      '0101010',
      '1111111',
      '0101010',
      '0101110',
      '0100000',
      '0111110',
    ]);
  });

  it('offers sheng and shi from order seven', () => {
    expect(availableLetteringGlyphs(5)).not.toContain('生');
    expect(availableLetteringGlyphs(5)).not.toContain('世');
    expect(availableLetteringGlyphs(7)).toContain('生');
    expect(availableLetteringGlyphs(7)).toContain('世');
  });

  it('uses the full requested seven-order sheng and shi patterns', () => {
    expect(getLetteringPattern('生', 7)).toEqual([
      '0000000',
      '0101000',
      '0111110',
      '1001000',
      '0011100',
      '0001000',
      '0111110',
    ]);
    expect(getLetteringPattern('世', 7)).toEqual([
      '0000000',
      '0101010',
      '1111111',
      '0101010',
      '0101110',
      '0100000',
      '0111110',
    ]);
  });

  it('moves sheng up one row from order thirteen', () => {
    expect(getLetteringPattern('生', 11).at(-1)).not.toBe('0'.repeat(9));
    for (const order of [13, 15, 17, 19, 21] as const) {
      expect(getLetteringPattern('生', order).at(-1)).toBe('0'.repeat(order - 2));
    }
  });

  for (const glyph of Object.keys(LETTERING_GLYPHS) as LetteringGlyph[]) {
    it(`builds ${glyph} from legal 7x7 turns`, () => {
      const segments = buildLetteringSegments(glyph);
      expect(segments.every(segment => segment.trim().split(/\s+/).length >= 4)).toBe(true);
      expect(frontFace(buildLetteringAlg(glyph), LETTERING_ORDER)).toEqual(expectedFront(glyph, LETTERING_ORDER));
    });
  }

  for (const order of LETTERING_ORDERS) {
    it(`builds every available pattern on ${order}x${order}`, () => {
      for (const glyph of availableLetteringGlyphs(order)) {
        const pattern = getLetteringPattern(glyph, order);
        const pixelMoves = pattern.join('').replaceAll('0', '').length * 4;
        const alg = buildLetteringAlg(glyph, order);
        expect(alg.split(/\s+/).length).toBeLessThanOrEqual(pixelMoves);
        expect(frontFace(alg, order)).toEqual(expectedFront(glyph, order));
      }
    });
  }

  for (const order of [17, 21] as const) {
    it(`builds 一生一世 on ${order}x${order}`, () => {
      const pattern = getLetteringWordPattern('一生一世', order);
      const alg = buildLetteringWordAlg('一生一世', order);
      expect(pattern).toHaveLength(order - 2);
      expect(frontFace(alg, order)).toEqual(expectedPatternFront(pattern, order));
    });
  }
});
