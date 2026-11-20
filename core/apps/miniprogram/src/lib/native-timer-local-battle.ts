import {
  createLocalBattleRound, createLocalBattleRoundStore, initialLocalBattleState, summarizeLocalBattleRounds,
  transitionLocalBattle, type LocalBattleAction, type LocalBattleEffect, type LocalBattlePenalty, type LocalBattleRoundStorage,
} from '@cuberoot/shared/timer/local-battle';
import { requestLocalBattleScramble, type LocalBattleScramble } from '@cuberoot/shared/timer/local-battle-scramble';
import { defaultLocalBattlePreferences, type LocalBattlePreferences } from '@cuberoot/shared/timer/local-battle-settings';
import type { TimerMachineAction } from '@cuberoot/shared/timer/machine';
import { formatTimerTimingDisplay } from '@cuberoot/shared/timer/timing-display';
import type { EventId } from '@cuberoot/shared/timer/types';

type Settings = Pick<LocalBattlePreferences, 'hideTime' | 'holdMs' | 'inspectionSec' | 'precision' | 'syncStart'>
  & { runningPrecision?: LocalBattlePreferences['precision'] };

export interface NativeTimerLocalBattleOptions {
  playerCount?: number;
  initialEvent?: EventId;
  storage: LocalBattleRoundStorage;
  requestScramble(event: EventId, signal: AbortSignal): Promise<LocalBattleScramble>;
  settings?(): Partial<Settings>;
  now?(): number;
  onChange?(): void;
}

let roundSequence = 0;

/** Native input and persistence around the browser/installed local battle machine. */
export function createNativeTimerLocalBattle(options: NativeTimerLocalBattleOptions) {
  const now = options.now ?? Date.now;
  const store = createLocalBattleRoundStore(options.storage);
  const defaults = defaultLocalBattlePreferences();
  const settings = () => ({ ...defaults, ...options.settings?.() });
  const notify = () => { if (!disposed) options.onChange?.(); };
  const holds = new Map<number, ReturnType<typeof setTimeout>>();
  const touches = new Map<number, number>();
  let state = initialLocalBattleState(options.playerCount, options.initialEvent);
  let request: AbortController | undefined;
  let scrambleRow: LocalBattleScramble | undefined;
  let scrambleFailed = false;
  let disposed = false;
  let roundTimestamp = Date.now();
  let roundId = '';
  let completed = false;
  let winners: number[] = [];
  let rounds: Awaited<ReturnType<typeof store.load>> = [];
  let storageError = false;
  let storageQueue = store.load().then(items => { rounds = items; notify(); }).catch(() => {
    storageError = true;
    notify();
  });

  function newRound() {
    roundTimestamp = Date.now();
    roundId = `local-${roundTimestamp}-${++roundSequence}`;
    completed = false;
    winners = [];
  }
  newRound();

  function writeHistory(write: () => Promise<void>) {
    storageQueue = storageQueue.then(write).then(() => { storageError = false; }).catch(() => { storageError = true; }).then(notify);
  }

  function playerTimer(playerId: number, action: TimerMachineAction) {
    return dispatch({ type: 'player-timer', playerId, action });
  }

  function clearHold(playerId: number) {
    const timer = holds.get(playerId);
    if (timer !== undefined) clearTimeout(timer);
    holds.delete(playerId);
  }

  function processEffect(effect: LocalBattleEffect) {
    if (effect.type === 'round-reset') { newRound(); return; }
    if (effect.type === 'request-scramble') {
      request?.abort();
      const controller = request = new AbortController();
      scrambleRow = undefined;
      scrambleFailed = false;
      const { event, revision } = effect;
      void requestLocalBattleScramble(event, options.requestScramble, controller.signal).then(row => {
        if (disposed || request !== controller) return;
        request = undefined;
        scrambleRow = row;
        dispatch({ type: 'scramble-ready', event, revision, scramble: row.scramble, source: row.source });
      }, () => {
        if (disposed || request !== controller) return;
        request = undefined;
        scrambleFailed = true;
        dispatch({ type: 'scramble-failed', event, revision });
      });
      return;
    }
    if (effect.type === 'round-complete') {
      const round = createLocalBattleRound(state, roundId, roundTimestamp);
      if (!round) return;
      winners = effect.winners;
      writeHistory(async () => {
        const exists = rounds.some(item => item.id === round.id);
        rounds = exists ? rounds.map(item => item.id === round.id ? round : item) : [...rounds, round];
        await store.save(rounds);
      });
      if (!completed) {
        completed = true;
        dispatch({ type: 'request-next-scramble', event: state.players[0].event, preserveResults: true });
      }
      return;
    }
    if (effect.effect === 'hold-started') {
      clearHold(effect.playerId);
      holds.set(effect.playerId, setTimeout(() => {
        holds.delete(effect.playerId);
        playerTimer(effect.playerId, { type: 'hold-ready' });
      }, settings().holdMs));
    } else if (effect.effect === 'hold-cancelled' || effect.effect === 'run-started') clearHold(effect.playerId);
  }

  function dispatch(action: LocalBattleAction): boolean {
    if (disposed) return false;
    const transition = transitionLocalBattle(state, action, settings());
    if (!transition.accepted) return false;
    state = transition.state;
    if (action.type === 'next-round' || action.type === 'set-player-count'
      || action.type === 'request-next-scramble' && !action.preserveResults) newRound();
    transition.effects.forEach(processEffect);
    notify();
    return true;
  }

  function releaseTouch(playerId: number, touchId: number, cancelled: boolean) {
    if (touches.get(playerId) !== touchId) return false;
    touches.delete(playerId);
    return playerTimer(playerId, cancelled ? { type: 'cancel-press' } : { type: 'press-up', nowMs: now() });
  }

  function snapshot() {
    const current = now(), display = settings();
    const players = state.players.slice(0, state.playerCount).map(player => {
      const { phase, startedAtMs, lastMs, inspectionStartedAtMs, inspectionSec } = player.timer;
      const lastPenalty = !player.result ? null : player.penalty === 'dnf' ? 'DNF' : player.penalty;
      return { ...player, phase, display: formatTimerTimingDisplay({
        displayMs: phase === 'running' ? Math.max(0, current - (startedAtMs ?? current)) : lastMs ?? 0,
        inspectionDisplayMs: phase === 'inspecting' ? Math.max(0, current - (inspectionStartedAtMs ?? current)) : 0,
        inspectionLimitSec: inspectionSec ?? display.inspectionSec,
        lastPenalty, phase, timingEnabled: true, hideTime: display.hideTime,
        precision: display.precision, runningPrecision: display.runningPrecision ?? display.precision,
      }) };
    });
    return {
      playerCount: state.playerCount, event: players[0].event, scramble: players[0].scramble, scrambleRow,
      loading: !!request, scrambleFailed, storageError, completed, winners: [...winners], players,
      active: players.some(player => player.phase !== 'idle' && player.phase !== 'stopped'),
      rounds: [...rounds], summary: summarizeLocalBattleRounds(rounds, state.playerCount),
    };
  }

  void Promise.resolve().then(() => {
    if (state.players[0].scrambleRevision === 0) dispatch({ type: 'set-event', event: state.players[0].event });
  });

  return {
    snapshot,
    down(playerId: number, touchId = playerId) {
      if (touches.has(playerId) || [...touches.values()].includes(touchId)) return false;
      touches.set(playerId, touchId);
      const accepted = playerTimer(playerId, { type: 'press-down', nowMs: now() });
      if (!accepted) touches.delete(playerId);
      return accepted;
    },
    up: (playerId: number, touchId = playerId) => releaseTouch(playerId, touchId, false),
    cancel: (playerId: number, touchId = playerId) => releaseTouch(playerId, touchId, true),
    cancelTouches() {
      for (const [playerId, touchId] of touches) releaseTouch(playerId, touchId, true);
    },
    setEvent: (event: EventId) => dispatch({ type: 'set-event', event }),
    setPlayerCount(playerCount: number) {
      if (!dispatch({ type: 'set-player-count', playerCount })) return false;
      dispatch({ type: 'request-next-scramble', event: state.players[0].event });
      return true;
    },
    setPenalty: (playerId: number, penalty: LocalBattlePenalty) => dispatch({ type: 'set-penalty', playerId, penalty }),
    startAll: () => dispatch({ type: 'start-all', nowMs: now() }),
    next() {
      return completed && (request || state.players[0].scramble)
        ? dispatch({ type: 'reset-round' }) : dispatch({ type: 'next-round' });
    },
    retry: () => dispatch({ type: 'request-next-scramble', event: state.players[0].event, preserveResults: completed }),
    clearHistory() {
      if (disposed || snapshot().active) return false;
      writeHistory(async () => { await store.clear(); rounds = []; });
      return true;
    },
    flush: () => storageQueue,
    dispose() {
      disposed = true;
      request?.abort();
      request = undefined;
      for (const playerId of holds.keys()) clearHold(playerId);
      touches.clear();
    },
  };
}

export type NativeTimerLocalBattle = ReturnType<typeof createNativeTimerLocalBattle>;
