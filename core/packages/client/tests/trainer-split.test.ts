import { describe, expect, it } from 'vitest';
import {
  advanceSplitLane,
  splitRoundDone,
  startSplitRound,
} from '@/lib/trainer-split';

describe('single-device trainer split queue', () => {
  it('deals distinct first cases and preserves set order in sequential mode', () => {
    const round = startSplitRound(['a', 'b', 'c', 'd'], 'seq');
    expect(round.lanes.a.key).toBe('a');
    expect(round.lanes.b.key).toBe('b');
    expect(round.remaining).toEqual(['c', 'd']);
    expect(round.total).toBe(4);
  });

  it('lets either person advance without changing the other lane', () => {
    const first = startSplitRound(['a', 'b', 'c', 'd'], 'seq');
    const afterB = advanceSplitLane(first, 'b');
    expect(afterB.lanes.a).toEqual({ key: 'a', completed: 0 });
    expect(afterB.lanes.b).toEqual({ key: 'c', completed: 1 });
    expect(afterB.completed).toBe(1);
  });

  it('handles an odd pool by parking the first person who runs out of work', () => {
    let round = startSplitRound(['a', 'b', 'c'], 'seq');
    round = advanceSplitLane(round, 'a');
    round = advanceSplitLane(round, 'b');
    expect(round.lanes.a.key).toBe('c');
    expect(round.lanes.b.key).toBeNull();
    expect(splitRoundDone(round)).toBe(false);
    round = advanceSplitLane(round, 'a');
    expect(splitRoundDone(round)).toBe(true);
  });

  it('deduplicates invalid input and ignores advancement on an idle lane', () => {
    const round = startSplitRound(['a', '', 'a'], 'seq');
    expect(round.total).toBe(1);
    expect(round.lanes.b.key).toBeNull();
    expect(advanceSplitLane(round, 'b')).toBe(round);
  });

  it('uses the supplied random source when shuffling', () => {
    const round = startSplitRound(['a', 'b', 'c', 'd'], 'shuffle', () => 0);
    expect([round.lanes.a.key, round.lanes.b.key, ...round.remaining]).toEqual(['b', 'c', 'd', 'a']);
  });
});
