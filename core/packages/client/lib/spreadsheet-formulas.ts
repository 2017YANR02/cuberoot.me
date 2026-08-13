import { HyperFormula } from 'hyperformula';
import { parseCellAddress, parseFormulaValue, type SpreadsheetSheet } from '@/lib/spreadsheet-model';

export interface SpreadsheetFormulaResult {
  values: Record<string, Record<string, unknown>>;
  error: string;
}

function buildFormulaEngine(sheets: SpreadsheetSheet[]): HyperFormula {
  const engine = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' });
  for (const sheet of sheets) engine.addSheet(sheet.name);
  engine.batch(() => {
    for (const sheet of sheets) {
      const sheetId = engine.getSheetId(sheet.name);
      if (sheetId === undefined) continue;
      for (const [address, raw] of Object.entries(sheet.cells)) {
        const point = parseCellAddress(address);
        if (!point || point.row >= sheet.rowCount || point.column >= sheet.columnCount) continue;
        engine.setCellContents({ sheet: sheetId, row: point.row, col: point.column }, [[parseFormulaValue(raw)]]);
      }
    }
  });
  return engine;
}

export function calculateSpreadsheetFormulas(sheets: SpreadsheetSheet[]): SpreadsheetFormulaResult {
  const values: Record<string, Record<string, unknown>> = Object.fromEntries(sheets.map((sheet) => [sheet.id, {}]));
  let engine: HyperFormula | null = null;
  try {
    engine = buildFormulaEngine(sheets);
    for (const sheet of sheets) {
      const sheetId = engine.getSheetId(sheet.name);
      if (sheetId === undefined) continue;
      for (const [address, raw] of Object.entries(sheet.cells)) {
        if (!raw.startsWith('=')) continue;
        const point = parseCellAddress(address);
        if (point) values[sheet.id][address] = engine.getCellValue({ sheet: sheetId, row: point.row, col: point.column });
      }
    }
    return { values, error: '' };
  } catch (cause) {
    return { values, error: cause instanceof Error ? cause.message : 'Formula calculation failed' };
  } finally {
    engine?.destroy();
  }
}

export function rewriteFormulasForSheetRename(
  sheets: SpreadsheetSheet[],
  oldName: string,
  newName: string,
): Record<string, Record<string, string>> {
  const patches: Record<string, Record<string, string>> = {};
  const engine = buildFormulaEngine(sheets);
  try {
    const renamedId = engine.getSheetId(oldName);
    if (renamedId === undefined) return patches;
    engine.renameSheet(renamedId, newName);
    for (const sheet of sheets) {
      const actualName = sheet.name === oldName ? newName : sheet.name;
      const sheetId = engine.getSheetId(actualName);
      if (sheetId === undefined) continue;
      for (const [address, raw] of Object.entries(sheet.cells)) {
        if (!raw.startsWith('=')) continue;
        const point = parseCellAddress(address);
        if (!point) continue;
        const formula = engine.getCellFormula({ sheet: sheetId, row: point.row, col: point.column });
        if (formula && formula !== raw) (patches[sheet.id] ??= {})[address] = formula;
      }
    }
    return patches;
  } finally {
    engine.destroy();
  }
}
