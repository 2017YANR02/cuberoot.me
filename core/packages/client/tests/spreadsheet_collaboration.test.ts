import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

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
});
