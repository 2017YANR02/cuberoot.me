import { describe, expect, it } from 'vitest';

import {
  assignLocalBattlePlayerKey,
  groupLocalBattlePlayersByEvent,
  isLocalBattleScrambleHidden,
  localBattlePlayerForKey,
  localBattlePlayerSlots,
  localBattleWinnerIndices,
  normalizeLocalBattlePlayerCount,
} from '@cuberoot/shared/timer';

describe('shared local-battle foundation', () => {
  it('normalizes the exact supported 2–4 player slots', () => {
    expect(normalizeLocalBattlePlayerCount(Number.NaN)).toBe(2);
    expect(normalizeLocalBattlePlayerCount(1)).toBe(2);
    expect(normalizeLocalBattlePlayerCount(3.9)).toBe(3);
    expect(normalizeLocalBattlePlayerCount(9)).toBe(4);
    expect(localBattlePlayerSlots(2)).toEqual([0, 1]);
    expect(localBattlePlayerSlots(3)).toEqual([0, 1, 2]);
    expect(localBattlePlayerSlots(4)).toEqual([0, 1, 2, 3]);
  });

  it('keeps key lookup and conflict swaps in one case-insensitive rule', () => {
    expect(localBattlePlayerForKey([' ', 'Enter', 'q', 'p'], 'Q')).toBe(2);
    expect(localBattlePlayerForKey([' ', 'Enter', 'q', 'p'], 'Escape')).toBeUndefined();
    expect(assignLocalBattlePlayerKey([' ', 'Enter', 'q', 'p'], 0, 'Q'))
      .toEqual(['Q', 'Enter', ' ', 'p']);
  });

  it('groups same-event players once while keeping mixed events independent', () => {
    expect([...groupLocalBattlePlayersByEvent(
      ['333', '222', '333', 'sq1'],
      [0, 1, 2, 3],
    )]).toEqual([
      ['333', [0, 2]],
      ['222', [1]],
      ['sq1', [3]],
    ]);
  });

  it('shares scramble visibility and exact-tie winner rules with the Web facade', () => {
    const players = [
      { isTiming: true, hasFinished: false },
      { isTiming: false, hasFinished: false },
    ];
    expect(isLocalBattleScrambleHidden(players, [0, 1])).toBe(false);
    expect(isLocalBattleScrambleHidden([
      players[0], { isTiming: true, hasFinished: false },
    ], [0, 1])).toBe(true);
    expect(localBattleWinnerIndices([
      { time: 8_000, penalty: '+2' },
      { time: 10_000, penalty: 'ok' },
      { time: 7_000, penalty: 'dnf' },
    ])).toEqual([0, 1]);
    expect(localBattleWinnerIndices([
      { time: 8_000, penalty: 'dnf' },
      { time: 9_000, penalty: 'dnf' },
    ])).toEqual([]);
  });
});
