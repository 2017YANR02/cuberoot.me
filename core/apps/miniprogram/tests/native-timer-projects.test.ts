import { DOUYIN_BASIC_TIMER_EVENTS } from '@cuberoot/shared/douyin-content';
import { formatMultiBlindScrambles, formatTimerCompoundScramble } from '@cuberoot/shared/timer/compound-scramble';
import { TIMER_EVENT_PICKER_ITEMS, timerWcaScrambleEventId } from '@cuberoot/shared/timer/event-catalog';
import { eventInfo } from '@cuberoot/shared/timer/types';
import { timerWcaScrambleSourceLine } from '@cuberoot/shared/timer/wca-source-config';
import { describe, expect, it, vi } from 'vitest';
import { nativeTimerPreview, nativeTimerUsesAsyncPreview } from '../src/lib/native-timer-preview';
import { generateNativeTimerScramble, nativeTimerEvents } from '../src/lib/native-timer-projects';

describe('native timer projects', () => {
  it('uses the website ordinary project catalog and keeps its ordering', () => {
    const ids = nativeTimerEvents().map(item => item.id);
    expect(ids).toEqual(TIMER_EVENT_PICKER_ITEMS
      .filter(item => !['cfop', 'll'].includes(eventInfo(item.id).group)).map(item => item.id));
    expect(ids).toHaveLength(68);
    expect(ids).toEqual(expect.arrayContaining([...DOUYIN_BASIC_TIMER_EVENTS]));
    expect(nativeTimerEvents().find(item => item.id === 'radiofathom')?.icon).toBe('puzzle-radiofathom');
  });

  it('keeps each random multi-blind board independent and officially sourced attempts numbered as a whole', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.125);
    try {
      const scramble = generateNativeTimerScramble('333', 'optimal');
      expect(generateNativeTimerScramble('333mbld', 'optimal')).toBe(formatMultiBlindScrambles([scramble, scramble, scramble]));
    } finally {
      random.mockRestore();
    }
    expect(timerWcaScrambleEventId('333mbld')).toBe('333mbf');
    expect(timerWcaScrambleSourceLine('1', 'A', 2)).toBe('R1,A,2');
    expect(timerWcaScrambleSourceLine('1', 'A', 2, true)).toBe('R1,A,E2');
  });

  it('renders a fewest-moves scramble as one cube and suppresses the incorrect multi-blind composite', () => {
    const scramble = "R' U' F D2 R' U' F";
    const preview = nativeTimerPreview('333', scramble);
    expect(preview).toMatch(/^data:image\/svg\+xml/);
    expect(nativeTimerPreview('333fm', scramble)).toBe(preview);
    expect(nativeTimerPreview('333mbld', formatMultiBlindScrambles([scramble, "R U R'"]))).toBe('');
    expect(nativeTimerPreview('333mbld', `${scramble}\nR U R'`)).toBe('');
  });

  it('uses the matching preview strategy for extra projects', () => {
    const relay = formatTimerCompoundScramble('r4', ['U F', "R U R'", 'Rw Uw']);
    expect(nativeTimerPreview('r4', relay)).toBe(nativeTimerPreview('333', "R U R'"));
    expect(nativeTimerPreview('666bld', '3Rw Uw')).toBe(nativeTimerPreview('666', '3Rw Uw'));
    expect(nativeTimerPreview('magic', 'Forward')).toMatch(/^data:image\/svg\+xml/);
    expect(nativeTimerPreview('superz', generateNativeTimerScramble('superz', 'optimal'))).toMatch(/^data:image\/svg\+xml/);
    expect(nativeTimerPreview('gear', 'R')).toBe('');
    expect(nativeTimerPreview('mpyram', 'R')).toBe('');
    expect((['fto', 'redi', 'kilominx', 'sphere'] as const).every(nativeTimerUsesAsyncPreview)).toBe(true);
  });
});
