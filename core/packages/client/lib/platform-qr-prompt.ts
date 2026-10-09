import { sessionFetch } from '@/lib/session-fetch';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { apiUrl } from '@/lib/api-base';

export const QR_PROMPT_PREAMBLE = `【魔方主体·必须准确】标准 WCA 配色三阶魔方：六面为白 / 黄 / 红 / 橙 / 蓝 / 绿，白对黄、红对橙、蓝对绿；黑色本体，鲜艳哑光贴纸，色块间黑色缝隙清晰，方块排布工整准确。
【通用】竖版构图 1:2（实际 2×4 cm 卡片正面），满版出血无白边，画面中下方留干净负空间用于后期叠文字，不要文字 / logo / 水印，印刷级超清。
【主色】品牌蓝 #2A5DF4；点缀魔方六色。
负面词：text, words, letters, watermark, blurry, low-res, cluttered
(Midjourney 末尾加 --ar 1:2；即梦 / SD 设宽高比 1:2)`;

export const QR_PROMPT_DIMENSIONS = [
  { key: '风格', zh: '风格', en: 'Style', hintZh: '艺术风格和媒介', hintEn: 'Art style and medium' },
  { key: '主体', zh: '内容主体', en: 'Subject', hintZh: '画面里画什么', hintEn: 'What appears in the image' },
  { key: '主题', zh: '主题场景', en: 'Theme', hintZh: '节日和氛围', hintEn: 'Occasion and mood' },
  { key: '构图', zh: '构图视角', en: 'Composition', hintZh: '镜头和排布', hintEn: 'Camera and arrangement' },
  { key: '光影', zh: '光影色调', en: 'Lighting', hintZh: '打光和配色', hintEn: 'Light and palette' },
] as const;

export type QrPromptDimension = typeof QR_PROMPT_DIMENSIONS[number]['key'];

export interface QrPromptBlock {
  id: string;
  nameZh: string;
  nameEn: string;
  dimension: QrPromptDimension;
  body: string;
}

export interface QrPromptPreset {
  id: string;
  nameZh: string;
  nameEn: string;
  category: string;
  body: string;
}

export interface QrPromptLibrary {
  blocks: QrPromptBlock[];
  presets: QrPromptPreset[];
}

export function assembleQrArtPrompt(body: string): string {
  const clean = body.trim();
  return clean ? `${QR_PROMPT_PREAMBLE}\n\n${clean}`.slice(0, 4000) : '';
}

export function composeQrArtPrompt(
  selected: Partial<Record<QrPromptDimension, string>>,
  blocks: readonly QrPromptBlock[],
): string {
  const bodies = QR_PROMPT_DIMENSIONS.flatMap(({ key }) => {
    const id = selected[key];
    if (!id) return [];
    const body = blocks.find((item) => item.id === id)?.body.trim();
    return body ? [body] : [];
  });
  return bodies.length ? assembleQrArtPrompt(bodies.join('，')) : '';
}

// The editable database library is authoritative, including an intentionally empty library.
export const FALLBACK_QR_PROMPT_LIBRARY: QrPromptLibrary = { blocks: [], presets: [] };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function dimension(value: unknown): QrPromptDimension | null {
  return QR_PROMPT_DIMENSIONS.some((item) => item.key === value) ? value as QrPromptDimension : null;
}

export async function getQrPromptLibrary(signal?: AbortSignal): Promise<QrPromptLibrary> {
  const response = await sessionFetch(apiUrl('/v1/platform/admin/qr/prompts'), {
    headers: authHeaders(false),
    cache: 'no-store',
    signal,
  });
  const payload = await handleApi<{ items?: unknown[] }>(response);
  const blocks: QrPromptBlock[] = [];
  const presets: QrPromptPreset[] = [];
  for (const [index, raw] of (payload.items ?? []).entries()) {
    const item = asRecord(raw);
    const template = asRecord(item?.template);
    if (!item || !template || item.status === 'archived') continue;
    const body = typeof template.body === 'string' ? template.body.trim() : '';
    if (!body) continue;
    const id = typeof item.id === 'string' ? item.id : `remote-${index}`;
    const nameZh = typeof item.nameZh === 'string' && item.nameZh.trim() ? item.nameZh.trim() : String(item.templateKey ?? id);
    const nameEn = typeof item.nameEn === 'string' && item.nameEn.trim() ? item.nameEn.trim() : nameZh;
    const dim = dimension(template.dimension);
    if (dim) blocks.push({ id, nameZh, nameEn, dimension: dim, body });
    else presets.push({ id, nameZh, nameEn, category: typeof template.category === 'string' ? template.category : '', body });
  }
  return {
    blocks,
    presets,
  };
}
