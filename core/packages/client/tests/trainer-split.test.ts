import { describe, expect, it } from 'vitest';
import {
  advanceSplitLane,
  resizeSplitRound,
  splitRoundDone,
  startSplitRound,
} from '@/lib/trainer-split';

describe('single-device trainer split queue', () => {
  it('deals distinct first cases and preserves set order in sequential mode', () => {
    const round = startSplitRound(['a', 'b', 'c', 'd'], 'seq');
    expect(round.lanes.a.keys).toEqual(['a']);
    expect(round.lanes.b.keys).toEqual(['b']);
    expect(round.remaining).toEqual(['c', 'd']);
    expect(round.total).toBe(4);
  });

  it('lets either person advance without changing the other lane', () => {
    const first = startSplitRound(['a', 'b', 'c', 'd'], 'seq');
    const afterB = advanceSplitLane(first, 'b');
    expect(afterB.lanes.a).toEqual({ keys: ['a'], completed: 0 });
    expect(afterB.lanes.b).toEqual({ keys: ['c'], completed: 1 });
    expect(afterB.completed).toBe(1);
  });

  it('handles an odd pool by parking the first person who runs out of work', () => {
    let round = startSplitRound(['a', 'b', 'c'], 'seq');
    round = advanceSplitLane(round, 'a');
    round = advanceSplitLane(round, 'b');
    expect(round.lanes.a.keys).toEqual(['c']);
    expect(round.lanes.b.keys).toEqual([]);
    expect(splitRoundDone(round)).toBe(false);
    round = advanceSplitLane(round, 'a');
    expect(splitRoundDone(round)).toBe(true);
  });

  it('deduplicates invalid input and ignores advancement on an idle lane', () => {
    const round = startSplitRound(['a', '', 'a'], 'seq');
    expect(round.total).toBe(1);
    expect(round.lanes.b.keys).toEqual([]);
    expect(advanceSplitLane(round, 'b')).toBe(round);
  });

  it('uses the supplied random source when shuffling', () => {
    const round = startSplitRound(['a', 'b', 'c', 'd'], 'shuffle', () => 0);
    expect([...round.lanes.a.keys, ...round.lanes.b.keys, ...round.remaining]).toEqual(['b', 'c', 'd', 'a']);
  });

  it('deals up to three distinct cases to each side and advances a whole batch', () => {
    const round = startSplitRound(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 'seq', Math.random, 1, 3);
    expect(round.lanes.a.keys).toEqual(['a', 'c', 'e']);
    expect(round.lanes.b.keys).toEqual(['b', 'd', 'f']);
    expect(round.remaining).toEqual(['g', 'h']);

    const afterA = advanceSplitLane(round, 'a');
    expect(afterA.lanes.a).toEqual({ keys: ['g', 'h'], completed: 3 });
    expect(afterA.lanes.b.keys).toEqual(['b', 'd', 'f']);
    expect(afterA.completed).toBe(3);
  });

  it('re-deals only unfinished cases when Three at once changes', () => {
    let round = startSplitRound(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 'seq');
    round = advanceSplitLane(round, 'a');
    round = resizeSplitRound(round, 3);

    expect(round.completed).toBe(1);
    expect(round.lanes.a.keys).toEqual(['c', 'd', 'f']);
    expect(round.lanes.b.keys).toEqual(['b', 'e', 'g']);
    expect(round.remaining).toEqual([]);
    expect(new Set([...round.lanes.a.keys, ...round.lanes.b.keys]).size).toBe(6);
  });
});
