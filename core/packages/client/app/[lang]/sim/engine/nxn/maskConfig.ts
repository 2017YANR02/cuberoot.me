// 管理员自定义遮罩清单:代码里的默认清单 ⊕ DB 里的覆盖层。
//
// 分层的理由:清单本体(方法学阶段的坐标谓词 + visualcube 位串)是代码资产,不该搬进 DB;
// 但「叫什么名字、排第几、要不要出现在下拉里、再加一条我自己点出来的」是运营决定,改一次
// 不该发一次版。所以 DB 只存差异(lib/sim-masks-api.ts 的 SimMaskRow),这里把两边合成
// 最终下拉。没有任何行时,合成结果必须与代码默认逐字相同 —— 测试钉死这条。
//
// 先合成旧 position 排序，再应用按阶数保存的完整布局；新条目追加到默认分组。
import { customMaskFn, type CustomTreatment } from './customStickering';
import type { StickeringGroup, StickeringMaskFn } from './stickering';
import { PRESET_PREFIX, type SimMaskRow } from '@/lib/sim-masks-api';

/** Editable English label rendered as a variable-style name; engine keys stay stable. */
export function maskDisplayIdentifier(label: string): string {
  let name = label.trim().replace(/[^A-Za-z0-9_$]+/g, '_') || 'stage';
  if (/^[0-9]/.test(name) || /^(?:await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|false|finally|for|function|if|implements|import|in|instanceof|interface|let|new|null|package|private|protected|public|return|static|super|switch|this|throw|true|try|typeof|var|void|while|with|yield)$/.test(name)) name = `_${name}`;
  return name;
}

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
  opts: { includeHidden?: boolean; layout?: readonly StickeringGroup[] } = {},
): StickeringGroup[] {
  const cfg = maskRowsForOrder(rows, order);
  const out: StickeringGroup[] = [];
  for (const g of groups) {
    const kept = g.items;
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
    .filter((r) => r.kind === 'custom')
    .map((r) => ({ r, tier: r.position >= 0 ? 0 : 1 }))
    .sort((a, b) => (a.tier - b.tier) || (a.r.position - b.r.position) || (a.r.id - b.r.id))
    .map((x) => x.r.maskKey);
  {
    // 紧跟在「阶段」那组后面:自建遮罩是常用入口,不该沉到几十条遮罩底下
    const at = out.findIndex((g) => g.group === 'Stickering');
    out.splice(at < 0 ? 0 : at + 1, 0, { group: PRESET_GROUP, items: presets });
  }
  const known = new Set(out.flatMap((g) => g.items));
  const placed = new Set<string>();
  const arranged: StickeringGroup[] = [];
  // Ignore removed stages and obsolete groups; append newly introduced stages in default order.
  for (const saved of opts.layout ?? []) {
    if (!out.some((g) => g.group === saved.group) || arranged.some((g) => g.group === saved.group)) continue;
    const items = saved.items.filter((key) => {
      if (!known.has(key) || placed.has(key)) return false;
      placed.add(key);
      return true;
    });
    arranged.push({ group: saved.group, items });
  }
  for (const g of out) {
    let target = arranged.find((x) => x.group === g.group);
    if (!target) { target = { group: g.group, items: [] }; arranged.push(target); }
    target.items.push(...g.items.filter((key) => !placed.has(key)));
  }
  return arranged.map((g) => ({ ...g, items: opts.includeHidden ? g.items : g.items.filter((key) => !cfg.get(key)?.hidden) }))
    .filter((g) => opts.includeHidden || g.items.length > 0);
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
