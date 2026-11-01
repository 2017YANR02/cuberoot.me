import { describe, expect, it } from 'vitest';
import fixture from './fixtures/jiangmen-group-awards.json';
import { parseCompetitionGroupAwards } from '../src/utils/competition_group_awards.js';
const parse = (f = structuredClone(fixture)) => parseCompetitionGroupAwards(f.competition, f.podiums, f.rounds, '2026-11-01T10:00:00.000Z');
describe('organizer category awards', () => {
  it('keeps Jiangmen category positions separate from official podiums', () => {
    const rows = parse();
    expect(rows).toHaveLength(33);
    expect(new Set(rows.map(r => r.groupKey)).size).toBe(11);
    const o30 = rows.filter(r => r.group.type === 'age' && r.group.age === 30);
    expect(o30.map(r => [r.wcaId, r.place, r.average, r.best])).toEqual([
      ['2012CHEN54', 1, 952, 865], ['2015LIGU01', 2, 1035, 874], ['2017YANR02', 3, 1037, 902],
    ]);
    expect(o30.every(r => r.roundNumber === 1 && !r.provisional)).toBe(true);
    expect(rows.some(r => r.roundNumber === 3)).toBe(false);
  });
  it('preserves ties and missing WCA IDs without matching by name', () => {
    const f = structuredClone(fixture);
    const group = f.podiums.data.find(p => p.group?.age === 30)!;
    group.results[1].position = 1;
    group.results[1].competitor.wcaId = null;
    const rows = parse(f).filter(r => r.group.age === 30);
    expect(rows.map(r => r.place)).toEqual([1, 1, 3]);
    expect(rows[1].wcaId).toBeNull();
  });
  it('does not count an unfinished round as a completed award', () => {
    const f = structuredClone(fixture);
    f.rounds.find(r => r.eventId === '333' && r.roundNumber === 1)!.status = 'in_progress';
    expect(parse(f).every(r => r.provisional)).toBe(true);
  });
  it('rejects partial or mismatched payloads before replacing a snapshot', () => {
    const f = structuredClone(fixture);
    f.podiums.data.find(p => p.group?.age === 30)!.results[0].competitionId = 999;
    expect(() => parse(f)).toThrow('Mismatched award result');
    expect(() => parseCompetitionGroupAwards(fixture.competition, {}, fixture.rounds, '')).toThrow();
    const duplicate = structuredClone(fixture);
    duplicate.podiums.data.push(duplicate.podiums.data.find(p => p.group?.age === 30)!);
    expect(() => parse(duplicate)).toThrow('Duplicate category award');
  });
});
