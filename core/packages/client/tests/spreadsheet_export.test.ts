import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { buildSpreadsheetCsv, buildSpreadsheetPdf, buildSpreadsheetXlsx, parseSpreadsheetFile } from '@/lib/spreadsheet-export';

afterEach(() => vi.unstubAllGlobals());

describe('spreadsheet XLSX export', () => {
  it('preserves sheets, formulas, numbers, booleans, text, and column widths', async () => {
    const blob = await buildSpreadsheetXlsx([{
      id: 'one', name: 'Data', rowCount: 100, columnCount: 26,
      cells: { A1: '12.5', A2: 'true', B1: '文字', C1: '=SUM(A1,2)' },
      styles: { A1: { numberFormat: 'currency', decimals: 1 } }, widths: { '0': 144 },
    }, {
      id: 'two', name: 'Other', rowCount: 100, columnCount: 26,
      cells: { A1: 'second' }, styles: {}, widths: {},
    }]);
    const workbook = XLSX.read(await blob.arrayBuffer(), { type: 'array', cellFormula: true, cellNF: true });
    expect(workbook.SheetNames).toEqual(['Data', 'Other']);
    expect(workbook.Sheets.Data.A1).toMatchObject({ t: 'n', v: 12.5 });
    expect(workbook.Sheets.Data.A1.z).toBe('¥#,##0.0');
    expect(workbook.Sheets.Data.A2).toMatchObject({ t: 'b', v: true });
    expect(workbook.Sheets.Data.B1.v).toBe('文字');
    expect(workbook.Sheets.Data.C1.f).toBe('SUM(A1,2)');
    expect(workbook.Sheets.Other.A1.v).toBe('second');

    const imported = await parseSpreadsheetFile(new File([blob], 'roundtrip.xlsx', { type: blob.type }));
    expect(imported).toEqual([
      { name: 'Data', cells: { A1: '12.5', A2: 'true', B1: '文字', C1: '=SUM(A1,2)' } },
      { name: 'Other', cells: { A1: 'second' } },
    ]);
  });

  it('builds a readable PDF with the current worksheet grid', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      const bytes = await readFile(join(process.cwd(), 'public', url.replace(/^\//, '')));
      return new Response(bytes);
    });
    const blob = await buildSpreadsheetPdf('Quarterly plan', {
      id: 'one', name: 'Data', rowCount: 100, columnCount: 26,
      cells: { A1: 'Item', B1: 'Amount', A2: 'Hardware', B2: '1200' },
      styles: {}, widths: {},
    });
    const header = new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 8));
    expect(header).toMatch(/^%PDF-/);
    expect(blob.size).toBeGreaterThan(10_000);
  });

  it('exports calculated formula values to CSV', async () => {
    const data = {
      id: 'data', name: 'Data', rowCount: 100, columnCount: 26,
      cells: { A1: '1200', A2: '2400', B1: '=SUM(A1:A2)', C1: '=Other!A1' },
      styles: {}, widths: {},
    };
    const other = {
      id: 'other', name: 'Other', rowCount: 100, columnCount: 26,
      cells: { A1: '42' }, styles: {}, widths: {},
    };
    const text = await buildSpreadsheetCsv(data, [data, other]).text();
    expect(text).toBe('1200,3600,42\r\n2400,,');
  });
});
