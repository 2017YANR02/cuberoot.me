import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatSq1PblNumericValue,
  loadSq1PblManifest,
  loadSq1PblSheet,
  type Sq1PblSheetRef,
} from '@/lib/sq1-pbl-data';

interface SnapshotCell {
  ref: string;
  value?: string;
  style?: string;
}

interface SnapshotSheet {
  cells: SnapshotCell[];
  styles: { cell: Record<string, { numFmt?: string; base?: { numFmt?: string } }> };
}

function snapshot(slug: string): SnapshotSheet {
  return JSON.parse(readFileSync(
    new URL(`../public/data/sq1-pbl/sheets/${slug}.json`, import.meta.url),
    'utf8',
  )) as SnapshotSheet;
}

function formattedCell(slug: string, ref: string): string | null {
  const sheet = snapshot(slug);
  const cell = sheet.cells.find(item => item.ref === ref);
  if (!cell?.style || cell.value === undefined) throw new Error(`Missing fixture cell ${slug}!${ref}`);
  const style = sheet.styles.cell[cell.style];
  return formatSq1PblNumericValue(Number(cell.value), style.numFmt ?? style.base?.numFmt);
}

const sheetRef: Sq1PblSheetRef = {
  index: 1,
  name: 'Test',
  slug: 'test',
  state: 'visible',
  dimension: 'A1',
  dataUrl: '/data/sq1-pbl/sheets/test.json',
};

function mockJson(value: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => value,
  })));
}

function sheetPayload(cell: Record<string, unknown>) {
  return {
    schemaVersion: 1,
    ...sheetRef,
    cells: [cell],
    styleRanges: [],
    styles: { cell: {}, differential: {} },
    notes: [],
    hyperlinks: [],
    merges: [],
    pictures: [],
    rows: [],
    columns: [],
    pane: null,
    validations: [],
    conditionalFormatting: [],
    autoFilter: null,
    tables: [],
    nonPictureDrawingAnchors: 0,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SQ1 PBL workbook number formats', () => {
  it('renders the real percentage cell using Excel builtin 10', () => {
    expect(formattedCell('statistics', 'E4')).toBe('0.01%');
  });

  it('renders the real Excel serial date without locale drift', () => {
    expect(formattedCell('pbl-of-the-day-discord', 'B2')).toBe('2/29/24');
  });

  it('supports integer and fixed-decimal builtins', () => {
    expect(formatSq1PblNumericValue(12, 'builtin:0')).toBe('12');
    expect(formatSq1PblNumericValue(12.6, 'builtin:1')).toBe('13');
    expect(formatSq1PblNumericValue(12.6, 'builtin:2')).toBe('12.60');
  });
});

describe('SQ1 PBL computed image contract', () => {
  const sha256 = 'a'.repeat(64);
  const image = {
    url: `/data/sq1-pbl/formula-media/${sha256}.png`,
    sha256,
    bytes: 123,
    extension: '.png',
    mime: 'image/png',
    pixels: [160, 90],
    source: { kind: 'direct', inputCell: '2e2c!B3' },
  };

  it('preserves a formula and its local computed image together', async () => {
    mockJson(sheetPayload({
      ref: 'A1',
      formula: { type: 'normal', text: 'IMAGE(B2)' },
      cached: null,
      computedImage: image,
    }));

    const sheet = await loadSq1PblSheet(sheetRef);
    expect(sheet.cells[0]?.formula?.text).toBe('IMAGE(B2)');
    expect(sheet.cells[0]?.computedImage).toEqual(image);
    expect(sheet.cells[0]?.computedImage?.source).toEqual({ kind: 'direct', inputCell: '2e2c!B3' });
  });

  it('rejects a computed image whose extension and MIME type disagree', async () => {
    mockJson(sheetPayload({
      ref: 'A1',
      formula: { type: 'normal', text: 'IMAGE(B2)' },
      cached: null,
      computedImage: { ...image, mime: 'image/svg+xml' },
    }));

    await expect(loadSq1PblSheet(sheetRef)).rejects.toThrow('Invalid SQ1 PBL computed image at A1');
  });

  it('rejects a manifest formula asset that is not a content-addressed local URL', async () => {
    mockJson({
      schemaVersion: 1,
      source: { url: 'https://docs.google.com/spreadsheets/d/test/' },
      definedNames: [],
      exclusions: [],
      media: [],
      sheets: [sheetRef],
      formulaImages: {
        sourceCells: 1,
        directFormulaCells: 1,
        derivedFormulaCells: 0,
        uniqueRequests: 1,
        uniqueAssets: 1,
        bytes: 123,
        mimeCounts: { 'image/png': 1 },
        assets: [{
          ...image,
          url: 'https://example.com/image.png',
          sourceCellCount: 1,
          requestDigests: ['request-digest'],
        }],
      },
    });

    await expect(loadSq1PblManifest()).rejects.toThrow('Invalid SQ1 PBL formula image manifest');
  });
});

describe('SQ1 PBL public export integrity', () => {
  it('loads all 64 published sheets through the strict runtime contract', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const relativePath = input === '/data/sq1-pbl/manifest.json'
        ? 'manifest.json'
        : input.replace('/data/sq1-pbl/', '');
      const payload = JSON.parse(readFileSync(
        new URL(`../public/data/sq1-pbl/${relativePath}`, import.meta.url),
        'utf8',
      )) as unknown;
      return { ok: true, json: async () => payload };
    }));

    const manifest = await loadSq1PblManifest();
    const sheets = await Promise.all(manifest.sheets.map(sheet => loadSq1PblSheet(sheet)));

    expect(sheets).toHaveLength(64);
    expect(sheets.filter(sheet => sheet.state === 'hidden').map(sheet => sheet.name)).toEqual(['wtfP']);
    expect(sheets.reduce((sum, sheet) => sum + sheet.cells.length, 0)).toBe(37_835);
  });

  it('rejects an unsupported manifest schema instead of guessing its shape', async () => {
    mockJson({ schemaVersion: 2 });

    await expect(loadSq1PblManifest()).rejects.toThrow('Unsupported SQ1 PBL manifest schema version');
  });

  it('rejects a sheet payload that does not match its manifest reference', async () => {
    mockJson({ ...sheetPayload({ ref: 'A1', value: 'ok' }), name: 'Wrong sheet' });

    await expect(loadSq1PblSheet(sheetRef)).rejects.toThrow('SQ1 PBL sheet identity does not match manifest');
  });

  it('rejects malformed collection entries instead of silently dropping cells', async () => {
    mockJson({ ...sheetPayload({ ref: 'A1', value: 'ok' }), cells: [null] });

    await expect(loadSq1PblSheet(sheetRef)).rejects.toThrow('Invalid SQ1 PBL cell');
  });
});
