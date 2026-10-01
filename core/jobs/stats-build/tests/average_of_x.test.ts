import { afterEach, describe, expect, it, vi } from 'vitest';
import { AverageOfX } from '../src/core/average_of_x';
import { AverageOf3 } from '../src/statistics/average_of_3';
import { AverageOf5 } from '../src/statistics/average_of_5';
import { AverageOf25 } from '../src/statistics/average_of_25';
import type { StatJson } from '../src/core/statistic';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock('../src/core/database', async importOriginal => ({
  ...await importOriginal<typeof import('../src/core/database')>(),
  query: queryMock,
}));

function round(personId: string, attempts: string, eventId = '333fm', date = '2026-01-01') {
  return {
    person_id: personId,
    person_link: `[${personId}](https://www.worldcubeassociation.org/persons/${personId})`,
    country_id: 'China',
    event_id: eventId,
    attempts,
    competition_link: '[Test](https://www.worldcubeassociation.org/competitions/Test2026)',
    start_date: date,
  };
}

function rows(json: StatJson, panelId: string) {
  return json.panels!.find(panel => panel.id === panelId)!.sections.flatMap(section => section.rows);
}

afterEach(() => {
  AverageOfX.clearSharedCache();
  queryMock.mockReset();
});

describe('rolling official averages', () => {
  it('uses the full FMC mean and excludes DNF/DNS windows from ranking and history', async () => {
    queryMock.mockResolvedValue([
      round('failed', '17,-1,18'),
      round('absent', '17,-2,18'),
      round('second', '17,24,19'),
      round('first', '21,17,18', '333fm', '2026-01-02'),
    ]);
    const json = await new AverageOf3().toJson();
    const ranking = rows(json, 'ranking');
    expect(ranking.map(row => row[2])).toEqual(['18.67', '20.00']);
    expect(ranking[0][1]).toContain('/first)');
    expect(ranking[0][8]).toEqual({ _type: 'solves', csv: '21,17,18' });
    expect(rows(json, 'history').map(row => row[0])).toEqual(['18.67', '20.00']);
    expect(JSON.stringify(json)).not.toContain('/failed)');
    expect(JSON.stringify(json)).not.toContain('/absent)');
  });

  it('slides across rounds, keeping failed attempts in the consecutive sequence', async () => {
    queryMock.mockResolvedValue([
      round('first', '17,-1,18'),
      round('first', '21,19,0', '333fm', '2026-01-02'),
    ]);
    const ranking = rows(await new AverageOf3().toJson(), 'ranking');
    expect(ranking[0][2]).toBe('19.33');
    expect(ranking[0][4]).toBe('2026-01-01');
    expect(ranking[0][6]).toBe('2026-01-02');
    expect(ranking[0][8]).toEqual({ _type: 'solves', csv: '18,21,19' });
  });

  it.each(['333', '666'])('also computes an untrimmed Mo3 for %s', async eventId => {
    queryMock.mockResolvedValue([round('first', '100,200,600', eventId)]);
    expect(rows(await new AverageOf3().toJson(), 'ranking')[0][2]).toBe('3.00');
  });

  it('keeps Ao5 trimming and its one-DNF allowance', async () => {
    queryMock.mockResolvedValue([
      round('first', '17,18,19,20,-1'),
      round('failed', '17,18,19,-1,-2'),
    ]);
    const ranking = rows(await new AverageOf5().toJson(), 'ranking');
    expect(ranking).toHaveLength(1);
    expect(ranking[0][2]).toBe('19.00');
  });

  it('still rounds the larger-window trim count up on each side', async () => {
    queryMock.mockResolvedValue([round('first', [...Array.from({ length: 23 }, (_, i) => i + 1), 900, 1000].join(','))]);
    expect(rows(await new AverageOf25().toJson(), 'ranking')[0][2]).toBe('13.00');
  });
});
