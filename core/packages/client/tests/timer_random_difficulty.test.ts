import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TIMER_RANDOM_DIFFICULTY_SETTINGS,
  canTrainerDifficulty,
  createTimerStoreData,
  decodeTimerStoreData,
  normalizeTimerRandomDifficultySettings,
  trainerSig,
  trainerSpecOf,
  type TimerRandomDifficultySettings,
} from '@cuberoot/shared/timer';

const enabled = (
  patch: Partial<TimerRandomDifficultySettings> = {},
): TimerRandomDifficultySettings => ({
  ...DEFAULT_TIMER_RANDOM_DIFFICULTY_SETTINGS,
  genDiffOn: true,
  ...patch,
});

describe('shared timer random difficulty', () => {
  it('uses the timer event ids and stays off for unsupported events', () => {
    for (const event of ['333', '333oh', '333bld', '333fm']) {
      expect(canTrainerDifficulty(event)).toBe(true);
      expect(trainerSpecOf(event, enabled())).not.toBeNull();
    }
    for (const event of ['222', '333bf', '333ft', '333ni']) {
      expect(canTrainerDifficulty(event)).toBe(false);
      expect(trainerSpecOf(event, enabled())).toBeNull();
    }
    expect(trainerSpecOf('333', { ...enabled(), genDiffOn: false })).toBeNull();
  });

  it('normalizes colors, steps, unsupported stages and invalid slots before identity', () => {
    const normalized = normalizeTimerRandomDifficultySettings(enabled({
      genDiffVariant: 'unknown',
      genDiffStage: 'unknown',
      genDiffColors: 'YYWW',
      genDiffSlot: 999,
      genDiffSteps: [10, 8, 10, -1, 501],
    }));
    expect(normalized).toMatchObject({
      genDiffVariant: 'std',
      genDiffStage: 'cross',
      genDiffColors: 'WY',
      genDiffSteps: [8, 10],
    });

    const multi = trainerSpecOf('333', enabled({
      genDiffStage: 'xcross',
      genDiffColors: 'WY',
      genDiffSlot: 2,
    }));
    expect(multi?.slot).toBe('best');

    const invalidFixed = trainerSpecOf('333', enabled({
      genDiffStage: 'xcross',
      genDiffColors: 'W',
      genDiffSlot: 999,
    }));
    expect(invalidFixed?.slot).toBe('best');
  });

  it('snaps gaps and produces a stable identity from the effective spec', () => {
    const cnXcross = enabled({
      genDiffStage: 'xcross',
      genDiffSteps: [9, 10],
    });
    expect(trainerSpecOf('333', cnXcross)).toMatchObject({ lo: 8, hi: 10 });
    expect(trainerSig('333', cnXcross)).toContain('std/xcross|BGORWY|best|8.10');

    const reordered = enabled({
      genDiffStage: 'xcross',
      genDiffColors: 'YW',
      genDiffSteps: [8, 10],
    });
    const canonical = enabled({
      genDiffStage: 'xcross',
      genDiffColors: 'WY',
      genDiffSteps: [8, 10],
    });
    expect(trainerSig('333', reordered)).toBe(trainerSig('333', canonical));
    expect(trainerSig('333', { ...canonical, genDiffStage: 'cross' }))
      .not.toBe(trainerSig('333', canonical));
  });

  it('persists all fields, migrates missing fields and rejects malformed explicit values', () => {
    const store = createTimerStoreData(0, 'difficulty');
    Object.assign(store.settings, enabled({
      genDiffVariant: 'pair',
      genDiffStage: 'cross_pair',
      genDiffColors: 'W',
      genDiffSlot: 2,
      genDiffSteps: [4, 5],
    }));
    expect(decodeTimerStoreData(store)?.settings).toMatchObject({
      genDiffOn: true,
      genDiffVariant: 'pair',
      genDiffStage: 'cross_pair',
      genDiffColors: 'W',
      genDiffSlot: 2,
      genDiffSteps: [4, 5],
    });

    const legacy = createTimerStoreData(0, 'legacy') as unknown as {
      settings: Record<string, unknown>;
    };
    for (const key of [
      'genDiffOn', 'genDiffVariant', 'genDiffStage',
      'genDiffColors', 'genDiffSlot', 'genDiffSteps',
    ]) delete legacy.settings[key];
    expect(decodeTimerStoreData(legacy)?.settings)
      .toMatchObject(DEFAULT_TIMER_RANDOM_DIFFICULTY_SETTINGS);

    legacy.settings.genDiffSteps = [4, '5'];
    expect(decodeTimerStoreData(legacy)).toBeNull();
  });
});
