// 管理员遮罩覆盖层的合成逻辑(engine/nxn/maskConfig.ts)。
// 最重要的一条:没有任何覆盖行时,合成结果必须与代码默认清单逐字相同 —— 否则这层
// 「只存差异」的设计就漏了,访客会看到与代码不一致的清单。
import { describe, it, expect } from 'vitest';
import {
  applyMaskConfig, maskLabelOverride, maskRowsForOrder, presetMaskFn, isPresetMask, PRESET_GROUP,
} from '@/app/[lang]/sim/engine/nxn/maskConfig';
import { FM_REGULAR, FM_IGNORED } from '@/app/[lang]/sim/engine/nxn/stickering';
import { FACE } from '@/app/[lang]/sim/engine/define';
import type { SimMaskRow } from '@/lib/sim-masks-api';

const GROUPS = [
  { group: 'Stickering', items: ['full', 'custom'] },
  { group: 'CFOP', items: ['Cross', 'F2L', 'OLL', 'PLL'] },
];

const row = (p: Partial<SimMaskRow> & { maskKey: string }): SimMaskRow => ({
  // position: -1 = 还没排过(改名 / 隐藏建的行就是这个值),与 DB 默认一致
  id: 1, kind: 'builtin', cubeSize: 3, position: -1, hidden: false,
  labelEn: '', labelZh: '', sids: '', pick: 'regular', rest: 'ignored', ...p,
});

describe('applyMaskConfig', () => {
  it('没有覆盖行 → 与代码默认清单逐字相同', () => {
    expect(applyMaskConfig(GROUPS, [], 3)).toEqual(GROUPS);
  });

  it('别的阶数的行不生效(3 阶的覆盖不该影响 4 阶下拉)', () => {
    const rows = [row({ maskKey: 'OLL', cubeSize: 3, hidden: true })];
    expect(applyMaskConfig(GROUPS, rows, 4)).toEqual(GROUPS);
  });

  it('hidden 从下拉里去掉,但管理抽屉(includeHidden)仍列出来', () => {
    const rows = [row({ maskKey: 'OLL', hidden: true })];
    expect(applyMaskConfig(GROUPS, rows, 3)[1].items).toEqual(['Cross', 'F2L', 'PLL']);
    expect(applyMaskConfig(GROUPS, rows, 3, { includeHidden: true })[1].items)
      .toEqual(['Cross', 'F2L', 'OLL', 'PLL']);
  });

  it('整组藏光 → 该 optgroup 整个不渲染(不留空壳)', () => {
    const rows = GROUPS[1].items.map((k, i) => row({ id: i + 1, maskKey: k, hidden: true }));
    expect(applyMaskConfig(GROUPS, rows, 3).map((g) => g.group)).toEqual(['Stickering']);
  });

  it('排过的按 position 排在组内最前,没排过的跟在后面按代码顺序', () => {
    const rows = [
      row({ id: 1, maskKey: 'PLL', position: 0 }),
      row({ id: 2, maskKey: 'F2L', position: 1 }),
    ];
    expect(applyMaskConfig(GROUPS, rows, 3)[1].items).toEqual(['PLL', 'F2L', 'Cross', 'OLL']);
  });

  it('抽屉发全量 keys 后(每条都有行)顺序完全由表说话', () => {
    const order = ['OLL', 'Cross', 'PLL', 'F2L'];
    const rows = order.map((k, i) => row({ id: i + 1, maskKey: k, position: i }));
    expect(applyMaskConfig(GROUPS, rows, 3)[1].items).toEqual(order);
  });

  it('只为隐藏建的行不改顺序(藏了再取消,条目回到原位)', () => {
    const rows = [row({ maskKey: 'PLL', hidden: true })];
    expect(applyMaskConfig(GROUPS, rows, 3, { includeHidden: true })[1].items)
      .toEqual(['Cross', 'F2L', 'OLL', 'PLL']);
  });

  it('自建遮罩单独一组,紧跟在「阶段」组后面;隐藏的不出现', () => {
    const rows = [
      row({ id: 1, maskKey: 'preset:a', kind: 'custom', sids: 'U:0', position: 1 }),
      row({ id: 2, maskKey: 'preset:b', kind: 'custom', sids: 'U:1', position: 0 }),
      row({ id: 3, maskKey: 'preset:c', kind: 'custom', sids: 'U:2', hidden: true }),
    ];
    const out = applyMaskConfig(GROUPS, rows, 3);
    expect(out.map((g) => g.group)).toEqual(['Stickering', PRESET_GROUP, 'CFOP']);
    expect(out[1].items).toEqual(['preset:b', 'preset:a']);   // position 说话
  });
});

describe('maskLabelOverride', () => {
  const cfg = maskRowsForOrder([
    row({ id: 1, maskKey: 'OLL', labelZh: '顶层朝向', labelEn: 'Top orientation' }),
    row({ id: 2, maskKey: 'PLL', labelZh: '只改了中文' }),
    row({ id: 3, maskKey: 'F2L' }),
  ], 3);

  it('双语都填 → 按语言取', () => {
    expect(maskLabelOverride(cfg, 'OLL', true)).toBe('顶层朝向');
    expect(maskLabelOverride(cfg, 'OLL', false)).toBe('Top orientation');
  });

  it('只填一侧 → 两侧都用它(免得英文侧变空)', () => {
    expect(maskLabelOverride(cfg, 'PLL', false)).toBe('只改了中文');
  });

  it('有行但没填标签 / 没有行 → 空串(调用方回退代码默认)', () => {
    expect(maskLabelOverride(cfg, 'F2L', true)).toBe('');
    expect(maskLabelOverride(cfg, 'Cross', true)).toBe('');
  });
});

describe('presetMaskFn', () => {
  const N = 3;
  const idx = (x: number, y: number, z: number) => x + y * N + z * N * N;
  // U 面展开图 index 0 = (x=0,z=0) 那枚(netIndex 的 U 行序),这里只验「清单里的亮、别的灰」
  const rows = [row({ id: 1, maskKey: 'preset:one', kind: 'custom', sids: 'U:0', pick: 'regular', rest: 'ignored' })];

  it('非 preset 值 / 查不到 / 不是 custom → null', () => {
    expect(presetMaskFn(N, 'OLL', rows)).toBeNull();
    expect(presetMaskFn(N, 'preset:nope', rows)).toBeNull();
    expect(presetMaskFn(N, 'preset:x', [row({ id: 2, maskKey: 'preset:x', sids: 'U:0' })])).toBeNull();
  });

  it('清单里的那枚原色,其余置灰', () => {
    const fn = presetMaskFn(N, 'preset:one', rows)!;
    const lit = [idx(0, 2, 0), idx(0, 2, 2), idx(2, 2, 0), idx(2, 2, 2)]
      .filter((i) => fn(i, FACE.U) === FM_REGULAR);
    expect(lit.length).toBe(1);                       // U 面四角里恰有一枚被点亮
    expect(fn(idx(1, 0, 1), FACE.D)).toBe(FM_IGNORED); // D 中心不在清单里
  });

  it('阶数不匹配的行不生效(点选清单绑死阶数)', () => {
    expect(presetMaskFn(4, 'preset:one', rows)).toBeNull();
  });

  it('isPresetMask 只认前缀', () => {
    expect(isPresetMask('preset:a')).toBe(true);
    expect(isPresetMask('custom')).toBe(false);
    expect(isPresetMask('OLL')).toBe(false);
  });
});
