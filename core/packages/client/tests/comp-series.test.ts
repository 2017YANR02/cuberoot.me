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

describe('buildCompSeriesIndex — name grouping', () => {
  const mk = (id: string, name: string, start: string, country = 'CN'): SeriesComp =>
    ({ id, name, country, start, end: start });

  it('groups same-series comps, sorts newest-first, and excludes singletons', () => {
    const idx = buildCompSeriesIndex([
      mk('GuangzhouGraDUAL3x3I2026', 'Guangzhou GraDUAL 3x3 I 2026', '2026-08-05'),
      mk('GuangzhouGraDUAL3x3II2026', 'Guangzhou GraDUAL 3x3 II 2026', '2026-08-19'),
      mk('GuangzhouGraDUAL3x3IV2026', 'Guangzhou GraDUAL 3x3 IV 2026', '2026-09-16'),
      mk('LonelyOpen2024', 'Lonely Open 2024', '2024-01-01'), // singleton → dropped
    ]);
    expect(idx.series.length).toBe(1);
    const gis = idx.byId['GuangzhouGraDUAL3x3I2026'];
    expect(gis).toEqual([0]);
    expect(idx.series[gis[0]].map(c => c.id)).toEqual([
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

describe('buildCompSeriesIndex — championship grouping (authoritative championship_type)', () => {
  const mk = (id: string, name: string, start: string, country = 'US'): SeriesComp =>
    ({ id, name, country, start, end: start });

  it('groups World Championships despite their names changing across years', () => {
    const idx = buildCompSeriesIndex(
      [
        mk('WC2003', "World Rubik's Games Championship 2003", '2003-08-23'),
        mk('WC2005', "Rubik's World Championship 2005", '2005-11-05'),
        mk('WC2023', "World Rubik's Cube Championship 2023", '2023-08-11'),
      ],
      { WC2003: ['world'], WC2005: ['world'], WC2023: ['world'] },
    );
    // No two names share a seriesKey stem → grouping comes purely from championship_type.
    expect(idx.byId['WC2023']).toHaveLength(1);
    const g = idx.series[idx.byId['WC2023'][0]];
    expect(g.map(c => c.id)).toEqual(['WC2023', 'WC2005', 'WC2003']); // newest-first
  });

  it('groups continental and national championships by type', () => {
    const idx = buildCompSeriesIndex(
      [
        mk('AsianChampionship2016', 'Asian Championship 2016', '2016-10-01', 'CN'),
        mk('AsianChampionship2018', 'Asian Championship 2018', '2018-10-01', 'CN'),
        mk('FrenchChampionship2004', 'French Championship 2004', '2004-05-01', 'FR'),
        mk('ChampionnatDeFrance2010', 'Championnat de France 2010', '2010-05-01', 'FR'),
      ],
      {
        AsianChampionship2016: ['_Asia', 'greater_china'],
        AsianChampionship2018: ['_Asia'],
        FrenchChampionship2004: ['FR'],
        ChampionnatDeFrance2010: ['FR'],
      },
    );
    // Asia pair grouped even though greater_china is a singleton (dropped).
    const asia = idx.series[idx.byId['AsianChampionship2016'][0]];
    expect(asia.map(c => c.id).sort()).toEqual(['AsianChampionship2016', 'AsianChampionship2018']);
    expect(idx.byId['AsianChampionship2016']).toHaveLength(1); // greater_china singleton not a group
    // Two French nationals with unrelated names grouped by champ:FR.
    const fr = idx.series[idx.byId['FrenchChampionship2004'][0]];
    expect(fr.map(c => c.id).sort()).toEqual(['ChampionnatDeFrance2010', 'FrenchChampionship2004']);
  });

  it('a comp that is both national and world champ belongs to both groups (multi-membership)', () => {
    const idx = buildCompSeriesIndex(
      [
        mk('WC2019', "World Rubik's Cube Championship 2019", '2019-07-11', 'AU'),
        mk('WC2023', "World Rubik's Cube Championship 2023", '2023-08-11', 'US'),
        mk('AustralianChampionship2017', 'Australian Championship 2017', '2017-01-01', 'AU'),
        mk('AustralianChampionship2022', 'Australian Championship 2022', '2022-01-01', 'AU'),
      ],
      {
        WC2019: ['AU', 'world'],
        WC2023: ['world'],
        AustralianChampionship2017: ['AU'],
        AustralianChampionship2022: ['AU'],
      },
    );
    // WC2019 sits in both the world group and the AU group.
    expect(idx.byId['WC2019']).toHaveLength(2);
    const groups = idx.byId['WC2019'].map(gi => new Set(idx.series[gi].map(c => c.id)));
    expect(groups.some(s => s.has('WC2023'))).toBe(true); // world group
    expect(groups.some(s => s.has('AustralianChampionship2017'))).toBe(true); // AU group
  });

  it('drops a name group fully contained in a larger championship group (subset dedup)', () => {
    // All three share the same name stem AND the same championship_type → one group, not two.
    const idx = buildCompSeriesIndex(
      [
        mk('USANationals2013', 'US Nationals 2013', '2013-08-01'),
        mk('USANationals2014', 'US Nationals 2014', '2014-08-01'),
        mk('USANationals2015', 'US Nationals 2015', '2015-08-01'),
      ],
      {
        USANationals2013: ['US'],
        USANationals2014: ['US'],
        USANationals2015: ['US'],
      },
    );
    expect(idx.series.length).toBe(1);
    expect(idx.byId['USANationals2013']).toEqual([0]);
  });
});
