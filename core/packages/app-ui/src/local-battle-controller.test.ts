import {
  LOCAL_BATTLE_KEYS_STORAGE_KEY,
  LOCAL_BATTLE_ROUNDS_STORAGE_KEY,
  assignLocalBattlePlayerKey,
  createLocalBattleKeyStore,
  createLocalBattleRound,
  createLocalBattleRoundStore,
  initialLocalBattleState,
  nextLocalBattleCubeHolder,
  summarizeLocalBattleRounds,
  transitionLocalBattle,
  type LocalBattleAction,
  type LocalBattleState,
} from '@cuberoot/shared/timer';
import { describe, expect, it } from 'vitest';

const config = { inspectionSec: 0 };

function apply(state: LocalBattleState, action: LocalBattleAction) {
  return transitionLocalBattle(state, action, config);
}

function loadScramble(state: LocalBattleState, event = '333') {
  const requested = apply(state, { type: 'request-next-scramble', event: event as '333' });
  const effect = requested.effects.find((candidate) => candidate.type === 'request-scramble');
  expect(effect).toBeDefined();
  return apply(requested.state, {
    type: 'scramble-ready',
    event: event as '333',
    revision: effect!.revision,
    scramble: "R U R'",
  }).state;
}

describe('shared local battle transition', () => {
  it('normalizes and switches between 2, 3 and 4 visible players', () => {
    let state = initialLocalBattleState(2);
    expect(state.playerCount).toBe(2);
    state = apply(state, { type: 'set-player-count', playerCount: 3 }).state;
    expect(state.playerCount).toBe(3);
    state = apply(state, { type: 'set-player-count', playerCount: 4 }).state;
    expect(state.playerCount).toBe(4);
    expect(initialLocalBattleState(99).playerCount).toBe(4);
  });

  it('gives newly visible players the current shared scramble when growing 2 to 4', () => {
    const twoPlayers = loadScramble(initialLocalBattleState(2));
    const grown = apply(twoPlayers, { type: 'set-player-count', playerCount: 4 });
    expect(grown.accepted).toBe(true);
    expect(grown.effects).toEqual([]);
    expect(grown.state.players.map((player) => player.scramble)).toEqual([
      "R U R'", "R U R'", "R U R'", "R U R'",
    ]);
    expect(apply(grown.state, { type: 'start-all', nowMs: 1_000 }).accepted).toBe(true);
  });

  it('shares one scramble per event and rejects a stale async completion', () => {
    let state = initialLocalBattleState(3);
    const first = apply(state, { type: 'request-next-scramble', event: '333' });
    const firstRequest = first.effects[0];
    expect(firstRequest).toMatchObject({ type: 'request-scramble', event: '333' });
    state = first.state;

    const second = apply(state, { type: 'request-next-scramble', event: '333' });
    const secondRequest = second.effects[0];
    state = second.state;

    const stale = apply(state, {
      type: 'scramble-ready',
      event: '333',
      revision: firstRequest.type === 'request-scramble' ? firstRequest.revision : -1,
      scramble: 'OLD',
    });
    expect(stale.accepted).toBe(false);

    const ready = apply(state, {
      type: 'scramble-ready',
      event: '333',
      revision: secondRequest.type === 'request-scramble' ? secondRequest.revision : -1,
      scramble: 'NEW',
    });
    expect(ready.state.players.slice(0, 3).map((player) => player.scramble)).toEqual([
      'NEW', 'NEW', 'NEW',
    ]);
  });

  it('delegates player timing to transitionTimer and completes only after every player', () => {
    let state = loadScramble(initialLocalBattleState(2));
    state = apply(state, { type: 'start-all', nowMs: 1_000 }).state;
    expect(state.players.slice(0, 2).map((player) => player.timer.phase)).toEqual([
      'running', 'running',
    ]);

    const first = apply(state, {
      type: 'player-timer',
      playerId: 0,
      action: { type: 'press-down', nowMs: 2_000 },
    });
    expect(first.effects.some((effect) => effect.type === 'round-complete')).toBe(false);
    expect(first.state.players[0].result?.timeMs).toBe(1_000);

    const second = apply(first.state, {
      type: 'player-timer',
      playerId: 1,
      action: { type: 'press-down', nowMs: 2_500 },
    });
    expect(second.state.players[1].result?.timeMs).toBe(1_500);
    expect(second.effects).toContainEqual({ type: 'round-complete', winners: [0] });
  });

  it('recomputes ties and all-DNF after penalty changes', () => {
    let state = loadScramble(initialLocalBattleState(2));
    state = apply(state, { type: 'start-all', nowMs: 1_000 }).state;
    state = apply(state, {
      type: 'player-timer', playerId: 0, action: { type: 'press-down', nowMs: 2_000 },
    }).state;
    state = apply(state, {
      type: 'player-timer', playerId: 1, action: { type: 'press-down', nowMs: 2_000 },
    }).state;
    expect(apply(state, { type: 'set-penalty', playerId: 0, penalty: 'ok' }).effects)
      .toContainEqual({ type: 'round-complete', winners: [0, 1] });
    state = apply(state, { type: 'set-penalty', playerId: 0, penalty: 'dnf' }).state;
    const allDnf = apply(state, { type: 'set-penalty', playerId: 1, penalty: 'dnf' });
    expect(allDnf.effects).toContainEqual({ type: 'round-complete', winners: [] });
    expect(apply(allDnf.state, {
      type: 'player-timer', playerId: 0, action: { type: 'start-now', nowMs: 3_000 },
    }).accepted).toBe(false);
  });

  it('locks event and player-count context while an attempt is active', () => {
    let state = loadScramble(initialLocalBattleState(2));
    state = apply(state, { type: 'start-all', nowMs: 1_000 }).state;
    expect(apply(state, { type: 'set-player-event', playerId: 0, event: '222' }).accepted).toBe(false);
    expect(apply(state, { type: 'set-player-count', playerCount: 4 }).accepted).toBe(false);
    expect(apply(state, { type: 'request-next-scramble', event: '333' }).accepted).toBe(false);
  });

  it('rejects attempts until the shared scramble is ready', () => {
    const state = initialLocalBattleState(2);
    expect(apply(state, {
      type: 'player-timer', playerId: 0, action: { type: 'press-down', nowMs: 1_000 },
    }).accepted).toBe(false);
    expect(apply(state, {
      type: 'player-timer', playerId: 0, action: { type: 'start-now', nowMs: 1_000 },
    }).accepted).toBe(false);
    expect(apply(state, {
      type: 'player-timer', playerId: 0, action: { type: 'stop-external', timeMs: 1_000 },
    }).accepted).toBe(false);
  });

  it('stores indivisible rounds and derives local stats from the same canonical solves', async () => {
    let state = loadScramble(initialLocalBattleState(2));
    state = apply(state, { type: 'start-all', nowMs: 1_000 }).state;
    state = apply(state, {
      type: 'player-timer', playerId: 0, action: { type: 'press-down', nowMs: 2_000 },
    }).state;
    state = apply(state, {
      type: 'player-timer', playerId: 1, action: { type: 'press-down', nowMs: 2_500 },
    }).state;
    state = apply(state, { type: 'set-penalty', playerId: 0, penalty: '+2' }).state;
    const round = createLocalBattleRound(state, 'round-1', 100);
    expect(round).not.toBeNull();
    expect(round?.attempts.map((attempt) => attempt.solve.id)).toEqual(['round-1:0', 'round-1:1']);
    expect(round?.winners).toEqual([1]);
    expect(summarizeLocalBattleRounds([round!], 2)).toEqual([
      { attempts: 1, bestMs: 3_000, playerId: 0, wins: 0 },
      { attempts: 1, bestMs: 1_500, playerId: 1, wins: 1 },
    ]);

    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const store = createLocalBattleRoundStore(storage);
    await store.save([round!]);
    expect(values.has(LOCAL_BATTLE_ROUNDS_STORAGE_KEY)).toBe(true);
    expect(await store.load()).toEqual([round]);
    await store.clear();
    expect(await store.load()).toEqual([]);
  });

  it('persists conflict-free custom player keys with a stable shared codec', async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const store = createLocalBattleKeyStore(storage);
    expect(await store.load()).toEqual([' ', 'Enter', 'q', 'p']);
    const assigned = assignLocalBattlePlayerKey([' ', 'Enter', 'q', 'p'], 0, 'q');
    expect(assigned).toEqual(['q', 'Enter', ' ', 'p']);
    expect(assignLocalBattlePlayerKey(assigned, 1, 'Shift')).toEqual(assigned);
    await store.save(assigned);
    expect(values.has(LOCAL_BATTLE_KEYS_STORAGE_KEY)).toBe(true);
    expect(await store.load()).toEqual(assigned);
    values.set(LOCAL_BATTLE_KEYS_STORAGE_KEY, JSON.stringify(['q', 'Q', 'x', 'y']));
    expect(await store.load()).toEqual([' ', 'Enter', 'q', 'p']);
  });

  it('passes a shared smart cube only to the next unfinished 3x3 player', () => {
    let state = initialLocalBattleState(3);
    state = {
      ...state,
      players: state.players.map((player) => player.id === 1
        ? { ...player, event: '222' }
        : player.id === 0
          ? { ...player, result: { timeMs: 1_000, inspectionMs: 0, autoPenalty: 'ok' } }
          : player),
    };
    expect(nextLocalBattleCubeHolder(state, 0)).toBe(2);
    state = {
      ...state,
      players: state.players.map((player) => player.id === 2
        ? { ...player, result: { timeMs: 1_100, inspectionMs: 0, autoPenalty: 'ok' } }
        : player),
    };
    expect(nextLocalBattleCubeHolder(state, 0)).toBeNull();
  });
});
