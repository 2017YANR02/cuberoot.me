import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TIMER_WCA_SOURCE_CORE_SETTINGS,
  advanceTimerSourceRevision,
  compareTimerWcaCompetitionScrambleOrder,
  createTimerSourceRevision,
  normalizeTimerWcaSourceCoreSettings,
  parseTimerWcaCompetitionScrambles,
  resolveTimerWcaSourceCore,
  searchTimerWcaCompetitions,
  timerWcaRandomQuery,
  timerWcaRoundGroupOptions,
  timerWcaCompetitionScrambleSlotIdentity,
  timerWcaScrambleSourceLine,
  timerWcaSourceCoreIdentity,
  timerManualSourceIdentity,
  type TimerWcaCompetition,
} from '@cuberoot/shared/timer';

describe('shared timer WCA source contract', () => {
  it('uses revision identity instead of a collision-prone manual-text hash', () => {
    const initial = createTimerSourceRevision('app-instance-fixture');
    const first = advanceTimerSourceRevision(initial, 'POLOXlU4wD');
    const unchanged = advanceTimerSourceRevision(first, 'POLOXlU4wD');
    const second = advanceTimerSourceRevision(unchanged, 'PhaKzJyf2I');

    expect(unchanged).toBe(first);
    expect(timerManualSourceIdentity('333', first))
      .not.toBe(timerManualSourceIdentity('333', second));
    expect([first.revision, second.revision]).toEqual([1, 2]);
  });

  it('migrates missing settings and canonicalizes a reversed ISO date range', () => {
    expect(normalizeTimerWcaSourceCoreSettings(undefined))
      .toEqual(DEFAULT_TIMER_WCA_SOURCE_CORE_SETTINGS);
    expect(normalizeTimerWcaSourceCoreSettings({
      wcaScrambleMode: 'date',
      wcaDateFrom: '2026-08-30',
      wcaDateTo: '2025-01-02',
    })).toMatchObject({
      wcaScrambleMode: 'date',
      wcaDateFrom: '2025-01-02',
      wcaDateTo: '2026-08-30',
    });
  });

  it('resolves an unpicked competition to the Web all-history source', () => {
    expect(resolveTimerWcaSourceCore(DEFAULT_TIMER_WCA_SOURCE_CORE_SETTINGS)).toEqual({
      mode: 'date',
      comp: '',
      compName: '',
      compCountry: '',
      round: '',
      group: '',
      from: '',
      to: '',
    });
  });

  it('keys event aliases and every source-affecting competition filter separately', () => {
    const selected = {
      ...DEFAULT_TIMER_WCA_SOURCE_CORE_SETTINGS,
      wcaComp: 'Example2026',
      wcaRound: '2',
      wcaGroup: 'B',
    };
    expect(timerWcaSourceCoreIdentity('333', '333', selected))
      .not.toBe(timerWcaSourceCoreIdentity('333mr', '333', selected));
    expect(timerWcaSourceCoreIdentity('333', '333', selected))
      .not.toBe(timerWcaSourceCoreIdentity('333', '333', { ...selected, wcaGroup: 'C' }));
    expect(timerWcaSourceCoreIdentity('333', null, selected)).toBeNull();
  });

  it('keeps arbitrary restored filter strings unambiguous instead of delimiter-joining them', () => {
    const left = {
      ...DEFAULT_TIMER_WCA_SOURCE_CORE_SETTINGS,
      wcaComp: 'A|B',
      wcaRound: 'C',
      wcaGroup: 'D',
    };
    const right = {
      ...DEFAULT_TIMER_WCA_SOURCE_CORE_SETTINGS,
      wcaComp: 'A',
      wcaRound: 'B',
      wcaGroup: 'C|D',
    };
    expect(timerWcaSourceCoreIdentity('222', '222', left))
      .not.toBe(timerWcaSourceCoreIdentity('222', '222', right));
  });

  it('shares Web/Mobile competition row ordering, including AA groups and extras', () => {
    const row = (roundTypeId: string, groupId: string, isExtra: boolean, scrambleNumber: number) => ({
      roundTypeId, groupId, isExtra, scrambleNumber,
    });
    const values = [
      row('f', 'A', false, 1),
      row('1', 'AA', false, 1),
      row('1', 'A', true, 1),
      row('1', 'B', false, 1),
      row('1', 'A', false, 2),
      row('1', 'A', false, 1),
    ].sort(compareTimerWcaCompetitionScrambleOrder);
    expect(values).toEqual([
      row('1', 'A', false, 1),
      row('1', 'A', false, 2),
      row('1', 'A', true, 1),
      row('1', 'B', false, 1),
      row('1', 'AA', false, 1),
      row('f', 'A', false, 1),
    ]);
  });

  it('identifies official slots independently of scramble text and field delimiters', () => {
    const base = {
      competitionId: 'Example2026',
      eventId: '333',
      roundTypeId: '1',
      groupId: 'A|B',
      isExtra: false,
      scrambleNumber: 1,
    };
    expect(timerWcaCompetitionScrambleSlotIdentity(base)).toBe(
      timerWcaCompetitionScrambleSlotIdentity({ ...base }),
    );
    expect(timerWcaCompetitionScrambleSlotIdentity(base)).not.toBe(
      timerWcaCompetitionScrambleSlotIdentity({
        ...base,
        groupId: 'A',
        roundTypeId: '1|A',
      }),
    );
    expect(timerWcaCompetitionScrambleSlotIdentity(base)).not.toBe(
      timerWcaCompetitionScrambleSlotIdentity({ ...base, scrambleNumber: 2 }),
    );
  });

  it('puts every qualification format before round one and every final last', () => {
    const ids = ['f', 'd', 'g', '0', 'c', '2', 'h', '3', '1', 'e', 'b'];
    const values = ids.map((roundTypeId, index) => ({
      roundTypeId,
      groupId: 'A',
      isExtra: false,
      scrambleNumber: index + 1,
    })).sort(compareTimerWcaCompetitionScrambleOrder);
    const rank = (roundTypeId: string) => (
      ['0', 'h'].includes(roundTypeId) ? 0
        : ['1', 'd'].includes(roundTypeId) ? 1
          : ['2', 'e'].includes(roundTypeId) ? 2
            : ['3', 'g'].includes(roundTypeId) ? 3
              : 4
    );
    expect(values.map((row) => rank(row.roundTypeId))).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4,
    ]);
  });

  it('shares compact normal and extra provenance labels', () => {
    expect(timerWcaScrambleSourceLine('f', 'A', 2)).toBe('Fi,A,2');
    expect(timerWcaScrambleSourceLine('c', 'B', 1, true)).toBe('Fi,B,E1');
  });

  it('builds the same date query for Web and Mobile adapters', () => {
    const query = timerWcaRandomQuery('333', {
      ...DEFAULT_TIMER_WCA_SOURCE_CORE_SETTINGS,
      wcaScrambleMode: 'date',
      wcaDateFrom: '2024-01-02',
      wcaDateTo: '2024-03-04',
    }, 50);
    expect(Object.fromEntries(query)).toEqual({
      event: '333',
      count: '50',
      from: '2024-01-02',
      to: '2024-03-04',
    });
  });

  it('derives chronological rounds and natural A/Z/AA groups for one event', () => {
    const options = timerWcaRoundGroupOptions([
      { eventId: '333', roundTypeId: 'f', groupId: 'B' },
      { eventId: '333', roundTypeId: '1', groupId: 'Z' },
      { eventId: '333', roundTypeId: '1', groupId: 'AA' },
      { eventId: '333', roundTypeId: '1', groupId: 'A' },
      { eventId: '222', roundTypeId: '1', groupId: 'B' },
    ], '333', '1');
    expect(options).toEqual({
      rounds: ['1', 'f'],
      groups: ['A', 'Z', 'AA'],
      hasEvent: true,
    });
  });

  it('decodes competition scrambles strictly and distinguishes [] from malformed rows', () => {
    expect(parseTimerWcaCompetitionScrambles([])).toEqual([]);
    expect(parseTimerWcaCompetitionScrambles([{}])).toBeNull();
    expect(parseTimerWcaCompetitionScrambles([{
      event_id: '333',
      round_type_id: 'f',
      group_id: 'A',
      is_extra: 1,
      scramble_num: 2,
      scramble: "R U R'",
      optimal_scramble: null,
    }])).toEqual([{
      eventId: '333',
      roundTypeId: 'f',
      groupId: 'A',
      isExtra: true,
      scrambleNumber: 2,
      scramble: "R U R'",
      optimalScramble: null,
    }]);
    expect(parseTimerWcaCompetitionScrambles([{
      event_id: '333',
      round_type_id: 'f',
      group_id: 'A',
      is_extra: false,
      scramble_num: 1,
      scramble: 'R U',
    }, {}])).toBeNull();
  });

  it('shares deterministic localized competition search without owning host data', () => {
    const competitions: TimerWcaCompetition[] = [{
      id: 'WorldChampionship2025',
      name: 'WCA World Championship 2025',
      displayName: '世界锦标赛 2025',
      country: 'US',
      startDate: '2025-07-03',
      endDate: '2025-07-06',
    }];
    expect(searchTimerWcaCompetitions('锦标赛', competitions).map(({ id }) => id))
      .toEqual(['WorldChampionship2025']);
  });
});
