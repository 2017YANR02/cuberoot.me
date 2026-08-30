import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { repairSpreadsheetSheets } from '@/lib/spreadsheet-yjs';

function initialize(doc: Y.Doc): void {
  const sheet = new Y.Map<unknown>();
  sheet.set('id', 'sheet-1');
  sheet.set('name', 'Sheet 1');
  sheet.set('rowCount', 100);
  sheet.set('columnCount', 26);
  sheet.set('cells', new Y.Map<string>());
  sheet.set('styles', new Y.Map<Record<string, unknown>>());
  sheet.set('widths', new Y.Map<number>());
  doc.getArray<Y.Map<unknown>>('sheets').push([sheet]);
}

function cells(doc: Y.Doc): Y.Map<string> {
  return doc.getArray<Y.Map<unknown>>('sheets').get(0).get('cells') as Y.Map<string>;
}

function initializeRaceCreatedSheet(doc: Y.Doc, value = ''): void {
  const sheet = new Y.Map<unknown>();
  const sheetCells = new Y.Map<string>();
  sheet.set('id', 'race-sheet');
  sheet.set('name', 'Sheet 1');
  sheet.set('rowCount', 100);
  sheet.set('columnCount', 26);
  sheet.set('cells', sheetCells);
  sheet.set('styles', new Y.Map<Record<string, unknown>>());
  sheet.set('widths', new Y.Map<number>());
  sheet.set('notes', new Y.Map<string>());
  sheet.set('links', new Y.Map<string>());
  sheet.set('validations', new Y.Map<Record<string, unknown>>());
  sheet.set('merges', new Y.Map<boolean>());
  sheet.set('conditionalRules', new Y.Map<Record<string, unknown>>());
  sheet.set('frozenRows', 0);
  sheet.set('frozenColumns', 0);
  if (value) sheetCells.set('A1', value);
  doc.getArray<Y.Map<unknown>>('sheets').push([sheet]);
}

describe('spreadsheet Yjs collaboration', () => {
  it('merges simultaneous edits from two clients without losing either cell', () => {
    const left = new Y.Doc();
    initialize(left);
    const right = new Y.Doc();
    Y.applyUpdate(right, Y.encodeStateAsUpdate(left));

    const leftVector = Y.encodeStateVector(left);
    const rightVector = Y.encodeStateVector(right);
    cells(left).set('A1', 'left');
    cells(right).set('B1', '=1+1');

    Y.applyUpdate(left, Y.encodeStateAsUpdate(right, leftVector));
    Y.applyUpdate(right, Y.encodeStateAsUpdate(left, rightVector));
    expect(cells(left).toJSON()).toEqual({ A1: 'left', B1: '=1+1' });
    expect(cells(right).toJSON()).toEqual(cells(left).toJSON());

    left.destroy();
    right.destroy();
  });

  it('removes the blank Sheet 1 inserted before the server state arrived', () => {
    const server = new Y.Doc();
    initialize(server);
    const client = new Y.Doc();
    initializeRaceCreatedSheet(client);

    Y.applyUpdate(client, Y.encodeStateAsUpdate(server));
    expect(client.getArray('sheets')).toHaveLength(2);

    expect(repairSpreadsheetSheets(client)).toEqual({ removed: 1, renamed: 0 });
    expect(client.getArray<Y.Map<unknown>>('sheets')).toHaveLength(1);
    expect(client.getArray<Y.Map<unknown>>('sheets').get(0).get('name')).toBe('Sheet 1');

    server.destroy();
    client.destroy();
  });

  it('keeps data from duplicate sheets and gives them unique names', () => {
    const doc = new Y.Doc();
    initialize(doc);
    initializeRaceCreatedSheet(doc, 'keep me');

    expect(repairSpreadsheetSheets(doc)).toEqual({ removed: 0, renamed: 1 });
    const sheets = doc.getArray<Y.Map<unknown>>('sheets').toArray();
    expect(sheets.map((sheet) => sheet.get('name'))).toEqual(['Sheet 1', 'Sheet 1 2']);
    expect((sheets[1].get('cells') as Y.Map<string>).get('A1')).toBe('keep me');

    doc.destroy();
  });
});
