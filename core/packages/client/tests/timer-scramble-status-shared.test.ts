import {
  timerScrambleStatus,
  timerWcaScrambleEmptyReason,
  type TimerScrambleStatusReason,
} from '@cuberoot/shared/timer';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const solo = readFileSync(
  new URL('../app/[lang]/timer/_shell/SoloView.tsx', import.meta.url),
  'utf8',
);

describe('shared timer scramble status', () => {
  it('keeps retry policy and bilingual copy with the canonical reason', () => {
    expect(timerScrambleStatus('error-real')).toEqual({
      kind: 'error',
      message: {
        en: 'Could not load real competition scrambles.',
        zh: '无法加载比赛真题。',
      },
      retryable: true,
    });
    expect(timerScrambleStatus('unsupported')).toMatchObject({
      kind: 'unsupported', retryable: false,
    });
  });

  it.each([
    [{ hasTypeFilter: true }, 'empty-wca-type'],
    [{ hasByStepsFilter: true }, 'empty-wca-steps'],
    [{ hasDifficultyFilter: true, competitionUnindexed: true }, 'empty-wca-difficulty-unindexed'],
    [{ hasDifficultyFilter: true }, 'empty-wca-difficulty-competition'],
    [{ mode: 'date', hasDifficultyFilter: true }, 'empty-wca-difficulty'],
    [{}, 'empty-wca-competition-event'],
    [{ mode: 'date' }, 'empty-wca-date'],
  ] as const)('selects the exact WCA empty reason for %o', (patch, expected) => {
    expect(timerWcaScrambleEmptyReason({
      competitionUnindexed: false,
      hasByStepsFilter: false,
      hasDifficultyFilter: false,
      hasTypeFilter: false,
      mode: 'comp',
      ...patch,
    })).toBe(expected satisfies TimerScrambleStatusReason);
  });

  it('keeps exhausted Web WCA and worker sources explicitly retryable', () => {
    expect(solo).toContain("if (outcome.kind === 'exhausted') {\n        setWcaSourceFailed(true);");
    expect(solo).toContain('if (cstimerFailed) { setCstimerRetry((value) => value + 1); return; }');
    expect(solo).toContain('if (wcaSourceFailed) setWcaRetry((value) => value + 1);');
    expect(solo).toContain('scrambleStatus.retryable');
    expect(solo).toContain('onRetry: retryDisplayedScramble');
  });

  it('pins every async completion to the exact visible history slot', () => {
    expect(solo).toContain('const entryId = currentScrambleEntryId;');
    expect(solo).toContain('entry?.id === expectedId && entry.scramble ===');
    expect(solo).toContain('fillCurrentEmptyScrambleEntry(entryId, outcome.value.scramble');
    expect(solo).toContain('fillCurrentEmptyScrambleEntry(entryId, generated)');
    expect(solo).toContain('fillCurrentEmptyScrambleEntry(entryId, real)');
  });

  it('lets optimal generation exclusively consume a selected trainer pool', () => {
    expect(solo).toContain("return { kind: 'unavailable' as const, reason: status };");
    expect(solo).toContain('if (randomOptimalRequested) { setTrainerLoading(false); setTrainerMiss(null); return; }');
    expect(solo).toContain("status === 'base-empty' || status === 'base-rare'");
  });
});
