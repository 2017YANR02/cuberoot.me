import type { useT } from '@/hooks/useT';
import { isQrCardTextElement, type PlatformQrCard, type QrCardElement, type QrCardFont, type QrCardTextStyle } from '@/lib/platform-qr-card';
import type { PlatformEntity } from '@/lib/platform-types';

export type EditableElement = QrCardElement | `ct:${string}`;

type Translate = ReturnType<typeof useT>;

export const ELEMENT_SIDE: Record<QrCardElement, 'front' | 'back'> = {
  quote: 'front',
  brand: 'front',
  front: 'front',
  backText: 'back',
  term: 'back',
  qr: 'back',
  alg: 'back',
  back: 'back',
};

export function codeOf(entity: PlatformEntity): string {
  const code = entity.data?.code;
  return typeof code === 'string' && code.trim() ? code.trim() : entity.id;
}

export function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function elementName(t: Translate, key: EditableElement): string {
  if (key.startsWith('ct:')) return t('自定义文字', 'Custom text');
  return {
    quote: t('正面文案', 'Front copy'),
    brand: t('品牌名', 'Brand'),
    front: t('正面艺术图', 'Front artwork'),
    backText: t('背面介绍', 'Back introduction'),
    term: t('短标题', 'Short title'),
    qr: t('二维码', 'QR code'),
    alg: t('公式', 'Algorithm'),
    back: t('背面艺术图', 'Back artwork'),
  }[key as QrCardElement];
}

export function fontName(t: Translate, font: QrCardFont): string {
  return {
    sans: t('黑体', 'Sans'),
    serif: t('宋体', 'Serif'),
    kai: t('楷体', 'Kai'),
    round: t('圆体', 'Rounded'),
    mono: t('等宽', 'Mono'),
  }[font];
}

export function getPosition(card: PlatformQrCard, key: EditableElement): { x: number; y: number } {
  if (key.startsWith('ct:')) {
    const item = card.customTexts.find((entry) => entry.id === key.slice(3));
    return { x: item?.x ?? 0, y: item?.y ?? 0 };
  }
  const element = key as QrCardElement;
  return { x: card.layout[element]?.x ?? 0, y: card.layout[element]?.y ?? 0 };
}

export function getScale(card: PlatformQrCard, key: EditableElement): number {
  if (key.startsWith('ct:')) return card.customTexts.find((entry) => entry.id === key.slice(3))?.style?.size ?? 1;
  if (isQrCardTextElement(key)) return card.textStyles[key]?.size ?? 1;
  return card.layout[key as QrCardElement]?.s ?? 1;
}

export function withPosition(card: PlatformQrCard, key: EditableElement, x: number, y: number): PlatformQrCard {
  if (key.startsWith('ct:')) {
    const id = key.slice(3);
    return { ...card, customTexts: card.customTexts.map((item) => item.id === id ? { ...item, x, y } : item) };
  }
  const element = key as QrCardElement;
  return { ...card, layout: { ...card.layout, [element]: { ...card.layout[element], x, y } } };
}

export function withScale(card: PlatformQrCard, key: EditableElement, scale: number): PlatformQrCard {
  const next = Math.max(key === 'qr' ? 0.01 : key === 'front' || key === 'back' ? 0.5 : 0.3, Math.min(3, Math.round(scale * 100) / 100));
  if (key.startsWith('ct:')) {
    const id = key.slice(3);
    return {
      ...card,
      customTexts: card.customTexts.map((item) => item.id === id
        ? { ...item, style: { ...item.style, size: next } }
        : item),
    };
  }
  if (isQrCardTextElement(key)) {
    return { ...card, textStyles: { ...card.textStyles, [key]: { ...card.textStyles[key], size: next } } };
  }
  const element = key as QrCardElement;
  return { ...card, layout: { ...card.layout, [element]: { ...card.layout[element], x: card.layout[element]?.x ?? 0, y: card.layout[element]?.y ?? 0, s: next } } };
}

export function patchStyle(card: PlatformQrCard, key: EditableElement, patch: Partial<QrCardTextStyle>): PlatformQrCard {
  if (key.startsWith('ct:')) {
    const id = key.slice(3);
    return {
      ...card,
      customTexts: card.customTexts.map((item) => item.id === id ? { ...item, style: { ...item.style, ...patch } } : item),
    };
  }
  if (!isQrCardTextElement(key)) return card;
  return { ...card, textStyles: { ...card.textStyles, [key]: { ...card.textStyles[key], ...patch } } };
}

export function patchAlgorithm(card: PlatformQrCard, field: 'name' | 'moves' | 'url', value: string): PlatformQrCard {
  const next = { moves: '', ...card.alg, [field]: value };
  return { ...card, alg: next.moves || next.name || next.url ? next : null };
}

export interface Gesture {
  key: EditableElement;
  originX: number;
  originY: number;
  firstX: number;
  firstY: number;
  distance: number;
  scale: number;
  pxPerMm: number;
  baseCenterX: number;
  baseCenterY: number;
  targetsX: number[];
  targetsY: number[];
}

export interface InlineEdit {
  key: EditableElement;
  value: string;
}
