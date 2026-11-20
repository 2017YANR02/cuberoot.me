import { expect, it } from 'vitest';
import { subXBreakdown } from '@cuberoot/shared/timer/stats';
import { dayKeyOf } from '@cuberoot/shared/timer/stats-buckets';
import type { Solve } from '@cuberoot/shared/timer/types';
import { nativeTimerStatistics } from '../src/lib/native-timer-statistics';

const now = new Date(2026, 10, 18, 14).getTime();
const solve = (index: number, patch: Partial<Solve> = {}): Solve => ({
  id: `solve-${index}`, event: '333', ts: now - 600 * (250 - index), timeMs: 9000 + index * 50,
  penalty: 'ok', scramble: "R U' F2", ...patch,
});

it('filters the entire workspace and shows the real PB separately from the latest DNS', () => {
  const solves = [
    solve(0, { ts: now - 20 * 86_400_000, timeMs: 2000 }),
    solve(1, { timeMs: 6000, penalty: '+2', scramble: 'F2' }),
    solve(2, { timeMs: 9000 }),
    solve(3, { penalty: 'DNS' }),
  ];
  const result = nativeTimerStatistics(solves, '333', { range: '7d', language: 'en', now });
  expect(result.count).toBe(3);
  expect(result.overview?.rows.map(row => row.key)).toEqual(['time', 'mo3', 'ao5', 'ao12', 'ao25', 'ao50', 'ao100']);
  expect(result.overview?.rows[0]).toMatchObject({ current: 'DNS', best: '8.00' });
  expect(result.overview?.pb).toMatchObject({ result: '8.00', scramble: 'F2' });
  expect(result.overview?.reportText).toContain('Count: 3');
  expect(result.overview?.reportText).toContain('Time periods:');
  expect(result.daily).toBeNull();
  expect(result.charts).toBeNull();
});

it('keeps FMC scores and points-ranked multi-blind singles meaningful', () => {
  const fmc = solve(0, { event: '333fm', timeMs: 28000 });
  const time = nativeTimerStatistics([fmc], '333fm', { language: 'en', now }).overview?.rows[0];
  expect(time).toMatchObject({ best: '28', current: '28' });
  const attempts = [solve(0, { event: '333mbld', timeMs: 3_300_000, mbld: { solved: 5, attempted: 6 } }),
    solve(1, { event: '333mbld', timeMs: 1_600_000, mbld: { solved: 3, attempted: 3 } })];
  const mbld = nativeTimerStatistics(attempts, '333mbld', { language: 'en', now });
  expect(mbld.overview?.rows).toHaveLength(1);
  expect(mbld.overview?.rows[0].best).toContain('5/6');
  expect(mbld.overview?.rows[0].current).toContain('3/3');
});

it('uses preceding practice days for daily deltas and keeps calendar periods separate', () => {
  const then = new Date(2026, 10, 15, 11).getTime();
  const solves = [solve(0, { ts: then, timeMs: 14000 }), solve(1, { ts: now, timeMs: 11000 }),
    solve(2, { ts: now + 300, timeMs: 13000 })];
  const options = { tab: 'daily', language: 'en', now } as const;
  const result = nativeTimerStatistics(solves, '333', options).daily!;
  expect(result.practice).toMatchObject({ days: 2, title: dayKeyOf(now), canPrevious: true, canNext: false });
  expect(result.practice.rows.find(row => row.key === 'mean')).toMatchObject({ value: '12.00', delta: '▼ 2.00', better: true });
  expect(result.periods[0]).toMatchObject({ current: { count: 2, best: '11.00' }, previous: { count: 0 }, bestDelta: null });
  expect(nativeTimerStatistics(solves, '333', { ...options, dayOffset: 1 }).daily?.practice)
    .toMatchObject({ title: dayKeyOf(then), canPrevious: false, canNext: true });
  expect(nativeTimerStatistics(solves, '333', { ...options, total: true }).daily?.practice)
    .toMatchObject({ title: 'All 2 days', total: true, canPrevious: false, canNext: false });
});

it('plots 200 latest attempts, keeps prior history for ao12 and excludes invalid times from bars', () => {
  const solves = Array.from({ length: 225 }, (_, index) => solve(index));
  solves[0].timeMs = 7000;
  solves[224].penalty = 'DNS';
  solves[223].penalty = '+2';
  const result = nativeTimerStatistics(solves, '333', { tab: 'charts', language: 'en', now }).charts!;
  expect(result.scatter.points).toHaveLength(200);
  expect(result.scatter.points[0].ao12).toBeGreaterThan(0);
  expect(result.scatter.best?.value).toBe(7000);
  expect(result.scatter.points.at(-1)).toMatchObject({ isDnf: true, y: 0, label: '#200 · DNS' });
  expect(result.scatter.points.at(-2)).toMatchObject({ isPlus2: true });
  expect(result.scatter.trend.length).toBeGreaterThan(190);
  expect(result.distribution.bins).toHaveLength(20);
  expect(result.distribution.bins.reduce((count, row) => count + row.count, 0)).toBe(224);
  expect(result.scatter.attempts).toEqual([1, 100, 200]);
  expect(result.practiceTimes?.hours.bars.reduce((count, row) => count + row.count, 0)).toBe(224);
  expect(result.practiceTimes?.weekdays.bars.map(row => row.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  const short = nativeTimerStatistics(solves.slice(0, 4), '333', { tab: 'charts', language: 'en', now }).charts!;
  expect(short.distribution.bins).toEqual([]);
  expect(short.practiceTimes).toBeNull();
});

it('shares threshold bins and counts only recorded finite OLL or PLL observations', () => {
  const solves = Array.from({ length: 10 }, (_, index) => solve(index, { timeMs: 8000 + index * 500 }));
  for (let index = 0; index < 3; index++) solves[index].stageSegments = {
    crossDoneMs: null, f2lDoneMs: null, ollDoneMs: null, solvedMs: null, crossMs: null, f2lMs: null,
    ollMs: 1000 * (index + 1), pllMs: null, crossHtm: null, f2lHtm: null, ollHtm: null, pllHtm: null,
    crossSide: null, ollCase: 'OLL 1', pllCase: 'Ua',
  };
  const result = nativeTimerStatistics(solves, '333', { tab: 'cases', language: 'zh', now }).cases!;
  expect(result.thresholds.map(({ threshold, pct }) => ({ threshold, pct }))).toEqual(
    subXBreakdown(solves).map(({ threshold, pct }) => ({ threshold, pct })),
  );
  expect(result.cfop[0]).toMatchObject({ stage: 'oll', rows: [{ id: 'OLL 1', count: 3, avg: '2.00' }], slowest: [{ id: 'OLL 1' }] });
  expect(result.cfop[1].rows).toHaveLength(0);
  expect(nativeTimerStatistics([], '222', { tab: 'cases', language: 'zh', now }).cases?.cfop).toEqual([]);
});
