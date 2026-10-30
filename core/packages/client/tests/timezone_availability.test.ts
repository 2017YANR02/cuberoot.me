import { describe, expect, it } from 'vitest';
import { dateKey, timeKey, wallPartsIn } from '@cuberoot/shared/tz';
import { mergeRanges, readRanges, resolveRange, weekMinute, weekOf, writeRanges } from '@/app/[lang]/timezone/_lib/availability';

const sundayMorning = { start: 6 * 1440 + 9 * 60, end: 6 * 1440 + 12 * 60 };
function beijing(week: string, range = sundayMorning) {
  const result = resolveRange(week, 'Europe/Berlin', range)!;
  return [result.start, result.end].map((at) => {
    const wall = wallPartsIn('Asia/Shanghai', at);
    return `${dateKey(wall)} ${timeKey(wall)}`;
  });
}

describe('availability range conversion', () => {
  it('recalculates the same German Sunday morning for winter and summer dates', () => {
    expect(beijing('2026-10-26')).toEqual(['2026-11-01 16:00', '2026-11-01 19:00']);
    expect(beijing('2026-07-06')).toEqual(['2026-07-12 15:00', '2026-07-12 18:00']);
    expect(beijing('2026-03-23')).toEqual(['2026-03-29 15:00', '2026-03-29 18:00']);
    expect(beijing('2026-10-19')).toEqual(['2026-10-25 16:00', '2026-10-25 19:00']);
  });
  it('preserves exact minutes and next-day / next-week dates', () => {
    expect(beijing('2026-10-26', { start: 6 * 1440 + 17 * 60 + 15, end: 6 * 1440 + 20 * 60 + 45 }))
      .toEqual(['2026-11-02 00:15', '2026-11-02 03:45']);
    expect(beijing('2026-10-26', { start: 6 * 1440 + 23 * 60, end: 7 * 1440 + 60 }))
      .toEqual(['2026-11-02 06:00', '2026-11-02 08:00']);
  });
  it('handles fractional-hour zones and reverse date rollover', () => {
    const result = resolveRange('2026-10-26', 'Asia/Kathmandu', { start: 540, end: 600 })!;
    expect(timeKey(wallPartsIn('Asia/Shanghai', result.start))).toBe('11:15');
    expect(weekMinute('2026-10-26', 'Asia/Kathmandu', result.start)).toBe(540);
    const midnight = resolveRange('2026-10-26', 'Pacific/Auckland', { start: 0, end: 60 })!;
    expect(dateKey(wallPartsIn('Asia/Shanghai', midnight.start))).toBe('2026-10-25');
    expect(timeKey(wallPartsIn('Asia/Shanghai', midnight.start))).toBe('19:00');
  });
  it('rejects skipped and repeated boundary times instead of silently moving them', () => {
    const changeHour = { start: 6 * 1440 + 150, end: 6 * 1440 + 240 };
    expect(resolveRange('2026-03-23', 'Europe/Berlin', changeHour)).toBeNull();
    expect(resolveRange('2026-10-19', 'Europe/Berlin', changeHour)).toBeNull();
    const spanning = { start: 6 * 1440 + 60, end: 6 * 1440 + 240 };
    const spring = resolveRange('2026-03-23', 'Europe/Berlin', spanning)!;
    const fall = resolveRange('2026-10-19', 'Europe/Berlin', spanning)!;
    expect(+spring.end - +spring.start).toBe(2 * 3600000);
    expect(+fall.end - +fall.start).toBe(4 * 3600000);
  });
  it('validates shared URL state and merges overlapping selections without mutating them', () => {
    const ranges = [{ start: 600, end: 660 }, { start: 540, end: 630 }, { start: 720, end: 750 }];
    expect(writeRanges(ranges)).toBe('540-660,720-750');
    expect(ranges[1].end).toBe(630);
    expect(readRanges('oops,-1-60,10-10,0-999999,10080-10100,540-600')).toEqual([{ start: 540, end: 600 }]);
    expect(mergeRanges([{ start: 9990, end: 10140 }])).toEqual([{ start: 9990, end: 10140 }]);
    expect(weekOf('2026-11-01')).toBe('2026-10-26');
    expect(weekOf('2026-02-31')).toBeNull();
  });
});
