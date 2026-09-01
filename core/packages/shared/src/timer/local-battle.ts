/** Runtime-neutral rules for the 2–4 player local timer. */

import {
  BATTLE_EVENT_IDS,
  type EventId,
  type Solve,
} from './types';
import { decodeTimerSolve } from './persistence';
import {
  initialTimerMachineState,
  transitionTimer,
  type SolveResult,
  type TimerMachineAction,
  type TimerMachineConfig,
  type TimerMachineEffect,
  type TimerMachineState,
} from './machine';

export const LOCAL_BATTLE_MIN_PLAYERS = 2;
export const LOCAL_BATTLE_MAX_PLAYERS = 4;
export const LOCAL_BATTLE_DEFAULT_PLAYER_KEYS = [' ', 'Enter', 'q', 'p'] as const;
export const LOCAL_BATTLE_KEYS_STORAGE_KEY = 'cuberoot_local_battle_keys_v1';
export const LOCAL_BATTLE_ROUNDS_STORAGE_KEY = 'cuberoot_local_battle_rounds_v1';

export type LocalBattlePenalty = 'ok' | '+2' | 'dnf';

export interface LocalBattleTimingState {
  isTiming: boolean;
  hasFinished: boolean;
}

export interface LocalBattleResultLike {
  time: number;
  penalty: LocalBattlePenalty;
}

export interface LocalBattlePlayerState {
  id: number;
  event: EventId;
  penalty: LocalBattlePenalty;
  result: SolveResult | null;
  scramble: string;
  scrambleRevision: number;
  timer: TimerMachineState;
}

export interface LocalBattleState {
  playerCount: number;
  players: LocalBattlePlayerState[];
}

export interface LocalBattleConfig extends TimerMachineConfig {}

export type LocalBattleAction =
  | { type: 'set-player-count'; playerCount: number }
  | { type: 'set-player-event'; playerId: number; event: EventId }
  | { type: 'request-next-scramble'; event: EventId }
  | { type: 'scramble-ready'; event: EventId; revision: number; scramble: string }
  | { type: 'scramble-failed'; event: EventId; revision: number }
  | { type: 'player-timer'; playerId: number; action: TimerMachineAction }
  | { type: 'start-all'; nowMs: number }
  | { type: 'set-penalty'; playerId: number; penalty: LocalBattlePenalty }
  | { type: 'next-round' };

export type LocalBattleEffect =
  | { type: 'player-timer'; playerId: number; effect: TimerMachineEffect }
  | { type: 'request-scramble'; event: EventId; revision: number }
  | { type: 'round-complete'; winners: number[] };

export interface LocalBattleTransition {
  state: LocalBattleState;
  effects: LocalBattleEffect[];
  accepted: boolean;
}

export interface LocalBattleAttempt {
  playerId: number;
  solve: Solve;
}

/** One indivisible local matchup; never reconstruct rounds by parallel array index. */
export interface LocalBattleRound {
  id: string;
  ts: number;
  attempts: LocalBattleAttempt[];
  winners: number[];
}

export interface LocalBattleRoundStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface LocalBattleRoundStore {
  clear(): Promise<void>;
  load(): Promise<LocalBattleRound[]>;
  save(rounds: readonly LocalBattleRound[]): Promise<void>;
}

export interface LocalBattleKeyStore {
  load(): Promise<string[]>;
  save(keys: readonly string[]): Promise<void>;
}

export interface LocalBattlePlayerSummary {
  attempts: number;
  bestMs: number | null;
  playerId: number;
  wins: number;
}

const LOCAL_BATTLE_EVENT_IDS = new Set<EventId>(BATTLE_EVENT_IDS);
const MAX_DATE_TIMESTAMP_MS = 8_640_000_000_000_000;
const DANGEROUS_IDS = new Set(['__proto__', 'constructor', 'prototype']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLocalBattleEvent(event: EventId): boolean {
  return LOCAL_BATTLE_EVENT_IDS.has(event);
}

function activeLocalBattlePlayer(player: LocalBattlePlayerState): boolean {
  return player.timer.phase === 'inspecting'
    || player.timer.phase === 'holding'
    || player.timer.phase === 'ready'
    || player.timer.phase === 'running';
}

function visiblePlayers(state: LocalBattleState): LocalBattlePlayerState[] {
  return state.players.slice(0, state.playerCount);
}

function nextScrambleRevision(players: readonly LocalBattlePlayerState[]): number {
  return Math.max(0, ...players.map((player) => player.scrambleRevision)) + 1;
}

function roundCompleteEffect(state: LocalBattleState): LocalBattleEffect[] {
  const players = visiblePlayers(state);
  if (players.length < LOCAL_BATTLE_MIN_PLAYERS || players.some((player) => player.result === null)) return [];
  return [{
    type: 'round-complete',
    winners: localBattleWinnerIndices(players.map((player) => ({
      time: player.result!.timeMs,
      penalty: player.penalty,
    }))),
  }];
}

function freshLocalBattlePlayer(id: number, event: EventId): LocalBattlePlayerState {
  return {
    id,
    event,
    penalty: 'ok',
    result: null,
    scramble: '',
    scrambleRevision: 0,
    timer: initialTimerMachineState(),
  };
}

export function createLocalBattleRound(
  state: LocalBattleState,
  roundId: string,
  timestamp: number,
): LocalBattleRound | null {
  if (!isSafeLocalBattleId(roundId)
    || !Number.isFinite(timestamp)
    || timestamp < 0
    || timestamp > MAX_DATE_TIMESTAMP_MS) return null;
  const players = visiblePlayers(state);
  if (players.length < LOCAL_BATTLE_MIN_PLAYERS || players.some((player) => !player.result)) return null;
  const attempts = players.map((player): LocalBattleAttempt => ({
    playerId: player.id,
    solve: {
      id: `${roundId}:${player.id}`,
      event: player.event,
      penalty: player.penalty === 'dnf' ? 'DNF' : player.penalty,
      scramble: player.scramble,
      timeMs: player.result!.timeMs,
      ts: timestamp,
    },
  }));
  const round: LocalBattleRound = { id: roundId, ts: timestamp, attempts, winners: [] };
  round.winners = localBattleRoundWinners(round);
  return round;
}

export function summarizeLocalBattleRounds(
  rounds: readonly LocalBattleRound[],
  playerCount = LOCAL_BATTLE_MAX_PLAYERS,
): LocalBattlePlayerSummary[] {
  return localBattlePlayerSlots(playerCount).map((playerId) => {
    const solves = rounds.flatMap((round) => (
      round.attempts.find((attempt) => attempt.playerId === playerId)?.solve ?? []
    ));
    const validTimes = solves.flatMap((solve) => {
      if (solve.penalty === 'DNF' || solve.penalty === 'DNS') return [];
      return [solve.timeMs + (solve.penalty === '+2' ? 2_000 : 0)];
    });
    return {
      attempts: solves.length,
      bestMs: validTimes.length > 0 ? Math.min(...validTimes) : null,
      playerId,
      wins: rounds.filter((round) => round.winners.includes(playerId)).length,
    };
  });
}

export function createLocalBattleRoundStore(
  storage: LocalBattleRoundStorage,
): LocalBattleRoundStore {
  return {
    async load() {
      const raw = await storage.getItem(LOCAL_BATTLE_ROUNDS_STORAGE_KEY);
      if (!raw) return [];
      try {
        return decodeLocalBattleRounds(JSON.parse(raw)) ?? [];
      } catch {
        return [];
      }
    },
    async save(rounds) {
      const decoded = decodeLocalBattleRounds(rounds);
      if (!decoded) throw new Error('invalid local battle rounds');
      await storage.setItem(LOCAL_BATTLE_ROUNDS_STORAGE_KEY, JSON.stringify(decoded));
    },
    async clear() {
      await storage.removeItem(LOCAL_BATTLE_ROUNDS_STORAGE_KEY);
    },
  };
}

export function decodeLocalBattlePlayerKeys(value: unknown): string[] | null {
  if (!Array.isArray(value)
    || value.length !== LOCAL_BATTLE_MAX_PLAYERS
    || !value.every((key) => typeof key === 'string' && isLocalBattleAssignableKey(key))) {
    return null;
  }
  const normalized = value.map(normalizeLocalBattleKey);
  return new Set(normalized).size === normalized.length ? [...value] : null;
}

/** Versioned key bindings; the host injects local or native storage only. */
export function createLocalBattleKeyStore(storage: LocalBattleRoundStorage): LocalBattleKeyStore {
  return {
    async load() {
      const raw = await storage.getItem(LOCAL_BATTLE_KEYS_STORAGE_KEY);
      if (!raw) return [...LOCAL_BATTLE_DEFAULT_PLAYER_KEYS];
      try {
        return decodeLocalBattlePlayerKeys(JSON.parse(raw)) ?? [...LOCAL_BATTLE_DEFAULT_PLAYER_KEYS];
      } catch {
        return [...LOCAL_BATTLE_DEFAULT_PLAYER_KEYS];
      }
    },
    async save(keys) {
      const decoded = decodeLocalBattlePlayerKeys(keys);
      if (!decoded) throw new Error('invalid local battle keys');
      await storage.setItem(LOCAL_BATTLE_KEYS_STORAGE_KEY, JSON.stringify(decoded));
    },
  };
}

/** Pure initial state for every Web/App local multiplayer controller. */
export function initialLocalBattleState(
  playerCount = LOCAL_BATTLE_MIN_PLAYERS,
  event: EventId = '333',
): LocalBattleState {
  const safeEvent = isLocalBattleEvent(event) ? event : '333';
  return {
    playerCount: normalizeLocalBattlePlayerCount(playerCount),
    players: Array.from(
      { length: LOCAL_BATTLE_MAX_PLAYERS },
      (_, id) => freshLocalBattlePlayer(id, safeEvent),
    ),
  };
}

/**
 * One runtime-neutral transition for 2–4 player timing.
 *
 * It delegates every timing phase to transitionTimer(), rejects context
 * changes while any visible player is active, and revision-gates async
 * scrambles so an old provider response cannot overwrite a newer round.
 */
export function transitionLocalBattle(
  state: LocalBattleState,
  action: LocalBattleAction,
  config: LocalBattleConfig,
): LocalBattleTransition {
  const players = visiblePlayers(state);
  const contextLocked = players.some(activeLocalBattlePlayer);

  if (action.type === 'set-player-count') {
    if (contextLocked) return { state, effects: [], accepted: false };
    const playerCount = normalizeLocalBattlePlayerCount(action.playerCount);
    if (playerCount === state.playerCount) return { state, effects: [], accepted: false };
    if (playerCount < state.playerCount) {
      return { state: { ...state, playerCount }, effects: [], accepted: true };
    }

    const sources = new Map<EventId, LocalBattlePlayerState>();
    for (const player of players) {
      if (!sources.has(player.event)) sources.set(player.event, player);
    }
    const revisions = new Map<EventId, number>();
    let revision = nextScrambleRevision(state.players);
    const effects: LocalBattleEffect[] = [];
    const nextPlayers = state.players.map((player) => {
      if (player.id < state.playerCount || player.id >= playerCount) return player;
      const source = sources.get(player.event);
      if (source) {
        return {
          ...player,
          penalty: 'ok' as const,
          result: null,
          scramble: source.scramble,
          scrambleRevision: source.scrambleRevision,
          timer: initialTimerMachineState(),
        };
      }
      let eventRevision = revisions.get(player.event);
      if (eventRevision === undefined) {
        eventRevision = revision++;
        revisions.set(player.event, eventRevision);
        effects.push({ type: 'request-scramble', event: player.event, revision: eventRevision });
      }
      return {
        ...player,
        penalty: 'ok' as const,
        result: null,
        scramble: '',
        scrambleRevision: eventRevision,
        timer: initialTimerMachineState(),
      };
    });
    return { state: { ...state, playerCount, players: nextPlayers }, effects, accepted: true };
  }

  if (action.type === 'set-player-event') {
    if (contextLocked
      || !Number.isInteger(action.playerId)
      || action.playerId < 0
      || action.playerId >= state.playerCount
      || !isLocalBattleEvent(action.event)) {
      return { state, effects: [], accepted: false };
    }
    const current = state.players[action.playerId];
    if (current.event === action.event) return { state, effects: [], accepted: false };
    const shared = players.find((player) => player.id !== action.playerId && player.event === action.event);
    const revision = shared?.scrambleRevision ?? nextScrambleRevision(state.players);
    const nextPlayers = state.players.map((player) => player.id === action.playerId ? {
      ...player,
      event: action.event,
      penalty: 'ok' as const,
      result: null,
      scramble: shared?.scramble ?? '',
      scrambleRevision: revision,
      timer: initialTimerMachineState(),
    } : player);
    return {
      state: { ...state, players: nextPlayers },
      effects: shared ? [] : [{ type: 'request-scramble', event: action.event, revision }],
      accepted: true,
    };
  }

  if (action.type === 'request-next-scramble') {
    if (contextLocked || !isLocalBattleEvent(action.event)) {
      return { state, effects: [], accepted: false };
    }
    const targets = players.filter((player) => player.event === action.event);
    if (targets.length === 0) return { state, effects: [], accepted: false };
    const revision = nextScrambleRevision(state.players);
    const targetIds = new Set(targets.map((player) => player.id));
    return {
      state: {
        ...state,
        players: state.players.map((player) => targetIds.has(player.id) ? {
          ...player,
          penalty: 'ok',
          result: null,
          scramble: '',
          scrambleRevision: revision,
          timer: initialTimerMachineState(),
        } : player),
      },
      effects: [{ type: 'request-scramble', event: action.event, revision }],
      accepted: true,
    };
  }

  if (action.type === 'scramble-ready' || action.type === 'scramble-failed') {
    const targets = state.players.filter((player) => (
      player.event === action.event && player.scrambleRevision === action.revision
    ));
    if (targets.length === 0 || targets.some(activeLocalBattlePlayer)) {
      return { state, effects: [], accepted: false };
    }
    const targetIds = new Set(targets.map((player) => player.id));
    return {
      state: {
        ...state,
        players: state.players.map((player) => targetIds.has(player.id)
          ? { ...player, scramble: action.type === 'scramble-ready' ? action.scramble : '' }
          : player),
      },
      effects: [],
      accepted: true,
    };
  }

  if (action.type === 'player-timer') {
    if (!Number.isInteger(action.playerId)
      || action.playerId < 0
      || action.playerId >= state.playerCount) {
      return { state, effects: [], accepted: false };
    }
    const player = state.players[action.playerId];
    const startsOrRecordsAttempt = action.action.type === 'start-now'
      || action.action.type === 'start-from-cube'
      || action.action.type === 'stop-external'
      || (action.action.type === 'press-down' && player.timer.phase !== 'running');
    if (startsOrRecordsAttempt && (player.scramble.length === 0 || player.result !== null)) {
      return { state, effects: [], accepted: false };
    }
    const timerTransition = transitionTimer(player.timer, action.action, config);
    if (timerTransition.accepted === false
      || (timerTransition.state === player.timer && timerTransition.effects.length === 0)) {
      return { state, effects: [], accepted: false };
    }
    const penalty: LocalBattlePenalty = timerTransition.solve?.autoPenalty === 'DNF'
      ? 'dnf'
      : timerTransition.solve?.autoPenalty === '+2'
        ? '+2'
        : player.penalty;
    const nextState = {
      ...state,
      players: state.players.map((candidate) => candidate.id === action.playerId ? {
        ...candidate,
        penalty,
        result: timerTransition.solve ?? candidate.result,
        timer: timerTransition.state,
      } : candidate),
    };
    return {
      state: nextState,
      effects: [
        ...timerTransition.effects.map((effect): LocalBattleEffect => ({
          type: 'player-timer',
          playerId: action.playerId,
          effect,
        })),
        ...roundCompleteEffect(nextState),
      ],
      accepted: true,
    };
  }

  if (action.type === 'start-all') {
    const eligible = players.filter((player) => (
      player.result === null && player.timer.phase !== 'running' && player.scramble.length > 0
    ));
    if (eligible.length < LOCAL_BATTLE_MIN_PLAYERS) {
      return { state, effects: [], accepted: false };
    }
    const eligibleIds = new Set(eligible.map((player) => player.id));
    const effects: LocalBattleEffect[] = [];
    const nextPlayers = state.players.map((player) => {
      if (!eligibleIds.has(player.id)) return player;
      const transition = transitionTimer(player.timer, { type: 'start-now', nowMs: action.nowMs }, config);
      effects.push(...transition.effects.map((effect): LocalBattleEffect => ({
        type: 'player-timer',
        playerId: player.id,
        effect,
      })));
      return { ...player, timer: transition.state };
    });
    return { state: { ...state, players: nextPlayers }, effects, accepted: true };
  }

  if (action.type === 'set-penalty') {
    if (!Number.isInteger(action.playerId)
      || action.playerId < 0
      || action.playerId >= state.playerCount
      || state.players[action.playerId].result === null) {
      return { state, effects: [], accepted: false };
    }
    const nextState = {
      ...state,
      players: state.players.map((player) => player.id === action.playerId
        ? { ...player, penalty: action.penalty }
        : player),
    };
    return { state: nextState, effects: roundCompleteEffect(nextState), accepted: true };
  }

  if (contextLocked) return { state, effects: [], accepted: false };
  const events = [...new Set(players.map((player) => player.event))];
  let revision = nextScrambleRevision(state.players);
  const revisionByEvent = new Map(events.map((event) => [event, revision++]));
  const nextState = {
    ...state,
    players: state.players.map((player) => player.id < state.playerCount ? {
      ...player,
      penalty: 'ok' as const,
      result: null,
      scramble: '',
      scrambleRevision: revisionByEvent.get(player.event)!,
      timer: initialTimerMachineState(),
    } : player),
  };
  return {
    state: nextState,
    effects: events.map((event) => ({
      type: 'request-scramble',
      event,
      revision: revisionByEvent.get(event)!,
    })),
    accepted: true,
  };
}

function isSafeLocalBattleId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 512
    && !DANGEROUS_IDS.has(value);
}

function decodeLocalBattleSolve(value: unknown): Solve | null {
  if (!isRecord(value)
    || typeof value.event !== 'string'
    || !LOCAL_BATTLE_EVENT_IDS.has(value.event as EventId)) return null;
  const solve = decodeTimerSolve(value, value.event as EventId);
  return solve && solve.penalty !== 'DNS' ? solve : null;
}

export function decodeLocalBattleRounds(value: unknown): LocalBattleRound[] | null {
  if (!Array.isArray(value)) return null;
  const rounds: LocalBattleRound[] = [];
  const roundIds = new Set<string>();
  const solveIds = new Set<string>();
  for (const raw of value) {
    if (!isRecord(raw)
      || !isSafeLocalBattleId(raw.id)
      || roundIds.has(raw.id)
      || typeof raw.ts !== 'number'
      || !Number.isFinite(raw.ts)
      || raw.ts < 0
      || raw.ts > MAX_DATE_TIMESTAMP_MS
      || !Array.isArray(raw.attempts)
      || !Array.isArray(raw.winners)) return null;
    const attempts: LocalBattleAttempt[] = [];
    const playerIds = new Set<number>();
    for (const candidate of raw.attempts) {
      if (!isRecord(candidate)
        || !Number.isInteger(candidate.playerId)
        || (candidate.playerId as number) < 0
        || (candidate.playerId as number) >= LOCAL_BATTLE_MAX_PLAYERS
        || playerIds.has(candidate.playerId as number)) return null;
      const solve = decodeLocalBattleSolve(candidate.solve);
      if (!solve || solve.ts !== raw.ts || solveIds.has(solve.id)) return null;
      const playerId = candidate.playerId as number;
      playerIds.add(playerId);
      solveIds.add(solve.id);
      attempts.push({ playerId, solve });
    }
    if (attempts.length < LOCAL_BATTLE_MIN_PLAYERS
      || attempts.length > LOCAL_BATTLE_MAX_PLAYERS
      || attempts.some((attempt, index) => attempt.playerId !== index)
      || !raw.winners.every((winner) => Number.isInteger(winner))) return null;
    const round = { id: raw.id, ts: raw.ts, attempts, winners: [] as number[] };
    round.winners = localBattleRoundWinners(round);
    roundIds.add(raw.id);
    rounds.push(round);
  }
  return rounds;
}

export function localBattleRoundWinners(round: Pick<LocalBattleRound, 'attempts'>): number[] {
  const ranked = [...round.attempts].sort((a, b) => a.playerId - b.playerId);
  const winningPositions = localBattleWinnerIndices(ranked.map(({ solve }) => ({
    time: solve.timeMs,
    penalty:
      solve.penalty === 'DNF' || solve.penalty === 'DNS'
        ? 'dnf'
        : solve.penalty,
  })));
  return winningPositions.map((position) => ranked[position].playerId);
}

export function normalizeLocalBattlePlayerCount(value: number): number {
  if (!Number.isFinite(value)) return LOCAL_BATTLE_MIN_PLAYERS;
  return Math.max(
    LOCAL_BATTLE_MIN_PLAYERS,
    Math.min(LOCAL_BATTLE_MAX_PLAYERS, Math.trunc(value)),
  );
}

export function localBattlePlayerSlots(playerCount: number): number[] {
  return Array.from({ length: normalizeLocalBattlePlayerCount(playerCount) }, (_, index) => index);
}

/** Pass one shared smart cube to the next unfinished 3x3 player, wrapping once. */
export function nextLocalBattleCubeHolder(
  state: LocalBattleState,
  currentPlayerId: number,
): number | null {
  const players = visiblePlayers(state);
  for (let step = 1; step <= players.length; step++) {
    const candidate = players[(currentPlayerId + step) % players.length];
    if (candidate && candidate.event === '333' && candidate.result === null) return candidate.id;
  }
  return null;
}

function normalizeLocalBattleKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

export function isLocalBattleAssignableKey(key: string): boolean {
  return key.length > 0 && key.length <= 32
    && key !== 'Shift' && key !== 'Control' && key !== 'Alt' && key !== 'Meta';
}

export function localBattlePlayerForKey(playerKeys: readonly string[], key: string): number | undefined {
  const normalized = normalizeLocalBattleKey(key);
  const index = playerKeys.findIndex((candidate) => normalizeLocalBattleKey(candidate) === normalized);
  return index === -1 ? undefined : index;
}

/** Assign one key; a conflict swaps keys so no player silently loses their binding. */
export function assignLocalBattlePlayerKey(
  playerKeys: readonly string[],
  target: number,
  key: string,
): string[] {
  if (!Number.isInteger(target)
    || target < 0
    || target >= playerKeys.length
    || !isLocalBattleAssignableKey(key)) return [...playerKeys];
  const result = [...playerKeys];
  const normalized = normalizeLocalBattleKey(key);
  const conflict = result.findIndex((candidate, index) => (
    index !== target && normalizeLocalBattleKey(candidate) === normalized
  ));
  if (conflict !== -1) result[conflict] = result[target];
  result[target] = key;
  return result;
}

/**
 * A shared scramble remains visible until every unfinished member of its event group has started.
 * This prevents an early starter from hiding the scramble from a teammate who has not begun.
 */
export function isLocalBattleScrambleHidden(
  players: readonly LocalBattleTimingState[],
  playerIds: readonly number[],
): boolean {
  if (!playerIds.some((index) => players[index]?.isTiming)) return false;
  return !playerIds.some((index) => {
    const player = players[index];
    return player && !player.isTiming && !player.hasFinished;
  });
}

/** Stable event groups; same-event players request exactly one scramble. */
export function groupLocalBattlePlayersByEvent(
  events: readonly string[],
  playerIds: readonly number[],
): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const playerId of playerIds) {
    const event = events[playerId];
    if (typeof event !== 'string' || event.length === 0) continue;
    const group = groups.get(event);
    if (group) group.push(playerId);
    else groups.set(event, [playerId]);
  }
  return groups;
}

export function effectiveLocalBattleTime(result: LocalBattleResultLike): number {
  if (result.penalty === 'dnf') return Infinity;
  return result.penalty === '+2' ? result.time + 2_000 : result.time;
}

/** All-DNF has no winner; exact ties share the win. */
export function localBattleWinnerIndices(results: readonly LocalBattleResultLike[]): number[] {
  const times = results.map(effectiveLocalBattleTime);
  const best = Math.min(...times);
  if (!Number.isFinite(best)) return [];
  return times.flatMap((time, index) => (time === best ? [index] : []));
}
