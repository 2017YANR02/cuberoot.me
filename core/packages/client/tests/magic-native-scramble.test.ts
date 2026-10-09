import { describe, expect, it } from 'vitest';
import { formatTimerCompoundScramble } from '@cuberoot/shared/timer';
import { scrambleEventPickerGroups } from '@/app/[lang]/scramble/gen/_event-picker';
import { CSTIMER_EVENT_IDS } from '@/lib/cstimer-scramble';
import {
  NATIVE_SCRAMBLE_APPEND,
  NATIVE_SCRAMBLE_EVENT_IDS,
  isNativeScrambleEvent,
  nativeScramble,
} from '@/lib/native-scramble';

describe('Magic practice setup integration', () => {
  it.each([
    ['magic', 0, 'Forward'],
    ['magic', 0.499, 'Forward'],
    ['magic', 0.5, 'Backward'],
    ['mmagic', 0, 'M Forward'],
    ['mmagic', 0.999, 'M Backward'],
  ] as const)('preserves the Timer direction for %s at %s', async (event, sample, expected) => {
    const actual = await nativeScramble(event, () => sample);
    expect(actual).toBe(expected);
    expect(actual).toBe(formatTimerCompoundScramble(event, [], () => sample));
  });

  it('rejects an invalid random source without inventing a direction', async () => {
    for (const sample of [-1, 1, Infinity, NaN]) {
      await expect(nativeScramble('magic', () => sample)).rejects.toThrow('[0, 1)');
    }
  });

  it('exposes both historical event identities with their real tile icons', () => {
    const groups = scrambleEventPickerGroups([...NATIVE_SCRAMBLE_EVENT_IDS], NATIVE_SCRAMBLE_APPEND, true);
    const items = groups.find(({ id }) => id === 'wca')!.items;
    for (const [id, label] of [['magic', '八板'], ['mmagic', '十二板']] as const) {
      expect(isNativeScrambleEvent(id)).toBe(true);
      expect(CSTIMER_EVENT_IDS.has(id)).toBe(false);
      expect(items.find((item) => item.id === id)).toEqual({
        id, label, iconClass: `event-${id}`, textLabel: undefined,
      });
    }
  });
});
