import type {
  Sq1PblFinderDefaults,
  Sq1PblPll,
  Sq1PblAuxiliary,
} from '@/lib/sq1-pbl';

type JsonRecord = Record<string, unknown>;
const SQ1_PBL_SCHEMA_VERSION = 1;

export interface Sq1PblManifestSource {
  kind?: string;
  url: string;
  rawSha256?: string;
  title?: string;
  documentId?: string;
  documentUrl?: string;
  downloadUrl?: string;
  contentDigest?: string;
  presentationDigest?: string;
}

export interface Sq1PblMedia {
  sha256: string;
  bytes?: number;
  extension?: string;
  pixels?: [number, number];
  url: string;
}

export interface Sq1PblFormulaImageAsset {
  url: string;
  sha256: string;
  bytes: number;
  extension: '.png' | '.svg';
  mime: 'image/png' | 'image/svg+xml';
  pixels?: [number, number];
  sourceCellCount: number;
  requestDigests: string[];
}

export interface Sq1PblFormulaImages {
  sourceCells: number;
  directFormulaCells: number;
  derivedFormulaCells: number;
  uniqueRequests: number;
  uniqueAssets: number;
  bytes: number;
  mimeCounts: Record<string, number>;
  assets: Sq1PblFormulaImageAsset[];
}

export interface Sq1PblSheetRef {
  index: number;
  name: string;
  slug: string;
  state: string;
  dimension: string;
  dataUrl: string;
  counts?: Record<string, unknown>;
}

export interface Sq1PblManifest {
  schemaVersion: number;
  source: Sq1PblManifestSource;
  generatedAt?: string;
  dataBaseUrl?: string;
  totals?: Record<string, unknown>;
  invariants?: Record<string, unknown>;
  definedNames: Sq1PblJsonValue[];
  exclusions: Sq1PblJsonValue[];
  media: Sq1PblMedia[];
  formulaImages?: Sq1PblFormulaImages;
  sheets: Sq1PblSheetRef[];
}

export type Sq1PblJsonValue =
  | string
  | number
  | boolean
  | null
  | Sq1PblJsonValue[]
  | { [key: string]: Sq1PblJsonValue };

export type Sq1PblJsonObject = { [key: string]: Sq1PblJsonValue };

export interface Sq1PblFormula {
  type?: string;
  text?: string;
  template?: string;
  sharedMaster?: string;
  sharedRange?: string;
  ref?: string;
  attrs?: Record<string, string>;
}

export interface Sq1PblComputedImage {
  url: string;
  sha256: string;
  bytes: number;
  extension: '.png' | '.svg';
  mime: 'image/png' | 'image/svg+xml';
  pixels?: [number, number];
  source:
    | { kind: 'direct'; inputCell: string }
    | { kind: 'derived'; imageCell: string };
}

export interface Sq1PblCell {
  ref: string;
  type?: string;
  value?: string | number | boolean | null;
  cached?: string | number | boolean | null;
  formula?: Sq1PblFormula;
  style?: string;
  richText?: Sq1PblJsonObject;
  computedImage?: Sq1PblComputedImage;
}

export interface Sq1PblNote {
  ref: string;
  author?: string;
  text: string;
}

export interface Sq1PblHyperlink {
  ref: string;
  location?: string;
  display?: string;
  tooltip?: string;
  target?: string;
  targetMode?: string;
}

export interface Sq1PblStyleRange {
  ref: string;
  style: string;
}

export interface Sq1PblSheetStyles {
  cell: Record<string, Sq1PblJsonObject>;
  differential: Record<string, Sq1PblJsonObject>;
}

export type Sq1PblRow = Record<string, string>;
export type Sq1PblColumn = Record<string, string>;
export type Sq1PblPane = Record<string, string>;

export interface Sq1PblImageMarker {
  col?: number;
  colOff?: number;
  row?: number;
  rowOff?: number;
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
}

export interface Sq1PblPicture {
  type?: string;
  from?: Sq1PblImageMarker;
  to?: Sq1PblImageMarker;
  pos?: Sq1PblImageMarker;
  ext?: Sq1PblImageMarker;
  image: {
    sha256: string;
    bytes?: number;
    extension?: string;
    pixels?: [number, number];
    descr?: string;
    title?: string;
    url?: string;
  };
}

export interface Sq1PblSheet {
  schemaVersion: number;
  index: number;
  name: string;
  slug: string;
  state: string;
  dimension: string;
  counts?: Record<string, unknown>;
  cells: Sq1PblCell[];
  styleRanges: Sq1PblStyleRange[];
  styles: Sq1PblSheetStyles;
  notes: Sq1PblNote[];
  hyperlinks: Sq1PblHyperlink[];
  merges: string[];
  pictures: Sq1PblPicture[];
  rows: Sq1PblRow[];
  columns: Sq1PblColumn[];
  pane: Sq1PblPane | null;
  validations: Sq1PblJsonObject[];
  conditionalFormatting: Sq1PblJsonObject[];
  autoFilter: Sq1PblJsonObject | null;
  tables: Sq1PblJsonObject[];
  nonPictureDrawingAnchors: number;
}

function record(value: unknown, message: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as JsonRecord;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function requiredArray(value: unknown, message: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(message);
  return value;
}

function string(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function requiredNonNegativeInteger(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(message);
  return value;
}

function requiredPositiveInteger(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error(message);
  return value;
}

function requiredString(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value) throw new Error(message);
  return value;
}

function schemaVersion(value: unknown, context: string): number {
  if (value !== SQ1_PBL_SCHEMA_VERSION) {
    throw new Error(`Unsupported ${context} schema version`);
  }
  return SQ1_PBL_SCHEMA_VERSION;
}

function number(value: unknown, fallback = 0): number {
  return optionalNumber(value) ?? fallback;
}

function scalar(value: unknown): string | number | boolean | null | undefined {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value)
    ? value as string | number | boolean | null
    : undefined;
}

function optionalScalar(value: unknown, message: string): string | number | boolean | null | undefined {
  if (value === undefined) return undefined;
  const parsed = scalar(value);
  if (parsed === undefined) throw new Error(message);
  return parsed;
}

const EXCEL_DAY_MS = 86_400_000;

/** Formats the numeric subset used by the workbook snapshot without executing formulas. */
export function formatSq1PblNumericValue(value: number, formatCode: string | undefined): string | null {
  if (!Number.isFinite(value) || !formatCode || formatCode === 'builtin:49') {
    return null;
  }
  if (formatCode === 'builtin:0') return String(value);
  if (formatCode === 'builtin:1') return Math.round(value).toFixed(0);
  if (formatCode === 'builtin:2') return value.toFixed(2);
  if (formatCode === 'builtin:9') return `${(value * 100).toFixed(0)}%`;
  if (formatCode === 'builtin:10') return `${(value * 100).toFixed(2)}%`;

  const normalized = formatCode.toLowerCase();
  if (/^m{1,2}\/d{1,2}\/y{2,4}$/.test(normalized)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * EXCEL_DAY_MS);
    if (!Number.isFinite(date.getTime())) return null;
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    return `${normalized.startsWith('mm') ? String(month).padStart(2, '0') : month}/${normalized.includes('/dd/') ? String(day).padStart(2, '0') : day}/${normalized.endsWith('yyyy') ? year : String(year).slice(-2)}`;
  }

  const numericPattern = formatCode.split(';')[0];
  const decimalMatch = numericPattern.match(/\.(0+)/);
  if (!/[0#]/.test(numericPattern)) return null;
  const digits = decimalMatch?.[1].length ?? 0;
  const percent = numericPattern.includes('%');
  const scaled = percent ? value * 100 : value;
  const prefix = [...numericPattern.matchAll(/"([^"]*)"/g)].map(match => match[1]).join('');
  const formatted = numericPattern.includes(',')
    ? scaled.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : scaled.toFixed(digits);
  return `${prefix}${formatted}${percent ? '%' : ''}`;
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as JsonRecord)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function jsonValue(value: unknown, message: string, depth = 0): Sq1PblJsonValue {
  if (depth > 32) throw new Error(message);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(item => jsonValue(item, message, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, item]) => [key, jsonValue(item, message, depth + 1)]),
    );
  }
  throw new Error(message);
}

function jsonObject(value: unknown, message: string): Sq1PblJsonObject {
  const parsed = jsonValue(value, message);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(message);
  return parsed;
}

function jsonObjectArray(value: unknown, message: string): Sq1PblJsonObject[] {
  return requiredArray(value, message).map(item => jsonObject(item, message));
}

function stringObject(value: unknown, message: string): Record<string, string> {
  const source = record(value, message);
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(source)) {
    if (typeof item !== 'string') throw new Error(message);
    result[key] = item;
  }
  return result;
}

function jsonObjectMap(value: unknown, message: string): Record<string, Sq1PblJsonObject> {
  const source = record(value, message);
  return Object.fromEntries(
    Object.entries(source).map(([key, item]) => [key, jsonObject(item, message)]),
  );
}

function imagePixels(value: unknown, message: string): [number, number] | undefined {
  if (value === undefined) return undefined;
  const raw = requiredArray(value, message);
  if (raw.length !== 2 || raw.some(part => typeof part !== 'number' || !Number.isFinite(part) || part <= 0)) {
    throw new Error(message);
  }
  return raw as [number, number];
}

function formulaImageFields(value: unknown, message: string) {
  const raw = record(value, message);
  const url = string(raw.url);
  const sha256 = string(raw.sha256);
  const extension = raw.extension;
  const mime = raw.mime;
  const bytes = requiredNonNegativeInteger(raw.bytes, message);
  if (!/^[a-f0-9]{64}$/.test(sha256)
    || (extension !== '.png' && extension !== '.svg')
    || (mime !== 'image/png' && mime !== 'image/svg+xml')
    || (extension === '.png' ? mime !== 'image/png' : mime !== 'image/svg+xml')
    || url !== `/data/sq1-pbl/formula-media/${sha256}${extension}`) {
    throw new Error(message);
  }
  return {
    raw,
    url,
    sha256,
    bytes,
    extension,
    mime,
    pixels: imagePixels(raw.pixels, message),
  } as const;
}

function computedImage(value: unknown, ref: string): Sq1PblComputedImage | undefined {
  if (value === undefined) return undefined;
  const message = `Invalid SQ1 PBL computed image at ${ref}`;
  const image = formulaImageFields(value, message);
  const source = record(image.raw.source, message);
  if (source.kind === 'direct') {
    const inputCell = string(source.inputCell);
    if (!inputCell) throw new Error(message);
    return {
      url: image.url,
      sha256: image.sha256,
      bytes: image.bytes,
      extension: image.extension,
      mime: image.mime,
      pixels: image.pixels,
      source: { kind: 'direct', inputCell },
    };
  }
  if (source.kind === 'derived') {
    const imageCell = string(source.imageCell);
    if (!imageCell) throw new Error(message);
    return {
      url: image.url,
      sha256: image.sha256,
      bytes: image.bytes,
      extension: image.extension,
      mime: image.mime,
      pixels: image.pixels,
      source: { kind: 'derived', imageCell },
    };
  }
  throw new Error(message);
}

function formulaImages(value: unknown): Sq1PblFormulaImages | undefined {
  if (value === undefined) return undefined;
  const message = 'Invalid SQ1 PBL formula image manifest';
  const raw = record(value, message);
  const mimeCounts = record(raw.mimeCounts, message);
  const parsedMimeCounts = Object.fromEntries(
    Object.entries(mimeCounts).map(([mime, count]) => [mime, requiredNonNegativeInteger(count, message)]),
  );
  const assets = requiredArray(raw.assets, message).map((value): Sq1PblFormulaImageAsset => {
    const image = formulaImageFields(value, message);
    return {
      url: image.url,
      sha256: image.sha256,
      bytes: image.bytes,
      extension: image.extension,
      mime: image.mime,
      pixels: image.pixels,
      sourceCellCount: requiredNonNegativeInteger(image.raw.sourceCellCount, message),
      requestDigests: requiredArray(image.raw.requestDigests, message).map((digest) => {
        if (typeof digest !== 'string' || !digest) throw new Error(message);
        return digest;
      }),
    };
  });
  return {
    sourceCells: requiredNonNegativeInteger(raw.sourceCells, message),
    directFormulaCells: requiredNonNegativeInteger(raw.directFormulaCells, message),
    derivedFormulaCells: requiredNonNegativeInteger(raw.derivedFormulaCells, message),
    uniqueRequests: requiredNonNegativeInteger(raw.uniqueRequests, message),
    uniqueAssets: requiredNonNegativeInteger(raw.uniqueAssets, message),
    bytes: requiredNonNegativeInteger(raw.bytes, message),
    mimeCounts: parsedMimeCounts,
    assets,
  };
}

function marker(value: unknown, message: string): Sq1PblImageMarker | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = record(value, message);
  const result: Sq1PblImageMarker = {};
  for (const key of ['col', 'colOff', 'row', 'rowOff', 'x', 'y', 'cx', 'cy'] as const) {
    const part = raw[key];
    if (part === undefined) continue;
    const parsed = optionalNumber(part);
    if (parsed === undefined) throw new Error(message);
    result[key] = parsed;
  }
  if (!Object.keys(result).length) throw new Error(message);
  return result;
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal, cache: 'force-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function loadSq1PblManifest(signal?: AbortSignal): Promise<Sq1PblManifest> {
  const manifestMessage = 'Invalid SQ1 PBL manifest';
  const raw = record(await fetchJson('/data/sq1-pbl/manifest.json', signal), manifestMessage);
  const parsedSchemaVersion = schemaVersion(raw.schemaVersion, 'SQ1 PBL manifest');
  const source = record(raw.source, 'Invalid SQ1 PBL manifest source');
  const sourceUrl = requiredString(source.url ?? source.documentUrl, 'Invalid SQ1 PBL manifest source');
  const sheets = requiredArray(raw.sheets, manifestMessage).map((value): Sq1PblSheetRef => {
    const item = record(value, 'Invalid SQ1 PBL sheet reference');
    const index = requiredPositiveInteger(item.index, 'Invalid SQ1 PBL sheet reference');
    const name = requiredString(item.name, `Invalid SQ1 PBL sheet reference at ${index}`);
    const slug = requiredString(item.slug, `Invalid SQ1 PBL sheet reference at ${index}`);
    const dataUrl = requiredString(item.dataUrl, `Invalid SQ1 PBL sheet reference at ${index}`);
    return {
      index,
      name,
      slug,
      dataUrl,
      state: requiredString(item.state, `Invalid SQ1 PBL sheet reference at ${index}`),
      dimension: requiredString(item.dimension, `Invalid SQ1 PBL sheet reference at ${index}`),
      counts: objectRecord(item.counts),
    };
  });
  if (!sheets.length) throw new Error('SQ1 PBL manifest has no sheets');
  if (new Set(sheets.map(sheet => sheet.index)).size !== sheets.length
    || new Set(sheets.map(sheet => sheet.slug)).size !== sheets.length) {
    throw new Error('SQ1 PBL manifest has duplicate sheets');
  }

  const media = requiredArray(raw.media, manifestMessage).map((value): Sq1PblMedia => {
    const message = 'Invalid SQ1 PBL workbook media';
    const item = record(value, message);
    const sha256 = requiredString(item.sha256, message);
    const url = requiredString(item.url, message);
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error(message);
    return {
      sha256,
      url,
      bytes: item.bytes === undefined ? undefined : requiredNonNegativeInteger(item.bytes, message),
      extension: optionalString(item.extension),
      pixels: imagePixels(item.pixels, message),
    };
  });

  return {
    schemaVersion: parsedSchemaVersion,
    source: {
      kind: optionalString(source.kind),
      url: sourceUrl,
      rawSha256: optionalString(source.rawSha256),
      title: optionalString(source.title),
      documentId: optionalString(source.documentId),
      documentUrl: optionalString(source.documentUrl),
      downloadUrl: optionalString(source.downloadUrl),
      contentDigest: optionalString(source.contentDigest),
      presentationDigest: optionalString(source.presentationDigest),
    },
    generatedAt: optionalString(raw.generatedAt),
    dataBaseUrl: optionalString(raw.dataBaseUrl),
    totals: objectRecord(raw.totals),
    invariants: objectRecord(raw.invariants),
    definedNames: requiredArray(raw.definedNames, manifestMessage)
      .map(item => jsonValue(item, 'Invalid SQ1 PBL defined name')),
    exclusions: requiredArray(raw.exclusions, manifestMessage)
      .map(item => jsonValue(item, 'Invalid SQ1 PBL exclusion')),
    media,
    formulaImages: formulaImages(raw.formulaImages),
    sheets,
  };
}

export async function loadSq1PblSheet(sheetRef: Sq1PblSheetRef, signal?: AbortSignal): Promise<Sq1PblSheet> {
  const sheetMessage = 'Invalid SQ1 PBL sheet data';
  const raw = record(await fetchJson(sheetRef.dataUrl, signal), sheetMessage);
  const parsedSchemaVersion = schemaVersion(raw.schemaVersion, 'SQ1 PBL sheet');
  const index = requiredPositiveInteger(raw.index, sheetMessage);
  const name = requiredString(raw.name, sheetMessage);
  const slug = requiredString(raw.slug, sheetMessage);
  const state = requiredString(raw.state, sheetMessage);
  const dimension = requiredString(raw.dimension, sheetMessage);
  if (index !== sheetRef.index || name !== sheetRef.name || slug !== sheetRef.slug
    || state !== sheetRef.state || dimension !== sheetRef.dimension) {
    throw new Error('SQ1 PBL sheet identity does not match manifest');
  }
  const cells = requiredArray(raw.cells, sheetMessage).map((value): Sq1PblCell => {
    const item = record(value, 'Invalid SQ1 PBL cell');
    const ref = requiredString(item.ref, 'Invalid SQ1 PBL cell').toUpperCase();
    if (!/^[A-Z]{1,4}[1-9]\d*$/.test(ref)) throw new Error(`Invalid SQ1 PBL cell at ${ref}`);
    let formula: Sq1PblFormula | undefined;
    if (item.formula !== undefined) {
      const rawFormula = record(item.formula, `Invalid SQ1 PBL formula at ${ref}`);
      const text = optionalString(rawFormula.text);
      const template = optionalString(rawFormula.template);
      if (!text && !template) throw new Error(`Invalid SQ1 PBL formula at ${ref}`);
      formula = {
        text,
        template,
        sharedMaster: optionalString(rawFormula.sharedMaster),
        sharedRange: optionalString(rawFormula.sharedRange),
        type: optionalString(rawFormula.type),
        ref: optionalString(rawFormula.ref),
        attrs: stringRecord(rawFormula.attrs),
      };
    }
    const richText = item.richText === undefined
      ? undefined
      : jsonObject(item.richText, `Invalid SQ1 PBL rich text at ${ref}`);
    return {
      ref,
      type: optionalString(item.type),
      value: optionalScalar(item.value, `Invalid SQ1 PBL value at ${ref}`),
      cached: optionalScalar(item.cached, `Invalid SQ1 PBL cached value at ${ref}`),
      formula,
      style: optionalString(item.style),
      richText,
      computedImage: computedImage(item.computedImage, ref),
    };
  });

  const notes = requiredArray(raw.notes, sheetMessage).map((value): Sq1PblNote => {
    const message = 'Invalid SQ1 PBL note';
    const item = record(value, message);
    const ref = requiredString(item.ref, message).toUpperCase();
    if (typeof item.text !== 'string') throw new Error(message);
    return { ref, text: item.text, author: optionalString(item.author) };
  });

  const hyperlinks = requiredArray(raw.hyperlinks, sheetMessage).map((value): Sq1PblHyperlink => {
    const message = 'Invalid SQ1 PBL hyperlink';
    const item = record(value, message);
    const ref = requiredString(item.ref, message).toUpperCase();
    return {
      ref,
      location: optionalString(item.location),
      display: optionalString(item.display),
      tooltip: optionalString(item.tooltip),
      target: optionalString(item.target),
      targetMode: optionalString(item.targetMode),
    };
  });

  const pictures = requiredArray(raw.pictures, sheetMessage).map((value): Sq1PblPicture => {
    const message = 'Invalid SQ1 PBL picture';
    const item = record(value, message);
    const image = record(item.image, message);
    const sha256 = requiredString(image.sha256, message);
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error(message);
    return {
      type: optionalString(item.type),
      from: marker(item.from, message),
      to: marker(item.to, message),
      pos: marker(item.pos, message),
      ext: marker(item.ext, message),
      image: {
        sha256,
        bytes: image.bytes === undefined ? undefined : requiredNonNegativeInteger(image.bytes, message),
        extension: optionalString(image.extension),
        pixels: imagePixels(image.pixels, message),
        descr: optionalString(image.descr),
        title: optionalString(image.title),
        url: optionalString(image.url),
      },
    };
  });

  const styleRanges = requiredArray(raw.styleRanges, 'Invalid SQ1 PBL style ranges').map((value): Sq1PblStyleRange => {
    const item = record(value, 'Invalid SQ1 PBL style range');
    const ref = string(item.ref).toUpperCase();
    const style = string(item.style);
    if (!ref || !style) throw new Error('Invalid SQ1 PBL style range');
    return { ref, style };
  });
  const rawStyles = record(raw.styles, 'Invalid SQ1 PBL styles');
  const pane = raw.pane === null
    ? null
    : stringObject(raw.pane, 'Invalid SQ1 PBL frozen pane');
  const autoFilter = raw.autoFilter === null
    ? null
    : jsonObject(raw.autoFilter, 'Invalid SQ1 PBL auto filter');
  const nonPictureDrawingAnchors = number(raw.nonPictureDrawingAnchors, -1);
  if (!Number.isInteger(nonPictureDrawingAnchors) || nonPictureDrawingAnchors < 0) {
    throw new Error('Invalid SQ1 PBL non-picture drawing anchor count');
  }

  return {
    schemaVersion: parsedSchemaVersion,
    index,
    name,
    slug,
    state,
    dimension,
    counts: objectRecord(raw.counts),
    cells,
    styleRanges,
    styles: {
      cell: jsonObjectMap(rawStyles.cell, 'Invalid SQ1 PBL cell styles'),
      differential: jsonObjectMap(rawStyles.differential, 'Invalid SQ1 PBL differential styles'),
    },
    notes,
    hyperlinks,
    merges: requiredArray(raw.merges, 'Invalid SQ1 PBL merges').map((value) => {
      if (typeof value !== 'string' || !value) throw new Error('Invalid SQ1 PBL merge');
      return value;
    }),
    pictures,
    rows: requiredArray(raw.rows, 'Invalid SQ1 PBL rows')
      .map(value => stringObject(value, 'Invalid SQ1 PBL row')),
    columns: requiredArray(raw.columns, 'Invalid SQ1 PBL columns')
      .map(value => stringObject(value, 'Invalid SQ1 PBL column')),
    pane,
    validations: jsonObjectArray(raw.validations, 'Invalid SQ1 PBL data validation'),
    conditionalFormatting: jsonObjectArray(raw.conditionalFormatting, 'Invalid SQ1 PBL conditional formatting'),
    autoFilter,
    tables: jsonObjectArray(raw.tables, 'Invalid SQ1 PBL table'),
    nonPictureDrawingAnchors,
  };
}

function pll(value: unknown): Sq1PblPll | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as JsonRecord;
  const name = string(item.name);
  const topSetup = string(item.topSetup);
  const bottomSetup = string(item.bottomSetup);
  if (!name || !topSetup || !bottomSetup) return null;
  return { name, topSetup, bottomSetup, parity: item.parity === true };
}

function auxiliary(value: unknown): Sq1PblAuxiliary | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as JsonRecord;
  const name = string(item.name);
  const sequence = string(item.sequence);
  return name && sequence ? { name, sequence } : null;
}

export async function loadSq1PblFinderDefaults(signal?: AbortSignal): Promise<Sq1PblFinderDefaults> {
  const raw = record(await fetchJson('/data/sq1-pbl/finder-defaults.json', signal), 'Invalid SQ1 PBL finder defaults');
  const provenance = record(raw.provenance, 'Invalid SQ1 PBL finder provenance');
  const licenseStatus = record(raw.licenseStatus, 'Invalid SQ1 PBL finder license status');
  const plls = record(raw.plls, 'Invalid SQ1 PBL finder PLLs');
  const standard = array(plls.standard).map(pll).filter((item): item is Sq1PblPll => item !== null);
  const parity = array(plls.parity).map(pll).filter((item): item is Sq1PblPll => item !== null);
  const algorithms = array(raw.auxiliaryAlgorithms).map(auxiliary).filter((item): item is Sq1PblAuxiliary => item !== null);
  if (!standard.length || !parity.length || !algorithms.length) throw new Error('Incomplete SQ1 PBL finder defaults');

  return {
    schemaVersion: number(raw.schemaVersion, 1),
    provenance: {
      application: string(provenance.application),
      authors: array(provenance.authors).filter((value): value is string => typeof value === 'string'),
      sourceUrl: string(provenance.sourceUrl),
      sourceSha256: string(provenance.sourceSha256),
    },
    licenseStatus: {
      status: string(licenseStatus.status),
      redistributionPermission: string(licenseStatus.redistributionPermission),
      notice: string(licenseStatus.notice),
    },
    plls: { standard, parity },
    auxiliaryAlgorithms: algorithms,
  };
}
