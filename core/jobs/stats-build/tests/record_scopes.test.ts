import { describe, expect, it } from 'vitest';
import type { RowDataPacket } from 'mysql2';
import { LongestStandingRecords } from '../src/statistics/longest_standing_records';
import { MostRecordsAtSingleCompetition } from '../src/statistics/most_records_at_single_competition';
import { RecordsInMostEvents } from '../src/statistics/records_in_most_events';
import type { GroupedSection } from '../src/core/grouped_statistic';
import type { RecordScope } from '../src/core/statistic';

function row(overrides: Record<string, unknown> = {}): RowDataPacket {
  return {
    continent: 'Asia', regional_single_record: 'AsR', regional_average_record: '',
    person_link: 'Person A', results_link: 'Competition A', event_id: '333', event_name: '3x3x3 Cube',
    single: 1000, average: 0, competition_date: '2020-01-01', last_event_date: null,
    ...overrides,
  } as RowDataPacket;
}

function bucket(sections: GroupedSection[], scope: Partial<RecordScope>) {
  return sections.find(([, , actual]) => Object.entries(scope).every(([key, value]) => actual?.[key as keyof RecordScope] === value))?.[1] ?? [];
}

describe('regional record counts', () => {
  it('includes higher levels once and counts single and average separately', () => {
    const sections = new MostRecordsAtSingleCompetition().transform([
      row({ regional_single_record: 'WR', regional_average_record: 'AsR' }),
      row({ regional_single_record: 'NR' }),
      row({ continent: 'Europe', person_link: 'Person B', regional_single_record: 'ER' }),
    ]);
    expect(bucket(sections, { region: 'Asia', level: 'WR' })[0][0]).toBe(1);
    expect(bucket(sections, { region: 'Asia', level: 'CR' })[0][0]).toBe(2);
    expect(bucket(sections, { region: 'Asia', level: 'NR' })[0][0]).toBe(3);
    expect(bucket(sections, { region: 'Europe', level: 'WR' })).toEqual([]);
  });

  it('ranks each continent before truncating and preserves boundary ties', () => {
    const europe = Array.from({ length: 21 }, (_, i) => Array.from({ length: 2 }, () => row({
      continent: 'Europe', person_link: `European ${i}`, regional_single_record: 'ER',
    }))).flat();
    const sections = new MostRecordsAtSingleCompetition().transform([...europe, row()]);
    expect(bucket(sections, { region: 'World', level: 'CR' })).toHaveLength(21);
    expect(bucket(sections, { region: 'Asia', level: 'CR' })).toEqual([[1, 'Person A', 'Competition A']]);
  });

  it('deduplicates events and uses each result’s region, including nationality changes', () => {
    const sections = new RecordsInMostEvents().transform([
      row(), row({ regional_average_record: 'AsR' }),
      row({ continent: 'Europe', event_name: '2x2x2 Cube', regional_single_record: 'ER' }),
    ]);
    expect(bucket(sections, { region: 'World', level: 'CR' })[0][0]).toBe(2);
    expect(bucket(sections, { region: 'Asia', level: 'CR' })[0][0]).toBe(1);
    expect(bucket(sections, { region: 'Europe', level: 'CR' })[0][2]).toBe('2x2x2 Cube');
  });
});

describe('standing records', () => {
  it('ends on a strictly better result, not a tie or a result from another continent', () => {
    const sections = new LongestStandingRecords().transform([
      row(), row({ competition_date: '2020-01-03' }),
      row({ continent: 'Europe', competition_date: '2020-01-02', single: 900, regional_single_record: 'ER' }),
      row({ competition_date: '2020-01-11', single: 900 }),
    ], new Date('2020-01-12'));
    const asia = bucket(sections, { region: 'Asia', event: '333', type: 'single' });
    expect(asia.map(result => result[2])).toEqual(['**10**', '**8**', '**1**']);
  });

  it('retains a project outside the overall top ten and omits unsupported averages', () => {
    const sections = new LongestStandingRecords().transform([
      ...Array.from({ length: 11 }, (_, i) => row({ person_link: `Person ${i}` })),
      row({ event_id: '333mbf', single: 970001000, competition_date: '2020-01-11' }),
    ], new Date('2020-01-12'));
    expect(bucket(sections, { region: 'Asia', event: '', type: 'single' })).toHaveLength(10);
    expect(bucket(sections, { region: 'Asia', event: '333mbf', type: 'single' })).toHaveLength(1);
    expect(bucket(sections, { region: 'Asia', event: '333mbf', type: 'average' })).toEqual([]);
    expect(bucket(sections, { region: 'Asia', event: '333mbf', type: 'all' })).toEqual([]);
  });

  it('stops retired events at the final competition date and retains 1982', () => {
    const sections = new LongestStandingRecords().transform([
      row({ event_id: 'magic', competition_date: '2012-12-01', last_event_date: '2012-12-31' }),
      row({ competition_date: '1982-06-05', regional_single_record: 'WR' }),
    ], new Date('2026-09-12'));
    expect(bucket(sections, { region: 'Asia', event: 'magic', type: 'single' })[0][2]).toBe('**30**');
    expect(bucket(sections, { region: 'World', event: '333', type: 'single' })[0][2]).toBe('**16170**');
  });

  it('serializes filter metadata and removes empty buckets', async () => {
    const stat = new MostRecordsAtSingleCompetition();
    stat.queryResults = async () => [row()];
    const data = await stat.toJson();
    expect(data.sections).toHaveLength(4);
    expect(data.sections?.every(section => section.rows.length > 0 && section.recordScope)).toBe(true);
  });
});
