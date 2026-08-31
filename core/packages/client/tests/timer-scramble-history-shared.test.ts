import { describe, expect, it } from 'vitest';
import {
  SCRAMBLE_HISTORY_CAP,
  histBack,
  histForward,
  histPush,
  type ScrambleHistory,
} from '@cuberoot/shared/timer';

describe('shared timer scramble history', () => {
  it('walks retained entries and signals when the host must generate a fresh one', () => {
    const first: ScrambleHistory<string> = { list: ['A'], idx: 0 };
    const second = histPush(first, 'B');
    const third = histPush(second, 'C');

    const back = histBack(third);
    expect(back).toEqual({ list: ['A', 'B', 'C'], idx: 1 });
    expect(histBack(back!)).toEqual({ list: ['A', 'B', 'C'], idx: 0 });
    expect(histBack({ list: ['A', 'B', 'C'], idx: 0 })).toBeNull();
    expect(histForward(back!)).toEqual(third);
    expect(histForward(third)).toBeNull();
  });

  it('drops only the oldest overflow and never mutates the host snapshot', () => {
    const original: ScrambleHistory<number> = {
      list: Array.from({ length: SCRAMBLE_HISTORY_CAP }, (_, index) => index),
      idx: SCRAMBLE_HISTORY_CAP - 1,
    };

    const pushed = histPush(original, SCRAMBLE_HISTORY_CAP);

    expect(pushed.list).toHaveLength(SCRAMBLE_HISTORY_CAP);
    expect(pushed.list[0]).toBe(1);
    expect(pushed.list.at(-1)).toBe(SCRAMBLE_HISTORY_CAP);
    expect(pushed.idx).toBe(SCRAMBLE_HISTORY_CAP - 1);
    expect(original.list[0]).toBe(0);
    expect(original.list).toHaveLength(SCRAMBLE_HISTORY_CAP);
  });

  it('preserves generic entry identity while returning immutable cursor snapshots', () => {
    type Entry = { scramble: string; source: 'manual' | 'random' };
    const entry: Entry = { scramble: "R U R'", source: 'manual' };
    const current: ScrambleHistory<Entry> = { list: [entry], idx: 0 };
    const next = histPush(current, { scramble: 'F2', source: 'random' });
    const previous = histBack(next)!;

    expect(previous.list[previous.idx]).toBe(entry);
    expect(previous).not.toBe(next);
    expect(previous.list).toBe(next.list);
  });
});
