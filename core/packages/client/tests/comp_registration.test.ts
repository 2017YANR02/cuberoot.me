import { describe, it, expect } from 'vitest';
import type { Comp } from '@/lib/comp-search';
import {
  nextRegMilestone,
  buildRegView,
  countActionableReg,
  REG_HORIZON_DAYS,
  localDayDiff,
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
  it('已截止 → closed', () => {
    expect(nextRegMilestone(comp('c', -30, -1), NOW)?.status).toBe('closed');
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
    expect(keys).toEqual(['today', 'tomorrow', 'dayAfter', 'soon', 'later', 'closed']);
    expect(v.buckets[0].items[0].comp.id).toBe('today-close');
    expect(v.total).toBe(6); // 未结束比赛的 closed 保留
  });

  it('超视野排除、已截止保留', () => {
    const v = buildRegView(comps, NOW, new Set());
    const ids = v.buckets.flatMap((b) => b.items.map((i) => i.comp.id));
    expect(ids).toContain('closed');
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
  it('报名结束仍保留入口，超视野排除', () => {
    const comps: Comp[] = [
      comp('a', -5, 3),
      comp('b', 2, 30),
      comp('c', -30, -1),                 // 已截止
      comp('d', -5, REG_HORIZON_DAYS + 5), // 超视野
    ];
    expect(countActionableReg(comps, NOW)).toBe(3);
  });
});

 describe('Cubing registration and timezone boundaries', () => {
  const cnComp = { ...comp('cn', -5, 10), country: 'cn' };
  const cn = { registrationStartTime: iso(-5), registrationEndTime: iso(10), cancellationEndTime: iso(5), registrationReopenTime: iso(6), hasBeenFull: false };
  it('distinguishes open, early pause, scheduled pause, reopen and close', () => {
    expect(nextRegMilestone(cnComp, NOW, cn)?.status).toBe('open');
    expect(nextRegMilestone(cnComp, NOW, { ...cn, hasBeenFull: true })?.status).toBe('paused');
    expect(nextRegMilestone(cnComp, NOW + 5 * MS_DAY, cn)?.status).toBe('paused');
    expect(nextRegMilestone(cnComp, NOW + 6 * MS_DAY, cn)?.status).toBe('reopened');
    expect(nextRegMilestone(cnComp, NOW + 10 * MS_DAY, cn)?.status).toBe('closed');
    expect(nextRegMilestone(cnComp, NOW)?.status).toBe('unknown');
  });
  it('uses instants, not browser wall time, and rejects an ambiguous timestamp', () => {
    const c = { ...cn, registrationStartTime: '2026-11-15T20:00:00+08:00', registrationEndTime: '2026-11-16T12:00:00Z', registrationReopenTime: null };
    expect(nextRegMilestone(cnComp, Date.parse('2026-11-15T11:59:59Z'), c)?.status).toBe('upcoming');
    expect(nextRegMilestone(cnComp, Date.parse('2026-11-15T12:00:00Z'), c)?.status).toBe('open');
    expect(nextRegMilestone({ ...comp('invalid', null, null), registration_open: '2026-11-15 20:00:00' }, NOW)).toBeNull();
  });
  it('groups by calendar date across DST and midnight', () => {
    expect(localDayDiff(new Date(2026, 2, 9, 0, 1).getTime(), new Date(2026, 2, 8, 0, 1).getTime())).toBe(1);
    expect(localDayDiff(new Date(2026, 10, 2, 0, 1).getTime(), new Date(2026, 10, 1, 0, 1).getTime())).toBe(1);
    expect(localDayDiff(new Date(2026, 10, 15, 0, 1).getTime(), new Date(2026, 10, 14, 23, 59).getTime())).toBe(1);
  });
  it('does not show competitions that already ended', () => {
    expect(buildRegView([{ ...cnComp, end_date: '2020-01-01' }], NOW, new Set(['cn']), { cn }).total).toBe(0);
  });
});
