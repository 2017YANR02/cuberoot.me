import { describe, expect, it } from 'vitest';

import {
  assignLocalBattlePlayerKey,
  decodeLocalBattleRounds,
  groupLocalBattlePlayersByEvent,
  isLocalBattleScrambleHidden,
  localBattlePlayerForKey,
  localBattlePlayerSlots,
  localBattleRoundWinners,
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

  it('decodes atomic rounds and rejects duplicate players or non-battle events', () => {
    const round = {
      id: 'round-1',
      ts: 1_000,
      attempts: [
        { playerId: 0, solve: { id: 'a', timeMs: 8_000, penalty: '+2', scramble: 'R U', event: '222', ts: 1_000 } },
        { playerId: 1, solve: { id: 'b', timeMs: 10_000, penalty: 'ok', scramble: 'F R', event: '333', ts: 1_000 } },
      ],
      winners: [0, 1],
    };
    const decoded = decodeLocalBattleRounds([round]);
    expect(decoded).toEqual([round]);
    expect(localBattleRoundWinners(decoded![0])).toEqual([0, 1]);
    expect(decodeLocalBattleRounds([{
      ...round,
      attempts: [round.attempts[0], { ...round.attempts[1], playerId: 0 }],
    }])).toBeNull();
    expect(decodeLocalBattleRounds([{
      ...round,
      attempts: [round.attempts[0], {
        ...round.attempts[1], solve: { ...round.attempts[1].solve, event: 'custom' },
      }],
    }])).toBeNull();
    expect(decodeLocalBattleRounds([{ ...round, winners: [0] }])?.[0].winners).toEqual([0, 1]);
    expect(decodeLocalBattleRounds([{
      ...round,
      attempts: [round.attempts[0], {
        ...round.attempts[1], solve: { ...round.attempts[1].solve, ts: 999 },
      }],
    }])).toBeNull();
  });

  it('preserves canonical solve metadata while decoding a round', () => {
    const decoded = decodeLocalBattleRounds([{
      id: 'round-meta',
      ts: 2_000,
      attempts: [0, 1].map((playerId) => ({
        playerId,
        solve: {
          id: `solve-${playerId}`,
          timeMs: 9_000 + playerId,
          penalty: 'ok',
          scramble: 'R U',
          scrambleSource: { kind: 'wca', identity: `slot-${playerId}` },
          event: '333',
          ts: 2_000,
          moves: [{ m: 'R', ts: 100 }],
          device: { model: 'gan-v4', name: 'GAN 16 UI' },
          reconstruction: ['R'],
        },
      })),
      winners: [1],
    }]);
    expect(decoded?.[0].attempts[0].solve).toMatchObject({
      scrambleSource: { kind: 'wca', identity: 'slot-0' },
      moves: [{ m: 'R', ts: 100 }],
      device: { model: 'gan-v4', name: 'GAN 16 UI' },
      reconstruction: ['R'],
    });
    expect(decoded?.[0].winners).toEqual([0]);
  });
});
