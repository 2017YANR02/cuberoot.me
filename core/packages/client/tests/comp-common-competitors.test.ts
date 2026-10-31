import { describe, expect, it } from 'vitest';
import { commonCompetitors, competitionRoster, type CompetitionRosterData } from '@/lib/comp-common-competitors';

function competition(overrides: Partial<CompetitionRosterData> = {}): CompetitionRosterData {
  return {
    slug: 'Example2026', name: 'Example 2026', fetchedAt: 1,
    users: {
      '1': { number: 1, name: 'Same Name', wcaid: '2020TEST01', eventIds: ['333'] },
    },
    resultsByRound: {},
    ...overrides,
  };
}

describe('common competition entrants', () => {
  it('matches WCA IDs across local numbers and changed names, never names or local numbers', () => {
    const left = competitionRoster(competition());
    const right = competitionRoster(competition({ users: {
      '1': { number: 1, name: 'Same Name', wcaid: '2020TEST02', eventIds: ['222'] },
      '42': { number: 42, name: 'Changed Name', wcaid: '2020TEST01', eventIds: ['333'] },
    } }));
    expect(commonCompetitors(left, right)).toEqual([
      { wcaId: '2020TEST01', name: 'Same Name', presence: 'registered', otherPresence: 'registered' },
    ]);
  });

  it('counts DNF as participation but not DNS or unentered rows', () => {
    const status = (b: number, a: number, v: number[]) => competitionRoster(competition({
      resultsByRound: { '333:1': [{ n: 1, b, a, v }] },
    })).people.get('2020TEST01')?.presence;
    expect(status(0, 0, [0, 0, 0])).toBe('registered');
    expect(status(-2, -1, [-2, -2, -2])).toBe('dns');
    expect(status(-1, -1, [-1, -2, -2])).toBe('competed');
    expect(status(900, 0, [900, 0, 0])).toBe('competed');
    expect(status(-1, 0, [])).toBe('competed');
  });

  it('excludes unidentified newcomers and staff without competition entries', () => {
    const roster = competitionRoster(competition({ users: {
      '1': { number: 1, name: 'Same Name', wcaid: '', eventIds: ['333'] },
      '2': { number: 2, name: 'Staff', wcaid: '2020TEST02' },
    } }));
    expect(roster.people.size).toBe(0);
    expect(roster.unidentified).toBe(1);
    expect(roster.total).toBe(1);
    expect(commonCompetitors(roster, roster)).toEqual([]);
  });

  it('deduplicates identities and preserves participation across events and rounds', () => {
    const roster = competitionRoster(competition({ users: {
      '1': { number: 1, name: 'Name', wcaid: '2020TEST01' },
      '2': { number: 2, name: 'Name', wcaid: '2020TEST01', eventIds: ['333'] },
    }, resultsByRound: {
      '333:1': [{ n: 1, b: 900, a: 0, v: [900] }],
      '222:1': [{ n: 1, b: -2, a: 0, v: [-2] }],
    } }));
    expect(roster.total).toBe(1);
    expect(roster.people.get('2020TEST01')?.presence).toBe('competed');
  });

  it('refuses a partial event shard instead of reporting a false empty overlap', () => {
    expect(() => competitionRoster(competition({ partial: true }))).toThrow('full competition roster');
  });
});
