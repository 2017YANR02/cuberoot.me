import { describe, expect, it } from 'vitest';
import { calcCompetitionHref, hasEnteredCalcAttempt, wcaAttemptToCalcValue } from '@/lib/calc-link';
import {
  extractCompetitionCalcAttempts,
  mergeCompetitionCalcAttempts,
} from '@/lib/calc-competition-source';
import {
  DNF_VALUE,
  serializeCalcAttemptRow,
} from '@/app/[lang]/calc/_components/stores/calc_store';

describe('calculator competition result links', () => {
  it('carries the exact result row and competition context', () => {
    const href = calcCompetitionHref({
      eventId: 'clock',
      attempts: [488, 320, 355, 375, 316],
      personName: '刘烨宁',
      personNumber: 13,
      wcaId: '2023LIUY04',
      competitionId: 'FuzhouSpecial2026',
      competitionName: '福州特殊魔方公开赛 2026',
      roundTypeId: 'd',
    });
    const url = new URL(href, 'https://cuberoot.me');

    expect(url.pathname).toBe('/calc');
    expect(url.searchParams.get('event')).toBe('clock');
    expect(url.searchParams.get('sourceEvent')).toBe('clock');
    expect(url.searchParams.get('t0')).toBe('488,320,355,375,316');
    expect(url.searchParams.get('name0')).toBe('刘烨宁');
    expect(url.searchParams.get('comp')).toBe('FuzhouSpecial2026');
    expect(url.searchParams.get('compName')).toBe('福州特殊魔方公开赛 2026');
    expect(url.searchParams.get('round')).toBe('d');
    expect(url.searchParams.get('sourceUser')).toBe('13');
    expect(url.searchParams.get('wcaId')).toBe('2023LIUY04');
  });

  it('prefills partial live results while leaving future attempts empty', () => {
    const partialHref = calcCompetitionHref({
      eventId: 'clock',
      attempts: [488],
      personName: '刘烨宁',
      competitionId: 'FuzhouSpecial2026',
      roundTypeId: 'd',
    });
    const partialUrl = new URL(partialHref, 'https://cuberoot.me');

    expect(partialUrl.searchParams.get('t0')).toBe('488');

    const dnfHref = calcCompetitionHref({
      eventId: 'clock',
      attempts: [-1],
      competitionId: 'FuzhouSpecial2026',
      roundTypeId: 'd',
    });
    expect(new URL(dnfHref, 'https://cuberoot.me').searchParams.get('t0')).toBe('-1');

    const pendingHref = calcCompetitionHref({
      eventId: 'clock',
      attempts: [],
      competitionId: 'FuzhouSpecial2026',
      roundTypeId: 'd',
    });
    expect(new URL(pendingHref, 'https://cuberoot.me').searchParams.has('t0')).toBe(false);
  });

  it('converts WCA units into calculator units', () => {
    expect(wcaAttemptToCalcValue('333', 629)).toBe(629);
    expect(wcaAttemptToCalcValue('333fm', 26)).toBe(2600);
    expect(wcaAttemptToCalcValue('333mbf', 930320002)).toBe(600);
    expect(wcaAttemptToCalcValue('333mbo', 1960706900)).toBe(0);
    expect(wcaAttemptToCalcValue('333', -1)).toBe(-1);
    expect(wcaAttemptToCalcValue('333', -2)).toBe(-1);
    expect(wcaAttemptToCalcValue('333', 0)).toBe(0);
  });

  it('treats DNF-only rows as entered results', () => {
    expect(hasEnteredCalcAttempt([-1, 0, 0])).toBe(true);
    expect(hasEnteredCalcAttempt([DNF_VALUE, 0, 0])).toBe(true);
    expect(hasEnteredCalcAttempt([0, 0, 0])).toBe(false);
    expect(serializeCalcAttemptRow([DNF_VALUE, 460, 0])).toBe('-1,460,0');
  });

  it('restores the current round by WCA ID and keeps partial or DNF attempts', () => {
    const data = {
      users: {
        '13': { number: 13, wcaid: '2023LIUY04' },
        '27': { number: 27, wcaid: '2025XIAN12' },
      },
      resultsByRound: {
        'clock:f': [
          { n: 13, v: [408, 301, 0, 0, 0] },
          { n: 27, v: [-1, 0, 0, 0, 0] },
        ],
      },
    };

    expect(extractCompetitionCalcAttempts(data, {
      eventId: 'clock', roundTypeId: 'f', wcaId: '2023LIUY04',
    })).toEqual([408, 301]);
    expect(extractCompetitionCalcAttempts(data, {
      eventId: 'clock', roundTypeId: 'f', wcaId: '2025XIAN12',
    })).toEqual([-1]);
  });

  it('falls back to the competition person number for newcomers without a WCA ID', () => {
    expect(extractCompetitionCalcAttempts({
      users: { '42': { number: 42, wcaid: '' } },
      resultsByRound: { '333:1': [{ n: 42, v: [1234, 0, 0, 0, 0] }] },
    }, {
      eventId: '333', roundTypeId: '1', personNumber: 42,
    })).toEqual([1234]);
  });

  it('does not overwrite a manual edit made while competition data loads', () => {
    expect(mergeCompetitionCalcAttempts(
      [408, 350, 0, 0, 0],
      [408, 301, 0, 0, 0],
      [408, 301, 360, 281, 899],
      5,
    )).toBeNull();
    expect(mergeCompetitionCalcAttempts(
      [408, 301, 0, 0, 0],
      [408, 301, 0, 0, 0],
      [408, 301, 360, 281, 899],
      5,
    )).toEqual([408, 301, 360, 281, 899]);
  });
});
