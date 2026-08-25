import { describe, expect, it } from 'vitest';
import {
  buildLandingPastComps,
  LANDING_HISTORY_DAYS,
  type LandingCompRecord,
} from '../src/landing_comps';

const NOW = Date.UTC(2026, 7, 13, 12);
const comp = (id: string, start: string, end = start, extra: Record<string, unknown> = {}): LandingCompRecord => ({
  id,
  name: id,
  country: 'US',
  start_date: start,
  end_date: end,
  ...extra,
});

describe('landing competition dataset', () => {
  it('keeps only the recent history buffer', () => {
    const rows = buildLandingPastComps([
      comp('recent', '2026-06-20'),
      comp('boundary', '2026-06-14'),
      comp('old', '2026-06-13'),
    ], NOW);

    expect(LANDING_HISTORY_DAYS).toBe(60);
    expect(rows.map((row) => row.id)).toEqual(['boundary', 'recent']);
  });

  it('rejects duplicate ids instead of hiding a pipeline bug', () => {
    const duplicate = comp('dup', '2026-08-01');
    expect(() => buildLandingPastComps([duplicate, duplicate], NOW)).toThrow('duplicate competition id dup');
  });

  it('rejects invalid optional end dates at the generator boundary', () => {
    expect(() => buildLandingPastComps([comp('bad-end', '2026-08-01', 'August 2')], NOW))
      .toThrow('invalid competition end date');
  });
});
