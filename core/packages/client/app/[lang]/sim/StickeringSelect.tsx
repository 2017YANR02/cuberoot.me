// 按阶段展示色块下拉(twizzle edit 的 Stickering select,issue #27)。
// 住在魔方下方播放条最左侧;显隐由 simCaps.supports.stickering 决定(隐藏而非置灰)。
// NxN 清单来自 engine/nxn/stickering.ts(引擎遮罩);megaminx / fto(cubing.js 渲染)
// 用 cubing.js 原生 experimentalStickering,清单与 cubing.js puzzle-stickerings.ts 对齐。
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useIsAdmin } from '@/lib/auth-store';
import CubeOrientationSelect from '@/components/CubeOrientationSelect';
import type { StickeringGroup } from './engine/nxn/stickering';
import { CUSTOM_STICKERING, countSids, type PickGrain, type CustomTreatment } from './engine/nxn/customStickering';
import { stickeringSelectGroupsFor, VC_MASK_LABEL } from './engine/nxn/vcStageMask';
import { applyMaskConfig, maskLabelOverride, maskRowsForOrder, PRESET_GROUP } from './engine/nxn/maskConfig';
import { PRESET_PREFIX } from '@/lib/sim-masks-api';
import { useSimMasks } from './useSimMasks';
import SimMaskAdmin from './SimMaskAdmin';
import PillToggle from '@/components/PillToggle/PillToggle';
import BoolToggle from '@/components/BoolToggle';
import CubeColorChip from '@/components/CubeColorChip/CubeColorChip';
import type { SimPuzzle } from './PlayerControls';
import { SwatchPopup } from './SwatchCell';
import { SQ1_STAGE_ITEMS } from '@/lib/sq1-stage-mask';
import { orientationForBottomFace, orientedFaceColors } from '@/lib/cube-orientation';
import { BADGE_FACE_ORDER, CUBE_COLOR_LETTER_FOR_FACE, CUBE_COLOR_NAMES, CUBE_FILL, type CubeFace } from '@/lib/cube-colors';

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
const SQ1_GROUPS: StickeringGroup[] = [
  { group: 'Stickering', items: ['full'] },
  { group: 'Square-1', items: [...SQ1_STAGE_ITEMS] },
];

// 自定义阶段的画法。选项文字自带主语(选中 / 其余),两只下拉并排也不会看混,
// 省掉一条前缀标签。默认值排第一位。
const PICK_OPTIONS: { v: CustomTreatment; zh: string; en: string }[] = [
  { v: 'regular', zh: '选中 原色', en: 'Picked: color' },
  { v: 'outline', zh: '选中 原色 + 描边', en: 'Picked: color + outline' },
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
  if (name.startsWith(PRESET_PREFIX)) return name.slice(PRESET_PREFIX.length);  // 自建遮罩没填标签时的兜底
  if (name === CUSTOM_STICKERING) return t('自定义', 'custom');
  if (name === 'Daisy') return t('小花', 'Daisy');
  if (name === 'Cross') return t('十字', 'Cross');
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
    case 'LBL': return t('层先法', 'LBL');
    // visualcube 搬来的遮罩(退役对照表 §2b)
    case 'VCMasks': return t('遮罩', 'Masks');
    case 'VCMasksSize': return t('遮罩(阶专属)', 'Masks (this size)');
    // 管理员自己点选存出来的遮罩(DB,见 SimMaskAdmin)
    case PRESET_GROUP: return t('自建', 'Custom masks');
    // CFOP / ZZ / Petrus / Nautilus / FMC / Ortega / Bencisco:通用名,双语同形
    default: return group;
  }
}

export default function StickeringSelect({
  puzzleKind, value, onChange, orientation = '', onOrientationChange,
  faceColors = CUBE_FILL,
  mask = '', onMaskClear, editing = true, onEditingChange, grain = 'sticker', onGrainChange,
  pick = 'regular', onPickChange, rest = 'ignored', onRestChange,
}: {
  puzzleKind: SimPuzzle;
  value: string;
  onChange: (v: string) => void;
  /** 配色朝向(整体转前缀,lib/cube-orientation 的 24 档):阶段位置固定,只重贴六面颜色。
   *  仅 NxN 引擎遮罩支持;megaminx / fto 走 cubing.js 原生 stickering,不显示。 */
  orientation?: string;
  onOrientationChange?: (v: string) => void;
  faceColors?: Record<CubeFace, string>;
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
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');   // 仅作 maskLabelOverride 的取值参数
  const isAdmin = useIsAdmin();
  const { rows, reload } = useSimMasks();
  const [adminOpen, setAdminOpen] = useState(false);
  // 代码里的默认清单(单一源);管理员的覆盖层再叠上去。
  const baseGroups = useMemo<StickeringGroup[]>(() => {
    // NxN:引擎自带阶段(方法学 CFOP/ZZ/Roux/…)+ visualcube 整套 MASK 清单(去重)。
    if (typeof puzzleKind === 'number') return stickeringSelectGroupsFor(puzzleKind);
    if (puzzleKind === 'sq1') return SQ1_GROUPS;
    if (puzzleKind === 'megaminx') return MEGAMINX_GROUPS;
    if (puzzleKind === 'fto') return FTO_GROUPS;
    return [];
  }, [puzzleKind]);
  // 覆盖层只管 NxN(megaminx / fto 的清单由 cubing.js 注册,遮罩函数也不在我们手里);
  // -1 是「本拼图没有覆盖层」的哨兵阶数,查出来必然是空 Map。
  const order = typeof puzzleKind === 'number' ? puzzleKind : -1;
  const groups = useMemo<StickeringGroup[]>(
    () => (order > 0 ? applyMaskConfig(baseGroups, rows, order) : baseGroups),
    [baseGroups, rows, order],
  );
  const cfg = useMemo(() => maskRowsForOrder(rows, order), [rows, order]);
  const label = (name: string): string => maskLabelOverride(cfg, name, isZh) || itemLabel(name, t);
  if (groups.length === 0) return null;
  // URL 带了本拼图清单外的阶段名(换拼图残留):补一项占位让 select 不显示成空白;
  // 引擎遮罩对未知名回退 full(不变暗),cubing.js 端由 player 自行兜底。
  const known = groups.some((g) => g.items.includes(value));
  const isCustom = value === CUSTOM_STICKERING;
  // 自定义阶段的清单是绝对的(用户点的就是这几枚),没有「整套转到某朝向」可言。
  const showOrientation = typeof puzzleKind === 'number' && value !== 'full' && !isCustom && !!onOrientationChange;
  const baseFace = orientedFaceColors(orientation).D;
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
              <option key={name} value={name}>{label(name)}</option>
            ))}
          </optgroup>
        ))}
        {!known && <option value={value}>{value}</option>}
      </select>
      {showOrientation && (value === 'Cross' || value === 'Daisy' || value === 'F2L' || value === 'fl' ? (
        <SwatchPopup
          className="sim-stage-color-select"
          title={t('底色', 'Base color')}
          trigger={<CubeColorChip colors={CUBE_COLOR_LETTER_FOR_FACE[baseFace]} faceColors={faceColors} />}
        >
          {(close) => BADGE_FACE_ORDER.map((face) => {
            const title = t(`${CUBE_COLOR_NAMES[face].zh}底`, `${CUBE_COLOR_NAMES[face].en} base`);
            return (
              <button
                key={face}
                type="button"
                className={`sim-swatch${baseFace === face ? ' active' : ''}`}
                title={title}
                aria-label={title}
                aria-pressed={baseFace === face}
                onClick={() => { onOrientationChange?.(orientationForBottomFace(face)); close(); }}
              >
                <CubeColorChip colors={CUBE_COLOR_LETTER_FOR_FACE[face]} faceColors={faceColors} />
              </button>
            );
          })}
        </SwatchPopup>
      ) : (
        <CubeOrientationSelect
          className="sim-player-mode sim-player-stickering"
          value={orientation}
          onChange={(v) => onOrientationChange?.(v)}
          title={t('配色朝向:阶段位置不变,只更换六面配色',
            'Color orientation: keep the stage in place and only change the face colors')}
          ariaLabel={t('配色朝向', 'Color orientation')}
        />
      ))}
      {isAdmin && order > 0 && (
        <button
          type="button"
          className="sim-stickering-admin"
          onClick={() => setAdminOpen(true)}
          title={t('遮罩清单管理(管理员):改名 / 排序 / 隐藏 / 把点选存成遮罩',
            'Manage mask list (admin): rename, reorder, hide, save a pick as a mask')}
          aria-label={t('遮罩清单管理', 'Manage mask list')}
        >
          <Settings size={14} />
        </button>
      )}
      {adminOpen && order > 0 && (
        <SimMaskAdmin
          order={order}
          groups={applyMaskConfig(baseGroups, rows, order, { includeHidden: true })}
          rows={rows}
          onReload={reload}
          onClose={() => setAdminOpen(false)}
          groupLabel={(g) => groupLabel(g, t)}
          defaultLabel={(name) => itemLabel(name, t)}
          pickedSids={isCustom ? mask : ''}
          pick={pick}
          rest={rest}
        />
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
