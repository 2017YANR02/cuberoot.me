import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classifyDrift, renderReport } from '../scripts/sq1-pbl/check-lib.mjs';

type Snapshot = {
  schemaVersion: number;
  source: string;
  fetchedAt?: string;
  digests: Record<'content' | 'presentation' | 'editorial', string>;
  totals: Record<string, unknown>;
  invariants: Record<string, unknown>;
  sheets: Array<{
    name: string;
    digests: Record<'content' | 'presentation' | 'editorial', string>;
    counts?: Record<string, number>;
  }>;
};

const snapshot = JSON.parse(
  readFileSync(new URL('../scripts/sq1-pbl/source.snapshot.json', import.meta.url), 'utf8'),
) as Snapshot;
const materialFixture = JSON.parse(
  readFileSync(new URL('../scripts/sq1-pbl/material.snapshot.fixture.json', import.meta.url), 'utf8'),
) as Snapshot;

function changed(category: 'content' | 'presentation' | 'editorial'): Snapshot {
  const live = structuredClone(snapshot);
  live.digests[category] = `changed-${category}`;
  live.sheets[0].digests[category] = `changed-${category}`;
  return live;
}

describe('SQ1 PBL drift contract', () => {
  it('locks the complete current workbook invariants', () => {
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.source).toContain('/export?format=xlsx');
    expect(snapshot.sheets).toHaveLength(64);
    expect(snapshot.invariants).toEqual({
      cellRecords: 143902,
      conditionalFormatting: 17,
      formulas: 8061,
      frequencyTotal: 10368,
      hiddenSheetNames: ['wtfP'],
      hyperlinks: 657,
      merges: 321,
      pictureAnchors: 15,
      rawCases: 968,
      recommendedCases: 963,
      recommendedFrequency: 10303,
      sheetCount: 64,
      sliceDistribution: { 0: 1, 3: 6, 4: 6, 5: 51, 6: 178, 7: 387, 8: 283, 9: 56 },
      slicerCounts: {
        '3 and 4 slicers': 12,
        '5 slicers': 51,
        '6 slicers': 174,
        '7 slicers': 387,
        '8 Slicers': 283,
        '9 slicers': 56,
      },
      uniqueMedia: 13,
      uniqueRawKeys: 968,
      unusedCases: { 'Ga/Gd': true, 'Ga/Jb': true, 'Gb/Gc': true, 'Gb/Jb': true },
      validations: 10,
      valueOrFormula: 37835,
      visibleSheets: 63,
    });
  });

  it('treats editorial-only changes as nonmaterial', () => {
    const live = changed('editorial');
    const result = classifyDrift(snapshot, live);
    expect(result).toMatchObject({
      material: false,
      editorial: true,
      workbookCategories: ['editorial'],
    });
    expect(renderReport(snapshot, live, result, 'https://example.test/sheet')).not.toContain('## 处理步骤');
  });

  it.each(['content', 'presentation'] as const)('treats %s changes as material', (category) => {
    expect(classifyDrift(snapshot, changed(category)).material).toBe(true);
  });

  it('treats sheet and invariant changes as material and reports them', () => {
    const live = structuredClone(snapshot);
    live.sheets.push({
      name: 'New sheet',
      digests: { content: 'a', presentation: 'b', editorial: 'c' },
    });
    live.invariants.rawCases = 969;
    const result = classifyDrift(snapshot, live);
    const report = renderReport(snapshot, live, result, 'https://example.test/sheet');
    expect(result.material).toBe(true);
    expect(result.added).toEqual(['New sheet']);
    expect(result.invariantDiff).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'rawCases' })]));
    expect(report).toContain('## 新增表页');
    expect(report).toContain('## 数据不变量变化');
  });

  it('keeps a repeatable material-drift baseline for the CLI exit-3 audit', () => {
    const result = classifyDrift(materialFixture, snapshot);
    expect(result.material).toBe(true);
    expect(result.added).toHaveLength(64);
    expect(result.workbookCategories).toEqual(['content', 'presentation', 'editorial']);
  });
});
