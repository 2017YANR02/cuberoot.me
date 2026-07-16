// 按阶段展示色块下拉(twizzle edit 的 Stickering select,issue #27)。
// 住在魔方下方播放条最左侧;显隐由 simCaps.supports.stickering 决定(隐藏而非置灰)。
// NxN 清单来自 engine/nxn/stickering.ts(引擎遮罩);megaminx / fto(cubing.js 渲染)
// 用 cubing.js 原生 experimentalStickering,清单与 cubing.js puzzle-stickerings.ts 对齐。
import { useMemo } from 'react';
import { useT } from '@/hooks/useT';
import { stickeringGroupsFor, type StickeringGroup } from './engine/nxn/stickering';
import type { SimPuzzle } from './PlayerControls';

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

/** 选项显示文本:阶段名本身是通用缩写原样展示,少数长名 / 前缀名换短标签。 */
function itemLabel(name: string, t: (zh: string, en: string) => string): string {
  if (name === 'full') return t('完整', 'full');
  if (name === 'centers-only') return t('仅中心', 'centers only');
  if (name === 'opposite-centers') return t('对面中心', 'opposite centers');
  if (name.startsWith('experimental-fto-')) return name.slice('experimental-fto-'.length).toUpperCase();
  return name;
}

function groupLabel(group: string, t: (zh: string, en: string) => string): string {
  switch (group) {
    case 'Stickering': return t('阶段', 'Stickering');
    case 'Last Layer': return t('顶层', 'Last Layer');
    case 'Last Slot': return t('最后槽', 'Last Slot');
    case 'Roux': return t('桥式 (Roux)', 'Roux');
    case 'Reduction': return t('降阶', 'Reduction');
    case 'General': return t('通用', 'General');
    case 'Miscellaneous': return t('其它', 'Miscellaneous');
    // CFOP (Fridrich) / ZZ / Petrus / Nautilus / FMC / Ortega / Bencisco:通用名,双语同形
    default: return group;
  }
}

export default function StickeringSelect({ puzzleKind, value, onChange }: {
  puzzleKind: SimPuzzle;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useT();
  const groups = useMemo<StickeringGroup[]>(() => {
    if (typeof puzzleKind === 'number') return stickeringGroupsFor(puzzleKind);
    if (puzzleKind === 'megaminx') return MEGAMINX_GROUPS;
    if (puzzleKind === 'fto') return FTO_GROUPS;
    return [];
  }, [puzzleKind]);
  if (groups.length === 0) return null;
  // URL 带了本拼图清单外的阶段名(换拼图残留):补一项占位让 select 不显示成空白;
  // 引擎遮罩对未知名回退 full(不变暗),cubing.js 端由 player 自行兜底。
  const known = groups.some((g) => g.items.includes(value));
  return (
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
  );
}
