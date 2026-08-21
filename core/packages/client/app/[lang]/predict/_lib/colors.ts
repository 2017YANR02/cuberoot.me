/**
 * /predict 的显示配色。
 *
 * 立方体族(含金字塔 / 斜转 / 枫叶)只用得到站内那 6 色,直接吃 `lib/cube-colors` 的
 * 单一源;十二面体(五魔方)另有 12 色,取 `mega_svg` 那份 tnoodle 配色 —— 站内所有
 * 五魔方 2D 打乱图画的就是它,两处别各配一套。
 *
 * 色号空间是两族合起来的一张表:立方体族沿用面字母(`U` / `R` / …),十二面体一律
 * 带 `m:` 前缀(`m:U` / `m:DBR`)。不加前缀的话五魔方的 `U`/`R`/`F`/`L`/`D` 会和立方体
 * 那 5 个字母撞成同一个色号,而两边的白 / 红 / 绿根本不是同一个色值。
 */
import { CUBE_COLOR_NAMES, CUBE_FILL, CUBE_ON_FILL, type CubeFace } from '@/lib/cube-colors';
import {
  DEFAULT_MEGA_COLORS, MEGA_FACE_NAMES, type MegaFaceKey,
} from '@/app/[lang]/scramble/gen/_svg/mega_svg';

/** 一个色号。 */
export type PredictColor = CubeFace | `m:${MegaFaceKey}`;

/** 五魔方面名 → 色号。 */
export const megaColor = (face: MegaFaceKey): PredictColor => `m:${face}`;

/** 深底色上用白字,浅底色上用深字(与 `CUBE_ON_FILL` 同一套取值)。 */
const DARK_TEXT = '#171717';
const LIGHT_TEXT = '#ffffff';

/** 十二面体那 12 色的字色 + 中英色名。色值本身在 `DEFAULT_MEGA_COLORS`,这里不重复。 */
const MEGA_INK: Record<MegaFaceKey, { on: string; zh: string; en: string }> = {
  U:   { on: DARK_TEXT,  zh: '白',   en: 'white' },
  BL:  { on: DARK_TEXT,  zh: '黄',   en: 'yellow' },
  BR:  { on: LIGHT_TEXT, zh: '蓝',   en: 'blue' },
  R:   { on: LIGHT_TEXT, zh: '红',   en: 'red' },
  F:   { on: LIGHT_TEXT, zh: '绿',   en: 'green' },
  L:   { on: LIGHT_TEXT, zh: '紫',   en: 'purple' },
  D:   { on: DARK_TEXT,  zh: '灰',   en: 'gray' },
  DR:  { on: DARK_TEXT,  zh: '浅黄', en: 'light yellow' },
  DBR: { on: DARK_TEXT,  zh: '粉',   en: 'pink' },
  B:   { on: DARK_TEXT,  zh: '浅绿', en: 'light green' },
  DBL: { on: DARK_TEXT,  zh: '橙',   en: 'orange' },
  DL:  { on: DARK_TEXT,  zh: '浅蓝', en: 'light blue' },
};

const megaEntries = <T,>(pick: (face: MegaFaceKey) => T): Record<string, T> =>
  Object.fromEntries(MEGA_FACE_NAMES.map((f) => [megaColor(f), pick(f)]));

/** 色号 → 贴纸实心填充色。 */
export const PREDICT_FILL: Record<PredictColor, string> = {
  ...CUBE_FILL,
  ...megaEntries((f) => DEFAULT_MEGA_COLORS[f]),
} as Record<PredictColor, string>;

/** 色号 → 填充之上的可读字色。 */
export const PREDICT_ON_FILL: Record<PredictColor, string> = {
  ...CUBE_ON_FILL,
  ...megaEntries((f) => MEGA_INK[f].on),
} as Record<PredictColor, string>;

/** 色号 → 中英色名(题面念「哪一枚」用)。 */
export const PREDICT_COLOR_NAMES: Record<PredictColor, { zh: string; en: string }> = {
  ...CUBE_COLOR_NAMES,
  ...megaEntries((f) => ({ zh: MEGA_INK[f].zh, en: MEGA_INK[f].en })),
} as Record<PredictColor, { zh: string; en: string }>;

/**
 * 恒等换色表 —— 不吃「拿方朝向」那 24 档的拼图(金字塔 / 五魔方)用它:面色是死的,
 * 换不了。立方体族走 `lib/cube-orientation` 的 `orientedFaceColors`。
 */
export const IDENTITY_COLORS: Record<string, PredictColor> = Object.fromEntries(
  (Object.keys(PREDICT_FILL) as PredictColor[]).map((c) => [c, c]),
);
