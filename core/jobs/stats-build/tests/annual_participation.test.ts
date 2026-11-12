import { describe, expect, it } from 'vitest';
import { addAnnualParticipation, countSolveAttempts, type AnnualParticipation } from '../src/core/annual_participation.js';

describe('annual participation', () => {
  it('counts partial rounds and all-DNF rounds, excluding DNS and unattempted slots', () => {
    const totals = new Map<string, AnnualParticipation>();
    const row = { pid: 'person', countryId: 'China', compDate: '2026-12-31' };
    for (const attempts of [[100, -1, -2, 0, null], [-1, -1], [150], [-2, 0, null]]) {
      addAnnualParticipation(totals, row, countSolveAttempts(attempts));
    }
    expect([...totals.values()]).toEqual([
      { wcaId: 'person', countryId: 'China', year: 2026, solve: 2, attempt: 5, rounds: 3 },
    ]);
  });
  it('separates historical representation and competition-start years', () => {
    const totals = new Map<string, AnnualParticipation>();
    for (const [countryId, compDate] of [['China', '2025-12-31'], ['China', '2026-01-01'], ['USA', '2026-01-02']]) {
      addAnnualParticipation(totals, { pid: 'person', countryId, compDate }, [1, 1]);
    }
    expect([...totals.values()].map(r => [r.countryId, r.year, r.rounds])).toEqual([
      ['China', 2025, 1], ['China', 2026, 1], ['USA', 2026, 1],
    ]);
  });
});
