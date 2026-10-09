import { describe, expect, it } from 'vitest';
import * as bluetooth from '@/lib/bluetooth';
import * as legacyBluetooth from '@/app/[lang]/timer/_lib/bluetooth';
import * as fakeCube from '@/lib/bluetooth/fake_cube';
import * as legacyFakeCube from '@/app/[lang]/timer/_lib/bluetooth/fake_cube';
import * as solver from '@/lib/kociemba/random_state';
import * as legacySolver from '@/app/[lang]/timer/_lib/scramble/kociemba/random_state';
import { formatSolveTime } from '@/app/[lang]/alg/_trainer/trainer-components';

describe('timer and trainer capability compatibility', () => {
  it('keeps old and new consumers on the same connection, fake peripheral and worker cache', () => {
    for (const [legacy, current] of [
      [legacyBluetooth, bluetooth], [legacyFakeCube, fakeCube], [legacySolver, solver],
    ]) {
      expect(Object.keys(legacy)).toEqual(Object.keys(current));
      for (const key of Object.keys(legacy)) {
        expect((legacy as Record<string, unknown>)[key], key)
          .toBe((current as Record<string, unknown>)[key]);
      }
    }
  });

  it('preserves trainer rounding, long durations and penalty suffixes', () => {
    expect(formatSolveTime({ ms: 12346 })).toBe('12.35');
    expect(formatSolveTime({ ms: 58346, penalty: '+2' })).toBe('1:00.35+');
    expect(formatSolveTime({ ms: 3600000, penalty: 'ok' })).toBe('60:00.00');
    expect(formatSolveTime({ ms: 12346, penalty: 'DNF' })).toBe('DNF');
    expect(formatSolveTime({ ms: -1 })).toBe('0.00');
    expect(formatSolveTime({ ms: Infinity })).toBe('0.00');
  });
});
