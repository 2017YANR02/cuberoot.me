import { describe, expect, it } from 'vitest';
import { HyperFormula } from 'hyperformula';
import { calculateSpreadsheetFormulas, rewriteFormulasForSheetRename } from '@/lib/spreadsheet-formulas';
import {
  cellAddress, columnIndex, columnLabel, formatCalculatedValue, normalizedRange,
  parseCellAddress, parseClipboardTable, parseFormulaValue, rangeAddresses, rangeToTsv, usedBounds,
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
});
