// 管理员自定义遮罩清单:代码里的默认清单 ⊕ DB 里的覆盖层。
//
// 分层的理由:清单本体(方法学阶段的坐标谓词 + visualcube 位串)是代码资产,不该搬进 DB;
// 但「叫什么名字、排第几、要不要出现在下拉里、再加一条我自己点出来的」是运营决定,改一次
// 不该发一次版。所以 DB 只存差异(lib/sim-masks-api.ts 的 SimMaskRow),这里把两边合成
// 最终下拉。没有任何行时,合成结果必须与代码默认逐字相同 —— 测试钉死这条。
//
// 排序规则:管理员排过的条目(有行、position 有意义)升序排在组内最前,没排过的按代码顺序
// 跟在后面。抽屉里点一次上/下就会把该组全量 keys 发去 /reorder(全组都有行),于是「看到的
// 顺序 = 摆好的顺序」;半截数据也不会乱序,只是新条目落在末尾。
import { customMaskFn, type CustomTreatment } from './customStickering';
import type { StickeringGroup, StickeringMaskFn } from './stickering';
import { PRESET_PREFIX, type SimMaskRow } from '@/lib/sim-masks-api';

/** 自建遮罩单独一组(不混进内置分组,免得管理员的东西看着像站内预设)。 */
export const PRESET_GROUP = 'AdminPresets';

/** 本阶生效的覆盖行:maskKey → row。 */
export function maskRowsForOrder(rows: readonly SimMaskRow[], order: number): Map<string, SimMaskRow> {
  const out = new Map<string, SimMaskRow>();
  for (const r of rows) if (r.cubeSize === order) out.set(r.maskKey, r);
  return out;
}

/** 该条目的展示标签覆盖(空 = 用代码默认)。 */
export function maskLabelOverride(cfg: Map<string, SimMaskRow>, key: string, isZh: boolean): string {
  const r = cfg.get(key);
  if (!r) return '';
  // 只填了一侧语言时两侧都用它 —— 管理员多半只想改中文名,别让英文侧变空
  return (isZh ? r.labelZh || r.labelEn : r.labelEn || r.labelZh) || '';
}

/** 代码清单 + 覆盖层 → 实际下拉分组(隐藏、排序、自建遮罩组)。
 *  includeHidden:管理抽屉要连隐藏项一起列(否则藏了就没法取消隐藏)。 */
export function applyMaskConfig(
  groups: readonly StickeringGroup[],
  rows: readonly SimMaskRow[],
  order: number,
  opts: { includeHidden?: boolean } = {},
): StickeringGroup[] {
  const cfg = maskRowsForOrder(rows, order);
  const out: StickeringGroup[] = [];
  for (const g of groups) {
    const kept = opts.includeHidden ? g.items : g.items.filter((k) => !cfg.get(k)?.hidden);
    const ranked = kept.map((k, i) => {
      const r = cfg.get(k);
      // position < 0 = 还没排过(只为「改名 / 隐藏」建的行也是这个值)—— 那就按代码顺序,
      // 别让「藏一下再取消」把条目挪到组首。
      const posed = !!r && r.position >= 0;
      return { k, tier: posed ? 0 : 1, pos: posed ? r.position : i, i };
    });
    ranked.sort((a, b) => (a.tier - b.tier) || (a.pos - b.pos) || (a.i - b.i));
    if (ranked.length) out.push({ group: g.group, items: ranked.map((x) => x.k) });
  }
  const presets = [...cfg.values()]
    .filter((r) => r.kind === 'custom' && (opts.includeHidden || !r.hidden))
    .map((r) => ({ r, tier: r.position >= 0 ? 0 : 1 }))
    .sort((a, b) => (a.tier - b.tier) || (a.r.position - b.r.position) || (a.r.id - b.r.id))
    .map((x) => x.r.maskKey);
  if (presets.length) {
    // 紧跟在「阶段」那组后面:自建遮罩是常用入口,不该沉到几十条遮罩底下
    const at = out.findIndex((g) => g.group === 'Stickering');
    out.splice(at < 0 ? 0 : at + 1, 0, { group: PRESET_GROUP, items: presets });
  }
  return out;
}

/** 自建遮罩(`preset:` 前缀)→ 遮罩函数;不是自建 / 查不到 → null(调用方回退)。 */
export function presetMaskFn(
  order: number,
  value: string,
  rows: readonly SimMaskRow[],
): StickeringMaskFn | null {
  if (!value.startsWith(PRESET_PREFIX)) return null;
  const r = maskRowsForOrder(rows, order).get(value);
  if (!r || r.kind !== 'custom') return null;
  return customMaskFn(order, r.sids, r.pick as CustomTreatment, r.rest as CustomTreatment);
}

/** 是否自建遮罩值(SimPage 分发用,免得到处写字符串前缀)。 */
export function isPresetMask(value: string): boolean {
  return value.startsWith(PRESET_PREFIX);
}
