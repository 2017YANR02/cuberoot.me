import { authHeaders, handleApi } from '@/lib/admin-api';
import { apiUrl } from '@/lib/api-base';

export const QR_CARD_ELEMENTS = ['quote', 'brand', 'backText', 'term', 'qr', 'alg', 'front', 'back'] as const;
export const QR_CARD_TEXT_ELEMENTS = ['quote', 'brand', 'backText', 'term', 'alg'] as const;
export const QR_CARD_FONTS = ['sans', 'serif', 'kai', 'round', 'mono'] as const;

export type QrCardElement = typeof QR_CARD_ELEMENTS[number];
export type QrCardTextElement = typeof QR_CARD_TEXT_ELEMENTS[number];
export type QrCardFont = typeof QR_CARD_FONTS[number];
export type QrCardSide = 'front' | 'back';

export interface QrCardTransform {
  x: number;
  y: number;
  s?: number;
  fit?: 'contain' | 'cover';
}

export type QrCardLayout = Partial<Record<QrCardElement, QrCardTransform>>;

export interface QrCardTextStyle {
  font?: QrCardFont;
  color?: string;
  size?: number;
  stroke?: string;
  strokeW?: number;
  hidden?: boolean;
}

export interface QrCardCustomText {
  id: string;
  side: QrCardSide;
  text: string;
  x: number;
  y: number;
  style?: QrCardTextStyle;
}

export interface QrCardAlgorithm {
  name?: string;
  moves: string;
  url?: string;
}

export interface PlatformQrCard {
  intro: string;
  term: string;
  quote: string;
  brand: string;
  frontArt: string;
  backArt: string;
  frontArtPrompt: string;
  alg: QrCardAlgorithm | null;
  layout: QrCardLayout;
  textStyles: Partial<Record<QrCardTextElement, QrCardTextStyle>>;
  customTexts: QrCardCustomText[];
}

export interface PlatformQrCardResponse {
  id: string;
  code: string;
  card: PlatformQrCard;
  updatedAt?: string;
}

export const QR_CARD_DEFAULT_BRAND = '魔方开放社群';

export const QR_CARD_DEFAULT_QUOTES = [
  '慢就是快\n一次打乱 一次成长',
  '拧的是方块\n解的是心境',
  '手指快\n不如脑子快',
  '三阶之上\n皆是热爱',
  '热爱可抵\n万次打乱',
  '每一次复原\n都是新的开始',
] as const;

export const QR_CARD_FRONT_ARTS = [
  { src: '/card/front-ink.webp', nameZh: '流彩泼墨', nameEn: 'Color ink' },
  { src: '/card/front-city.webp', nameZh: '微缩世界', nameEn: 'Miniature world' },
] as const;

export const QR_CARD_FACE_COLORS = [
  '#C41E3A', '#FFFFFF', '#0051BA',
  '#FF8A00', '#FFD500', '#009E60',
  '#FFFFFF', '#C41E3A', '#FFD500',
] as const;

export const QR_CARD_FORMULA_TOKENS = [
  "R U R' U'", 'F2L', 'CFOP', 'OLL', 'PLL', "R' D' R D", "U R U' R'",
  'Cross', "F R U R' U' F'", 'ZBLL', 'Sune', 'T-Perm', 'Roux', 'ZZ',
  'Petrus', "L' U' L U", "x2 y'", "R U2 R'", 'COLL', 'Mehta', 'Heise',
] as const;

export interface QrCardFaceletSpot {
  x: number;
  y: number;
  size: number;
  colorIndex: number;
  opacity: number;
  rotation: number;
}

export function qrCardFaceletSpots(count = 14): QrCardFaceletSpot[] {
  const hash = (index: number, seed: number) => {
    let value = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(seed + 1, 0x85ebca6b);
    value = Math.imul(value ^ (value >>> 15), 0x2b2ae35);
    value ^= value >>> 13;
    return (value >>> 0) / 4294967296;
  };
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => ({
    x: hash(index, 1),
    y: hash(index, 2),
    size: 1.1 + hash(index, 3) * 1.7,
    colorIndex: Math.floor(hash(index, 4) * QR_CARD_FACE_COLORS.length),
    opacity: 0.1 + hash(index, 5) * 0.13,
    rotation: hash(index, 6) * 44 - 22,
  }));
}

export function qrCardFormulaRow(rowIndex: number, count = 6): string {
  const start = (Math.max(0, Math.floor(rowIndex)) * 3) % QR_CARD_FORMULA_TOKENS.length;
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => (
    QR_CARD_FORMULA_TOKENS[(start + index * 2) % QR_CARD_FORMULA_TOKENS.length]
  )).join('   ');
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

export interface QrCardSnapInput {
  originX: number;
  originY: number;
  deltaX: number;
  deltaY: number;
  baseCenterX: number;
  baseCenterY: number;
  targetsX: readonly number[];
  targetsY: readonly number[];
  pxPerMm: number;
  enabled: boolean;
  altKey: boolean;
  thresholdMm?: number;
}

export interface QrCardSnapResult {
  x: number;
  y: number;
  guideX?: number;
  guideY?: number;
}

export function snapQrCardPosition(input: QrCardSnapInput): QrCardSnapResult {
  const pxPerMm = Number.isFinite(input.pxPerMm) && input.pxPerMm > 0 ? input.pxPerMm : 1;
  let x = input.originX + input.deltaX;
  let y = input.originY + input.deltaY;
  if (!input.enabled || input.altKey) return { x, y };
  const thresholdPx = (input.thresholdMm ?? 0.7) * pxPerMm;
  const centerX = input.baseCenterX + x * pxPerMm;
  const centerY = input.baseCenterY + y * pxPerMm;
  const guideX = input.targetsX.find((candidate) => Math.abs(candidate - centerX) < thresholdPx);
  const guideY = input.targetsY.find((candidate) => Math.abs(candidate - centerY) < thresholdPx);
  if (guideX != null) x = (guideX - input.baseCenterX) / pxPerMm;
  if (guideY != null) y = (guideY - input.baseCenterY) / pxPerMm;
  return { x, y, guideX, guideY };
}

export interface QrCardArtworkDownload {
  source: string;
  filename: string;
}

export function qrCardArtworkDownload(
  card: Pick<PlatformQrCard, 'frontArt' | 'backArt'>,
  side: QrCardSide,
  code: string,
  index = 0,
): QrCardArtworkDownload | null {
  const source = side === 'front'
    ? card.frontArt || QR_CARD_FRONT_ARTS[Math.max(0, Math.floor(index)) % QR_CARD_FRONT_ARTS.length].src
    : card.backArt;
  return source ? { source, filename: `qr-card-${code || 'artwork'}-${side}.png` } : null;
}

export const DEFAULT_QR_CARD: PlatformQrCard = {
  intro: '',
  term: '',
  quote: '',
  brand: '',
  frontArt: '',
  backArt: '',
  frontArtPrompt: '',
  alg: null,
  layout: {},
  textStyles: {},
  customTexts: [],
};

/**
 * The print-content decision shared by the editable DOM proof and export tests.
 * Keep this deliberately free of layout and React so the API SVG renderer can
 * be checked against exactly the same brand/quote/back-copy/algorithm rules.
 */
export function resolveQrCardContent(
  card: Pick<PlatformQrCard, 'quote' | 'brand' | 'intro' | 'term' | 'alg' | 'textStyles'>,
  title: string,
  index = 0,
): QrCardResolvedContent {
  const quote = card.quote.trim()
    || QR_CARD_DEFAULT_QUOTES[Math.max(0, Math.floor(index)) % QR_CARD_DEFAULT_QUOTES.length];
  const quoteLines = quote.split('\n').map((line) => line.trim()).filter(Boolean);
  const hasAlgorithm = Boolean(card.alg?.moves.trim()) && !card.textStyles.alg?.hidden;
  return {
    quote,
    quoteMain: quoteLines[0] || '热爱魔方',
    quoteSubs: quoteLines.slice(1),
    brand: card.brand.trim() || QR_CARD_DEFAULT_BRAND,
    backMain: title.trim() || '扫码直达',
    backSub: card.intro.trim(),
    term: hasAlgorithm ? '' : card.term.trim(),
    hasAlgorithm,
    algorithmMoves: hasAlgorithm ? card.alg?.moves.trim() ?? '' : '',
  };
}

const HEX = /^#[0-9a-f]{6}$/i;
const DATA_IMAGE = /^data:image\/(png|jpeg|webp);base64,/i;
const BUILTIN_ART = new Set<string>(QR_CARD_FRONT_ARTS.map((item) => item.src));
const TEXT_ELEMENT_SET = new Set<string>(QR_CARD_TEXT_ELEMENTS);
const FONT_SET = new Set<string>(QR_CARD_FONTS);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').slice(0, max) : '';
}

function rounded(value: unknown, fallback: number, min: number, max: number, places = 1): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  const factor = 10 ** places;
  return Math.round(Math.max(min, Math.min(max, number)) * factor) / factor;
}

function cleanStyle(value: unknown, allowHidden: boolean): QrCardTextStyle {
  const raw = record(value);
  if (!raw) return {};
  const result: QrCardTextStyle = {};
  if (typeof raw.font === 'string' && FONT_SET.has(raw.font)) result.font = raw.font as QrCardFont;
  if (typeof raw.color === 'string' && HEX.test(raw.color)) result.color = raw.color;
  if (raw.size != null) result.size = rounded(raw.size, 1, 0.3, 3, 2);
  const stroke = typeof raw.stroke === 'string' && HEX.test(raw.stroke) ? raw.stroke : null;
  const strokeW = raw.strokeW != null ? rounded(raw.strokeW, 0, 0, 1, 2) : 0;
  if (stroke && strokeW > 0) {
    result.stroke = stroke;
    result.strokeW = strokeW;
  }
  if (allowHidden && raw.hidden === true) result.hidden = true;
  return result;
}

function cleanLayout(value: unknown): QrCardLayout {
  const raw = record(value);
  if (!raw) return {};
  const result: QrCardLayout = {};
  for (const element of QR_CARD_ELEMENTS) {
    const item = record(raw[element]);
    if (!item) continue;
    const transform: QrCardTransform = {
      x: rounded(item.x, 0, -40, 40),
      y: rounded(item.y, 0, -40, 40),
    };
    if (element === 'qr' || element === 'front' || element === 'back') {
      transform.s = rounded(item.s, 1, element === 'qr' ? 0.01 : 0.5, 3, 2);
    }
    if ((element === 'front' || element === 'back') && item.fit === 'cover') transform.fit = 'cover';
    result[element] = transform;
  }
  return result;
}

export function normalizeQrCard(value: unknown): PlatformQrCard {
  const raw = record(value) ?? {};
  const algorithm = record(raw.alg);
  const stylesRaw = record(raw.textStyles);
  const textStyles: PlatformQrCard['textStyles'] = {};
  if (stylesRaw) {
    for (const element of QR_CARD_TEXT_ELEMENTS) {
      if (stylesRaw[element] != null) textStyles[element] = cleanStyle(stylesRaw[element], true);
    }
  }
  const customTexts = Array.isArray(raw.customTexts)
    ? raw.customTexts.slice(0, 30).flatMap((value): QrCardCustomText[] => {
      const item = record(value);
      if (!item) return [];
      const id = text(item.id, 40).trim();
      const content = text(item.text, 200).trimEnd();
      if (!id || !content.trim()) return [];
      const style = cleanStyle(item.style, false);
      return [{
        id,
        side: item.side === 'front' ? 'front' : 'back',
        text: content,
        x: rounded(item.x, 0, -40, 40),
        y: rounded(item.y, 0, -40, 40),
        ...(Object.keys(style).length ? { style } : {}),
      }];
    })
    : [];

  return {
    intro: text(raw.intro, 1000),
    term: text(raw.term, 160),
    quote: text(raw.quote, 500),
    brand: text(raw.brand, 160),
    frontArt: typeof raw.frontArt === 'string' && (DATA_IMAGE.test(raw.frontArt) || BUILTIN_ART.has(raw.frontArt)) ? raw.frontArt : '',
    backArt: typeof raw.backArt === 'string' && (DATA_IMAGE.test(raw.backArt) || BUILTIN_ART.has(raw.backArt)) ? raw.backArt : '',
    frontArtPrompt: text(raw.frontArtPrompt, 4000),
    alg: algorithm && text(algorithm.moves, 500).trim()
      ? {
        moves: text(algorithm.moves, 500).trim(),
        ...(text(algorithm.name, 160).trim() ? { name: text(algorithm.name, 160).trim() } : {}),
        ...(text(algorithm.url, 2000).trim() ? { url: text(algorithm.url, 2000).trim() } : {}),
      }
      : null,
    layout: cleanLayout(raw.layout),
    textStyles,
    customTexts,
  };
}

export function parseQrCardAlgorithm(value: string): QrCardAlgorithm | null {
  const parts = value.split('|').map((part) => part.trim());
  if (parts.length === 1) return parts[0] ? { moves: parts[0] } : null;
  const [name, moves, url] = parts;
  const usableMoves = (moves || name || '').trim().slice(0, 500);
  if (!usableMoves) return null;
  return {
    moves: usableMoves,
    ...(name && moves ? { name } : {}),
    ...(url ? { url } : {}),
  };
}

export function qrCardAlgorithmText(value: QrCardAlgorithm | null): string {
  if (!value?.moves) return '';
  return [value.name, value.moves, value.url].filter(Boolean).join(' | ');
}

export function inverseAlgorithm(moves: string): string {
  return moves.trim().split(/\s+/).filter(Boolean).reverse().map((move) => (
    move.endsWith("'") ? move.slice(0, -1) : move.endsWith('2') ? move : `${move}'`
  )).join(' ');
}

export function qrCardVisualCubeUrl(algorithm: QrCardAlgorithm | null): string | null {
  if (!algorithm?.moves) return null;
  const name = algorithm.name?.toLowerCase() ?? '';
  const query = new URLSearchParams({
    view: name.includes('f2l') ? 'f2l' : name.includes('pll') ? 'pll' : 'oll',
    size: '160',
    setup: inverseAlgorithm(algorithm.moves),
  });
  return apiUrl(`/v1/visualcube.svg?${query.toString()}`);
}

export function qrCardPublicUrl(code: string, variant: 'preview' | 'press' | 'clean' = 'preview', index = 0): string {
  const query = new URLSearchParams();
  query.set('idx', String(Math.max(0, Math.min(1_000_000, Math.floor(index)))));
  if (variant === 'press') {
    query.set('bleed', '3');
    query.set('crop', '1');
    query.set('dl', '1');
  }
  if (variant === 'clean') {
    query.set('bleed', '0');
    query.set('crop', '0');
    query.set('dl', '1');
  }
  return apiUrl(`/v1/platform/qr/${encodeURIComponent(code)}/card?${query.toString()}`);
}

export function qrCodeSvgUrl(code: string): string {
  return apiUrl(`/v1/platform/qr/${encodeURIComponent(code)}/svg`);
}

export async function getPlatformQrCard(id: string, signal?: AbortSignal): Promise<PlatformQrCardResponse> {
  const response = await fetch(apiUrl(`/v1/platform/admin/qr/${encodeURIComponent(id)}/card`), {
    headers: authHeaders(false),
    cache: 'no-store',
    signal,
  });
  const payload = await handleApi<{ id: string; code: string; card: unknown; updatedAt?: string }>(response);
  return { ...payload, card: normalizeQrCard(payload.card) };
}

export async function savePlatformQrCard(id: string, card: PlatformQrCard): Promise<PlatformQrCardResponse> {
  const response = await fetch(apiUrl(`/v1/platform/admin/qr/${encodeURIComponent(id)}/card`), {
    method: 'PATCH',
    headers: {
      ...authHeaders(),
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ card: normalizeQrCard(card) }),
  });
  const payload = await handleApi<{ id: string; code: string; card: unknown; updatedAt?: string }>(response);
  return { ...payload, card: normalizeQrCard(payload.card) };
}

export function qrCardFontStack(font?: QrCardFont): string | undefined {
  switch (font) {
    case 'serif': return "'Songti SC', 'Noto Serif SC', 'SimSun', serif";
    case 'kai': return "'Kaiti SC', 'STKaiti', 'KaiTi', 'Noto Serif SC', serif";
    case 'round': return "'Yuanti SC', 'Hiragino Maru Gothic ProN', 'Microsoft YaHei', sans-serif";
    case 'mono': return "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace";
    case 'sans': return "-apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
    default: return undefined;
  }
}

export function isQrCardTextElement(value: string): value is QrCardTextElement {
  return TEXT_ELEMENT_SET.has(value);
}
