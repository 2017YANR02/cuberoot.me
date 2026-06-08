'use client';

// 底色子集选择器 — 模式下拉(六色/四色/双色/单色)+ 方形色块。
// /scramble/stats 与首页 RecentScrambles 共用(单一来源:子集 key 推导 + 魔方色常量 + 渐变序)。
// 主题无关:用 currentColor 派生边框 + var(--accent) 选中态(两页都有 --accent),不碰 --background/--foreground
// (stats 页 light-locked 用页级 --bg/--text,RecentScrambles 用全局 token)。
import { useMemo, useState } from 'react';
import './SubsetColorPicker.css';
import { tr } from '@/i18n/tr';

export type ColorLetter = 'B' | 'G' | 'O' | 'R' | 'W' | 'Y';
export type ColorMode = 'cn' | 'quad' | 'dual' | 'single';

export const COLOR_LETTERS: ColorLetter[] = ['B', 'G', 'O', 'R', 'W', 'Y'];
// 魔方面固定色(色字母版),非主题色 —— 与 lib/cube-colors 同值,这里集中一份供两页共用。
export const COLOR_HEX: Record<ColorLetter, string> = {
  W: '#FFFFFF', Y: '#FEFE00', R: '#EE0000', O: '#FFA100', B: '#0000F2', G: '#00D800',
};
export const COLOR_NAME: Record<ColorLetter, { zh: string; en: string }> = {
  W: { zh: '白', en: 'White' }, Y: { zh: '黄', en: 'Yellow'
}, R: { zh: '红', en: 'Red'
},
  O: { zh: '橙', en: 'Orange' }, B: { zh: '蓝', en: 'Blue'
}, G: { zh: '绿', en: 'Green'
},
};
// 渐变里颜色自上而下顺序(与直方图 fillColors 一致)。
export const GRADIENT_ORDER: ColorLetter[] = ['W', 'Y', 'G', 'B', 'R', 'O'];
export const DUAL_PAIRS: { key: string; letters: [ColorLetter, ColorLetter] }[] = [
  { key: 'WY', letters: ['W', 'Y'] },
  { key: 'BG', letters: ['B', 'G'] },
  { key: 'OR', letters: ['O', 'R'] },
];

export function subsetKeyFromLetters(letters: ColorLetter[]): string {
  return [...letters].sort().join('');
}
export function fillColorsForSubset(letters: ColorLetter[]): string[] {
  const set = new Set(letters);
  return GRADIENT_ORDER.filter((c) => set.has(c)).map((c) => COLOR_HEX[c]);
}
// 一个子集色块的内层 tile:单色实底,多色像切蛋糕一样从正方形中点等分扇形(所有颜色共用中点)。
// picker 选项、六色 tile、RecentScrambles hero 圆点共用;外层尺寸/形状/边框由调用方的容器决定(配 overflow:hidden 裁切)。
export function SubsetSwatch({ colors }: { colors: ColorLetter[] }) {
  if (colors.length <= 1) {
    return <span className="subset-swatch-tile" style={colors[0] ? { background: COLOR_HEX[colors[0]] } : undefined} />;
  }
  const seg = 360 / colors.length; // 等分扇形角度(6→60°, 4→90°, 2→180°)
  const stops = colors
    .map((c, i) => `${COLOR_HEX[c]} ${(i * seg).toFixed(3)}deg ${((i + 1) * seg).toFixed(3)}deg`)
    .join(', ');
  return <span className="subset-swatch-tile" style={{ background: `conic-gradient(from -90deg, ${stops})` }} />;
}

const MODE_ORDER: ColorMode[] = ['dual', 'single', 'cn', 'quad'];
const MODE_LABEL: Record<ColorMode, { zh: string; en: string }> = {
  cn: { zh: '六色', en: 'CN' },
  quad: { zh: '四色', en: 'Quad' },
  dual: { zh: '双色', en: 'Dual'
},
  single: { zh: '单色', en: 'Single'
},
};

export interface SubsetOption { id: string; key: string; colors: ColorLetter[] }
export interface SubsetSelection {
  colorMode: ColorMode;
  setColorMode: (m: ColorMode) => void;
  subsetKey: string;          // 当前选中子集的 key(与 distribution/recent_scrambles 数据 key 一致)
  selectedColors: ColorLetter[];
  options: SubsetOption[];    // 当前模式下可选的子集(cn 为空 = 无需子选)
  activeOptionId: string;
  selectOption: (id: string) => void;
}

// 模式 + 子选状态 → 当前 subsetKey / 颜色 / 可选项。两页各自 use 一份。
export function useSubsetSelection(initialMode: ColorMode = 'cn'): SubsetSelection {
  const [colorMode, setColorMode] = useState<ColorMode>(initialMode);
  const [singleColor, setSingleColor] = useState<ColorLetter>('Y');
  const [dualPairKey, setDualPairKey] = useState<string>('WY');
  const [quadExcludedPairKey, setQuadExcludedPairKey] = useState<string>('BG');

  return useMemo<SubsetSelection>(() => {
    let options: SubsetOption[];
    let activeOptionId: string;
    let selectedColors: ColorLetter[];
    let selectOption: (id: string) => void;

    switch (colorMode) {
      case 'single':
        options = COLOR_LETTERS.map((c) => ({ id: c, key: c, colors: [c] }));
        activeOptionId = singleColor;
        selectedColors = [singleColor];
        selectOption = (id) => setSingleColor(id as ColorLetter);
        break;
      case 'dual':
        options = DUAL_PAIRS.map((p) => ({ id: p.key, key: subsetKeyFromLetters(p.letters), colors: [...p.letters] }));
        activeOptionId = dualPairKey;
        selectedColors = [...(DUAL_PAIRS.find((p) => p.key === dualPairKey) ?? DUAL_PAIRS[0]).letters];
        selectOption = (id) => setDualPairKey(id);
        break;
      case 'quad':
        options = DUAL_PAIRS.map((p) => {
          const cs = COLOR_LETTERS.filter((c) => !(p.letters as string[]).includes(c));
          return { id: p.key, key: subsetKeyFromLetters(cs), colors: cs };
        });
        activeOptionId = quadExcludedPairKey;
        {
          const p = DUAL_PAIRS.find((x) => x.key === quadExcludedPairKey) ?? DUAL_PAIRS[0];
          selectedColors = COLOR_LETTERS.filter((c) => !(p.letters as string[]).includes(c));
        }
        selectOption = (id) => setQuadExcludedPairKey(id);
        break;
      case 'cn':
      default:
        options = [];                       // 六色 = 用全部色,无需子选;展示全部 6 色块
        activeOptionId = '';
        selectedColors = [...COLOR_LETTERS];
        selectOption = () => {};
        break;
    }
    return {
      colorMode, setColorMode,
      subsetKey: subsetKeyFromLetters(selectedColors),
      selectedColors, options, activeOptionId, selectOption,
    };
  }, [colorMode, singleColor, dualPairKey, quadExcludedPairKey]);
}

export function SubsetColorPicker({ sel, isZh, className }: { sel: SubsetSelection; isZh: boolean; className?: string }) {
  const colorTitle = (colors: ColorLetter[]) => colors.map((c) => COLOR_NAME[c][isZh ? 'zh' : 'en']).join(isZh ? '' : '+');
  return (
    <div className={`subset-picker${className ? ` ${className}` : ''}`}>
      <select
        className="subset-picker-mode"
        value={sel.colorMode}
        onChange={(e) => sel.setColorMode(e.target.value as ColorMode)}
        aria-label={tr({ zh: '底色模式', en: 'Color mode' })}
      >
        {MODE_ORDER.map((m) => (
          <option key={m} value={m}>{MODE_LABEL[m][isZh ? 'zh' : 'en']}</option>
        ))}
      </select>
      <div className="subset-picker-swatches" role="group" aria-label={tr({ zh: '底色', en: 'Bottom color' })}>
        {sel.options.length === 0
          // 六色(色中性):一个划分方格 tile,与 dual/quad 同视觉语言
          ? (
              <span className="subset-swatch is-static" title={tr({ zh: '色中性 全部 6 色', en: 'Color-neutral, all six' })}>
                <SubsetSwatch colors={COLOR_LETTERS} />
              </span>
            )
          : sel.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`subset-swatch${opt.id === sel.activeOptionId ? ' is-active' : ''}`}
                onClick={() => sel.selectOption(opt.id)}
                title={colorTitle(opt.colors)}
                aria-label={colorTitle(opt.colors)}
                aria-pressed={opt.id === sel.activeOptionId}
              >
                <SubsetSwatch colors={opt.colors} />
              </button>
            ))}
      </div>
    </div>
  );
}
