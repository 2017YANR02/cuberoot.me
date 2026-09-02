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

const blockSeed: Array<[QrPromptDimension, string, string, string]> = [
  ['风格', '科技发光', 'Tech glow', '科技未来风，边缘发光、细微光粒子与极淡科技网格，冷调高级质感'],
  ['风格', '3D 渲染', '3D render', 'C4D / OC 立体渲染，亚克力玻璃光泽、柔和影棚布光，产品级精致'],
  ['风格', '写实摄影', 'Photography', '写实原生摄影质感，真实材质、细腻高光与景深，电影级超清'],
  ['风格', '水彩手绘', 'Watercolor', '水彩晕染手绘，透明水痕与自然笔触，清新文艺通透'],
  ['风格', '赛博霓虹', 'Cyber neon', '赛博朋克霓虹，蓝紫青基调、霓虹辉光与全息光带，炫酷未来'],
  ['风格', '极简留白', 'Minimal', '极简主义，大面积留白与柔和渐变，克制高级、杂志编排感'],
  ['主体', '单颗悬浮魔方', 'Floating cube', '一颗 WCA 三阶魔方悬浮于画面中上方，边缘高光、主体清晰锐利'],
  ['主体', '魔方城市', 'Cube city', '由魔方搭建的微缩城市与建筑群，海量趣味细节、欢乐繁忙'],
  ['主体', '魔方爆裂', 'Cube burst', '一颗魔方爆裂分解，小方块与彩色碎屑向四周飞散并拖出动态轨迹'],
  ['主体', '速拧手部', 'Speedcubing hands', '速拧选手手部正飞快转动魔方的特写，手指利落、动感十足'],
  ['主题', '春节', 'Lunar New Year', '春节氛围，红灯笼、烟花、祥云与中国红配金点缀，喜庆热闹'],
  ['主题', '圣诞', 'Christmas', '圣诞氛围，雪花、松枝、礼盒与暖色灯串，温馨梦幻'],
  ['主题', '电竞赛事', 'Esports', '电竞赛事舞台，聚光灯、看台与夺冠氛围，热血竞技'],
  ['主题', '未来太空', 'Future space', '未来太空场景，星空、星云与失重悬浮，宏大科幻'],
  ['构图', '居中特写', 'Centered close-up', '主体居中偏上特写，中下大量负空间留白用于叠文字'],
  ['构图', '等距俯视', 'Isometric', '等距 2.5D 俯视视角，模型般整齐排布、纵深规整'],
  ['构图', '微距浅景深', 'Macro', '微距特写浅景深，主体锐利、背景奶油般柔化虚化'],
  ['构图', '大场景鸟瞰', 'Aerial wide shot', '大场景鸟瞰全景，丰富细节与空间纵深'],
  ['光影', '影棚暗调', 'Studio low-key', '影棚单束硬光配深色背景，强高光与深阴影对比，戏剧暗调'],
  ['光影', '柔和晨光', 'Soft morning', '柔和自然晨光，通透明亮、淡淡光晕，清新干净'],
  ['光影', '霓虹辉光', 'Neon glow', '霓虹辉光打光，冷蓝紫与品牌蓝交映，赛博炫彩'],
  ['光影', '六色撞色', 'Six-color pop', '高饱和魔方六色撞色，明快活泼、对比强烈'],
];

const presetSeed: Array<[string, string, string, string]> = [
  ['科技发光感', 'Tech glow', '通用', '深蓝到品牌蓝渐变背景，一个悬浮、边缘发光的等距三阶魔方，四周细微光粒子与光束，冷调高级质感'],
  ['3D 渲染质感', '3D product render', '通用', 'C4D / OC 渲染的立体魔方，亚克力玻璃光泽，柔和影棚布光，品牌蓝渐变背景，轻微景深'],
  ['孟菲斯撞色波普', 'Memphis pop', '通用', '孟菲斯设计风，大胆几何形和魔方撞色块，平涂矢量，波普趣味'],
  ['国潮中国风', 'Chinese guochao', '通用', '国潮风，魔方融合祥云与传统几何纹样，红蓝配金箔点缀，大气东方感'],
  ['极简高级', 'Minimal editorial', '通用', '大面积品牌蓝单色或柔和渐变，一个精致小魔方，大量负空间，克制高级的杂志编排感'],
  ['碎裂粒子魔方', 'Particle burst', '大片', '一颗 WCA 魔方正在爆裂分解，小方块与彩色碎屑向四周飞散，暗色戏剧化背景，强逆光与边缘高光'],
  ['流彩泼墨魔方', 'Color ink cube', '大片', '一颗干净利落的 WCA 魔方为主角，周围红橙黄绿蓝六色颜料和水墨在空中泼溅流动、丝缕环绕'],
  ['魔方微缩世界', 'Miniature cube world', '场景', '等距俯视的微缩城市，整座城市由魔方搭建，卡通小人在拧魔方和比赛，高饱和撞色、海量趣味细节'],
  ['赛博霓虹都市', 'Cyber neon city', '场景', '未来赛博都市雨夜，高楼由发光魔方堆叠，霓虹光带和湿润地面彩色倒影，电影级光影'],
  ['水彩手绘', 'Watercolor', '插画', '水彩晕染手绘风，透明水痕与自然笔触，一颗魔方为主体，六色淡彩点染，清新文艺'],
  ['伦勃朗暗调速度', 'Rembrandt speed', '大片', '伦勃朗式单束硬光打在魔方一面与边缘，其余隐入深阴影，魔方身后拉出横向动态模糊拖影'],
  ['扁平吉祥物', 'Flat mascot', '插画', '扁平矢量卡通，一颗拟人魔方吉祥物有手脚和俏皮表情，活泼友好、品牌 IP 感'],
];

export const FALLBACK_QR_PROMPT_LIBRARY: QrPromptLibrary = {
  blocks: blockSeed.map(([dimension, nameZh, nameEn, body], index) => ({ id: `block-${index}`, dimension, nameZh, nameEn, body })),
  presets: presetSeed.map(([nameZh, nameEn, category, body], index) => ({ id: `preset-${index}`, nameZh, nameEn, category, body })),
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function dimension(value: unknown): QrPromptDimension | null {
  return QR_PROMPT_DIMENSIONS.some((item) => item.key === value) ? value as QrPromptDimension : null;
}

export async function getQrPromptLibrary(signal?: AbortSignal): Promise<QrPromptLibrary> {
  const response = await fetch(apiUrl('/v1/platform/admin/qr/prompts'), {
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
    blocks: blocks.length ? blocks : FALLBACK_QR_PROMPT_LIBRARY.blocks,
    presets: presets.length ? presets : FALLBACK_QR_PROMPT_LIBRARY.presets,
  };
}
