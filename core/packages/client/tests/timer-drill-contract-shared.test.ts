import { describe, expect, it } from 'vitest';

import { invertAlg } from '@cuberoot/shared/alg-transform';
import {
  EVENTS,
  OLL_CASES,
  PLL_CASES,
  TIMER_DRILL_AUFS,
  TIMER_DRILL_PICKER_COPY,
  TIMER_MORE_ACTION_CONTRACTS,
  generateTimerDrillScramble,
  timerMoreActionStates,
  type EventId,
  type TimerDrillTarget,
} from '@cuberoot/shared/timer';

const DRILL_EVENTS = new Set<EventId>(['333', '333oh', '333fm', 'oll', 'pll']);

describe('shared Timer drill contract', () => {
  it('uses the canonical OLL/PLL cases exactly and applies each AUF bucket', () => {
    expect(TIMER_DRILL_AUFS).toEqual(['', 'U', 'U2', "U'"]);
    for (const [type, cases] of [['oll', OLL_CASES], ['pll', PLL_CASES]] as const) {
      for (const item of cases) {
        const inverse = invertAlg(item.solutionAlg);
        expect(inverse).not.toBe('');
        for (const [random, prefix] of [[0, ''], [0.25, 'U'], [0.5, 'U2'], [0.75, "U'"]] as const) {
          expect(generateTimerDrillScramble({ type, id: item.id }, () => random)).toEqual({
            scramble: prefix ? `${prefix} ${inverse}` : inverse,
            targetCase: item.id,
          });
        }
      }
    }
  });

  it('keeps shared random boundary semantics and fails closed on stale targets', () => {
    const target: TimerDrillTarget = { type: 'oll', id: OLL_CASES[0].id };
    const inverse = invertAlg(OLL_CASES[0].solutionAlg);
    expect(generateTimerDrillScramble(target, () => Number.NaN)?.scramble).toBe(inverse);
    expect(generateTimerDrillScramble(target, () => -1)?.scramble).toBe(inverse);
    expect(generateTimerDrillScramble(target, () => 1)?.scramble).toBe(`U' ${inverse}`);
    expect(generateTimerDrillScramble(target, () => Number.POSITIVE_INFINITY)?.scramble).toBe(inverse);
    expect(generateTimerDrillScramble({ type: 'oll', id: 'removed-case' })).toBeNull();
    expect(generateTimerDrillScramble({ type: 'pll', id: OLL_CASES[0].id })).toBeNull();
    expect(generateTimerDrillScramble({ type: 'bad', id: PLL_CASES[0].id } as never)).toBeNull();
    expect(generateTimerDrillScramble(null as never)).toBeNull();
  });

  it('keeps the picker copy bilingual from one shared object', () => {
    expect(Object.keys(TIMER_DRILL_PICKER_COPY)).toEqual([
      'title',
      'typeLabel',
      'searchLabel',
      'clearSearch',
      'searchPlaceholder',
      'noMatches',
      'exit',
      'close',
    ]);
    for (const text of [
      TIMER_DRILL_PICKER_COPY.title,
      TIMER_DRILL_PICKER_COPY.typeLabel,
      TIMER_DRILL_PICKER_COPY.searchLabel,
      TIMER_DRILL_PICKER_COPY.clearSearch,
      TIMER_DRILL_PICKER_COPY.searchPlaceholder.oll,
      TIMER_DRILL_PICKER_COPY.searchPlaceholder.pll,
      TIMER_DRILL_PICKER_COPY.noMatches,
      TIMER_DRILL_PICKER_COPY.exit,
      TIMER_DRILL_PICKER_COPY.close,
    ]) {
      expect(text.en).not.toBe('');
      expect(text.zh).not.toBe('');
    }
  });

  it('keeps Drill visible while active and marks only a supported active event', () => {
    expect(TIMER_MORE_ACTION_CONTRACTS.find(({ id }) => id === 'more.drill')?.visibility)
      .toBe('drill-event');
    expect(EVENTS).toHaveLength(43);
    for (const event of EVENTS.map(({ id }) => id)) {
      for (const drillActive of [false, true]) {
        const action = timerMoreActionStates({
          compactViewport: false,
          drillActive,
          event,
          fullscreen: false,
          solveCount: 0,
        }).find(({ id }) => id === 'more.drill');
        expect(action?.visible).toBe(DRILL_EVENTS.has(event));
        expect(action?.active).toBe(DRILL_EVENTS.has(event) && drillActive);
      }
    }
  });
});
