/** Runtime-neutral rules for the 2–4 player local timer. */

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
