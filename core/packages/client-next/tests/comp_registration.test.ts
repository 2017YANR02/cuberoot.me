import { describe, it, expect } from 'vitest';
import type { Comp } from '@/lib/comp-search';
import {
  nextRegMilestone,
  buildRegView,
  countActionableReg,
  REG_HORIZON_DAYS,
} from '@/lib/comp-registration';

const MS_DAY = 86_400_000;
// 本地正午锚点 — 加整数天后仍是当天正午,localDayDiff 才稳定(避开跨午夜边界)。
const NOW = new Date(2026, 5, 13, 12, 0, 0).getTime();

function iso(offsetDays: number): string {
  return new Date(NOW + offsetDays * MS_DAY).toISOString();
}

function comp(id: string, openDays: number | null, closeDays: number | null): Comp {
  return {
    id,
    name: id,
    country: 'us',
    start_date: '2026-09-01',
    end_date: '2026-09-01',
    events: ['3', 'fm'],
    registration_open: openDays == null ? null : iso(openDays),
    registration_close: closeDays == null ? null : iso(closeDays),
  };
}

describe('nextRegMilestone', () => {
  it('未开放 → open 里程碑', () => {
    const m = nextRegMilestone(comp('a', 3, 30), NOW);
    expect(m?.kind).toBe('open');
    expect(m?.at).toBe(NOW + 3 * MS_DAY);
  });
  it('报名中 → close 里程碑', () => {
    const m = nextRegMilestone(comp('b', -5, 10), NOW);
    expect(m?.kind).toBe('close');
    expect(m?.at).toBe(NOW + 10 * MS_DAY);
  });
  it('已截止 → null', () => {
    expect(nextRegMilestone(comp('c', -30, -1), NOW)).toBeNull();
  });
  it('无报名字段 → null', () => {
    expect(nextRegMilestone(comp('d', null, null), NOW)).toBeNull();
  });
});

describe('buildRegView 分组', () => {
  const comps: Comp[] = [
    comp('today-close', -5, 0.25), // 今天稍晚截止
    comp('tomorrow', -5, 1),       // 明天截止
    comp('dayafter-open', 2, 40),  // 后天开放
    comp('soon', -5, 5),           // 本周内截止
    comp('later', -5, 20),         // 更晚截止
    comp('closed', -30, -1),       // 已截止 → 不进视图
    comp('beyond', -5, REG_HORIZON_DAYS + 10), // 超视野 → 不进
  ];

  it('按本地日分桶且有序', () => {
    const v = buildRegView(comps, NOW, new Set());
    const keys = v.buckets.map((b) => b.key);
    expect(keys).toEqual(['today', 'tomorrow', 'dayAfter', 'soon', 'later']);
    expect(v.buckets[0].items[0].comp.id).toBe('today-close');
    expect(v.total).toBe(5); // closed + beyond 被排除
  });

  it('超视野与已截止不计入', () => {
    const v = buildRegView(comps, NOW, new Set());
    const ids = v.buckets.flatMap((b) => b.items.map((i) => i.comp.id));
    expect(ids).not.toContain('closed');
    expect(ids).not.toContain('beyond');
  });

  it('关注的比赛进 followed 且从日分组去重', () => {
    const v = buildRegView(comps, NOW, new Set(['tomorrow', 'closed']));
    const followedIds = v.followed.map((i) => i.comp.id);
    expect(followedIds).toContain('tomorrow');
    // 已截止但被关注 → 以 closed 形式保留
    const closedItem = v.followed.find((i) => i.comp.id === 'closed');
    expect(closedItem?.kind).toBe('closed');
    // 不在日分组里重复
    const dayIds = v.buckets.flatMap((b) => b.items.map((i) => i.comp.id));
    expect(dayIds).not.toContain('tomorrow');
  });
});

describe('countActionableReg', () => {
  it('数视野内可行动场次,排除已截止/超视野', () => {
    const comps: Comp[] = [
      comp('a', -5, 3),
      comp('b', 2, 30),
      comp('c', -30, -1),                 // 已截止
      comp('d', -5, REG_HORIZON_DAYS + 5), // 超视野
    ];
    expect(countActionableReg(comps, NOW)).toBe(2);
  });
});
