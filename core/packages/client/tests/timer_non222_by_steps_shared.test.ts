import { describe, expect, it } from 'vitest';
import {
  normalizeTimerByStepsSettings,
  stepMetricsFor,
  timerByStepsIdentity,
  timerByStepsSelection,
  type TimerByStepsSettings,
} from '@cuberoot/shared/timer';

const enabled = (metric: string, steps: number[]): TimerByStepsSettings => ({
  genByStepsOn: true,
  genStepsMetric: metric,
  genSteps: steps,
});

describe('shared non-2x2 Timer by-steps settings', () => {
  it('locks the four random metric registries and full generated-state ranges', () => {
    expect(stepMetricsFor('pyra')).toEqual([
      { key: 'v', zh: 'V', en: 'V', range: [0, 7], band: [3, 5] },
      { key: 'cube', zh: '魔方', en: 'Cube', range: [0, 11], wcaRange: [2, 11], band: [6, 9] },
    ]);
    expect(stepMetricsFor('skewb')).toEqual([
      { key: 'htm', zh: '魔方', en: 'Cube', range: [0, 11], wcaRange: [7, 11], band: [8, 10] },
    ]);
    expect(stepMetricsFor('ivy')).toEqual([
      { key: 'htm', zh: '魔方', en: 'Cube', range: [0, 8], band: [5, 7] },
    ]);
    expect(stepMetricsFor('gear')).toEqual([
      { key: 'ftm', zh: '魔方', en: 'Cube', range: [0, 6], band: [4, 5] },
    ]);
  });

  it('uses the same Web/Mobile WCA bounds for Pyraminx and Skewb', () => {
    expect(timerByStepsSelection('pyra', 'wca', enabled('cube', [0, 11])))
      .toMatchObject({ metric: 'cube', min: 2, max: 11, lo: 2, hi: 11 });
    expect(timerByStepsSelection('skewb', 'wca', enabled('htm', [0, 11])))
      .toMatchObject({ metric: 'htm', min: 7, max: 11, lo: 7, hi: 11 });
  });

  it('normalizes persisted settings against the active event and isolates identities', () => {
    const stale222 = enabled('face', [3, 4]);
    expect(timerByStepsSelection('gear', 'random', stale222)).toMatchObject({
      metric: 'ftm', lo: 4, hi: 5,
    });
    expect(normalizeTimerByStepsSettings('gear', 'random', stale222)).toEqual(
      enabled('ftm', [4, 5]),
    );
    expect(timerByStepsIdentity('gear', 'random', stale222)).toBe('byst|gear|ftm|4.5');
    expect(timerByStepsIdentity('gear', 'random', enabled('ftm', [4, 5])))
      .toBe('byst|gear|ftm|4.5');
    expect(timerByStepsIdentity('ivy', 'random', enabled('htm', [4, 5])))
      .toBe('byst|ivy|htm|4.5');
  });
});
