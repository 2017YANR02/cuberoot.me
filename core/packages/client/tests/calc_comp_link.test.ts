import { describe, expect, it } from 'vitest';
import { calcCompetitionHref, wcaAttemptToCalcValue } from '@/lib/calc-link';

describe('calculator competition result links', () => {
  it('carries the exact result row and competition context', () => {
    const href = calcCompetitionHref({
      eventId: 'clock',
      attempts: [488, 320, 355, 375, 316],
      personName: '刘烨宁',
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
});
