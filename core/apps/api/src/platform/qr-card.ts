import QRCode from 'qrcode';
import * as opentype from 'opentype.js';
import { renderFromSimpleQuery } from '@cuberoot/visualcube';
import frontCityArt from './card-assets/front-city.webp?inline';
import frontInkArt from './card-assets/front-ink.webp?inline';
import monoTtf from './card-assets/jetbrains-mono-500.ttf?inline';
import monoWoff2 from './card-assets/jetbrains-mono-latin-500-normal.woff2?inline';
import { badRequest } from './errors.js';
import { isObject, type JsonObject } from './validation.js';

export type QrCardElement = 'quote' | 'brand' | 'backText' | 'term' | 'qr' | 'alg' | 'front' | 'back';
export type QrCardTextElement = 'quote' | 'brand' | 'backText' | 'term' | 'alg';

export interface QrCardTransform {
  x: number;
  y: number;
  s?: number;
  fit?: 'contain' | 'cover';
}

export interface QrCardTextStyle {
  font?: 'sans' | 'serif' | 'kai' | 'round' | 'mono';
  color?: string;
  size?: number;
  stroke?: string;
  strokeW?: number;
  hidden?: boolean;
}

export interface QrCardCustomText {
  id: string;
  side: 'front' | 'back';
  text: string;
  x: number;
  y: number;
  style?: Omit<QrCardTextStyle, 'hidden'>;
}

export interface QrCardDesign {
  intro?: string;
  term?: string;
  quote?: string;
  brand?: string;
  frontArt?: string;
  backArt?: string;
  frontArtPrompt?: string;
  alg?: { name?: string; moves: string; url?: string };
  layout?: Partial<Record<QrCardElement, QrCardTransform>>;
  textStyles?: Partial<Record<QrCardTextElement, QrCardTextStyle>>;
  customTexts?: QrCardCustomText[];
}

export interface QrCardRenderOptions {
  bleed: number;
  cropMarks: boolean;
  pattern: boolean;
  noArt: boolean;
  download: boolean;
  idx: number;
}

export interface QrCardRenderEntry {
  code: string;
  title: string;
  targetKind: 'internal_path' | 'external_url' | 'content';
  targetValue: string;
  card: QrCardDesign;
}

export interface QrCardResolvedContent {
  quote: string;
  quoteMain: string;
  quoteSubs: string[];
  brand: string;
  backMain: string;
  backSub: string;
  term: string;
  hasAlgorithm: boolean;
  algorithmMoves: string;
}

const CARD_KEYS = ['intro', 'term', 'quote', 'brand', 'frontArt', 'backArt', 'frontArtPrompt', 'alg', 'layout', 'textStyles', 'customTexts'] as const;
const CARD_ELEMENTS: QrCardElement[] = ['quote', 'brand', 'backText', 'term', 'qr', 'alg', 'front', 'back'];
const TEXT_ELEMENTS: QrCardTextElement[] = ['quote', 'brand', 'backText', 'term', 'alg'];
const ART_ELEMENTS = new Set<QrCardElement>(['front', 'back']);
const SCALE_ELEMENTS = new Set<QrCardElement>(['front', 'back', 'qr']);
const FONT_KEYS = new Set(['sans', 'serif', 'kai', 'round', 'mono']);
const IMAGE_DATA_URI = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
export const QR_CARD_FRONT_ARTS = ['/card/front-ink.webp', '/card/front-city.webp'] as const;
const BUILTIN_ART = new Map<string, string>([
  [QR_CARD_FRONT_ARTS[0], frontInkArt],
  [QR_CARD_FRONT_ARTS[1], frontCityArt],
]);
const MAX_ART_BYTES = 1_500_000;
// Two artwork slots may each contain 1.5 MB before base64 expansion.
const MAX_CARD_JSON_BYTES = 4_100_000;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const PANEL_W = 20;
const PANEL_H = 40;
const BRAND = '#2A5DF4';
const BRAND_DARK = '#1E4ACB';
const INK = '#11111A';
const FONT = "-apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";
const FONT_STACKS: Record<string, string> = {
  sans: FONT,
  serif: "'Songti SC', 'Noto Serif SC', 'SimSun', serif",
  kai: "'Kaiti SC', 'STKaiti', 'KaiTi', 'Noto Serif SC', serif",
  round: "'Yuanti SC', 'Hiragino Maru Gothic ProN', 'Microsoft YaHei', sans-serif",
  mono: MONO,
};
const CUBE_FACES = ['#C41E3A', '#FFFFFF', '#0051BA', '#FF8A00', '#FFD500', '#009E60', '#FFFFFF', '#C41E3A', '#FFD500'];
const DEFAULT_QUOTES = [
  '慢就是快\n一次打乱 一次成长',
  '拧的是方块\n解的是心境',
  '手指快\n不如脑子快',
  '三阶之上\n皆是热爱',
  '热爱可抵\n万次打乱',
  '每一次复原\n都是新的开始',
];
const FORMULA_TOKENS = [
  "R U R' U'", 'F2L', 'CFOP', 'OLL', 'PLL', "R' D' R D", "U R U' R'",
  'Cross', "F R U R' U' F'", 'ZBLL', 'Sune', 'T-Perm', 'Roux', 'ZZ',
  'Petrus', "L' U' L U", "x2 y'", "R U2 R'", 'COLL', 'Mehta', 'Heise',
];

function rejectUnknownKeys(value: JsonObject, allowed: readonly string[], path: string): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unknown) badRequest(`${path}.${unknown} is not supported`);
}

function optionalText(value: JsonObject, key: string, path: string, max: number): string | undefined {
  const raw = value[key];
  if (raw == null || raw === '') return undefined;
  if (typeof raw !== 'string') badRequest(`${path}.${key} must be a string or null`);
  const normalized = raw.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return undefined;
  if (normalized.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) {
    badRequest(`${path}.${key} has an invalid length or contains control characters`);
  }
  return normalized;
}

function finiteNumber(value: JsonObject, key: string, path: string, min: number, max: number, required = false): number | undefined {
  const raw = value[key];
  if (raw == null) {
    if (required) badRequest(`${path}.${key} is required`);
    return undefined;
  }
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < min || raw > max) {
    badRequest(`${path}.${key} must be a finite number between ${min} and ${max}`);
  }
  return Math.round(raw * 100) / 100;
}

function imageDataUri(value: JsonObject, key: 'frontArt' | 'backArt'): string | undefined {
  const raw = optionalText(value, key, 'card', MAX_ART_BYTES * 2);
  if (!raw) return undefined;
  if (BUILTIN_ART.has(raw)) return raw;
  const match = IMAGE_DATA_URI.exec(raw);
  if (!match || match[2]!.length % 4 !== 0) {
    badRequest(`card.${key} must be a base64 PNG, JPEG, or WebP data URI`);
  }
  const bytes = Buffer.from(match[2]!, 'base64');
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ART_BYTES) {
    badRequest(`card.${key} exceeds the ${MAX_ART_BYTES}-byte limit`);
  }
  const mime = match[1];
  const isPng = mime === 'png' && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = mime === 'jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = mime === 'webp' && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!isPng && !isJpeg && !isWebp) badRequest(`card.${key} data does not match its image MIME type`);
  return raw;
}

export function resolveQrCardContent(
  entry: QrCardRenderEntry,
  index = 0,
): QrCardResolvedContent {
  const card = entry.card;
  const quote = card.quote?.trim()
    || DEFAULT_QUOTES[Math.max(0, Math.floor(index)) % DEFAULT_QUOTES.length]!;
  const quoteLines = quote.split('\n').map((line) => line.trim()).filter(Boolean);
  const hasAlgorithm = Boolean(card.alg?.moves.trim()) && !card.textStyles?.alg?.hidden;
  return {
    quote,
    quoteMain: quoteLines[0] || '热爱魔方',
    quoteSubs: quoteLines.slice(1),
    brand: card.brand?.trim() || '魔方开放社群',
    backMain: entry.title.trim() || '扫码直达',
    backSub: card.intro?.trim() || '',
    term: hasAlgorithm ? '' : card.term?.trim() || '',
    hasAlgorithm,
    algorithmMoves: hasAlgorithm ? card.alg!.moves.trim() : '',
  };
}

export function resolveQrCardArtwork(
  card: QrCardDesign,
  options: Pick<QrCardRenderOptions, 'idx' | 'noArt'>,
): { frontArt?: string; backArt?: string } {
  if (options.noArt) return {};
  const artworkIndex = Math.max(0, Math.floor(options.idx));
  const frontSource = card.frontArt || QR_CARD_FRONT_ARTS[artworkIndex % QR_CARD_FRONT_ARTS.length]!;
  return {
    frontArt: BUILTIN_ART.get(frontSource) || frontSource,
    ...(card.backArt ? { backArt: BUILTIN_ART.get(card.backArt) || card.backArt } : {}),
  };
}

export function qrCardAlgorithmView(algorithm: NonNullable<QrCardDesign['alg']>): 'oll' | 'f2l' | 'pll' {
  const name = algorithm.name?.toLowerCase() || '';
  if (name.includes('f2l')) return 'f2l';
  if (name.includes('pll')) return 'pll';
  return 'oll';
}

let parsedMonoFont: opentype.Font | null | undefined;

function monoFont(): opentype.Font | null {
  if (parsedMonoFont !== undefined) return parsedMonoFont;
  try {
    const base64 = monoTtf.slice(monoTtf.indexOf(',') + 1);
    const bytes = Buffer.from(base64, 'base64');
    parsedMonoFont = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  } catch {
    parsedMonoFont = null;
  }
  return parsedMonoFont;
}

function algorithmMovesPath(moves: string, size: number): { d: string; width: number } | undefined {
  const font = monoFont();
  if (!font || !moves) return undefined;
  try {
    const path = font.getPath(moves, 0, 0, size);
    const d = path.toPathData(3);
    return d ? { d, width: font.getAdvanceWidth(moves, size) } : undefined;
  } catch {
    return undefined;
  }
}

function algorithmCaseSvg(algorithm: NonNullable<QrCardDesign['alg']>): string | undefined {
  try {
    return renderFromSimpleQuery({
      case: algorithm.moves,
      view: qrCardAlgorithmView(algorithm),
      size: 120,
    });
  } catch {
    return undefined;
  }
}

function embedSvg(svg: string, x: number, y: number, size: number): string {
  const inner = svg.replace(/^<\?xml[^>]*>\s*/i, '').trim();
  return inner.replace(/^<svg([^>]*)>/i, (_match, attributes: string) => {
    const cleaned = attributes.replace(/\s(width|height|x|y)="[^"]*"/gi, '');
    return `<svg${cleaned} x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${size}" height="${size}">`;
  });
}

function parseStyle(raw: unknown, path: string, allowHidden: boolean): QrCardTextStyle {
  if (!isObject(raw)) badRequest(`${path} must be an object`);
  rejectUnknownKeys(raw, allowHidden
    ? ['font', 'color', 'size', 'stroke', 'strokeW', 'hidden']
    : ['font', 'color', 'size', 'stroke', 'strokeW'], path);
  const out: QrCardTextStyle = {};
  if (raw.font != null) {
    if (typeof raw.font !== 'string' || !FONT_KEYS.has(raw.font)) badRequest(`${path}.font is not supported`);
    out.font = raw.font as QrCardTextStyle['font'];
  }
  for (const key of ['color', 'stroke'] as const) {
    if (raw[key] != null) {
      if (typeof raw[key] !== 'string' || !HEX_COLOR.test(raw[key])) badRequest(`${path}.${key} must be a six-digit hex color`);
      out[key] = raw[key].toUpperCase();
    }
  }
  const size = finiteNumber(raw, 'size', path, 0.3, 3);
  const strokeW = finiteNumber(raw, 'strokeW', path, 0, 1);
  if (size != null) out.size = size;
  if (strokeW != null && strokeW > 0) out.strokeW = strokeW;
  if ((out.stroke != null) !== (out.strokeW != null)) {
    badRequest(`${path}.stroke and a positive strokeW must be provided together`);
  }
  if (allowHidden && raw.hidden != null) {
    if (typeof raw.hidden !== 'boolean') badRequest(`${path}.hidden must be a boolean`);
    out.hidden = raw.hidden;
  }
  return out;
}

function parseAlg(raw: unknown): QrCardDesign['alg'] {
  if (raw == null) return undefined;
  if (!isObject(raw)) badRequest('card.alg must be an object or null');
  rejectUnknownKeys(raw, ['name', 'moves', 'url'], 'card.alg');
  const moves = optionalText(raw, 'moves', 'card.alg', 500);
  if (!moves) badRequest('card.alg.moves is required');
  const name = optionalText(raw, 'name', 'card.alg', 160);
  const url = optionalText(raw, 'url', 'card.alg', 2000);
  if (url) {
    if (url.startsWith('//')) badRequest('card.alg.url must be a site path or an http/https URL');
    if (!url.startsWith('/')) {
      let parsed: URL;
      try { parsed = new URL(url); } catch { badRequest('card.alg.url must be a site path or an http/https URL'); }
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        badRequest('card.alg.url must be a site path or an http/https URL');
      }
    }
  }
  return { ...(name ? { name } : {}), moves, ...(url ? { url } : {}) };
}

function parseLayout(raw: unknown): QrCardDesign['layout'] {
  if (raw == null) return undefined;
  if (!isObject(raw)) badRequest('card.layout must be an object or null');
  rejectUnknownKeys(raw, CARD_ELEMENTS, 'card.layout');
  const out: Partial<Record<QrCardElement, QrCardTransform>> = {};
  for (const key of CARD_ELEMENTS) {
    const item = raw[key];
    if (item == null) continue;
    if (!isObject(item)) badRequest(`card.layout.${key} must be an object`);
    rejectUnknownKeys(item, ['x', 'y', 's', 'fit'], `card.layout.${key}`);
    const x = finiteNumber(item, 'x', `card.layout.${key}`, -40, 40, true)!;
    const y = finiteNumber(item, 'y', `card.layout.${key}`, -40, 40, true)!;
    const result: QrCardTransform = { x, y };
    if (item.s != null) {
      if (!SCALE_ELEMENTS.has(key)) badRequest(`card.layout.${key}.s is not supported`);
      result.s = finiteNumber(item, 's', `card.layout.${key}`, key === 'qr' ? 0.01 : 0.5, 3, true)!;
    }
    if (item.fit != null) {
      if (!ART_ELEMENTS.has(key) || !['contain', 'cover'].includes(String(item.fit))) {
        badRequest(`card.layout.${key}.fit is not supported`);
      }
      result.fit = item.fit as 'contain' | 'cover';
    }
    out[key] = result;
  }
  return out;
}

function parseTextStyles(raw: unknown): QrCardDesign['textStyles'] {
  if (raw == null) return undefined;
  if (!isObject(raw)) badRequest('card.textStyles must be an object or null');
  rejectUnknownKeys(raw, TEXT_ELEMENTS, 'card.textStyles');
  const out: Partial<Record<QrCardTextElement, QrCardTextStyle>> = {};
  for (const key of TEXT_ELEMENTS) {
    if (raw[key] != null) out[key] = parseStyle(raw[key], `card.textStyles.${key}`, true);
  }
  return out;
}

function parseCustomTexts(raw: unknown): QrCardCustomText[] | undefined {
  if (raw == null) return undefined;
  if (!Array.isArray(raw) || raw.length > 30) badRequest('card.customTexts must be an array of at most 30 items');
  const seen = new Set<string>();
  return raw.map((item, index) => {
    const path = `card.customTexts[${index}]`;
    if (!isObject(item)) badRequest(`${path} must be an object`);
    rejectUnknownKeys(item, ['id', 'side', 'text', 'x', 'y', 'style'], path);
    const id = optionalText(item, 'id', path, 40);
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) badRequest(`${path}.id has an invalid format`);
    if (seen.has(id)) badRequest(`${path}.id must be unique`);
    seen.add(id);
    const side = item.side;
    if (side !== 'front' && side !== 'back') badRequest(`${path}.side must be front or back`);
    const text = optionalText(item, 'text', path, 200);
    if (!text) badRequest(`${path}.text is required`);
    const x = finiteNumber(item, 'x', path, -40, 40, true)!;
    const y = finiteNumber(item, 'y', path, -40, 40, true)!;
    const style = item.style == null ? undefined : parseStyle(item.style, `${path}.style`, false);
    return { id, side, text, x, y, ...(style ? { style } : {}) };
  });
}

export function parseQrCardDesign(raw: unknown): QrCardDesign {
  if (!isObject(raw)) badRequest('card must be an object');
  rejectUnknownKeys(raw, CARD_KEYS, 'card');
  const card: QrCardDesign = {};
  const intro = optionalText(raw, 'intro', 'card', 1000);
  const term = optionalText(raw, 'term', 'card', 160);
  const quote = optionalText(raw, 'quote', 'card', 500);
  const brand = optionalText(raw, 'brand', 'card', 160);
  const frontArtPrompt = optionalText(raw, 'frontArtPrompt', 'card', 4000);
  const frontArt = imageDataUri(raw, 'frontArt');
  const backArt = imageDataUri(raw, 'backArt');
  const alg = parseAlg(raw.alg);
  const layout = parseLayout(raw.layout);
  const textStyles = parseTextStyles(raw.textStyles);
  const customTexts = parseCustomTexts(raw.customTexts);
  if (intro) card.intro = intro;
  if (term) card.term = term;
  if (quote) card.quote = quote;
  if (brand) card.brand = brand;
  if (frontArtPrompt) card.frontArtPrompt = frontArtPrompt;
  if (frontArt) card.frontArt = frontArt;
  if (backArt) card.backArt = backArt;
  if (alg) card.alg = alg;
  if (layout) card.layout = layout;
  if (textStyles) card.textStyles = textStyles;
  if (customTexts) card.customTexts = customTexts;
  if (Buffer.byteLength(JSON.stringify(card), 'utf8') > MAX_CARD_JSON_BYTES) badRequest('card is too large');
  return card;
}

export function parseQrCardRenderOptions(params: URLSearchParams): QrCardRenderOptions {
  const rawBleed = params.get('bleed');
  let bleed = 3;
  if (rawBleed != null) {
    const parsed = Number(rawBleed);
    if (Number.isFinite(parsed)) bleed = Math.max(0, Math.min(6, parsed));
  }
  const rawIdx = params.get('idx');
  const parsedIdx = rawIdx == null ? 0 : Number(rawIdx);
  const idx = Number.isSafeInteger(parsedIdx) ? Math.max(0, Math.min(1_000_000, parsedIdx)) : 0;
  return {
    bleed: Math.round(bleed * 100) / 100,
    cropMarks: params.get('crop') !== '0',
    pattern: params.get('bg') !== 'plain',
    noArt: params.get('noart') === '1',
    download: params.get('dl') === '1',
    idx,
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function shift(layout: QrCardDesign['layout'], key: QrCardElement, body: string): string {
  const transform = layout?.[key];
  return transform && (transform.x !== 0 || transform.y !== 0)
    ? `<g transform="translate(${transform.x} ${transform.y})">${body}</g>`
    : body;
}

function textSvg(x: number, y: number, size: number, fill: string, content: string, options: {
  weight?: number; mono?: boolean; spacing?: number; font?: string; stroke?: string; strokeW?: number;
} = {}): string {
  const font = options.font ?? (options.mono ? MONO : FONT);
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${options.weight ?? 400}" fill="${fill}" text-anchor="middle"${options.spacing ? ` letter-spacing="${options.spacing}"` : ''}${options.stroke && options.strokeW ? ` stroke="${options.stroke}" stroke-width="${options.strokeW}" paint-order="stroke" stroke-linejoin="round"` : ''}>${escapeXml(content)}</text>`;
}

function styled(style: QrCardTextStyle | undefined, baseSize: number, fill: string, mono = false) {
  const outlined = !!(style?.stroke && style.strokeW);
  return {
    size: Math.round(baseSize * (style?.size ?? 1) * 1000) / 1000,
    fill: style?.color ?? fill,
    font: style?.font ? FONT_STACKS[style.font]! : (mono ? MONO : FONT),
    stroke: outlined ? style!.stroke : undefined,
    strokeW: outlined ? style!.strokeW : undefined,
  };
}

function cubeLogo(x: number, y: number, size: number): string {
  const cell = size / 3;
  const gap = cell * 0.14;
  const cells = CUBE_FACES.map((color, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    const cx = x + column * cell + gap / 2;
    const cy = y + row * cell + gap / 2;
    const side = cell - gap;
    return `<rect x="${cx.toFixed(3)}" y="${cy.toFixed(3)}" width="${side.toFixed(3)}" height="${side.toFixed(3)}" rx="${(side * 0.16).toFixed(3)}" fill="${color}" stroke="${INK}" stroke-width="${(cell * 0.05).toFixed(3)}"/>`;
  });
  return `<rect x="${(x - gap / 2).toFixed(3)}" y="${(y - gap / 2).toFixed(3)}" width="${(size + gap).toFixed(3)}" height="${(size + gap).toFixed(3)}" rx="${(size * 0.12).toFixed(3)}" fill="${INK}"/>${cells.join('')}`;
}

function qrBody(value: string): { inner: string; dim: number } {
  const margin = 2;
  const qr = QRCode.create(value, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;
  const dim = size + margin * 2;
  let span = Math.round(size * 0.3);
  span = Math.max(5, Math.min(size - 2, span));
  if (span % 2 === 0) span += 1;
  const clearFrom = Math.floor((size - span) / 2);
  const clearTo = clearFrom + span - 1;
  const rects: string[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (!qr.modules.data[row * size + column]) continue;
      if (row >= clearFrom && row <= clearTo && column >= clearFrom && column <= clearTo) continue;
      rects.push(`<rect x="${margin + column}" y="${margin + row}" width="1" height="1" rx="0.18"/>`);
    }
  }
  const pad = 0.6;
  const box = margin + clearFrom - pad;
  const boxSize = span + pad * 2;
  const inset = 0.45;
  const cube = margin + clearFrom + inset;
  return {
    dim,
    inner: `<g fill="${BRAND}">${rects.join('')}</g><rect x="${box.toFixed(3)}" y="${box.toFixed(3)}" width="${boxSize.toFixed(3)}" height="${boxSize.toFixed(3)}" rx="${(boxSize * 0.18).toFixed(3)}" fill="#FFFFFF"/>${cubeLogo(cube, cube, span - inset * 2)}`,
  };
}

function faceletSpots(count = 14) {
  const hash = (index: number, seed: number) => {
    let value = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(seed + 1, 0x85ebca6b);
    value = Math.imul(value ^ (value >>> 15), 0x2b2ae35);
    value ^= value >>> 13;
    return (value >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, (_, index) => ({
    x: hash(index, 1), y: hash(index, 2), size: 1.1 + hash(index, 3) * 1.7,
    colorIndex: Math.floor(hash(index, 4) * CUBE_FACES.length), opacity: 0.1 + hash(index, 5) * 0.13,
    rotation: hash(index, 6) * 44 - 22,
  }));
}

function facelets(x0: number, top: number, clipId: string): string {
  const blocks = faceletSpots().map((spot) => {
    const x = x0 + 1 + spot.x * (PANEL_W - 3);
    const y = top + 1 + spot.y * (PANEL_H - 3);
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${spot.size.toFixed(2)}" height="${spot.size.toFixed(2)}" rx="${(spot.size * 0.2).toFixed(2)}" fill="${CUBE_FACES[spot.colorIndex]}" fill-opacity="${spot.opacity.toFixed(2)}" transform="rotate(${spot.rotation.toFixed(1)} ${(x + spot.size / 2).toFixed(2)} ${(y + spot.size / 2).toFixed(2)})"/>`;
  });
  return `<g clip-path="url(#${clipId})">${blocks.join('')}</g>`;
}

function notationPattern(x0: number, top: number): string {
  const rows: string[] = [];
  for (let row = 0; (row - 1) * 2.7 < PANEL_H + 4; row += 1) {
    const items: string[] = [];
    const start = (row * 3) % FORMULA_TOKENS.length;
    for (let index = 0; index < 6; index += 1) items.push(FORMULA_TOKENS[(start + index * 2) % FORMULA_TOKENS.length]!);
    rows.push(`<text x="${x0 + (row % 2 ? -5 : -2)}" y="${(top - 2 + row * 2.7).toFixed(2)}" font-family="${MONO}" font-size="1.4" fill="${BRAND}" fill-opacity="0.08">${escapeXml(items.join('   '))}</text>`);
  }
  return `<g clip-path="url(#backClip)"><g transform="rotate(-8 ${x0 + PANEL_W / 2} ${top + PANEL_H / 2})">${rows.join('')}</g></g>`;
}

function artLayer(art: string, x0: number, top: number, bleed: number, transform?: QrCardTransform): string {
  const cx = x0 + PANEL_W / 2;
  const cy = top + PANEL_H / 2;
  const contain = transform?.fit !== 'cover';
  const image = contain
    ? `<image href="${art}" x="${x0 + 1}" y="${top + 1}" width="${PANEL_W - 2}" height="${PANEL_H - 2}" preserveAspectRatio="xMidYMid meet"/>`
    : `<image href="${art}" x="${x0 - bleed}" y="${top - bleed}" width="${PANEL_W + bleed * 2}" height="${PANEL_H + bleed * 2}" preserveAspectRatio="xMidYMid slice"/>`;
  if (!transform) return image;
  const scale = contain ? (transform.s ?? 1) : Math.max(1, transform.s ?? 1);
  return `<g transform="translate(${transform.x} ${transform.y}) translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})">${image}</g>`;
}

function customTexts(items: QrCardCustomText[], x: number, y: number, defaultColor: string): string {
  return items.map((item) => {
    const style = styled(item.style, 2.4, defaultColor);
    const lines = item.text.split('\n');
    const lineHeight = style.size * 1.2;
    const startY = y + item.y - ((lines.length - 1) * lineHeight) / 2 + style.size * 0.35;
    return lines.map((line, index) => textSvg(x + item.x, startY + index * lineHeight, style.size, style.fill, line, {
      weight: 600, font: style.font, stroke: style.stroke, strokeW: style.strokeW,
    })).join('');
  }).join('');
}

function cropMarks(bleed: number, width: number, height: number): string {
  if (bleed <= 0) return '';
  const length = Math.min(bleed, 3);
  const segments: string[] = [];
  const segment = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#FFFFFF" stroke-width="0.3"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#111111" stroke-width="0.12"/>`;
  for (const x of [bleed, width - bleed]) {
    for (const y of [bleed, height - bleed]) {
      const ox = x === bleed ? -1 : 1;
      const oy = y === bleed ? -1 : 1;
      segments.push(segment(x + ox * (length + 0.6), y, x + ox * 0.6, y));
      segments.push(segment(x, y + oy * (length + 0.6), x, y + oy * 0.6));
    }
  }
  return segments.join('');
}

export function renderQrCardSvg(entry: QrCardRenderEntry, url: string, options: QrCardRenderOptions): string {
  const card = entry.card;
  const content = resolveQrCardContent(entry, options.idx);
  const { frontArt, backArt } = resolveQrCardArtwork(card, options);
  const width = PANEL_W * 2 + options.bleed * 2;
  const height = PANEL_H + options.bleed * 2;
  const foldX = options.bleed + PANEL_W;
  const frontX = options.bleed;
  const top = options.bleed;
  const frontCenter = frontX + PANEL_W / 2;
  const backCenter = foldX + PANEL_W / 2;
  const quoteLines = [content.quoteMain, ...content.quoteSubs];
  const mainQuote = content.quoteMain;
  const quoteStyle = styled(card.textStyles?.quote, 2.8, '#FFFFFF');
  const quoteSubStyle = styled(card.textStyles?.quote, 1.4, '#FFFFFF');
  const brandStyle = styled(card.textStyles?.brand, 1.4, '#FFFFFF');
  const mainY = top + PANEL_H - 9;
  const quoteSub = quoteLines.slice(1).map((line, index) => textSvg(frontCenter, mainY + 2 + index * 1.7 * (card.textStyles?.quote?.size ?? 1), quoteSubStyle.size, quoteSubStyle.fill, line, { font: quoteSubStyle.font, stroke: quoteSubStyle.stroke, strokeW: quoteSubStyle.strokeW })).join('');
  const quoteSvg = card.textStyles?.quote?.hidden ? '' : shift(card.layout, 'quote', textSvg(frontCenter, mainY, quoteStyle.size, quoteStyle.fill, mainQuote, { weight: 800, font: quoteStyle.font, stroke: quoteStyle.stroke, strokeW: quoteStyle.strokeW }) + quoteSub);
  const brandY = mainY + 2 + quoteLines.slice(1).length * 1.7 * (card.textStyles?.quote?.size ?? 1) + 2.6;
  const brandSvg = card.textStyles?.brand?.hidden ? '' : shift(card.layout, 'brand', textSvg(frontCenter, brandY, brandStyle.size, brandStyle.fill, content.brand, { weight: 700, spacing: 0.1, font: brandStyle.font, stroke: brandStyle.stroke, strokeW: brandStyle.strokeW }));

  const frontBg = frontArt
    ? `<rect x="0" y="0" width="${foldX}" height="${height}" fill="${INK}"/><g clip-path="url(#frontArtClip)">${artLayer(frontArt, frontX, top, options.bleed, card.layout?.front)}</g><rect x="0" y="0" width="${foldX}" height="${height}" fill="url(#frontShade)"/>`
    : `<rect x="${frontX}" y="${top}" width="${PANEL_W}" height="${PANEL_H}" fill="${INK}"/>${options.pattern ? facelets(frontX, top, 'frontClip') : ''}<rect x="${frontX}" y="${top}" width="${PANEL_W}" height="${PANEL_H}" fill="url(#frontGlow)"/>${cubeLogo(frontCenter - 3.75, top + 5, 7.5)}`;

  const backBg = `<rect x="${foldX}" y="${top}" width="${PANEL_W}" height="${PANEL_H}" fill="url(#backBg)"/>${backArt ? `<g clip-path="url(#backArtClip)">${artLayer(backArt, foldX, top, options.bleed, card.layout?.back)}</g><rect x="${foldX}" y="${top}" width="${PANEL_W}" height="${PANEL_H}" fill="#FFFFFF" fill-opacity="0.62"/>` : options.pattern ? facelets(foldX, top, 'backClip') + notationPattern(foldX, top) : ''}`;

  const hasAlg = content.hasAlgorithm;
  const qr = qrBody(url);
  const chip = 14.5;
  const padding = 0.9;
  const chipX = backCenter - chip / 2;
  const chipTop = top + (hasAlg ? 12 : 15.75);
  const qrScale = card.layout?.qr?.s ?? 1;
  const qrBodySvg = `<rect x="${chipX}" y="${chipTop}" width="${chip}" height="${chip}" rx="1.4" fill="#FFFFFF" stroke="#E5E8EE" stroke-width="0.14"/><g transform="translate(${(chipX + padding).toFixed(3)} ${(chipTop + padding).toFixed(3)}) scale(${((chip - padding * 2) / qr.dim).toFixed(4)})">${qr.inner}</g>`;
  const scaledQr = qrScale === 1 ? qrBodySvg : `<g transform="translate(${backCenter} ${chipTop + chip / 2}) scale(${qrScale}) translate(${-backCenter} ${-(chipTop + chip / 2)})">${qrBodySvg}</g>`;
  const qrSvg = shift(card.layout, 'qr', scaledQr);

  const titleStyle = styled(card.textStyles?.backText, 1.6, BRAND_DARK);
  const introStyle = styled(card.textStyles?.backText, 1.2, '#6B7280');
  const titleLines = content.backMain.split('\n');
  const introLines = content.backSub.split('\n').filter(Boolean);
  const titleY = top + 6.5;
  const titleSvg = titleLines.map((line, index) => textSvg(backCenter, titleY + index * titleStyle.size * 1.25, titleStyle.size, titleStyle.fill, line, { weight: 700, font: titleStyle.font, stroke: titleStyle.stroke, strokeW: titleStyle.strokeW })).join('');
  const introY = titleY + (titleLines.length - 1) * titleStyle.size * 1.25 + 2.9 * (card.textStyles?.backText?.size ?? 1);
  const introSvg = introLines.map((line, index) => textSvg(backCenter, introY + index * introStyle.size * 1.25, introStyle.size, introStyle.fill, line, { font: introStyle.font, stroke: introStyle.stroke, strokeW: introStyle.strokeW })).join('');
  const backTextSvg = card.textStyles?.backText?.hidden ? '' : shift(card.layout, 'backText', titleSvg + introSvg);

  const termStyle = styled(card.textStyles?.term, 1.1, BRAND_DARK);
  const termSvg = content.term && !card.textStyles?.term?.hidden
    ? shift(card.layout, 'term', `<rect x="${backCenter - (content.term.length * 1.2 + 1.8) / 2}" y="${chipTop - 3.4}" width="${content.term.length * 1.2 + 1.8}" height="2.4" rx="1.2" fill="${BRAND}" fill-opacity="0.10" stroke="${BRAND}" stroke-opacity="0.28" stroke-width="0.12"/>${textSvg(backCenter, chipTop - 1.7, termStyle.size, termStyle.fill, content.term, { weight: 700, spacing: 0.06, font: termStyle.font, stroke: termStyle.stroke, strokeW: termStyle.strokeW })}`)
    : '';
  const algStyle = styled(card.textStyles?.alg, 1.1, BRAND, true);
  let algSvg = '';
  if (hasAlg) {
    const algorithm = card.alg!;
    const caseSvg = algorithmCaseSvg(algorithm);
    const cubeSize = 6;
    const caseImage = caseSvg ? embedSvg(caseSvg, backCenter - cubeSize / 2, top + 26.8, cubeSize) : '';
    const movesY = top + 34.8;
    const style = card.textStyles?.alg;
    const isCustomized = !!(style && (style.font || style.size || style.color || style.stroke));
    const movesPath = algorithmMovesPath(content.algorithmMoves, 1.1);
    const moves = movesPath && !isCustomized
      ? `<path transform="translate(${(backCenter - movesPath.width / 2).toFixed(3)} ${movesY})" d="${movesPath.d}" fill="${BRAND}"/>`
      : textSvg(backCenter, movesY, algStyle.size, algStyle.fill, content.algorithmMoves, { weight: 500, font: algStyle.font, stroke: algStyle.stroke, strokeW: algStyle.strokeW });
    algSvg = shift(card.layout, 'alg', caseImage + moves);
  }

  const frontCustom = customTexts((card.customTexts ?? []).filter((item) => item.side === 'front'), frontCenter, top + PANEL_H / 2, '#FFFFFF');
  const backCustom = customTexts((card.customTexts ?? []).filter((item) => item.side === 'back'), backCenter, top + PANEL_H / 2, INK);
  const defs = `<defs><style>@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:400 700;src:url(${monoWoff2}) format('woff2');}</style><clipPath id="frontClip"><rect x="${frontX}" y="${top}" width="${PANEL_W}" height="${PANEL_H}"/></clipPath><clipPath id="frontArtClip"><rect x="0" y="0" width="${foldX}" height="${height}"/></clipPath><clipPath id="backArtClip"><rect x="${foldX}" y="0" width="${width - foldX}" height="${height}"/></clipPath><clipPath id="backClip"><rect x="${foldX}" y="${top}" width="${PANEL_W}" height="${PANEL_H}"/></clipPath><linearGradient id="frontGlow" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${BRAND}" stop-opacity="0.55"/><stop offset="0.45" stop-color="${BRAND}" stop-opacity="0.12"/><stop offset="1" stop-color="${BRAND}" stop-opacity="0"/></linearGradient><linearGradient id="frontShade" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${INK}" stop-opacity="0.92"/><stop offset="0.42" stop-color="${INK}" stop-opacity="0.55"/><stop offset="1" stop-color="${INK}" stop-opacity="0"/></linearGradient><linearGradient id="backBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.46" stop-color="#F5F8FF"/><stop offset="1" stop-color="#E7EEFE"/></linearGradient></defs>`;
  const bleedBg = `<rect x="0" y="0" width="${foldX}" height="${height}" fill="${INK}"/><rect x="${foldX}" y="0" width="${width - foldX}" height="${height}" fill="url(#backBg)"/>`;
  const fold = `<line x1="${foldX}" y1="${top}" x2="${foldX}" y2="${top + PANEL_H}" stroke="#111111" stroke-opacity="0.18" stroke-width="0.12" stroke-dasharray="0.8 0.8"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}" role="img" aria-label="CubeRoot QR card" data-qr-ecc="H" data-card-code="${escapeXml(entry.code)}">${defs}${bleedBg}${frontBg}${backBg}${quoteSvg}${brandSvg}${frontCustom}${backTextSvg}${termSvg}${qrSvg}${algSvg}${backCustom}${fold}${options.cropMarks ? cropMarks(options.bleed, width, height) : ''}</svg>`;
}
