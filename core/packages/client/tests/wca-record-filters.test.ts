import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// guard-registry: tracked at /dev/guards
import { isRecordStatistic, recordStatIds } from '../../../scripts/list-record-stat-fixtures.mjs';
import { selectRecordSection } from '@/components/wca-stats/WcaStatView.cells';
import type { StatSection, RecordScope } from '@/components/wca-stats/WcaStatView.types';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { CONTINENT_NAMES } from '@/lib/continent';

function section(scope: Partial<RecordScope>, rows: unknown[][] = [[1]]): StatSection {
  return { title: '', rows, recordScope: { region: 'World', level: 'WR', event: '', type: 'all', ...scope } };
}

describe('record filter availability', () => {
  const sections = [
    section({}), section({ event: '333', type: 'single' }), section({ event: '333', type: 'average' }),
    section({ region: 'Asia', level: 'CR' }),
    section({ region: 'Asia', level: 'CR', event: '333mbf', type: 'single' }),
    section({ region: 'Asia', level: 'CR', event: '333mbf', type: 'average' }, []),
  ];
  it('restores a complete deep link', () => {
    expect(selectRecordSection(sections, { region: 'World', event: '333', type: 'average' }).section).toBe(sections[2]);
  });
  it('only exposes supported types for the selected event', () => {
    const result = selectRecordSection(sections, { region: 'Asia', event: '333mbf', type: 'average' });
    expect(result.options.type).toEqual(['single']);
    expect(result.section).toBe(sections[4]);
  });
  it('resolves a stale selection after changing region and never renders a false empty table', () => {
    const result = selectRecordSection(sections, { region: 'Asia', level: 'WR', event: '333', type: 'average' });
    expect(result.section).toBe(sections[3]);
    expect(result.options.event).toEqual(['', '333mbf']);
  });
  it('handles invalid deep links and wholly empty data', () => {
    expect(selectRecordSection(sections, { region: 'invalid', event: 'invalid' }).section).toBe(sections[0]);
    expect(selectRecordSection([], {}).section).toBeUndefined();
  });
});

describe('all generated record filter combinations', () => {
  const ids = recordStatIds();
  const established = ['longest_standing_records', 'records_in_most_events', 'most_records_at_single_competition'];
  it('keeps existing generators covered and discovers new ones without a filename list', () => {
    expect(ids).toEqual(expect.arrayContaining(established));
    expect(isRecordStatistic("import { recordRowsForScope } from '../core/record_scopes.js'; export class FutureStat extends GroupedStatistic {}" )).toBe(true);
    expect(isRecordStatistic("export class FutureStat extends GroupedStatistic { transform() { return [['Continental', []]]; } }" )).toBe(true);
    expect(isRecordStatistic("export class FutureStat extends GroupedStatistic { transform() { return [['World', []]]; } }" )).toBe(false);
  });
  for (const id of ids) {
    it(`${id}: every bucket is reachable without falling back or offering an empty table`, () => {
      const data = JSON.parse(readFileSync(new URL(`../../../../stats/${id}.json`, import.meta.url), 'utf8'));
      const sections = data.sections as StatSection[];
      expect(Array.isArray(sections), `${id}: generate recordScope sections before adding the statistic`).toBe(true);
      expect(sections.length === 0, `${id}: no generated record data; investigate the builder or explicitly review an empty statistic`).toBe(false);
      const keys = new Set<string>();
      for (const section of sections) {
        expect(section.recordScope).toBeDefined();
        const scope = section.recordScope!;
        expect(['World', ...Object.values(CONTINENT_NAMES).map(name => name.en)]).toContain(scope.region);
        expect(['WR', 'CR', 'NR']).toContain(scope.level);
        expect(['', ...ALL_EVENT_IDS]).toContain(scope.event);
        expect(['all', 'single', 'average']).toContain(scope.type);
        expect(section.rows.length === 0).toBe(false);
        const key = JSON.stringify(section.recordScope);
        expect(keys.has(key)).toBe(false);
        keys.add(key);
        expect(selectRecordSection(sections, section.recordScope!).section).toBe(section);
      }
      // A future statistic may legitimately have data for only one continent.
      // The existing three already cover all six: lock that coverage separately.
      if (established.includes(id)) {
        expect([...new Set(sections.map(section => section.recordScope?.region))].sort()).toEqual([
          'Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America', 'World',
        ]);
      }
    });
  }
});
