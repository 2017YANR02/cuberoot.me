import { expect, it } from 'vitest';
import { explorerTier, groupExplorerAchievements, type ExplorerAchievement, type ExplorerKind } from '@/lib/person-achievements';

const award = (kind: ExplorerKind, event: string, count: number, record?: ExplorerAchievement['record']): ExplorerAchievement => ({
  kind, event, count, record, tier: explorerTier(kind, count)!,
  evidence: [{ compId: `${event}Competition`, date: '2026-01-01' }],
});

it('leaves empty and single-event collections unchanged', () => {
  expect(groupExplorerAchievements([])).toEqual([]);
  const single = award('podiumStreak', '333', 5);
  expect(groupExplorerAchievements([single])).toEqual([single]);
  expect(groupExplorerAchievements([single])[0]).toBe(single);
});

it.each([
  ['podiumStreak', 6, 7, 5], ['weekly', 30, 40, 10],
  ['firstWin', 30, 40, 20], ['monument', 600, 700, 365],
] as const)('uses the best %s event without unlocking a tier by adding events', (kind, first, second, tier) => {
  const input = [award(kind, '333', first), award(kind, '444', second)];
  const snapshot = structuredClone(input);
  const result = groupExplorerAchievements(input);
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ kind, event: undefined, count: second, tier, aggregation: 'best', groupedEvents: input });
  expect(result[0].evidence).toEqual([
    { ...input[0].evidence[0], event: '333' }, { ...input[1].evidence[0], event: '444' },
  ]);
  expect(input).toEqual(snapshot);
});

it.each(['calendar', 'triplets'] as const)('adds %s occurrences and keeps all event evidence', kind => {
  const input = [award(kind, '333', 2), award(kind, '444', 3)];
  const [result] = groupExplorerAchievements(input);
  expect(result.count).toBe(5);
  expect(result.tier).toBe(1);
  expect(result.aggregation).toBe('sum');
  expect(result.groupedEvents).toEqual(input);
});

it('counts the distinct events with a winning debut', () => {
  const [result] = groupExplorerAchievements([award('debutWin', '333', 1), award('debutWin', '444', 1)]);
  expect(result.count).toBe(2);
  expect(result.tier).toBe(1);
  expect(result.aggregation).toBe('events');
});

it('keeps WR and CR durations separate and preserves the order of other badges', () => {
  const input = [award('monument', '333', 600, 'WR'), award('butterfly', '333bf', 20),
    award('monument', '444', 700, 'WR'), award('monument', '333', 800, 'CR'), award('monument', '444', 900, 'CR')];
  const result = groupExplorerAchievements(input);
  expect(result.map(a => [a.kind, a.record, a.count])).toEqual([
    ['monument', 'WR', 700], ['butterfly', undefined, 20], ['monument', 'CR', 900],
  ]);
});

it.each(['butterfly', 'worldPodium', 'worldsBest', 'medalTrio', 'defend', 'storm', 'constellation'] as const)(
  'retains individual %s honors', kind => {
    const input = [award(kind, '333', 10), award(kind, '444', 10)];
    expect(groupExplorerAchievements(input)).toEqual(input);
  },
);
