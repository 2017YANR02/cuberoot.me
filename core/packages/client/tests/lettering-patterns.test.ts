import { describe, expect, it } from 'vitest';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import {
  availableLetteringGlyphs,
  buildLetteringAlg,
  buildLetteringSegments,
  buildPatternSegments,
  buildLetteringWordAlg,
  getLetteringPattern,
  getLetteringWordPattern,
  LETTERING_GLYPHS,
  LETTERING_ORDER,
  LETTERING_ORDERS,
  type LetteringGlyph,
  type LetteringOrder,
} from '@/app/[lang]/lettering/_lib/lettering-alg';
import { createCharacterPlan, fitsCharacterInput, validateCharacter, requiredPatternSize, preservesCharacter } from '@/app/[lang]/lettering/_lib/character-pattern';

function expectSolvedBorders(state: string, solved: string, order: number) {
  const border = (value: string) => Array.from({ length: 6 }, (_, face) => {
    const cells: string[] = [];
    for (let row = 0; row < order; row++) for (let column = 0; column < order; column++) {
      if (row === 0 || column === 0 || row === order - 1 || column === order - 1) {
        cells.push(value[face * order * order + row * order + column]);
      }
    }
    return cells.join('');
  });
  expect(border(state)).toEqual(border(solved));
}

function frontFace(alg: string, order: LetteringOrder): string[] {
  const cube = new Cube(order);
  const solved = cube.serialize();
  cube.twister.setup(alg);
  const state = cube.serialize();
  expectSolvedBorders(state, solved, order);
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
  it('limits committed input by visible characters rather than UTF-16 length', () => {
    for (const value of ['', '王', 'A', '♥️', '𠮷']) expect(fitsCharacterInput(value)).toBe(true);
    for (const value of ['王生', 'AB', '♥️★', '𠮷王', '王 ']) expect(fitsCharacterInput(value)).toBe(false);
  });
  it('validates single characters and the preview resolution policy', () => {
    for (const input of ['', 'AB', '你好', '1', '♥★', '👨‍👩‍👧']) expect(validateCharacter(input, 21)).toEqual({ code: 'input' });
    for (const input of ['♥', '♥️', '★']) expect(validateCharacter(input, 7)).toBeNull();
    expect(validateCharacter('A', 7)).toBeNull();
    expect(validateCharacter('a', 9)).toBeNull();
    expect(validateCharacter('福', 15)).toBeNull();
    expect(validateCharacter('福', 17)).toBeNull();
    expect(validateCharacter('工', 5)).toBeNull();
  });

  it('distinguishes simple strokes from dense patterns and rejects lost holes', () => {
    const simple = ['11111', '00000', '00000', '00000', '11111'];
    expect(requiredPatternSize(simple)).toBe(5);
    expect(preservesCharacter(simple, simple)).toBe(true);
    expect(preservesCharacter(simple, ['11111', '00000', '00000', '00000', '00000'])).toBe(false);
    const dense = Array.from({ length: 11 }, () => '10101010101');
    expect(requiredPatternSize(dense)).toBe(11);
    expect(preservesCharacter(dense, ['10101', '10101', '10101', '10101', '10101'])).toBe(false);
    const enclosed = ['11111', '10001', '10001', '10001', '11111'];
    expect(preservesCharacter(enclosed, Array(5).fill('11111'))).toBe(false);
  });

  it('builds asymmetric arbitrary grids including centre holes from legal moves', () => {
    for (const order of LETTERING_ORDERS) {
      const size = order - 2;
      const pattern = Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) =>
        (row * 7 + col * 3) % 11 < 4 ? '1' : '0').join(''));
      const alg = buildPatternSegments(pattern, order).join(' ');
      expect(frontFace(alg, order)).toEqual(expectedPatternFront(pattern, order));
    }
  });
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

  it('offers sheng and shi only from order nine', () => {
    expect(availableLetteringGlyphs(5)).not.toContain('生');
    expect(availableLetteringGlyphs(5)).not.toContain('世');
    expect(availableLetteringGlyphs(7)).not.toContain('生');
    expect(availableLetteringGlyphs(7)).not.toContain('世');
    expect(availableLetteringGlyphs(9)).toContain('生');
    expect(availableLetteringGlyphs(9)).toContain('世');
  });

  it('rejects undersized sheng and shi instead of using outer edges', () => {
    for (const glyph of ['生', '世'] as const) {
      expect(createCharacterPlan(glyph, 7)).toEqual({ code: 'order', minimum: 9 });
      expect(() => getLetteringPattern(glyph, 7)).toThrow();
      expect(() => buildLetteringAlg(glyph, 7)).toThrow();
      expect(getLetteringPattern(glyph, 9)).toEqual(LETTERING_GLYPHS[glyph]);
    }
  });

  it('rejects full-face grids and preserves borders even for fully filled centre grids', () => {
    for (const order of LETTERING_ORDERS) {
      expect(() => buildPatternSegments(Array(order).fill('1'.repeat(order)), order)).toThrow();
      const pattern = Array(order - 2).fill('1'.repeat(order - 2));
      expect(frontFace(buildPatternSegments(pattern, order).join(' '), order)).toEqual(expectedPatternFront(pattern, order));
    }
  });

  it('moves sheng up one row from order thirteen', () => {
    expect(getLetteringPattern('生', 11).at(-1)).not.toBe('0'.repeat(9));
    for (const order of [13, 15, 17, 19, 21] as const) {
      expect(getLetteringPattern('生', order).at(-1)).toBe('0'.repeat(order - 2));
    }
  });

  for (const glyph of availableLetteringGlyphs(LETTERING_ORDER)) {
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

  for (const order of [17, 19, 21] as const) {
    it(`builds 一生一世 on ${order}x${order}`, () => {
      const pattern = getLetteringWordPattern('一生一世', order);
      const alg = buildLetteringWordAlg('一生一世', order);
      expect(pattern).toHaveLength(order - 2);
      expect(frontFace(alg, order)).toEqual(expectedPatternFront(pattern, order));
    });
  }
});
