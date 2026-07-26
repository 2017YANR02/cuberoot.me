// 按阶段展示色块下拉(twizzle edit 的 Stickering select,issue #27)。
// 住在魔方下方播放条最左侧;显隐由 simCaps.supports.stickering 决定(隐藏而非置灰)。
// NxN 清单来自 engine/nxn/stickering.ts(引擎遮罩);megaminx / fto(cubing.js 渲染)
// 用 cubing.js 原生 experimentalStickering,清单与 cubing.js puzzle-stickerings.ts 对齐。
import { useMemo } from 'react';
import { useT } from '@/hooks/useT';
import { CROSS_COLORS, stickeringGroupsFor, type StickeringGroup } from './engine/nxn/stickering';
import { CUSTOM_STICKERING, countSids, type PickGrain, type CustomTreatment } from './engine/nxn/customStickering';
import { visualcubeStageGroups, VC_MASK_LABEL } from './engine/nxn/vcStageMask';
import PillToggle from '@/components/PillToggle/PillToggle';
import BoolToggle from '@/components/BoolToggle';
import type { SimPuzzle } from './PlayerControls';

// 十字(底面)颜色标签(标准配色 U=白 D=黄 F=绿 B=蓝 R=红 L=橙)。
const CROSS_COLOR_LABEL: Record<string, { zh: string; en: string }> = {
  white: { zh: '白', en: 'White' },
  yellow: { zh: '黄', en: 'Yellow' },
  green: { zh: '绿', en: 'Green' },
  blue: { zh: '蓝', en: 'Blue' },
  red: { zh: '红', en: 'Red' },
  orange: { zh: '橙', en: 'Orange' },
};

// cubing.js megaminx 注册的 stickering(cubeLikeStickeringList("megaminx")):full + LL/LS 组。
const MEGAMINX_GROUPS: StickeringGroup[] = [
  { group: 'Stickering', items: ['full'] },
  { group: 'Last Layer', items: ['OLL', 'PLL', 'LL', 'EOLL', 'COLL', 'OCLL', 'CPLL', 'CLL', 'EPLL', 'ELL', 'ZBLL'] },
  { group: 'Last Slot', items: ['LS', 'LSOLL', 'LSOCLL', 'ELS', 'CLS', 'ZBLS', 'VLS', 'WVLS'] },
];
// cubing.js fto 注册的 stickering(ftoStickerings(),Bencisco 法阶段)。
const FTO_GROUPS: StickeringGroup[] = [
  { group: 'Stickering', items: ['full'] },
  {
    group: 'Bencisco',
    items: ['experimental-fto-fc', 'experimental-fto-f2t', 'experimental-fto-sc',
      'experimental-fto-l2c', 'experimental-fto-lbt', 'experimental-fto-l3t'],
  },
];

// 自定义阶段的画法。选项文字自带主语(选中 / 其余),两只下拉并排也不会看混,
// 省掉一条前缀标签。默认值排第一位。
const PICK_OPTIONS: { v: CustomTreatment; zh: string; en: string }[] = [
  { v: 'regular', zh: '选中 原色', en: 'Picked: color' },
  { v: 'dim', zh: '选中 压暗', en: 'Picked: dim' },
  { v: 'ignored', zh: '选中 变灰', en: 'Picked: gray' },
];
const REST_OPTIONS: { v: CustomTreatment; zh: string; en: string }[] = [
  { v: 'ignored', zh: '其余 变灰', en: 'Rest: gray' },
  { v: 'dim', zh: '其余 压暗', en: 'Rest: dim' },
  { v: 'regular', zh: '其余 原色', en: 'Rest: color' },
];

/** 选项显示文本:阶段名本身是通用缩写原样展示,少数长名 / 前缀名换短标签。 */
function itemLabel(name: string, t: (zh: string, en: string) => string): string {
  if (name === 'full') return t('完整', 'full');
  if (name === CUSTOM_STICKERING) return t('自定义', 'custom');
  if (name === 'centers-only') return t('仅中心', 'centers only');
  if (name === 'opposite-centers') return t('对面中心', 'opposite centers');
  if (name.startsWith('experimental-fto-')) return name.slice('experimental-fto-'.length).toUpperCase();
  // visualcube 遮罩用 masks.ts 的人读标签(XCross FR / DR R / Mehta Belt2…)。
  return VC_MASK_LABEL[name] ?? name;
}

function groupLabel(group: string, t: (zh: string, en: string) => string): string {
  switch (group) {
    case 'Stickering': return t('阶段', 'Stickering');
    case 'Last Layer': return t('顶层', 'Last Layer');
    case 'Last Slot': return t('末槽', 'Last Slot');
    case 'Roux': return t('桥式', 'Roux');
    case 'Reduction': return t('降阶', 'Reduction');
    case 'General': return t('通用', 'General');
    case 'Miscellaneous': return t('其它', 'Miscellaneous');
    // visualcube 搬来的遮罩(退役对照表 §2b)
    case 'VCMasks': return t('遮罩', 'Masks');
    case 'VCMasksExt': return t('遮罩(进阶)', 'Masks (extended)');
    case 'VCMasksSize': return t('遮罩(阶专属)', 'Masks (this size)');
    // CFOP / ZZ / Petrus / Nautilus / FMC / Ortega / Bencisco:通用名,双语同形
    default: return group;
  }
}

export default function StickeringSelect({
  puzzleKind, value, onChange, color, onColorChange,
  mask = '', onMaskClear, editing = true, onEditingChange, grain = 'sticker', onGrainChange,
  pick = 'regular', onPickChange, rest = 'ignored', onRestChange,
}: {
  puzzleKind: SimPuzzle;
  value: string;
  onChange: (v: string) => void;
  /** 十字(底面)颜色(cubedb 的 Cross Color)。仅 NxN 引擎遮罩支持;
   *  megaminx / fto 走 cubing.js 原生 stickering,无重定向参数,不显示。 */
  color?: string;
  onColorChange?: (v: string) => void;
  /** 自定义阶段:选中的贴纸清单 + 作图开关(仅 value==='custom' 时显示)。 */
  mask?: string;
  onMaskClear?: () => void;
  editing?: boolean;
  onEditingChange?: (v: boolean) => void;
  grain?: PickGrain;
  onGrainChange?: (v: PickGrain) => void;
  /** 画法:选中的贴纸 / 其余贴纸各自保原色、压暗还是置灰(预设阶段也是这三档在混用)。 */
  pick?: CustomTreatment;
  onPickChange?: (v: CustomTreatment) => void;
  rest?: CustomTreatment;
  onRestChange?: (v: CustomTreatment) => void;
}) {
  const t = useT();
  const groups = useMemo<StickeringGroup[]>(() => {
    // NxN:引擎自带阶段(方法学 CFOP/ZZ/Roux/…)+ visualcube 整套 MASK 清单(去重)。
    if (typeof puzzleKind === 'number') return [...stickeringGroupsFor(puzzleKind), ...visualcubeStageGroups(puzzleKind)];
    if (puzzleKind === 'megaminx') return MEGAMINX_GROUPS;
    if (puzzleKind === 'fto') return FTO_GROUPS;
    return [];
  }, [puzzleKind]);
  if (groups.length === 0) return null;
  // URL 带了本拼图清单外的阶段名(换拼图残留):补一项占位让 select 不显示成空白;
  // 引擎遮罩对未知名回退 full(不变暗),cubing.js 端由 player 自行兜底。
  const known = groups.some((g) => g.items.includes(value));
  const isCustom = value === CUSTOM_STICKERING;
  // 自定义阶段的清单是绝对的(用户点的就是这几枚),没有「整套旋转到某底色」可言。
  const showColor = typeof puzzleKind === 'number' && value !== 'full' && !isCustom && !!onColorChange;
  const colorValue = color ?? 'yellow';
  const picked = isCustom ? countSids(mask) : 0;
  return (
    <>
      <select
        className="sim-player-mode sim-player-stickering"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={t('按阶段展示色块:所选阶段相关的贴纸保持彩色,其余变暗或置灰', 'Stage stickering: keep the stickers of the chosen stage colored, dim or gray out the rest')}
        aria-label={t('按阶段展示色块', 'Stage stickering')}
      >
        {groups.map((g) => (
          <optgroup key={g.group} label={groupLabel(g.group, t)}>
            {g.items.map((name) => (
              <option key={name} value={name}>{itemLabel(name, t)}</option>
            ))}
          </optgroup>
        ))}
        {!known && <option value={value}>{value}</option>}
      </select>
      {showColor && (
        <select
          className="sim-player-mode sim-player-stickering"
          value={colorValue}
          onChange={(e) => onColorChange(e.target.value)}
          title={t('十字(底面)颜色:整套阶段旋转到所选颜色的面,顶层阶段落在对面', 'Cross (bottom) color: re-anchor the stage to the chosen face; last-layer stages land on the opposite face')}
          aria-label={t('十字颜色', 'Cross color')}
        >
          {CROSS_COLORS.map((c) => (
            <option key={c} value={c}>{t(CROSS_COLOR_LABEL[c].zh, CROSS_COLOR_LABEL[c].en)}</option>
          ))}
          {!CROSS_COLORS.includes(colorValue as (typeof CROSS_COLORS)[number]) && (
            <option value={colorValue}>{colorValue}</option>
          )}
        </select>
      )}
      {isCustom && (
        <span className="sim-stickering-custom">
          <BoolToggle
            value={editing}
            onChange={(v) => onEditingChange?.(v)}
            label={t('点选', 'Pick')}
            ariaLabel={t('点选贴纸(开着时点魔方 = 选贴纸,不拧层)', 'Pick stickers (while on, clicking the cube selects instead of turning)')}
          />
          <PillToggle
            value={grain === 'sticker'}
            onChange={(v) => onGrainChange?.(v ? 'sticker' : 'piece')}
            onLabel={t('贴纸', 'Sticker')}
            offLabel={t('整块', 'Piece')}
            ariaLabel={t('选取粒度', 'Pick granularity')}
          />
          {picked > 0 && (
            <>
              <select
                className="sim-player-mode sim-player-stickering"
                value={pick}
                onChange={(e) => onPickChange?.(e.target.value as CustomTreatment)}
                title={t('选中的贴纸怎么显示', 'How the picked stickers are drawn')}
                aria-label={t('选中的贴纸怎么显示', 'How the picked stickers are drawn')}
              >
                {PICK_OPTIONS.map((o) => <option key={o.v} value={o.v}>{t(o.zh, o.en)}</option>)}
              </select>
              <select
                className="sim-player-mode sim-player-stickering"
                value={rest}
                onChange={(e) => onRestChange?.(e.target.value as CustomTreatment)}
                title={t('其余贴纸怎么显示(压暗 = CLL 那类预设的画法)', 'How the rest are drawn (dim = what presets like CLL do)')}
                aria-label={t('其余贴纸怎么显示', 'How the rest are drawn')}
              >
                {REST_OPTIONS.map((o) => <option key={o.v} value={o.v}>{t(o.zh, o.en)}</option>)}
              </select>
            </>
          )}
          <span className="sim-stickering-count" aria-live="polite">
            {picked > 0
              ? t(`已选 ${picked}`, `${picked} picked`)
              : t('点魔方选贴纸', 'Click a sticker')}
          </span>
          {picked > 0 && (
            <button
              type="button"
              className="sim-stickering-clear"
              onClick={() => onMaskClear?.()}
            >
              {t('清空', 'Clear')}
            </button>
          )}
        </span>
      )}
    </>
  );
}
