import { describe, expect, it } from 'vitest';
import { parseTimerEntry, roundResult, type Solve } from '@cuberoot/shared/timer';
import {
  advancesFromRound,
  buildCompSimLeaderboard,
  callupDelayMs,
  COMP_SIM_ACTIVE_VERSION,
  expectedAttemptCount,
  filterNextRoundOfficialRows,
  hasCrossRoundCumulativeLimit,
  isValidCompSimActiveSnapshot,
  matchPublishedCompSimRounds,
  roundConfigFromWcif,
  selectPlayableScrambleGroup,
  shouldDuplicateScramble,
  wcaFormatToRoundFormat,
} from '@/lib/comp-sim';
import type { CompWcifRound } from '@/lib/comp-wcif';
import type { WcaResultRow, WcaRound, WcaScrambleRow } from '@/lib/wca-results-api';
import { matchRoundType } from '@/lib/wca-results-api';

function scramble(groupId: string, scrambleNum: number, isExtra = false): WcaScrambleRow {
  return {
    event_id: '333',
    round_type_id: '1',
    group_id: groupId,
    is_extra: isExtra,
    scramble_num: scrambleNum,
    scramble: `R U ${groupId}${scrambleNum}`,
  };
}

function solve(timeMs: number, index: number): Solve {
  return {
    id: `solve-${index}`,
    timeMs,
    penalty: 'ok',
    scramble: `R U ${index}`,
    event: '333',
    ts: index,
  };
}

const AO5_ROUND: CompWcifRound = {
  id: '333-r1',
  format: 'a',
  timeLimitCs: 60_00,
  cumulative: false,
  cumulativeRoundIds: [],
  cutoff: { numberOfAttempts: 2, attemptResult: 30_00 },
  advancementCondition: { type: 'ranking', level: 2 },
};

describe('competition simulator round setup', () => {
  it('maps every supported WCA result format and rejects head-to-head', () => {
    expect(['1', '2', '3', '5', 'a', 'm'].map((format) => (
      wcaFormatToRoundFormat(format as CompWcifRound['format'])
    ))).toEqual(['bo1', 'bo2', 'bo3', 'bo5', 'ao5', 'mo3']);
    expect(wcaFormatToRoundFormat('h')).toBeNull();
    expect(expectedAttemptCount('2')).toBe(2);
    expect(expectedAttemptCount('5')).toBe(5);
  });

  it('keeps B-finals with finals and combined qualification rounds with qualification', () => {
    expect(matchRoundType('f', 'b')).toBe(true);
    expect(matchRoundType('1', 'b')).toBe(false);
    expect(matchRoundType('0', 'h')).toBe(true);
    expect(matchRoundType('f', 'h')).toBe(false);
  });

  it('pairs qualification, normal and separate finals with distinct WCIF rules', () => {
    const details = ['m', 'a', '1'].map((format, index): CompWcifRound => ({
      ...AO5_ROUND,
      id: `333-r${index + 1}`,
      format: format as CompWcifRound['format'],
    }));
    const rounds = [
      { id: 3, roundTypeId: 'f', results: [] },
      { id: 1, roundTypeId: 'h', results: [] },
      { id: 2, roundTypeId: '1', results: [] },
    ];
    expect(matchPublishedCompSimRounds(details, rounds)?.map(({ detail, officialRound }) => (
      [detail.id, officialRound.roundTypeId]
    ))).toEqual([
      ['333-r1', 'h'],
      ['333-r2', '1'],
      ['333-r3', 'f'],
    ]);

    const finalDetails = details.slice(0, 2);
    const finals: WcaRound[] = [
      { id: 2, roundTypeId: 'f', results: [] },
      { id: 1, roundTypeId: 'b', results: [] },
    ];
    expect(matchPublishedCompSimRounds(finalDetails, finals)?.map(({ officialRound }) => officialRound.roundTypeId))
      .toEqual(['b', 'f']);
  });

  it('rejects round-count and published-format mismatches', () => {
    const row: WcaResultRow = {
      wca_id: 'FAST', competition_id: 'TestOpen2026', event_id: '333', attempts: [1000],
      round_type_id: '1', format_id: '1', best: 1000, average: 0, pos: 1,
    };
    expect(matchPublishedCompSimRounds([AO5_ROUND], [
      { id: 1, roundTypeId: '1', results: [] },
      { id: 2, roundTypeId: 'f', results: [] },
    ])).toBeNull();
    expect(matchPublishedCompSimRounds([AO5_ROUND], [
      { id: 1, roundTypeId: '1', results: [row] },
    ])).toBeNull();
  });

  it('allows self-only cumulative limits and rejects cross-round limits', () => {
    expect(hasCrossRoundCumulativeLimit({ ...AO5_ROUND, cumulativeRoundIds: [] })).toBe(false);
    expect(hasCrossRoundCumulativeLimit({ ...AO5_ROUND, cumulativeRoundIds: [AO5_ROUND.id] })).toBe(false);
    expect(hasCrossRoundCumulativeLimit({ ...AO5_ROUND, cumulativeRoundIds: ['333-r2'] })).toBe(true);
    expect(hasCrossRoundCumulativeLimit({ ...AO5_ROUND, cumulativeRoundIds: [AO5_ROUND.id, '333-r2'] })).toBe(true);
  });

  it('preserves cutoff, time limit and cumulative semantics', () => {
    expect(roundConfigFromWcif(AO5_ROUND)).toEqual({
      on: true,
      format: 'ao5',
      cutoffMs: 30_000,
      cutoffAttempts: 2,
      limitMs: 60_000,
      cumulative: false,
    });
  });

  it('chooses only groups with a full regular set and keeps extras separate', () => {
    const rows = [
      scramble('A', 1), scramble('A', 2), scramble('A', 3), scramble('A', 4),
      scramble('B', 1), scramble('B', 2), scramble('B', 3), scramble('B', 4), scramble('B', 5),
      scramble('B', 1, true),
    ];
    const chosen = selectPlayableScrambleGroup(rows, '333', '1', 5, () => 0);
    expect(chosen?.groupId).toBe('B');
    expect(chosen?.scrambles).toHaveLength(5);
    expect(chosen?.extras).toHaveLength(1);
  });

  it('bounds call-up waits and only duplicates later attempts at five percent', () => {
    expect(callupDelayMs(3, () => 0)).toBe(60_000);
    expect(callupDelayMs(3, () => 1)).toBe(180_000);
    expect(callupDelayMs(-4, () => 0)).toBe(20_000);
    expect(callupDelayMs(99, () => 1)).toBe(900_000);
    expect(shouldDuplicateScramble(true, 0, () => 0)).toBe(false);
    expect(shouldDuplicateScramble(true, 1, () => 0.049)).toBe(true);
    expect(shouldDuplicateScramble(true, 1, () => 0.05)).toBe(false);
    expect(shouldDuplicateScramble(false, 1, () => 0)).toBe(false);
  });
});

describe('competition result entry and standings', () => {
  it('distinguishes legacy displayed-total +2 from competition suffix +2', () => {
    expect(parseTimerEntry('+2 12.34')).toEqual({ ms: 10_340, penalty: '+2' });
    expect(parseTimerEntry('12.34+2')).toEqual({ ms: 12_340, penalty: '+2' });
    expect(parseTimerEntry('1:02.34')).toEqual({ ms: 62_340, penalty: 'ok' });
    expect(parseTimerEntry('1:60')).toBeNull();
    expect(parseTimerEntry('DNF')).toEqual({ ms: 0, penalty: 'DNF' });
  });

  it('inserts the simulated competitor by official result and marks a new PR', () => {
    const officialRows: WcaResultRow[] = [{
      wca_id: '2000TEST01',
      competition_id: 'TestOpen2026',
      event_id: '333',
      attempts: [1100, 1200, 1300, 1400, 1500],
      round_type_id: '1',
      format_id: 'a',
      best: 1100,
      average: 1300,
      pos: 1,
      name: 'Official Solver',
      country_iso2: 'US',
    }];
    const solves = [10_004, 11_005, 12_006, 13_004, 14_005].map(solve);
    const result = roundResult(solves, {
      on: true,
      format: 'ao5',
      cutoffMs: null,
      cutoffAttempts: 0,
      limitMs: null,
      cumulative: false,
    });
    const rows = buildCompSimLeaderboard({
      officialRows,
      result,
      sim: { wcaId: '2026SIM01', name: 'Sim Solver', countryIso2: 'CN' },
      personalRecords: { single: 1050, average: 1250 },
    });
    const simulated = rows.find((row) => row.kind === 'sim');
    expect(simulated).toMatchObject({ rank: 1, average: 1201, best: 1000, xpr: true, xprBest: true, xprAverage: true });
    expect(simulated?.attempts).toEqual([1000, 1100, 1200, 1300, 1400]);
    expect(advancesFromRound(simulated!, AO5_ROUND.advancementCondition, 1)).toBe(true);
  });

  it('uses normalized limit, DNS and cutoff attempt states in standings', () => {
    const limitedSolves = [59_999, 60_000, 10_005, 10_006, 10_007].map(solve);
    const limited = roundResult(limitedSolves, {
      on: true,
      format: 'ao5',
      cutoffMs: null,
      cutoffAttempts: 0,
      limitMs: 60_000,
      cumulative: false,
    });
    const limitedRow = buildCompSimLeaderboard({
      officialRows: [],
      result: limited,
      sim: { wcaId: '2026SIM01', name: 'Sim Solver', countryIso2: 'CN' },
      personalRecords: { single: null, average: null },
    })[0];
    expect(limitedRow.attempts).toEqual([5999, -1, 1000, 1000, 1000]);
    expect(limitedRow.best).toBe(1000);

    const cumulative = roundResult([solve(60_000, 0)], {
      on: true,
      format: 'mo3',
      cutoffMs: null,
      cutoffAttempts: 0,
      limitMs: 60_000,
      cumulative: true,
    });
    const cumulativeRow = buildCompSimLeaderboard({
      officialRows: [],
      result: cumulative,
      sim: { wcaId: '2026SIM01', name: 'Sim Solver', countryIso2: 'CN' },
      personalRecords: { single: null, average: null },
    })[0];
    expect(cumulativeRow.attempts).toEqual([-1, -2, -2]);

    const cut = roundResult([31_009, 32_009].map(solve), {
      on: true,
      format: 'ao5',
      cutoffMs: 30_000,
      cutoffAttempts: 2,
      limitMs: null,
      cumulative: false,
    });
    const cutRow = buildCompSimLeaderboard({
      officialRows: [],
      result: cut,
      sim: { wcaId: '2026SIM01', name: 'Sim Solver', countryIso2: 'CN' },
      personalRecords: { single: null, average: null },
    })[0];
    expect(cutRow).toMatchObject({ attempts: [3100, 3200, 0, 0, 0], best: 3100, average: 0 });
  });

  it('replaces the signed-in competitor instead of showing them twice', () => {
    const ownOfficial: WcaResultRow = {
      wca_id: '2026SIM01',
      competition_id: 'TestOpen2026',
      event_id: '333',
      attempts: [1500],
      round_type_id: 'f',
      format_id: '1',
      best: 1500,
      average: 0,
      pos: 1,
      name: 'Old Result',
      country_iso2: 'CN',
    };
    const result = roundResult([solve(12_349, 0)], {
      on: true,
      format: 'bo1',
      cutoffMs: null,
      cutoffAttempts: 0,
      limitMs: null,
      cumulative: false,
    });
    const rows = buildCompSimLeaderboard({
      officialRows: [ownOfficial],
      result,
      sim: { wcaId: '2026SIM01', name: 'Sim Solver', countryIso2: 'CN' },
      personalRecords: { single: null, average: null },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'sim', attempts: [1234], best: 1234 });
  });

  it('rebuilds contiguous ranks after replacing an existing competitor and breaks average ties by best', () => {
    const officialRows: WcaResultRow[] = [
      {
        wca_id: '2000FAST01', competition_id: 'TestOpen2026', event_id: '333',
        attempts: [1000, 1100, 1200, 1300, 1400], round_type_id: '1', format_id: 'a',
        best: 1000, average: 1200, pos: 1, name: 'Fast', country_iso2: 'US',
      },
      {
        wca_id: '2026SIM01', competition_id: 'TestOpen2026', event_id: '333',
        attempts: [1100, 1200, 1300, 1400, 1500], round_type_id: '1', format_id: 'a',
        best: 1100, average: 1300, pos: 2, name: 'Old Result', country_iso2: 'CN',
      },
      {
        wca_id: '2000TIE01', competition_id: 'TestOpen2026', event_id: '333',
        attempts: [1150, 1250, 1300, 1350, 1450], round_type_id: '1', format_id: 'a',
        best: 1150, average: 1300, pos: 3, name: 'Tie Winner', country_iso2: 'JP',
      },
      {
        wca_id: '2000SLOW01', competition_id: 'TestOpen2026', event_id: '333',
        attempts: [1200, 1300, 1400, 1500, 1600], round_type_id: '1', format_id: 'a',
        best: 1200, average: 1400, pos: 4, name: 'Slow', country_iso2: 'GB',
      },
    ];
    const result = roundResult([11_600, 12_500, 13_000, 13_500, 14_500].map(solve), {
      on: true, format: 'ao5', cutoffMs: null, cutoffAttempts: 0, limitMs: null, cumulative: false,
    });
    const rows = buildCompSimLeaderboard({
      officialRows,
      result,
      sim: { wcaId: '2026SIM01', name: 'Sim Solver', countryIso2: 'CN' },
      personalRecords: { single: null, average: null },
    });
    expect(rows.map((row) => [row.wcaId, row.rank])).toEqual([
      ['2000FAST01', 1],
      ['2000TIE01', 2],
      ['2026SIM01', 3],
      ['2000SLOW01', 4],
    ]);
    expect(rows[0]).toMatchObject({ bestIndex: 0, worstIndex: 4 });
  });

  it('handles percent and result-based advancement boundaries', () => {
    const row = {
      kind: 'sim' as const,
      rank: 3,
      wcaId: '2026SIM01',
      name: 'Sim Solver',
      countryIso2: 'CN',
      attempts: [999],
      best: 999,
      average: 0,
      primary: 999,
      bestIndex: -1,
      worstIndex: -1,
    };
    expect(advancesFromRound(row, { type: 'percent', level: 25 }, 12)).toBe(true);
    expect(advancesFromRound(row, { type: 'percent', level: 15 }, 12)).toBe(false);
    expect(advancesFromRound(row, { type: 'attemptResult', level: 1000 }, 12)).toBe(true);
    expect(advancesFromRound(row, { type: 'attemptResult', level: 999 }, 12)).toBe(false);
  });

  it('removes historical next-round competitors displaced by the simulated result', () => {
    const leaderboard = [
      { kind: 'official' as const, rank: 1, wcaId: 'FAST', name: 'Fast', countryIso2: 'US', attempts: [1000], best: 1000, average: 0, primary: 1000, bestIndex: -1, worstIndex: -1 },
      { kind: 'sim' as const, rank: 2, wcaId: 'SIM', name: 'Sim', countryIso2: 'CN', attempts: [1100], best: 1100, average: 0, primary: 1100, bestIndex: -1, worstIndex: -1 },
      { kind: 'official' as const, rank: 3, wcaId: 'DISPLACED', name: 'Displaced', countryIso2: 'JP', attempts: [1200], best: 1200, average: 0, primary: 1200, bestIndex: -1, worstIndex: -1 },
    ];
    const nextRows = ['FAST', 'DISPLACED'].map((wcaId, index): WcaResultRow => ({
      wca_id: wcaId, competition_id: 'TestOpen2026', event_id: '333', attempts: [1000 + index * 200],
      round_type_id: 'f', format_id: '1', best: 1000 + index * 200, average: 0, pos: index + 1,
    }));
    expect(filterNextRoundOfficialRows(nextRows, leaderboard, { type: 'ranking', level: 2 })
      .map((row) => row.wca_id)).toEqual(['FAST']);
  });
});

describe('active simulation persistence', () => {
  const validSnapshot = {
    version: COMP_SIM_ACTIVE_VERSION,
    wcaId: '2026SIM01',
    competition: {
      id: 'TestOpen2026', name: 'Test Open 2026', country: 'us',
      start_date: '2026-01-01', end_date: '2026-01-02', events: ['333'],
    },
    eventId: '333',
    options: {
      inspectionVoice: true, ambiance: false, distractions: false, announcements: true,
      duplicateScrambles: true, visuals: false, stationary: false, maxWaitMinutes: 3,
    },
    rounds: [{
      detail: AO5_ROUND,
      config: roundConfigFromWcif(AO5_ROUND),
      roundTypeId: '1',
      officialRows: [],
      group: { groupId: 'A', scrambles: [scramble('A', 1)], extras: [] },
    }],
    roundIndex: 0,
    solves: [],
    currentScramble: 'R U A1',
    usedExtras: 0,
    tableNumber: 1,
    stage: 'waiting',
    callupAt: 1_700_000_000_000,
    inspectionStartedAt: null,
    inspectionVoice: null,
    crowdVideo: null,
    personalRecords: { single: null, average: null },
  };

  it('accepts a complete versioned snapshot', () => {
    expect(isValidCompSimActiveSnapshot(validSnapshot)).toBe(true);
  });

  it('rejects stale versions and malformed nested round data', () => {
    expect(isValidCompSimActiveSnapshot({ ...validSnapshot, version: 0 })).toBe(false);
    expect(isValidCompSimActiveSnapshot({
      ...validSnapshot,
      rounds: [{ ...validSnapshot.rounds[0], group: { groupId: 'A', scrambles: [{}], extras: [] } }],
    })).toBe(false);
  });
});
