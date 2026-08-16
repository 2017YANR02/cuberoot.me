import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Formula = {
  type: string;
  text?: string;
  template?: string;
  sharedMaster?: string;
  sharedRange?: string;
};

type ComputedImage = {
  url: string;
  sha256: string;
  bytes: number;
  extension: '.png' | '.svg';
  mime: 'image/png' | 'image/svg+xml';
  pixels?: [number, number];
  source: { kind: 'direct'; inputCell: string } | { kind: 'derived'; imageCell: string };
};

type FormulaImageAsset = Omit<ComputedImage, 'source'> & {
  sourceCellCount: number;
  requestDigests: string[];
};

type SheetExport = {
  schemaVersion: number;
  index: number;
  name: string;
  slug: string;
  state: string;
  dimension: string;
  digests: { content: string; presentation: string };
  counts: Record<string, number | Record<string, number>>;
  cells: Array<{
    ref: string;
    type: string;
    value?: string;
    cached?: string | null;
    formula?: Formula;
    computedImage?: ComputedImage;
    style: string;
  }>;
  styleRanges: Array<{ ref: string; style: string }>;
  styles: { cell: Record<string, unknown>; differential: Record<string, unknown> };
  notes: Array<{ ref: string; author: string; text: string }>;
  hyperlinks: unknown[];
  merges: string[];
  pictures: Array<{ image: { sha256: string; url: string } }>;
  rows: Array<Record<string, string>>;
  columns: Array<Record<string, string>>;
  pane: Record<string, string> | null;
  validations: unknown[];
  conditionalFormatting: unknown[];
  autoFilter: unknown;
  tables: unknown[];
  nonPictureDrawingAnchors: number;
};

const publicRoot = new URL('../public/data/sq1-pbl/', import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL('manifest.json', publicRoot), 'utf8'),
) as {
  schemaVersion: number;
  source: Record<string, string>;
  dataBaseUrl: string;
  totals: Record<string, unknown>;
  invariants: Record<string, unknown>;
  exclusions: Array<{ category: string; retained?: string }>;
  relatedData: { finderDefaults: { url: string; sha256: string } };
  media: Array<{ sha256: string; bytes: number; extension: string; url: string }>;
  formulaImages: {
    sourceCells: number;
    directFormulaCells: number;
    derivedFormulaCells: number;
    uniqueRequests: number;
    uniqueAssets: number;
    bytes: number;
    mimeCounts: Record<string, number>;
    assets: FormulaImageAsset[];
  };
  sheets: Array<{
    index: number;
    name: string;
    slug: string;
    state: string;
    dimension: string;
    dataUrl: string;
    counts: Record<string, number>;
  }>;
};
const cases = JSON.parse(
  readFileSync(new URL('../data/sq1-pbl/cases.json', import.meta.url), 'utf8'),
) as {
  schemaVersion: number;
  invariants: { caseCount: number; recommendedCount: number; frequencyTotal: number; usedFalse: string[] };
  buckets: Array<{ id: string; caseCount: number }>;
  cases: Array<{
    key: string;
    frequency: number;
    used: boolean;
    recommended: boolean;
    bucket: string;
    recommendation: null | { sheet: string; rank: number; algorithm: string | null };
  }>;
};

function readSheet(slug: string): SheetExport {
  return JSON.parse(readFileSync(new URL(`sheets/${slug}.json`, publicRoot), 'utf8')) as SheetExport;
}

function regularFileNames(url: URL): string[] {
  return readdirSync(url, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

function columnNumber(name: string): number {
  return [...name].reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0);
}

function rangeCellCount(reference: string): number {
  const [first, last = first] = reference.split(':');
  const parse = (cell: string) => {
    const match = /^([A-Z]+)(\d+)$/u.exec(cell);
    if (!match) throw new Error(`Invalid cell reference: ${cell}`);
    return { column: columnNumber(match[1]), row: Number.parseInt(match[2], 10) };
  };
  const start = parse(first);
  const end = parse(last);
  return (end.column - start.column + 1) * (end.row - start.row + 1);
}

describe('SQ1 PBL public workbook export', () => {
  it('publishes every sheet in order with deterministic semantic data', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.dataBaseUrl).toBe('/data/sq1-pbl');
    expect(manifest.source).toMatchObject({
      documentId: '1VQNYNwdOLqqBkacHcfYtEBst22FOVhH9EAhTOYOZTgo',
      url: 'https://docs.google.com/spreadsheets/d/1VQNYNwdOLqqBkacHcfYtEBst22FOVhH9EAhTOYOZTgo/edit',
    });
    expect(manifest.source).not.toHaveProperty('rawSha256');
    expect(manifest).not.toHaveProperty('generatedAt');
    expect(manifest.totals).toEqual({
      cellRecords: 143902,
      columnDefinitions: 589,
      conditionalFormatting: 17,
      customRows: 4171,
      formulaTypes: { array: 30, normal: 2115, shared: 5916 },
      formulaValueOverlap: 3989,
      formulas: 8061,
      hiddenSheets: 1,
      hyperlinks: 657,
      literalValues: 33763,
      merges: 321,
      pictureAnchors: 15,
      referencedStyles: 843,
      sharedStrings: 8513,
      sheets: 64,
      stableComments: 793,
      styleOnly: 106067,
      styles: { borders: 48, cellXfs: 952, dxfs: 9, fills: 44, fonts: 81, numFmts: 3, semanticCellXfs: 844 },
      tables: 3,
      uniqueMedia: 13,
      uniqueMediaBytes: 829855,
      validations: 10,
      valueOrFormula: 37835,
      visibleSheets: 63,
    });
    expect(manifest.invariants).toEqual({
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
    expect(manifest.sheets).toHaveLength(64);
    expect(manifest.sheets.map((sheet) => sheet.index)).toEqual(Array.from({ length: 64 }, (_, index) => index + 1));
    expect(new Set(manifest.sheets.map((sheet) => sheet.slug)).size).toBe(64);
    expect(manifest.sheets.filter((sheet) => sheet.state !== 'visible')).toEqual([
      expect.objectContaining({ name: 'wtfP', state: 'hidden' }),
    ]);

    const sheets = manifest.sheets.map((entry) => {
      expect(entry.dimension).toMatch(/^[A-Z]+\d+:[A-Z]+\d+$/u);
      expect(entry.dataUrl).toBe(`/data/sq1-pbl/sheets/${entry.slug}.json`);
      const sheet = readSheet(entry.slug);
      expect(sheet).toMatchObject({
        schemaVersion: 1,
        index: entry.index,
        name: entry.name,
        slug: entry.slug,
        state: entry.state,
        dimension: entry.dimension,
      });
      for (const field of [
        'cells', 'styleRanges', 'styles', 'notes', 'hyperlinks', 'merges', 'pictures',
        'rows', 'columns', 'pane', 'validations', 'conditionalFormatting', 'autoFilter',
        'tables', 'nonPictureDrawingAnchors',
      ]) {
        expect(sheet).toHaveProperty(field);
      }
      expect(sheet).not.toHaveProperty('threadedComments');
      expect(sheet.digests).not.toHaveProperty('editorial');

      const styleRefs = [
        ...sheet.cells.map((cell) => cell.style),
        ...sheet.styleRanges.map((range) => range.style),
        ...sheet.rows.flatMap((row) => row.style ? [row.style] : []),
        ...sheet.columns.flatMap((column) => column.style ? [column.style] : []),
      ];
      for (const style of styleRefs) expect(sheet.styles.cell).toHaveProperty(style);
      for (const cell of sheet.cells) {
        expect(cell.type).toBeTruthy();
        if (cell.formula) expect(cell).toHaveProperty('cached');
      }
      return sheet;
    });

    const totals = sheets.reduce((sum, sheet) => {
      sum.cells += sheet.cells.length;
      sum.styleOnly += sheet.styleRanges.reduce((count, range) => count + rangeCellCount(range.ref), 0);
      sum.formulas += sheet.cells.filter((cell) => cell.formula).length;
      sum.emptyFormulaCaches += sheet.cells.filter((cell) => cell.formula && cell.cached === null).length;
      sum.notes += sheet.notes.length;
      sum.hyperlinks += sheet.hyperlinks.length;
      sum.merges += sheet.merges.length;
      sum.pictures += sheet.pictures.length;
      sum.validations += sheet.validations.length;
      sum.conditionalRules += Number(sheet.counts.conditionalFormatting);
      sum.customRows += sheet.rows.length;
      sum.columns += sheet.columns.length;
      sum.hiddenColumns += sheet.columns.filter((column) => column.hidden === '1').length;
      sum.tables += sheet.tables.length;
      sum.nonPictureDrawingAnchors += sheet.nonPictureDrawingAnchors;
      for (const cell of sheet.cells) {
        if (cell.formula) sum.formulaTypes[cell.formula.type] = (sum.formulaTypes[cell.formula.type] ?? 0) + 1;
      }
      return sum;
    }, {
      cells: 0,
      styleOnly: 0,
      formulas: 0,
      emptyFormulaCaches: 0,
      notes: 0,
      hyperlinks: 0,
      merges: 0,
      pictures: 0,
      validations: 0,
      conditionalRules: 0,
      customRows: 0,
      columns: 0,
      hiddenColumns: 0,
      tables: 0,
      nonPictureDrawingAnchors: 0,
      formulaTypes: {} as Record<string, number>,
    });
    expect(totals).toEqual({
      cells: 37835,
      styleOnly: 106067,
      formulas: 8061,
      emptyFormulaCaches: 4072,
      notes: 793,
      hyperlinks: 657,
      merges: 321,
      pictures: 15,
      validations: 10,
      conditionalRules: 17,
      customRows: 4171,
      columns: 589,
      hiddenColumns: 9,
      tables: 3,
      nonPictureDrawingAnchors: 0,
      formulaTypes: { array: 30, normal: 2115, shared: 5916 },
    });
    const shared = sheets.flatMap((sheet) => sheet.cells).filter((cell) => cell.formula?.type === 'shared');
    expect(shared).toHaveLength(5916);
    expect(shared.every((cell) => cell.formula?.sharedMaster && cell.formula.sharedRange)).toBe(true);
    expect(shared.filter((cell) => cell.formula?.text)).toHaveLength(148);
    expect(shared.filter((cell) => cell.formula?.template)).toHaveLength(5768);

    const rawAlgs = sheets.find((sheet) => sheet.name === 'Raw Algs');
    expect(rawAlgs).toBeDefined();
    const rawShared = rawAlgs!.cells.filter((cell) => cell.formula?.type === 'shared');
    expect(rawShared).toHaveLength(967);
    expect(rawShared.filter((cell) => cell.formula?.text)).toHaveLength(2);
    expect(rawShared.filter((cell) => cell.formula?.template)).toHaveLength(965);
    expect(rawShared.every((cell) => cell.formula?.sharedMaster && cell.formula.sharedRange)).toBe(true);
  });

  it('publishes all content-addressed PNG media and finder defaults', () => {
    expect(manifest.media).toHaveLength(13);
    expect(manifest.media.reduce((sum, item) => sum + item.bytes, 0)).toBe(829855);
    for (const item of manifest.media) {
      expect(item.extension).toBe('.png');
      expect(item.url).toBe(`/data/sq1-pbl/media/${item.sha256}.png`);
      const raw = readFileSync(new URL(`media/${item.sha256}.png`, publicRoot));
      expect(raw).toHaveLength(item.bytes);
      expect(createHash('sha256').update(raw).digest('hex')).toBe(item.sha256);
    }
    const defaults = readFileSync(new URL('finder-defaults.json', publicRoot));
    expect(createHash('sha256').update(defaults).digest('hex')).toBe(manifest.relatedData.finderDefaults.sha256);
    expect(regularFileNames(new URL('media/', publicRoot))).toEqual(
      manifest.media.map((item) => `${item.sha256}${item.extension}`).sort(),
    );
  });

  it('materializes every visible empty-cache formula image into validated local assets', () => {
    expect(manifest.formulaImages).toMatchObject({
      sourceCells: 3089,
      directFormulaCells: 3082,
      derivedFormulaCells: 7,
      uniqueRequests: 1116,
      uniqueAssets: 1116,
      bytes: 24694158,
      mimeCounts: { 'image/png': 1102, 'image/svg+xml': 14 },
    });
    expect(manifest.formulaImages.assets).toHaveLength(1116);
    expect(manifest.formulaImages.assets.reduce((sum, asset) => sum + asset.sourceCellCount, 0)).toBe(3089);
    expect(manifest.formulaImages.assets.reduce((sum, asset) => sum + asset.requestDigests.length, 0)).toBe(1116);

    for (const asset of manifest.formulaImages.assets) {
      expect(asset.url).toBe(`/data/sq1-pbl/formula-media/${asset.sha256}${asset.extension}`);
      expect(asset.extension).toBe(asset.mime === 'image/png' ? '.png' : '.svg');
      expect(asset.pixels).toEqual(asset.mime === 'image/png' ? [602, 297] : [1400, 700]);
      const raw = readFileSync(new URL(`formula-media/${asset.sha256}${asset.extension}`, publicRoot));
      expect(raw).toHaveLength(asset.bytes);
      expect(createHash('sha256').update(raw).digest('hex')).toBe(asset.sha256);
    }
    expect(regularFileNames(new URL('formula-media/', publicRoot))).toEqual(
      manifest.formulaImages.assets.map((asset) => `${asset.sha256}${asset.extension}`).sort(),
    );

    const sheets = manifest.sheets.map((entry) => readSheet(entry.slug));
    const cells = sheets.flatMap((sheet) => sheet.cells);
    const formulaImages = cells.filter((cell) => cell.computedImage);
    expect(formulaImages).toHaveLength(3089);
    expect(formulaImages.every((cell) => cell.formula && cell.cached === null)).toBe(true);
    expect(formulaImages.filter((cell) => cell.computedImage?.source.kind === 'direct')).toHaveLength(3082);
    expect(formulaImages.filter((cell) => cell.computedImage?.source.kind === 'derived')).toHaveLength(7);
    expect(cells.filter((cell) => cell.formula && cell.cached === null && !cell.computedImage)).toHaveLength(983);
    expect(sheets.reduce((sum, sheet) => sum + Number(sheet.counts.computedImages), 0)).toBe(3089);

    const svgSample = readSheet('2e2c').cells.find((cell) => cell.ref === 'C3');
    expect(svgSample?.computedImage).toEqual({
      bytes: 9257,
      extension: '.svg',
      mime: 'image/svg+xml',
      pixels: [1400, 700],
      sha256: 'd06002608440f7323c7960f6b5dfe5abc516bffda38353c945f36b76fff331e8',
      source: { kind: 'direct', inputCell: '2e2c!B3' },
      url: '/data/sq1-pbl/formula-media/d06002608440f7323c7960f6b5dfe5abc516bffda38353c945f36b76fff331e8.svg',
    });
    const derivedSample = readSheet('case-select').cells.find((cell) => cell.ref === 'H3');
    expect(derivedSample?.computedImage).toMatchObject({
      extension: '.png',
      mime: 'image/png',
      source: { kind: 'derived', imageCell: 'DropDownData!O3' },
    });
  });

  it('keeps the three exporter-owned directories exactly aligned to the manifest', () => {
    expect(regularFileNames(new URL('sheets/', publicRoot))).toEqual(
      manifest.sheets.map((sheet) => `${sheet.slug}.json`).sort(),
    );
    expect(regularFileNames(new URL('media/', publicRoot))).toEqual(
      manifest.media.map((asset) => `${asset.sha256}${asset.extension}`).sort(),
    );
    expect(regularFileNames(new URL('formula-media/', publicRoot))).toEqual(
      manifest.formulaImages.assets.map((asset) => `${asset.sha256}${asset.extension}`).sort(),
    );
  });

  it('accepts a published safe SVG and rejects active or external SVG content', () => {
    const script = fileURLToPath(new URL('../scripts/sq1-pbl/test_normalize.py', import.meta.url));
    const candidates: Array<[string, string[]]> = process.platform === 'win32'
      ? [['uv', ['run', 'python']], ['python', []], ['py', ['-3']]]
      : [['python3', []], ['python', []]];
    let result: ReturnType<typeof spawnSync> | null = null;
    for (const [command, prefix] of candidates) {
      result = spawnSync(command, [...prefix, script], { encoding: 'utf8', windowsHide: true });
      if (result.error && 'code' in result.error && result.error.code === 'ENOENT') continue;
      break;
    }
    expect(result).not.toBeNull();
    expect(result?.status, String(result?.stderr || result?.error?.message || '')).toBe(0);
  });

  it('keeps 968 searchable Raw Algs and only the four declared unused cases', () => {
    expect(cases.schemaVersion).toBe(1);
    expect(cases.invariants).toEqual({
      caseCount: 968,
      recommendedCount: 963,
      frequencyTotal: 10368,
      usedFalse: ['Ga/Gd', 'Ga/Jb', 'Gb/Gc', 'Gb/Jb'],
    });
    expect(cases.cases).toHaveLength(968);
    expect(new Set(cases.cases.map((item) => item.key)).size).toBe(968);
    expect(cases.cases.reduce((sum, item) => sum + item.frequency, 0)).toBe(10368);
    expect(cases.cases.filter((item) => item.recommended)).toHaveLength(963);
    expect(cases.cases.filter((item) => !item.used).map((item) => item.key).sort()).toEqual(cases.invariants.usedFalse);
    expect(cases.buckets.map((bucket) => [bucket.id, bucket.caseCount])).toEqual([
      ['3-4', 12], ['5', 51], ['6', 174], ['7', 387], ['8', 283], ['9', 56],
    ]);
    expect(cases.cases.find((item) => item.key === '-/-')).toMatchObject({
      used: true,
      recommended: false,
      bucket: 'solved',
    });
    for (const item of cases.cases.filter((entry) => entry.recommended)) {
      expect(item.recommendation).toMatchObject({ sheet: expect.any(String), rank: expect.any(Number) });
    }
  });

  it('documents only exporter, debug, and editorial exclusions', () => {
    expect(manifest.exclusions.map((entry) => entry.category)).toEqual([
      'exporter-noise', 'debug-noise', 'editorial-noise',
    ]);
    expect(manifest.exclusions.at(-1)?.retained).toContain('all stable cell notes');
  });
});
