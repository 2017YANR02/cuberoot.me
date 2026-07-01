import { describe, it, expect } from 'vitest';
import { seriesKey, buildCompSeriesIndex, type SeriesComp } from '@cuberoot/shared/comp-series';

describe('seriesKey', () => {
  it('strips trailing year + roman-numeral edition to a shared stem', () => {
    expect(seriesKey('Guangzhou GraDUAL 3x3 I 2026')).toBe('Guangzhou GraDUAL 3x3');
    expect(seriesKey('Guangzhou GraDUAL 3x3 II 2026')).toBe('Guangzhou GraDUAL 3x3');
    expect(seriesKey('Guangzhou GraDUAL 3x3 IV 2026')).toBe('Guangzhou GraDUAL 3x3');
  });

  it('annual series collapse to the same stem across years', () => {
    expect(seriesKey('Beijing Open 2024')).toBe('Beijing Open');
    expect(seriesKey('Beijing Open 2025')).toBe('Beijing Open');
    expect(seriesKey("World Rubik's Cube Championship 2023")).toBe("World Rubik's Cube Championship");
  });

  it('strips a plain-number edition but keeps embedded digits like 3x3', () => {
    expect(seriesKey('Some Marathon 100 2024')).toBe('Some Marathon');
    expect(seriesKey('Some Marathon 200 2024')).toBe('Some Marathon');
    expect(seriesKey('Something 3x3 2024')).toBe('Something 3x3'); // "3x3" is not a pure number
  });

  it('does not strip a non-edition trailing word', () => {
    expect(seriesKey('Malaysia Open 2024')).toBe('Malaysia Open');
    expect(seriesKey('Beijing Open Winter 2024')).toBe('Beijing Open Winter');
  });

  it('returns null without a 4-digit year suffix or when the stem is too short', () => {
    expect(seriesKey('Some Competition')).toBeNull();
    expect(seriesKey('')).toBeNull();
    expect(seriesKey('A I 2024')).toBeNull(); // stem "A" < 2 chars
  });
});

describe('buildCompSeriesIndex', () => {
  const mk = (id: string, name: string, start: string): SeriesComp =>
    ({ id, name, country: 'CN', start, end: start });

  it('groups same-series comps, sorts newest-first, and excludes singletons', () => {
    const idx = buildCompSeriesIndex([
      mk('GuangzhouGraDUAL3x3I2026', 'Guangzhou GraDUAL 3x3 I 2026', '2026-08-05'),
      mk('GuangzhouGraDUAL3x3II2026', 'Guangzhou GraDUAL 3x3 II 2026', '2026-08-19'),
      mk('GuangzhouGraDUAL3x3IV2026', 'Guangzhou GraDUAL 3x3 IV 2026', '2026-09-16'),
      mk('LonelyOpen2024', 'Lonely Open 2024', '2024-01-01'), // singleton → dropped
    ]);
    expect(idx.series.length).toBe(1);
    const gi = idx.byId['GuangzhouGraDUAL3x3I2026'];
    expect(gi).toBe(0);
    expect(idx.series[gi].map(c => c.id)).toEqual([
      'GuangzhouGraDUAL3x3IV2026',
      'GuangzhouGraDUAL3x3II2026',
      'GuangzhouGraDUAL3x3I2026',
    ]);
    expect(idx.byId['LonelyOpen2024']).toBeUndefined();
  });

  it('groups an annual series across years', () => {
    const idx = buildCompSeriesIndex([
      mk('BeijingOpen2024', 'Beijing Open 2024', '2024-05-01'),
      mk('BeijingOpen2025', 'Beijing Open 2025', '2025-05-01'),
    ]);
    expect(idx.series.length).toBe(1);
    expect(idx.series[0].map(c => c.id)).toEqual(['BeijingOpen2025', 'BeijingOpen2024']);
  });

  it('dedups repeated ids (past+upcoming overlap), keeping the first', () => {
    const idx = buildCompSeriesIndex([
      mk('BeijingOpen2025', 'Beijing Open 2025', '2025-05-01'),
      mk('BeijingOpen2025', 'Beijing Open 2025', '2025-05-01'),
      mk('BeijingOpen2024', 'Beijing Open 2024', '2024-05-01'),
    ]);
    expect(idx.series[0].length).toBe(2);
  });
});
