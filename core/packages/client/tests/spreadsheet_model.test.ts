import { describe, expect, it } from 'vitest';
import { HyperFormula } from 'hyperformula';
import { calculateSpreadsheetFormulas, rewriteFormulasForSheetRename, rewriteFormulasForStructure } from '@/lib/spreadsheet-formulas';
import {
  cellAddress, columnIndex, columnLabel, formatCalculatedValue, normalizedRange,
  formatSpreadsheetCellValue, parseCellAddress, parseClipboardTable, parseFormulaValue,
  rangeAddresses, rangeToTsv, serializeRange, shiftAddressRecord, shiftSerializedRanges,
  sortSpreadsheetRangeRows, usedBounds, type SpreadsheetSheet,
} from '@/lib/spreadsheet-model';

describe('spreadsheet model', () => {
  it('round-trips A1 addresses across single and multi-letter columns', () => {
    expect([0, 25, 26, 701].map(columnLabel)).toEqual(['A', 'Z', 'AA', 'ZZ']);
    expect(['A', 'Z', 'AA', 'ZZ'].map(columnIndex)).toEqual([0, 25, 26, 701]);
    expect(cellAddress(99, 27)).toBe('AB100');
    expect(parseCellAddress('ab100')).toEqual({ row: 99, column: 27 });
    expect(parseCellAddress('A0')).toBeNull();
  });

  it('normalizes and serializes rectangular selections', () => {
    const range = { start: { row: 2, column: 2 }, end: { row: 1, column: 0 } };
    expect(normalizedRange(range)).toEqual({ start: { row: 1, column: 0 }, end: { row: 2, column: 2 } });
    expect(rangeAddresses(range)).toEqual(['A2', 'B2', 'C2', 'A3', 'B3', 'C3']);
    expect(rangeToTsv({ A2: 'one', B2: '=1+1', C3: 'last' }, range)).toBe('one\t=1+1\t\n\t\tlast');
  });

  it('parses pasted rows and formula engine values without losing text', () => {
    expect(parseClipboardTable('1\t2\r\n3\t4\r\n')).toEqual([['1', '2'], ['3', '4']]);
    expect(parseFormulaValue('001')).toBe(1);
    expect(parseFormulaValue('=SUM(A1:A3)')).toBe('=SUM(A1:A3)');
    expect(parseFormulaValue('hello')).toBe('hello');
    expect(formatCalculatedValue({ type: 'DIV_BY_ZERO' })).toBe('#DIV/0!');
  });

  it('finds the used range while ignoring invalid or empty cells', () => {
    expect(usedBounds({ A1: 'x', Z20: 'y', AA4: '', nope: 'z' })).toEqual({ rows: 20, columns: 26 });
  });

  it('formats numbers with spreadsheet number styles', () => {
    expect(formatSpreadsheetCellValue('0.125', null, { numberFormat: 'percent', decimals: 1 }, 'zh-CN')).toBe('12.5%');
    expect(formatSpreadsheetCellValue('=A1*2', 12.5, { numberFormat: 'currency' }, 'zh-CN')).toContain('12.50');
    expect(formatSpreadsheetCellValue('001', null, {}, 'zh-CN')).toBe('001');
    expect(formatSpreadsheetCellValue('', null, { numberFormat: 'number' }, 'zh-CN')).toBe('');
  });

  it('sorts a selected row range while moving cell styles with each row', () => {
    const sorted = sortSpreadsheetRangeRows(
      { A1: '10', B1: 'ten', A2: '2', B2: 'two', A3: '', B3: 'blank' },
      { B1: { bold: true }, B2: { italic: true } },
      { start: { row: 0, column: 0 }, end: { row: 2, column: 1 } },
      'asc',
    );
    expect(sorted.cells).toMatchObject({ A1: '2', B1: 'two', A2: '10', B2: 'ten', B3: 'blank' });
    expect(sorted.styles).toEqual({ B1: { italic: true }, B2: { bold: true } });
    expect(() => sortSpreadsheetRangeRows(
      { A1: '=SUM(B1:B2)' }, {},
      { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } }, 'asc',
    )).toThrow('FORMULA_IN_SORT_RANGE');
  });

  it('evaluates formulas and cross-sheet references with the production engine', () => {
    const engine = HyperFormula.buildFromSheets({
      Data: [[2], [3], ['=SUM(A1:A2)']],
      Summary: [['=Data!A3*4']],
    }, { licenseKey: 'gpl-v3' });
    expect(engine.getSheetValues(engine.getSheetId('Data')!)[2][0]).toBe(5);
    expect(engine.getSheetValues(engine.getSheetId('Summary')!)[0][0]).toBe(20);
    engine.destroy();
  });

  it('evaluates sparse formulas without allocating the full visible grid', () => {
    const result = calculateSpreadsheetFormulas([{
      id: 'data', name: 'Data', rowCount: 10_000, columnCount: 200,
      cells: { A1000: '5' }, styles: {}, widths: {},
    }, {
      id: 'summary', name: 'Summary', rowCount: 10_000, columnCount: 200,
      cells: { B1: '=Data!A1000*4', B2: '=A9000' }, styles: {}, widths: {},
    }]);
    expect(result.error).toBe('');
    expect(result.values.summary).toMatchObject({ B1: 20, B2: null });
  });

  it('rewrites cross-sheet formulas when their referenced sheet is renamed', () => {
    const sheets = [{
      id: 'old', name: 'Old data', rowCount: 100, columnCount: 26,
      cells: { A1: '4' }, styles: {}, widths: {},
    }, {
      id: 'summary', name: 'Summary', rowCount: 100, columnCount: 26,
      cells: { A1: "='Old data'!A1*2" }, styles: {}, widths: {},
    }];
    expect(rewriteFormulasForSheetRename(sheets, 'Old data', 'New data')).toEqual({
      summary: { A1: "='New data'!A1*2" },
    });
  });

  it('moves sparse cell metadata and merged ranges during row and column edits', () => {
    expect(shiftAddressRecord({ A1: 'head', B2: 'body', C3: 'tail' }, 'row', 1, 'insert', 100)).toEqual({
      A1: 'head', B3: 'body', C4: 'tail',
    });
    expect(shiftAddressRecord({ A1: 'head', B2: 'body', C3: 'tail' }, 'column', 1, 'delete', 26)).toEqual({
      A1: 'head', B3: 'tail',
    });
    const merge = { start: { row: 1, column: 1 }, end: { row: 2, column: 2 } };
    expect(serializeRange(merge)).toBe('B2:C3');
    expect(shiftSerializedRanges(['B2:C3'], 'row', 0, 'insert', 100)).toEqual(['B3:C4']);
    expect(shiftSerializedRanges(['B2:C3'], 'row', 1, 'delete', 100)).toEqual([]);
  });

  it('rewrites local and cross-sheet formulas during structural edits', () => {
    const sheets: SpreadsheetSheet[] = [{
      id: 'data', name: 'Data', rowCount: 100, columnCount: 26,
      cells: { A1: '2', A2: '3', B1: '=SUM(A1:A2)' }, styles: {}, widths: {},
    }, {
      id: 'summary', name: 'Summary', rowCount: 100, columnCount: 26,
      cells: { A1: '=Data!B1' }, styles: {}, widths: {},
    }];
    expect(rewriteFormulasForStructure(sheets, 'data', 'row', 0, 'insert')).toEqual({
      data: { B2: '=SUM(A2:A3)' },
      summary: { A1: '=Data!B2' },
    });
    expect(rewriteFormulasForStructure(sheets, 'data', 'row', 99, 'insert')).toEqual({
      data: { B1: '=SUM(A1:A2)' },
      summary: { A1: '=Data!B1' },
    });
  });
});
