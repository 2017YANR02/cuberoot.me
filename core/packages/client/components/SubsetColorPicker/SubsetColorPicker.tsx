'use client';

// 底色子集选择器 — 一个下拉:按钮显示当前子集(色块 + 模式名),菜单里四档模式各一行,
// 每行摊开该模式的全部色块,点色块 = 同时定模式和子集。
// /scramble/stats 与首页 RecentScrambles 共用(单一来源:子集 key 推导 + 魔方色常量 + 渐变序)。
// 主题无关:边框/文字走 currentColor 派生 + var(--accent) 选中态;菜单面板背景走局部 token
// --sp-surface(默认 var(--popover),light-locked 的 stats / StageSolver 在各自 CSS 里覆盖成页内 surface)。
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import './SubsetColorPicker.css';
import { tr } from '@/i18n/tr';
import { usePanelClamp } from '@/hooks/usePanelClamp';

export type ColorLetter = 'B' | 'G' | 'O' | 'R' | 'W' | 'Y';
export type ColorMode = 'cn' | 'quad' | 'dual' | 'single';

export const COLOR_LETTERS: ColorLetter[] = ['B', 'G', 'O', 'R', 'W', 'Y'];
// 魔方面固定色(色字母版),非主题色 —— 与 lib/cube-colors 同值,这里集中一份供两页共用。
export const COLOR_HEX: Record<ColorLetter, string> = {
  W: '#FFFFFF', Y: '#FEFE00', R: '#EE0000', O: '#FFA100', B: '#0000F2', G: '#00D800',
};
export const COLOR_NAME: Record<ColorLetter, { zh: string; en: string
 }> = {
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
export function SubsetSwatch({ colors, highlight }: { colors: ColorLetter[]; highlight?: ColorLetter }) {
  if (colors.length <= 1) {
    return <span className="subset-swatch-tile" style={colors[0] ? { background: COLOR_HEX[colors[0]] } : undefined} />;
  }
  // highlight = 多色档里「实际胜出/使用的那个底色」→ 走 SVG 分片,给该片描边;
  // 否则用廉价 conic-gradient(picker / hero 等全部现有调用方不变)。
  const hi = highlight ? colors.indexOf(highlight) : -1;
  if (hi >= 0) return <SubsetSwatchPie colors={colors} hiIndex={hi} />;
  const seg = 360 / colors.length; // 等分扇形角度(6→60°, 4→90°, 2→180°)
  const stops = colors
    .map((c, i) => `${COLOR_HEX[c]} ${(i * seg).toFixed(3)}deg ${((i + 1) * seg).toFixed(3)}deg`)
    .join(', ');
  return <span className="subset-swatch-tile" style={{ background: `conic-gradient(from -90deg, ${stops})` }} />;
}

// 多色档色块的 SVG 版:等分扇形填色(**填满整个圆角方形,与 conic-gradient 同形**,扇形延伸到方形四角,
// 非圆形)。标注「实际用的那个底色」的方式 = 在该片上放一个实心圆点(白点 + 细暗描边,任何底色都可见)。
// 仅综合视图的稀有卡需要标出胜出底色时才用;角度同 conic 版(`from -90deg`:0 号色从正西起、顺时针)。
const SWATCH_CORNERS: [number, [number, number]][] = [
  [45, [100, 0]], [135, [100, 100]], [225, [0, 100]], [315, [0, 0]],
];
function SubsetSwatchPie({ colors, hiIndex }: { colors: ColorLetter[]; hiIndex: number }) {
  const seg = 360 / colors.length;
  // 罗盘角(自正上、顺时针)→ 该射线与方形边界的交点(方形半宽 50)。
  const edge = (phiDeg: number): [number, number] => {
    const a = (phiDeg * Math.PI) / 180;
    const dx = Math.sin(a), dy = -Math.cos(a);
    const t = Math.min(dx ? 50 / Math.abs(dx) : Infinity, dy ? 50 / Math.abs(dy) : Infinity);
    return [50 + t * dx, 50 + t * dy];
  };
  // 第 i 色的扇形多边形:中心 → φ0 边界点 →(区间内的方形角,按角升序)→ φ1 边界点 → 闭合。
  const wedge = (i: number): string => {
    const p0 = -90 + i * seg;
    const p1 = p0 + seg;
    const pts: [number, number][] = [[50, 50], edge(p0)];
    const mids: [number, [number, number]][] = [];
    for (const [base, xy] of SWATCH_CORNERS) for (const k of [-1, 0, 1]) {
      const ca = base + 360 * k;
      if (ca > p0 && ca < p1) mids.push([ca, xy]);
    }
    mids.sort((a, b) => a[0] - b[0]);
    for (const [, xy] of mids) pts.push(xy);
    pts.push(edge(p1));
    return `M${pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L')} Z`;
  };
  // 胜出片角平分线方向、约 55% 半径处放一个实心圆点,标出「实际用的底色」。
  const phiMid = -90 + (hiIndex + 0.5) * seg;
  const [ex, ey] = edge(phiMid);
  const dotX = 50 + (ex - 50) * 0.55;
  const dotY = 50 + (ey - 50) * 0.55;
  return (
    <svg className="subset-swatch-tile" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {colors.map((c, i) => <path key={c} d={wedge(i)} fill={COLOR_HEX[c]} />)}
      <circle cx={dotX} cy={dotY} r="15" fill="#fff" stroke="#000" strokeOpacity="0.5" strokeWidth="2.5" />
    </svg>
  );
}

// 菜单里的行序(用户指定):双 → 六 → 单 → 四。
const MODE_ORDER: ColorMode[] = ['dual', 'cn', 'single', 'quad'];
const MODE_LABEL: Record<ColorMode, { zh: string; en: string
 }> = {
  cn: { zh: '六色', en: 'CN' },
  quad: { zh: '四色', en: 'Quad' },
  dual: { zh: '双色', en: 'Dual'
},
  single: { zh: '单色', en: 'Single'
},
};

export interface SubsetOption { id: string; key: string; colors: ColorLetter[] }

/** 某档模式下的全部子集选项(菜单一次摊开四档,所以要能脱离当前 mode 取)。 */
export function subsetOptionsFor(mode: ColorMode): SubsetOption[] {
  switch (mode) {
    case 'single':
      // 白/黄放前(GRADIENT_ORDER,与直方图配色序一致),不用 COLOR_LETTERS 的字母序。
      return GRADIENT_ORDER.map((c) => ({ id: c, key: c, colors: [c] }));
    case 'dual':
      return DUAL_PAIRS.map((p) => ({ id: p.key, key: subsetKeyFromLetters(p.letters), colors: [...p.letters] }));
    case 'quad':
      return DUAL_PAIRS.map((p) => {
        const cs = COLOR_LETTERS.filter((c) => !(p.letters as string[]).includes(c));
        return { id: p.key, key: subsetKeyFromLetters(cs), colors: cs };
      });
    case 'cn':
    default:  // 六色 = 用全部色,无子选,单个「全色」块代表这一档
      return [{ id: 'cn', key: subsetKeyFromLetters([...COLOR_LETTERS]), colors: [...COLOR_LETTERS] }];
  }
}
export interface SubsetSelection {
  colorMode: ColorMode;
  setColorMode: (m: ColorMode) => void;
  subsetKey: string;          // 当前选中子集的 key(与 distribution/recent_scrambles 数据 key 一致)
  selectedColors: ColorLetter[];
  options: SubsetOption[];    // 当前模式下可选的子集(cn 为空 = 无需子选)
  activeOptionId: string;
  selectOption: (id: string) => void;
  selectByKey: (key: string) => void;  // 按任意 subsetKey 直接定位(推导 mode + 子选,供自动选最稀有用)
}

// 把一个 subsetKey(如 'Y' / 'WY' / 'BGOR' / 'BGORWY')反推成初始 mode + 子选状态,
// 供深链 / URL 还原(?colors=WY 等)。无 key 时退回传入的 initialMode + 各档默认。
function deriveSubsetInit(
  initialMode: ColorMode,
  key?: string,
): { mode: ColorMode; single: ColorLetter; dual: string; quad: string } {
  const base = { mode: initialMode, single: 'Y' as ColorLetter, dual: 'WY', quad: 'BG' };
  if (!key) return base;
  const letters = key.split('').filter((c): c is ColorLetter => (COLOR_LETTERS as string[]).includes(c));
  if (letters.length === 6) return { ...base, mode: 'cn' };
  if (letters.length === 1) return { ...base, mode: 'single', single: letters[0] };
  if (letters.length === 2) {
    const pair = DUAL_PAIRS.find((p) => subsetKeyFromLetters(p.letters) === subsetKeyFromLetters(letters));
    return { ...base, mode: 'dual', dual: pair?.key ?? 'WY' };
  }
  if (letters.length === 4) {
    const missing = COLOR_LETTERS.filter((c) => !letters.includes(c));
    const pair = DUAL_PAIRS.find((p) => subsetKeyFromLetters(p.letters) === subsetKeyFromLetters(missing));
    return { ...base, mode: 'quad', quad: pair?.key ?? 'BG' };
  }
  return base;
}

// 模式 + 子选状态 → 当前 subsetKey / 颜色 / 可选项。两页各自 use 一份。
// initialSubsetKey:可选深链 key(只在首次挂载用于还原,之后由组件自身状态驱动)。
export function useSubsetSelection(initialMode: ColorMode = 'cn', initialSubsetKey?: string): SubsetSelection {
  const [init] = useState(() => deriveSubsetInit(initialMode, initialSubsetKey));
  const [colorMode, setColorMode] = useState<ColorMode>(init.mode);
  const [singleColor, setSingleColor] = useState<ColorLetter>(init.single);
  const [dualPairKey, setDualPairKey] = useState<string>(init.dual);
  const [quadExcludedPairKey, setQuadExcludedPairKey] = useState<string>(init.quad);

  return useMemo<SubsetSelection>(() => {
    let options: SubsetOption[];
    let activeOptionId: string;
    let selectedColors: ColorLetter[];
    let selectOption: (id: string) => void;

    switch (colorMode) {
      case 'single':
        options = subsetOptionsFor('single');
        activeOptionId = singleColor;
        selectedColors = [singleColor];
        selectOption = (id) => setSingleColor(id as ColorLetter);
        break;
      case 'dual':
        options = subsetOptionsFor('dual');
        activeOptionId = dualPairKey;
        selectedColors = [...(DUAL_PAIRS.find((p) => p.key === dualPairKey) ?? DUAL_PAIRS[0]).letters];
        selectOption = (id) => setDualPairKey(id);
        break;
      case 'quad':
        options = subsetOptionsFor('quad');
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
      selectByKey: (key: string) => {
        const d = deriveSubsetInit(colorMode, key);
        setColorMode(d.mode);
        setSingleColor(d.single);
        setDualPairKey(d.dual);
        setQuadExcludedPairKey(d.quad);
      },
    };
  }, [colorMode, singleColor, dualPairKey, quadExcludedPairKey]);
}

// allOption:可选的「综合」档(合并全部底色档)。仅首页概率视图传入 —— stats / StageSolver / 类型视图
// 都是「选一个档」的语境,不传就完全不出现这一项(菜单/触发按钮均无变化)。active 时触发钮显示「综合」
// 文字、菜单里该整行高亮,其余色块不高亮(调用方把 sel.subsetKey 置空即可)。
export function SubsetColorPicker({ sel, isZh, className, allOption }: {
  sel: SubsetSelection; isZh: boolean; className?: string;
  allOption?: { active: boolean; onSelect: () => void };
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  usePanelClamp(open, panelRef); // 触发钮靠右时面板右缘可能越出视口 → 实测左移

  // 开着时:点外面 / Esc 关掉(Esc 焦点还给按钮)。
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      btnRef.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const colorTitle = (colors: ColorLetter[]) =>
    (colors.length === COLOR_LETTERS.length
      ? tr({ zh: '色中性 全部 6 色', en: 'Color-neutral, all six' })
      : colors.map((c) => COLOR_NAME[c][isZh ? 'zh' : 'en']).join(isZh ? '' : '+'));
  const modeName = MODE_LABEL[sel.colorMode][isZh ? 'zh' : 'en'];
  const curTitle = colorTitle(sel.selectedColors);
  const aggName = tr({ zh: '综合', en: 'All' });
  const aggTitle = tr({ zh: '综合:合并全部底色档取最稀有', en: 'All neutralities combined — rarest across every subset' });
  const aggActive = !!allOption?.active;

  return (
    <div ref={rootRef} className={`subset-picker${className ? ` ${className}` : ''}`}>
      <button
        ref={btnRef}
        type="button"
        className={`subset-picker-mode${open ? ' is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={aggActive
          ? `${tr({ zh: '底色', en: 'Bottom color' })}: ${aggName}`
          : `${tr({ zh: '底色', en: 'Bottom color' })}: ${modeName} ${curTitle}`}
        title={aggActive ? aggTitle : curTitle}
      >
        {aggActive
          ? <span className="subset-agg-trigger">{aggName}</span>
          : <span className="subset-swatch is-static" aria-hidden="true"><SubsetSwatch colors={sel.selectedColors} /></span>}
      </button>

      {open && (
        <div ref={panelRef} className="subset-picker-panel" role="group" aria-label={tr({ zh: '底色', en: 'Bottom color' })}>
          {/* 「综合」整行(仅概率视图传 allOption):横跨两列,合并全部底色档。 */}
          {allOption && (
            <button
              type="button"
              className={`subset-agg-item${aggActive ? ' is-active' : ''}`}
              onClick={() => { allOption.onSelect(); setOpen(false); btnRef.current?.focus(); }}
              aria-pressed={aggActive}
              title={aggTitle}
            >{tr({ zh: '综合', en: 'All' })}</button>
          )}
          {/* 两列网格(模式名 | 色块行),行用 Fragment 直接摊进网格 = 四档模式名左边缘自动对齐。 */}
          {MODE_ORDER.map((m) => (
            <Fragment key={m}>
              <span className="subset-picker-name is-row">{MODE_LABEL[m][isZh ? 'zh' : 'en']}</span>
              <div className="subset-picker-swatches">
                {subsetOptionsFor(m).map((opt) => {
                  const active = opt.key === sel.subsetKey;
                  return (
                    <button
                      key={`${m}-${opt.id}`}
                      type="button"
                      className={`subset-swatch${active ? ' is-active' : ''}`}
                      // 直接按 subsetKey 定位 = 一次点击同时定模式和子选。
                      onClick={() => { sel.selectByKey(opt.key); setOpen(false); btnRef.current?.focus(); }}
                      title={colorTitle(opt.colors)}
                      aria-label={colorTitle(opt.colors)}
                      aria-pressed={active}
                    >
                      <SubsetSwatch colors={opt.colors} />
                    </button>
                  );
                })}
              </div>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
