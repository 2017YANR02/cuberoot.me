// 十字底色子集模型:六色 / 四色 / 双色 / 单色(6 选 1),供 /scramble/gen 单场分布选择底色。
// 颜色顺序对齐 lib/comp-cross 的 BADGE_ORDER = [White, Yellow, Red, Orange, Blue, Green];
// 取值 = 在选中底色集合上对 6 面最优步数取 min(底色越多越"取优",步数越少)。
// 纯逻辑,不含色值;swatch 用 gen.css 的 --gen-cx-* 主题变量(见 CX_CLASS)。

export type ColorMode = 'cn' | 'quad' | 'dual' | 'single';
export type ColorLetter = 'W' | 'Y' | 'R' | 'O' | 'B' | 'G';

// BADGE_ORDER 下标:W=0 Y=1 R=2 O=3 B=4 G=5
export const BADGE_LETTERS: readonly ColorLetter[] = ['W', 'Y', 'R', 'O', 'B', 'G'];
const IDX: Record<ColorLetter, number> = { W: 0, Y: 1, R: 2, O: 3, B: 4, G: 5 };

export const COLOR_NAME: Record<ColorLetter, { zh: string; en: string }> = {
  W: { zh: '白', en: 'White' }, Y: { zh: '黄', en: 'Yellow' }, R: { zh: '红', en: 'Red' },
  O: { zh: '橙', en: 'Orange' }, B: { zh: '蓝', en: 'Blue' }, G: { zh: '绿', en: 'Green' },
};
// 对应 gen.css 的 --gen-cx-{w,y,r,o,b,g}(主题感知)
export const CX_CLASS: Record<ColorLetter, string> = {
  W: 'cx-w', Y: 'cx-y', R: 'cx-r', O: 'cx-o', B: 'cx-b', G: 'cx-g',
};

// 对立面色对(取优成对 / 四色排除一对)
export const OPPOSITE_PAIRS: readonly (readonly [ColorLetter, ColorLetter])[] = [
  ['W', 'Y'], ['R', 'O'], ['B', 'G'],
];

export const COLOR_MODES: readonly ColorMode[] = ['cn', 'quad', 'dual', 'single'];
export const MODE_LABEL: Record<ColorMode, { zh: string; en: string }> = {
  cn: { zh: '六色', en: '6-color' },
  quad: { zh: '四色', en: '4-color' },
  dual: { zh: '双色', en: '2-color' },
  single: { zh: '单色', en: '1-color' },
};

export interface ColorSel {
  mode: ColorMode;
  single: ColorLetter; // single 模式选中色
  pair: number;        // dual 模式选中对立色对下标 (OPPOSITE_PAIRS)
  quadExcl: number;    // quad 模式排除的对立色对下标
}

export const DEFAULT_COLOR_SEL: ColorSel = { mode: 'single', single: 'W', pair: 0, quadExcl: 2 };

/** 当前 mode + 子选择对应的底色字母集合。 */
export function activeLetters(s: ColorSel): ColorLetter[] {
  switch (s.mode) {
    case 'cn': return [...BADGE_LETTERS];
    case 'single': return [s.single];
    case 'dual': return [...OPPOSITE_PAIRS[s.pair]];
    case 'quad': return BADGE_LETTERS.filter((c) => !OPPOSITE_PAIRS[s.quadExcl].includes(c));
  }
}

/** 6 面最优步数(BADGE_ORDER)→ 在选中底色集合上取 min。 */
export function reduceDigits(digits: number[], letters: ColorLetter[]): number {
  let m = Infinity;
  for (const L of letters) {
    const v = digits[IDX[L]];
    if (v != null && v < m) m = v;
  }
  return m === Infinity ? 0 : m;
}
