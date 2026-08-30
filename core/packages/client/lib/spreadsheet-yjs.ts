import * as Y from 'yjs';

type SheetMap = Y.Map<unknown>;

const REPAIR_ORIGIN = 'spreadsheet-sheet-repair';
const DEFAULT_SHEET_MAPS = ['notes', 'links', 'validations', 'merges', 'conditionalRules'] as const;

function mapIsEmpty(sheet: SheetMap, key: string): boolean {
  const value = sheet.get(key);
  return !(value instanceof Y.Map) || value.size === 0;
}

function isRaceCreatedDefault(sheet: SheetMap): boolean {
  return String(sheet.get('name')).toLocaleLowerCase() === 'sheet 1'
    && Number(sheet.get('rowCount')) === 100
    && Number(sheet.get('columnCount')) === 26
    && Number(sheet.get('frozenRows')) === 0
    && Number(sheet.get('frozenColumns')) === 0
    && ['cells', 'styles', 'widths', ...DEFAULT_SHEET_MAPS].every((key) => mapIsEmpty(sheet, key))
    && DEFAULT_SHEET_MAPS.every((key) => sheet.get(key) instanceof Y.Map);
}

function uniqueSheetName(name: string, used: Set<string>): string {
  if (!used.has(name.toLocaleLowerCase())) return name;
  let suffix = 2;
  let candidate = `${name} ${suffix}`;
  while (used.has(candidate.toLocaleLowerCase())) candidate = `${name} ${++suffix}`;
  return candidate;
}

export function repairSpreadsheetSheets(ydoc: Y.Doc): { removed: number; renamed: number } {
  const ySheets = ydoc.getArray<SheetMap>('sheets');
  const sheets = ySheets.toArray();
  const groups = new Map<string, number[]>();
  for (const [index, sheet] of sheets.entries()) {
    const key = String(sheet.get('name')).trim().toLocaleLowerCase();
    const indexes = groups.get(key) || [];
    indexes.push(index);
    groups.set(key, indexes);
  }

  const removeIndexes = new Set<number>();
  for (const indexes of groups.values()) {
    if (indexes.length < 2) continue;
    const raceCreated = indexes.filter((index) => isRaceCreatedDefault(sheets[index]));
    const keepRaceCreated = raceCreated.length === indexes.length ? raceCreated[0] : undefined;
    for (const index of raceCreated) if (index !== keepRaceCreated) removeIndexes.add(index);
  }

  let renamed = 0;
  ydoc.transact(() => {
    for (const index of Array.from(removeIndexes).sort((left, right) => right - left)) ySheets.delete(index, 1);

    const used = new Set<string>();
    for (const [index, sheet] of ySheets.toArray().entries()) {
      const current = String(sheet.get('name')).trim() || `Sheet ${index + 1}`;
      const name = uniqueSheetName(current, used);
      used.add(name.toLocaleLowerCase());
      if (name !== sheet.get('name')) {
        sheet.set('name', name);
        renamed += 1;
      }
    }
  }, REPAIR_ORIGIN);

  return { removed: removeIndexes.size, renamed };
}
