/** Runtime-neutral rules for the 2–4 player local timer. */

import {
  BATTLE_EVENT_IDS,
  type EventId,
  type Solve,
} from './types';
import { decodeTimerSolve } from './persistence';

export const LOCAL_BATTLE_MIN_PLAYERS = 2;
export const LOCAL_BATTLE_MAX_PLAYERS = 4;

export type LocalBattlePenalty = 'ok' | '+2' | 'dnf';

export interface LocalBattleTimingState {
  isTiming: boolean;
  hasFinished: boolean;
}

export interface LocalBattleResultLike {
  time: number;
  penalty: LocalBattlePenalty;
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

const LOCAL_BATTLE_EVENT_IDS = new Set<EventId>(BATTLE_EVENT_IDS);
const MAX_DATE_TIMESTAMP_MS = 8_640_000_000_000_000;
const DANGEROUS_IDS = new Set(['__proto__', 'constructor', 'prototype']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function normalizeLocalBattleKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
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
  if (!Number.isInteger(target) || target < 0 || target >= playerKeys.length) return [...playerKeys];
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
