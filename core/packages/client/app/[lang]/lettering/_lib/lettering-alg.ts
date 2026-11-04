export const LETTERING_ORDER = 7;

export const LETTERING_ORDERS = [5, 7, 9, 11, 13, 15, 17, 19, 21] as const;

export type LetteringOrder = typeof LETTERING_ORDERS[number];

export const LETTERING_GLYPHS = {
  '一': ['0000000', '0000000', '0000000', '1111111', '0000000', '0000000', '0000000'],
  '王': ['11111', '00100', '11111', '00100', '11111'],
  '中': ['00100', '11111', '10101', '11111', '00100'],
  '十': ['00100', '00100', '11111', '00100', '00100'],
  '山': ['00100', '10101', '10101', '10101', '11111'],
  '田': ['11111', '10101', '11111', '10101', '11111'],
  '口': ['11111', '10001', '10001', '10001', '11111'],
  '工': ['11111', '00100', '00100', '00100', '11111'],
  '生': ['0000000', '0101000', '0111110', '1001000', '0011100', '0001000', '0111110'],
  '世': ['0000000', '0101010', '1111111', '0101010', '0101110', '0100000', '0111110'],
} as const;

export type LetteringGlyph = keyof typeof LETTERING_GLYPHS;

export const LETTERING_WORDS = {
  '一生一世': ['一', '生', '一', '世'],
} as const satisfies Record<string, readonly LetteringGlyph[]>;

export type LetteringWord = keyof typeof LETTERING_WORDS;

export const LETTERING_WORD_MIN_ORDER: LetteringOrder = 17;

const COMPACT_LETTERING_GLYPHS = {
  '工': ['111', '010', '111'],
  '十': ['010', '111', '010'],
} as const satisfies Partial<Record<LetteringGlyph, readonly string[]>>;

export function availableLetteringGlyphs(order: LetteringOrder): LetteringGlyph[] {
  return order === 5
    ? Object.keys(COMPACT_LETTERING_GLYPHS) as LetteringGlyph[]
    : Object.keys(LETTERING_GLYPHS) as LetteringGlyph[];
}

function scalePattern(pattern: readonly string[], targetSize: number): string[] {
  if (pattern.length === targetSize) return [...pattern];
  const sourceSize = pattern.length;
  if (targetSize > sourceSize) {
    const canvas = Array.from({ length: targetSize }, () => Array<string>(targetSize).fill('0'));
    const scaledIndex = (sourceIndex: number) => Math.round(
      sourceIndex * (targetSize - 1) / (sourceSize - 1),
    );
    const drawLine = (startRow: number, startColumn: number, endRow: number, endColumn: number) => {
      const length = Math.max(Math.abs(endRow - startRow), Math.abs(endColumn - startColumn));
      for (let step = 0; step <= length; step++) {
        const row = Math.round(startRow + (endRow - startRow) * step / Math.max(1, length));
        const column = Math.round(startColumn + (endColumn - startColumn) * step / Math.max(1, length));
        canvas[row][column] = '1';
      }
    };
    const neighbours = [[0, 1], [1, -1], [1, 0], [1, 1]] as const;
    pattern.forEach((line, row) => {
      [...line].forEach((pixel, column) => {
        if (pixel !== '1') return;
        const startRow = scaledIndex(row);
        const startColumn = scaledIndex(column);
        canvas[startRow][startColumn] = '1';
        for (const [rowDelta, columnDelta] of neighbours) {
          const nextRow = row + rowDelta;
          const nextColumn = column + columnDelta;
          if (pattern[nextRow]?.[nextColumn] !== '1') continue;
          if (
            rowDelta !== 0
            && columnDelta !== 0
            && (pattern[row]?.[nextColumn] === '1' || pattern[nextRow]?.[column] === '1')
          ) continue;
          drawLine(startRow, startColumn, scaledIndex(nextRow), scaledIndex(nextColumn));
        }
      });
    });
    return canvas.map(row => row.join(''));
  }
  const sourceIndex = (targetIndex: number) => Math.min(
    sourceSize - 1,
    Math.floor((targetIndex + 0.5) * sourceSize / targetSize),
  );
  return Array.from({ length: targetSize }, (_, row) => {
    const sourceRow = pattern[sourceIndex(row)];
    return Array.from(
      { length: targetSize },
      (__, column) => sourceRow[sourceIndex(column)],
    ).join('');
  });
}

export function getLetteringPattern(glyph: LetteringGlyph, order: LetteringOrder): readonly string[] {
  if (order === 5) {
    const pattern = COMPACT_LETTERING_GLYPHS[glyph as keyof typeof COMPACT_LETTERING_GLYPHS];
    if (!pattern) throw new Error(`${glyph} has no compact lettering pattern`);
    return pattern;
  }
  if (order === 7 && (glyph === '生' || glyph === '世')) return LETTERING_GLYPHS[glyph];
  const pattern = scalePattern(LETTERING_GLYPHS[glyph], order - 2);
  if (glyph === '生' && order >= 13) {
    return [...pattern.slice(1), '0'.repeat(pattern.length)];
  }
  return pattern;
}

export function getLetteringWordPattern(word: LetteringWord, order: LetteringOrder): readonly string[] {
  if (order < LETTERING_WORD_MIN_ORDER) {
    throw new Error(`${word} requires order ${LETTERING_WORD_MIN_ORDER} or larger`);
  }
  const canvasSize = order - 2;
  const gap = 1;
  const glyphSize = Math.floor((canvasSize - gap) / 2);
  const canvas = Array.from({ length: canvasSize }, () => Array<string>(canvasSize).fill('0'));
  LETTERING_WORDS[word].forEach((glyph, index) => {
    const pattern = scalePattern(LETTERING_GLYPHS[glyph], glyphSize);
    const rowOffset = Math.floor(index / 2) * (glyphSize + gap);
    const columnOffset = (index % 2) * (glyphSize + gap);
    pattern.forEach((line, row) => {
      [...line].forEach((pixel, column) => {
        if (pixel === '1') canvas[rowOffset + row][columnOffset + column] = '1';
      });
    });
  });
  return canvas.map(row => row.join(''));
}

function inverseMoves(moves: readonly string[]): string[] {
  return [...moves].reverse().map(move => `${move}'`);
}

function groupedLayerMoves(face: 'R' | 'U', depths: readonly number[]): string[] {
  const sorted = [...new Set(depths)].sort((a, b) => a - b);
  const moves: string[] = [];
  for (let index = 0; index < sorted.length;) {
    const start = sorted[index];
    let end = start;
    while (index + 1 < sorted.length && sorted[index + 1] === end + 1) {
      end = sorted[++index];
    }
    moves.push(`${start}-${end}${face}`);
    index++;
  }
  return moves;
}

/**
 * Cycle D-centres into one rectangular block of F-centres on an order-N cube.
 * Parallel R slices commute, as do parallel U slices, so [R-set, U-set]
 * handles a whole block in one commutator. Consecutive depths are compressed
 * into one range turn (for example 2-6R), while separated runs stay separate.
 * A one-pixel line naturally falls back to the original four moves.
 */
function centerBlockAlg(
  order: LetteringOrder,
  rows: readonly number[],
  columns: readonly number[],
): string {
  const rightMoves = groupedLayerMoves('R', columns.map(column => order - column));
  const upMoves = groupedLayerMoves('U', rows.map(row => row + 1));
  return [
    ...rightMoves,
    ...upMoves,
    ...inverseMoves(rightMoves),
    ...inverseMoves(upMoves),
  ].join(' ');
}

function buildPatternSegments(pattern: readonly string[], order: LetteringOrder): string[] {
  const segments: string[] = [];
  const offset = (order - pattern.length) / 2;
  const remaining = new Set<string>();
  pattern.forEach((line, row) => {
    [...line].forEach((pixel, column) => {
      if (pixel === '1') remaining.add(`${row},${column}`);
    });
  });

  while (remaining.size > 0) {
    let bestRows: number[] = [];
    let bestColumns: number[] = [];
    let bestArea = 0;

    const consider = (rows: number[], columns: number[]) => {
      const area = rows.length * columns.length;
      if (area > bestArea) {
        bestRows = rows;
        bestColumns = columns;
        bestArea = area;
      }
    };

    const rowsByColumns = new Map<string, { rows: number[]; columns: number[] }>();
    for (let row = 0; row < pattern.length; row++) {
      const columns = Array.from({ length: pattern.length }, (_, column) => column)
        .filter(column => remaining.has(`${row},${column}`));
      if (columns.length === 0) continue;
      const key = columns.join(',');
      const candidate = rowsByColumns.get(key) ?? { rows: [], columns };
      candidate.rows.push(row);
      rowsByColumns.set(key, candidate);
    }
    for (const candidate of rowsByColumns.values()) consider(candidate.rows, candidate.columns);

    const columnsByRows = new Map<string, { rows: number[]; columns: number[] }>();
    for (let column = 0; column < pattern.length; column++) {
      const rows = Array.from({ length: pattern.length }, (_, row) => row)
        .filter(row => remaining.has(`${row},${column}`));
      if (rows.length === 0) continue;
      const key = rows.join(',');
      const candidate = columnsByRows.get(key) ?? { rows, columns: [] };
      candidate.columns.push(column);
      columnsByRows.set(key, candidate);
    }
    for (const candidate of columnsByRows.values()) consider(candidate.rows, candidate.columns);

    segments.push(centerBlockAlg(
      order,
      bestRows.map(row => offset + row),
      bestColumns.map(column => offset + column),
    ));
    for (const row of bestRows) {
      for (const column of bestColumns) remaining.delete(`${row},${column}`);
    }
  }
  return segments;
}

function buildSevenOrderFullFaceSegments(glyph: '生' | '世'): string[] {
  const pattern = LETTERING_GLYPHS[glyph];
  const segments: string[] = [];

  for (let row = 1; row < 6; row++) {
    const upDepth = row + 1;
    if (pattern[row][0] === '1') {
      segments.push(`7-7R ${upDepth}-${upDepth}U' 7-7R' ${upDepth}-${upDepth}U`);
    }
    if (pattern[row][6] === '1') {
      segments.push(`1-1R ${upDepth}-${upDepth}U 1-1R' ${upDepth}-${upDepth}U'`);
    }
  }

  const bottomColumns = [...pattern[6]]
    .map((pixel, column) => pixel === '1' ? column : -1)
    .filter(column => column > 0 && column < 6);
  if (bottomColumns.length > 0) {
    segments.push(centerBlockAlg(7, [6], bottomColumns));
  }

  const interior = pattern.slice(1, 6).map(line => line.slice(1, 6));
  segments.push(...buildPatternSegments(interior, 7));
  return segments;
}

export function buildLetteringSegments(
  glyph: LetteringGlyph,
  order: LetteringOrder = LETTERING_ORDER,
): string[] {
  if (order === 7 && (glyph === '生' || glyph === '世')) {
    return buildSevenOrderFullFaceSegments(glyph);
  }
  return buildPatternSegments(getLetteringPattern(glyph, order), order);
}

export function buildLetteringAlg(
  glyph: LetteringGlyph,
  order: LetteringOrder = LETTERING_ORDER,
): string {
  return buildLetteringSegments(glyph, order).join(' ');
}

export function buildLetteringWordSegments(word: LetteringWord, order: LetteringOrder): string[] {
  return buildPatternSegments(getLetteringWordPattern(word, order), order);
}

export function buildLetteringWordAlg(word: LetteringWord, order: LetteringOrder): string {
  return buildLetteringWordSegments(word, order).join(' ');
}
