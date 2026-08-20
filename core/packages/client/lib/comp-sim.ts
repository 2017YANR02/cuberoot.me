import {
  decodeTimerSolve,
  EVENTS,
  roundAttempts,
  type EventId,
  type RoundConfig,
  type RoundFormat,
  type RoundResult,
  type Solve,
} from '@cuberoot/shared/timer';
import { roundChronologicalOrder } from '@cuberoot/shared';
import type { CompWcifRound, RoundFormat as WcaRoundFormat } from './comp-wcif';
import type { WcaResultRow, WcaRound, WcaScrambleRow } from './wca-results-api';

export const SUPPORTED_COMP_SIM_EVENTS = new Set([
  '333', '222', '444', '555', '666', '777', '333oh',
  'clock', 'minx', 'pyram', 'skewb', 'sq1', 'fto',
]);

export interface PlayableScrambleGroup {
  groupId: string;
  scrambles: WcaScrambleRow[];
  extras: WcaScrambleRow[];
}

export interface CompSimLeaderboardRow {
  kind: 'official' | 'sim';
  rank: number;
  wcaId: string;
  name: string;
  countryIso2: string;
  attempts: number[];
  best: number;
  average: number;
  primary: number;
  bestIndex: number;
  worstIndex: number;
  xpr?: boolean;
  xprBest?: boolean;
  xprAverage?: boolean;
}

export interface MatchedPublishedRound {
  detail: CompWcifRound;
  officialRound: WcaRound;
}

export function hasCrossRoundCumulativeLimit(round: CompWcifRound): boolean {
  return round.cumulativeRoundIds.some((roundId) => roundId !== round.id);
}

/** Pairs each published result round with one WCIF rule, in full competition order. */
export function matchPublishedCompSimRounds(
  details: readonly CompWcifRound[],
  publishedRounds: readonly WcaRound[],
): MatchedPublishedRound[] | null {
  const ordered = publishedRounds.toSorted((a, b) => (
    roundChronologicalOrder(a.roundTypeId) - roundChronologicalOrder(b.roundTypeId)
  ));
  if (ordered.length > details.length) return null;
  const matched = ordered.map((officialRound, index) => ({
    detail: details[index],
    officialRound,
  }));
  if (matched.some(({ detail, officialRound }) => {
    const publishedFormat = officialRound.results[0]?.format_id;
    return !detail || (!!publishedFormat && publishedFormat !== detail.format);
  })) return null;
  return matched as MatchedPublishedRound[];
}

export const COMP_SIM_ACTIVE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableFiniteNumber(value: unknown): boolean {
  return value === null || isFiniteNumber(value);
}

function isValidAdvancement(value: unknown): boolean {
  return value === null || (isRecord(value)
    && ['ranking', 'percent', 'attemptResult'].includes(String(value.type))
    && isFiniteNumber(value.level));
}

function isValidRoundDetail(value: unknown): boolean {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || !['1', '2', '3', '5', 'a', 'm', 'h'].includes(String(value.format))
    || !isNullableFiniteNumber(value.timeLimitCs)
    || typeof value.cumulative !== 'boolean'
    || !Array.isArray(value.cumulativeRoundIds)
    || !value.cumulativeRoundIds.every((id) => typeof id === 'string')
    || !isValidAdvancement(value.advancementCondition)) return false;
  return value.cutoff === null || (isRecord(value.cutoff)
    && isFiniteNumber(value.cutoff.numberOfAttempts)
    && isFiniteNumber(value.cutoff.attemptResult));
}

function isValidRoundConfig(value: unknown): boolean {
  return isRecord(value)
    && value.on === true
    && ['bo1', 'bo2', 'bo3', 'bo5', 'ao5', 'mo3'].includes(String(value.format))
    && isNullableFiniteNumber(value.cutoffMs)
    && isFiniteNumber(value.cutoffAttempts)
    && isNullableFiniteNumber(value.limitMs)
    && typeof value.cumulative === 'boolean';
}

function isValidResultRow(value: unknown): boolean {
  return isRecord(value)
    && typeof value.wca_id === 'string'
    && typeof value.competition_id === 'string'
    && typeof value.event_id === 'string'
    && Array.isArray(value.attempts)
    && value.attempts.every(isFiniteNumber)
    && typeof value.round_type_id === 'string'
    && typeof value.format_id === 'string'
    && isFiniteNumber(value.best)
    && isFiniteNumber(value.average)
    && isFiniteNumber(value.pos);
}

function isValidScrambleRow(value: unknown): boolean {
  return isRecord(value)
    && typeof value.event_id === 'string'
    && typeof value.round_type_id === 'string'
    && typeof value.group_id === 'string'
    && typeof value.is_extra === 'boolean'
    && isFiniteNumber(value.scramble_num)
    && typeof value.scramble === 'string';
}

function isValidRoundBundle(value: unknown): boolean {
  return isRecord(value)
    && isValidRoundDetail(value.detail)
    && isValidRoundConfig(value.config)
    && typeof value.roundTypeId === 'string'
    && Array.isArray(value.officialRows)
    && value.officialRows.every(isValidResultRow)
    && isRecord(value.group)
    && typeof value.group.groupId === 'string'
    && Array.isArray(value.group.scrambles)
    && value.group.scrambles.length > 0
    && value.group.scrambles.every(isValidScrambleRow)
    && Array.isArray(value.group.extras)
    && value.group.extras.every(isValidScrambleRow);
}

function isValidSolve(value: unknown): boolean {
  if (!isRecord(value) || typeof value.event !== 'string') return false;
  const event = value.event as EventId;
  if (!EVENTS.some((item) => item.id === event)) return false;
  return decodeTimerSolve(value, event) !== null;
}

/** Strictly guards the persisted simulator snapshot before React consumes it. */
export function isValidCompSimActiveSnapshot(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const options = value.options;
  if (value.version !== COMP_SIM_ACTIVE_VERSION
    || typeof value.wcaId !== 'string'
    || !isRecord(value.competition)
    || typeof value.competition.id !== 'string'
    || typeof value.competition.name !== 'string'
    || typeof value.competition.country !== 'string'
    || typeof value.competition.start_date !== 'string'
    || typeof value.competition.end_date !== 'string'
    || typeof value.eventId !== 'string'
    || !isRecord(options)
    || !['inspectionVoice', 'ambiance', 'distractions', 'announcements', 'duplicateScrambles', 'visuals', 'stationary']
      .every((key) => typeof options[key] === 'boolean')
    || !Number.isInteger(options.maxWaitMinutes)
    || (options.maxWaitMinutes as number) < 1
    || (options.maxWaitMinutes as number) > 15
    || !Array.isArray(value.rounds)
    || value.rounds.length === 0
    || !value.rounds.every(isValidRoundBundle)
    || !Number.isInteger(value.roundIndex)
    || (value.roundIndex as number) < 0
    || (value.roundIndex as number) >= value.rounds.length
    || !Array.isArray(value.solves)
    || !value.solves.every(isValidSolve)
    || typeof value.currentScramble !== 'string'
    || !Number.isInteger(value.usedExtras)
    || (value.usedExtras as number) < 0
    || !Number.isInteger(value.tableNumber)
    || (value.tableNumber as number) < 1
    || (value.tableNumber as number) > 10
    || !['waiting', 'called', 'ready', 'entry', 'results'].includes(String(value.stage))
    || !isNullableFiniteNumber(value.callupAt)
    || !isNullableFiniteNumber(value.inspectionStartedAt)
    || !isRecord(value.personalRecords)
    || !isNullableFiniteNumber(value.personalRecords.single)
    || !isNullableFiniteNumber(value.personalRecords.average)) return false;
  const voice = value.inspectionVoice;
  if (voice !== null && (!isRecord(voice) || typeof voice.eight !== 'string' || typeof voice.twelve !== 'string')) return false;
  const video = value.crowdVideo;
  return video === null || (isRecord(video)
    && typeof video.src === 'string'
    && (video.poster === undefined || typeof video.poster === 'string'));
}

export function wcaFormatToRoundFormat(format: WcaRoundFormat): RoundFormat | null {
  if (format === '1') return 'bo1';
  if (format === '2') return 'bo2';
  if (format === '3') return 'bo3';
  if (format === '5') return 'bo5';
  if (format === 'a') return 'ao5';
  if (format === 'm') return 'mo3';
  return null;
}

export function roundConfigFromWcif(round: CompWcifRound): RoundConfig | null {
  const format = wcaFormatToRoundFormat(round.format);
  if (!format) return null;
  return {
    on: true,
    format,
    cutoffMs: round.cutoff ? round.cutoff.attemptResult * 10 : null,
    cutoffAttempts: round.cutoff?.numberOfAttempts ?? 0,
    limitMs: round.timeLimitCs === null ? null : round.timeLimitCs * 10,
    cumulative: round.cumulative,
  };
}

export function selectPlayableScrambleGroup(
  rows: readonly WcaScrambleRow[],
  eventId: string,
  roundTypeId: string,
  attempts: number,
  random: () => number = Math.random,
): PlayableScrambleGroup | null {
  const groups = new Map<string, { regular: WcaScrambleRow[]; extras: WcaScrambleRow[] }>();
  for (const row of rows) {
    if (row.event_id !== eventId || row.round_type_id !== roundTypeId || !row.group_id) continue;
    const group = groups.get(row.group_id) ?? { regular: [], extras: [] };
    (row.is_extra ? group.extras : group.regular).push(row);
    groups.set(row.group_id, group);
  }
  const playable = [...groups.entries()]
    .map(([groupId, group]) => ({
      groupId,
      scrambles: group.regular.toSorted((a, b) => a.scramble_num - b.scramble_num),
      extras: group.extras.toSorted((a, b) => a.scramble_num - b.scramble_num),
    }))
    .filter((group) => group.scrambles.length >= attempts && group.scrambles.slice(0, attempts).every((row) => row.scramble.trim()));
  if (playable.length === 0) return null;
  const index = Math.min(playable.length - 1, Math.floor(random() * playable.length));
  const chosen = playable[index];
  return { ...chosen, scrambles: chosen.scrambles.slice(0, attempts) };
}

export function callupDelayMs(maxWaitMinutes: number, random: () => number = Math.random): number {
  const safeMinutes = Math.min(15, Math.max(1, Math.floor(maxWaitMinutes)));
  const maximumSeconds = safeMinutes * 60;
  const minimumSeconds = Math.max(10, Math.min(120, Math.floor(maximumSeconds / 3)));
  return Math.round((minimumSeconds + random() * (maximumSeconds - minimumSeconds)) * 1000);
}

export function shouldDuplicateScramble(
  enabled: boolean,
  attemptIndex: number,
  random: () => number = Math.random,
): boolean {
  return enabled && attemptIndex > 0 && random() < 0.05;
}

export function makeCompSimSolve(
  event: Solve['event'],
  scramble: string,
  timeMs: number,
  penalty: Solve['penalty'],
  now = Date.now(),
): Solve {
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
    timeMs,
    penalty,
    scramble,
    event,
    ts: now,
  };
}

function resultToCs(valueMs: number | null): number {
  if (valueMs === null) return 0;
  if (!Number.isFinite(valueMs)) return -1;
  return Math.floor(valueMs / 10);
}

function droppedIndexes(values: readonly number[]): { bestIndex: number; worstIndex: number } {
  if (values.length < 5) return { bestIndex: -1, worstIndex: -1 };
  let bestIndex = 0;
  let worstIndex = 0;
  for (let index = 1; index < values.length; index++) {
    if (values[index] < values[bestIndex]) bestIndex = index;
    if (values[index] >= values[worstIndex]) worstIndex = index;
  }
  return { bestIndex, worstIndex };
}

function officialDroppedIndexes(row: WcaResultRow, format: RoundFormat): { bestIndex: number; worstIndex: number } {
  if (format !== 'ao5' || row.attempts.length < 5 || row.attempts.some((value) => value === 0)) {
    return { bestIndex: -1, worstIndex: -1 };
  }
  return droppedIndexes(row.attempts.map((value) => (
    value > 0 ? value : Number.POSITIVE_INFINITY
  )));
}

function primaryValue(row: Pick<CompSimLeaderboardRow, 'average' | 'best'>, format: RoundFormat): number {
  return format === 'ao5' || format === 'mo3' ? row.average : row.best;
}

function rankingKey(
  row: Pick<CompSimLeaderboardRow, 'average' | 'best'>,
  format: RoundFormat,
): readonly [tier: number, value: number, best: number] {
  if (format === 'ao5' || format === 'mo3') {
    if (row.average > 0) return [0, row.average, row.best > 0 ? row.best : Number.POSITIVE_INFINITY];
    if (row.average === 0 && row.best > 0) return [1, row.best, row.best];
    return [2, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  }
  if (row.best > 0) return [0, row.best, row.best];
  return [1, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
}

function compareRanking(
  a: Pick<CompSimLeaderboardRow, 'average' | 'best'>,
  b: Pick<CompSimLeaderboardRow, 'average' | 'best'>,
  format: RoundFormat,
): number {
  const [aTier, aValue, aBest] = rankingKey(a, format);
  const [bTier, bValue, bBest] = rankingKey(b, format);
  return aTier - bTier || aValue - bValue || aBest - bBest;
}

export function buildCompSimLeaderboard(args: {
  officialRows: readonly WcaResultRow[];
  result: RoundResult;
  sim: { wcaId: string; name: string; countryIso2: string };
  personalRecords: { single: number | null; average: number | null };
}): CompSimLeaderboardRow[] {
  const format = args.result.format;
  const official = args.officialRows
    .filter((row) => row.wca_id !== args.sim.wcaId)
    .map<CompSimLeaderboardRow>((row) => {
      const dropped = officialDroppedIndexes(row, format);
      return {
        kind: 'official',
        rank: row.pos,
        wcaId: row.wca_id,
        name: row.name || row.wca_id,
        countryIso2: row.country_iso2 || '',
        attempts: row.attempts,
        best: row.best,
        average: row.average,
        primary: primaryValue({ best: row.best, average: row.average }, format),
        bestIndex: row.best_index ?? dropped.bestIndex,
        worstIndex: row.worst_index ?? dropped.worstIndex,
      };
    });
  const attemptValues = args.result.list.map((attempt) => {
    if (attempt.state === 'dns') return -2;
    if (attempt.state === 'pending' || attempt.state === 'ineligible') return 0;
    return resultToCs(attempt.ms);
  });
  const dropped = (format === 'ao5' && args.result.list.every((attempt) => (
    attempt.state === 'done' || attempt.state === 'dns'
  )))
    ? droppedIndexes(args.result.list.map((attempt) => attempt.ms ?? Number.POSITIVE_INFINITY))
    : { bestIndex: -1, worstIndex: -1 };
  const simBest = resultToCs(args.result.best);
  const simAverage = format === 'ao5' || format === 'mo3' ? resultToCs(args.result.official) : 0;
  const simPrimary = primaryValue({ best: simBest, average: simAverage }, format);
  const xprBest = simBest > 0 && args.personalRecords.single !== null && simBest < args.personalRecords.single;
  const xprAverage = simAverage > 0 && args.personalRecords.average !== null && simAverage < args.personalRecords.average;
  const sim: CompSimLeaderboardRow = {
    kind: 'sim',
    rank: 0,
    wcaId: args.sim.wcaId,
    name: args.sim.name,
    countryIso2: args.sim.countryIso2,
    attempts: attemptValues,
    best: simBest,
    average: simAverage,
    primary: simPrimary,
    bestIndex: dropped.bestIndex,
    worstIndex: dropped.worstIndex,
    xpr: format === 'ao5' || format === 'mo3' ? xprAverage : xprBest,
    xprBest,
    xprAverage,
  };
  const rows = [...official, sim].toSorted((a, b) => compareRanking(a, b, format));
  let previous: CompSimLeaderboardRow | null = null;
  let rank = 0;
  return rows.map((row, index) => {
    if (!previous || compareRanking(previous, row, format) !== 0) rank = index + 1;
    previous = row;
    return { ...row, rank };
  });
}

export function advancesFromRound(
  row: CompSimLeaderboardRow,
  condition: CompWcifRound['advancementCondition'],
  officialCompetitorCount: number,
): boolean {
  if (!condition) return false;
  if (condition.type === 'ranking') return row.rank <= condition.level;
  if (condition.type === 'percent') {
    return row.rank <= Math.ceil(officialCompetitorCount * condition.level / 100);
  }
  return row.primary > 0 && row.primary < condition.level;
}

/** Keeps the historical next-round field, minus competitors displaced by the simulated result. */
export function filterNextRoundOfficialRows(
  nextRoundRows: readonly WcaResultRow[],
  currentLeaderboard: readonly CompSimLeaderboardRow[],
  condition: CompWcifRound['advancementCondition'],
): WcaResultRow[] {
  const qualified = new Set(currentLeaderboard
    .filter((row) => advancesFromRound(row, condition, currentLeaderboard.length))
    .map((row) => row.wcaId));
  return nextRoundRows.filter((row) => qualified.has(row.wca_id));
}

export function expectedAttemptCount(format: WcaRoundFormat): number | null {
  const mapped = wcaFormatToRoundFormat(format);
  return mapped ? roundAttempts(mapped) : null;
}
