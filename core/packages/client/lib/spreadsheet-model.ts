export type CellAlignment = 'left' | 'center' | 'right';
export type CellNumberFormat = 'general' | 'number' | 'currency' | 'percent';
export type CellFontFamily = 'sans' | 'serif' | 'mono';

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  align?: CellAlignment;
  fill?: string;
  color?: string;
  fontFamily?: CellFontFamily;
  fontSize?: number;
  numberFormat?: CellNumberFormat;
  decimals?: number;
}

export interface SpreadsheetSheet {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  cells: Record<string, string>;
  styles: Record<string, CellStyle>;
  widths: Record<string, number>;
}

export interface CellPoint { row: number; column: number }
export interface CellRange { start: CellPoint; end: CellPoint }

export function columnLabel(index: number): string {
  if (!Number.isInteger(index) || index < 0) throw new Error('Column index must be a non-negative integer');
  let value = index + 1;
  let output = '';
  while (value > 0) {
    value -= 1;
    output = String.fromCharCode(65 + value % 26) + output;
    value = Math.floor(value / 26);
  }
  return output;
}

export function columnIndex(label: string): number {
  if (!/^[A-Z]+$/i.test(label)) throw new Error('Invalid column label');
  let value = 0;
  for (const character of label.toUpperCase()) value = value * 26 + character.charCodeAt(0) - 64;
  return value - 1;
}

export function cellAddress(row: number, column: number): string {
  if (!Number.isInteger(row) || row < 0) throw new Error('Row index must be a non-negative integer');
  return `${columnLabel(column)}${row + 1}`;
}

export function parseCellAddress(address: string): CellPoint | null {
  const match = /^([A-Z]+)([1-9]\d*)$/i.exec(address.trim());
  if (!match) return null;
  return { row: Number(match[2]) - 1, column: columnIndex(match[1]) };
}

export function normalizedRange(range: CellRange): CellRange {
  return {
    start: { row: Math.min(range.start.row, range.end.row), column: Math.min(range.start.column, range.end.column) },
    end: { row: Math.max(range.start.row, range.end.row), column: Math.max(range.start.column, range.end.column) },
  };
}

export function rangeAddresses(range: CellRange): string[] {
  const normalized = normalizedRange(range);
  const output: string[] = [];
  for (let row = normalized.start.row; row <= normalized.end.row; row += 1) {
    for (let column = normalized.start.column; column <= normalized.end.column; column += 1) {
      output.push(cellAddress(row, column));
    }
  }
  return output;
}

export function parseFormulaValue(raw: string): string | number | boolean | null {
  if (!raw) return null;
  if (raw.startsWith('=')) return raw;
  if (/^(true|false)$/i.test(raw)) return raw.toLowerCase() === 'true';
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())) return Number(raw);
  return raw;
}

export function formatCalculatedValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && value && 'type' in value) {
    const type = String((value as { type: unknown }).type);
    const labels: Record<string, string> = {
      DIV_BY_ZERO: '#DIV/0!', NAME: '#NAME?', VALUE: '#VALUE!', NUM: '#NUM!', NA: '#N/A',
      CYCLE: '#CYCLE!', REF: '#REF!', SPILL: '#SPILL!', LIC: '#LIC!', ERROR: '#ERROR!',
    };
    return labels[type] || '#ERROR!';
  }
  return String(value);
}

export function formatSpreadsheetCellValue(
  raw: string,
  calculated: unknown,
  style: CellStyle = {},
  locale = 'en-US',
): string {
  const value = raw.startsWith('=') ? calculated : raw;
  const format = style.numberFormat || 'general';
  if (format === 'general') return raw.startsWith('=') ? formatCalculatedValue(value) : raw;
  if (value === '' || value === null || value === undefined) return '';
  const numeric = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(numeric)) return raw.startsWith('=') ? formatCalculatedValue(value) : raw;
  const defaultDecimals = format === 'currency' ? 2 : format === 'percent' ? 0 : 2;
  const decimals = Math.min(10, Math.max(0, style.decimals ?? defaultDecimals));
  return new Intl.NumberFormat(locale, {
    style: format === 'currency' ? 'currency' : format === 'percent' ? 'percent' : 'decimal',
    currency: format === 'currency' ? 'CNY' : undefined,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numeric);
}

export function sortSpreadsheetRangeRows(
  cells: Record<string, string>,
  styles: Record<string, CellStyle>,
  range: CellRange,
  direction: 'asc' | 'desc',
  locale = 'en-US',
): { cells: Record<string, string>; styles: Record<string, CellStyle> } {
  const normalized = normalizedRange(range);
  const addresses = rangeAddresses(normalized);
  if (addresses.some((address) => (cells[address] || '').startsWith('='))) {
    throw new Error('FORMULA_IN_SORT_RANGE');
  }
  const rows = Array.from(
    { length: normalized.end.row - normalized.start.row + 1 },
    (_, offset) => normalized.start.row + offset,
  );
  const firstColumn = normalized.start.column;
  rows.sort((leftRow, rightRow) => {
    const left = cells[cellAddress(leftRow, firstColumn)] || '';
    const right = cells[cellAddress(rightRow, firstColumn)] || '';
    if (!left && !right) return leftRow - rightRow;
    if (!left) return 1;
    if (!right) return -1;
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    const compared = Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
      ? leftNumber - rightNumber
      : left.localeCompare(right, locale, { numeric: true, sensitivity: 'base' });
    return direction === 'asc' ? compared : -compared;
  });
  const nextCells = { ...cells };
  const nextStyles = { ...styles };
  for (const address of addresses) {
    delete nextCells[address];
    delete nextStyles[address];
  }
  rows.forEach((sourceRow, destinationOffset) => {
    const destinationRow = normalized.start.row + destinationOffset;
    for (let column = normalized.start.column; column <= normalized.end.column; column += 1) {
      const sourceAddress = cellAddress(sourceRow, column);
      const destinationAddress = cellAddress(destinationRow, column);
      if (cells[sourceAddress]) nextCells[destinationAddress] = cells[sourceAddress];
      if (styles[sourceAddress]) nextStyles[destinationAddress] = styles[sourceAddress];
    }
  });
  return { cells: nextCells, styles: nextStyles };
}

export function parseClipboardTable(text: string): string[][] {
  const normalized = text.replace(/\r\n?/g, '\n');
  const lines = normalized.endsWith('\n') ? normalized.slice(0, -1).split('\n') : normalized.split('\n');
  return lines.map((line) => line.split('\t'));
}

export function rangeToTsv(cells: Record<string, string>, range: CellRange): string {
  const normalized = normalizedRange(range);
  const rows: string[] = [];
  for (let row = normalized.start.row; row <= normalized.end.row; row += 1) {
    const values: string[] = [];
    for (let column = normalized.start.column; column <= normalized.end.column; column += 1) {
      values.push(cells[cellAddress(row, column)] || '');
    }
    rows.push(values.join('\t'));
  }
  return rows.join('\n');
}

export function usedBounds(cells: Record<string, string>): { rows: number; columns: number } {
  let rows = 1;
  let columns = 1;
  for (const [address, value] of Object.entries(cells)) {
    if (!value) continue;
    const point = parseCellAddress(address);
    if (!point) continue;
    rows = Math.max(rows, point.row + 1);
    columns = Math.max(columns, point.column + 1);
  }
  return { rows, columns };
}
