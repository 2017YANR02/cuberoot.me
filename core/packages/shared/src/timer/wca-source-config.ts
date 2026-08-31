import { roundChronologicalOrder } from '../wca_round';
import type { EventId } from './types';
import {
  DEFAULT_TIMER_WCA_DIFFICULTY_SETTINGS,
  normalizeTimerWcaDifficultySettings,
  timerWcaDifficultyFilter,
  timerWcaDifficultyIdentity,
  timerWcaSupportsOptimal,
  type TimerWcaDifficultySettings,
} from './wca-difficulty';
import { LENGTH_VARIANT } from './scramble-variants';

export const TIMER_WCA_MIN_DATE = '1982-06-05';

export type TimerWcaSourceMode = 'date' | 'comp';

/**
 * Runtime-neutral settings owned by the real-WCA scramble source.  The website
 * TimerSettings structurally satisfies this contract; native hosts persist the
 * same field names instead of translating to an App-only model.
 */
export interface TimerWcaSourceCoreSettings {
  wcaScrambleMode: TimerWcaSourceMode;
  wcaComp: string;
  wcaCompName: string;
  wcaCompCountry: string;
  wcaRound: string;
  wcaGroup: string;
  wcaDateFrom: string;
  wcaDateTo: string;
}

/** Complete Web source-config model, including the still-to-be-shared difficulty UI. */
export interface TimerWcaSourceSettings
  extends TimerWcaSourceCoreSettings, TimerWcaDifficultySettings {}

export const DEFAULT_TIMER_WCA_SOURCE_CORE_SETTINGS: TimerWcaSourceCoreSettings = {
  wcaScrambleMode: 'comp',
  wcaComp: '',
  wcaCompName: '',
  wcaCompCountry: '',
  wcaRound: '',
  wcaGroup: '',
  wcaDateFrom: '',
  wcaDateTo: '',
};

/** One persisted WCA-source default for every timer host. */
export const DEFAULT_TIMER_WCA_SOURCE_SETTINGS: TimerWcaSourceSettings = {
  ...DEFAULT_TIMER_WCA_SOURCE_CORE_SETTINGS,
  ...DEFAULT_TIMER_WCA_DIFFICULTY_SETTINGS,
};

export interface TimerWcaCompetition {
  id: string;
  name: string;
  /** Host-localized candidate name; may omit a year shown beside its date. */
  displayName?: string;
  /** Host-localized selected name; retains the year when no date is visible. */
  selectedDisplayName?: string;
  city?: string;
  displayCity?: string;
  country: string;
  startDate: string;
  endDate: string;
  /** Additional canonical aliases (for example the Chinese competition name). */
  searchAliases?: readonly string[];
}

export interface TimerWcaScrambleSourceRow {
  eventId: string;
  roundTypeId: string;
  groupId: string;
}

/** Strict runtime-neutral form of one row from the WCA competition-scramble API. */
export interface TimerWcaCompetitionScramble extends TimerWcaScrambleSourceRow {
  isExtra: boolean;
  optimalScramble: string | null;
  scramble: string;
  scrambleNumber: number;
}

/**
 * Decode an untrusted competition-scramble response once for every host.
 * `[]` is an authoritative empty competition. A non-array or any malformed row
 * is a transport/contract failure (`null`), never a misleading "no event".
 */
export function parseTimerWcaCompetitionScrambles(
  payload: unknown,
): TimerWcaCompetitionScramble[] | null {
  if (!Array.isArray(payload)) return null;
  const rows: TimerWcaCompetitionScramble[] = [];
  for (const value of payload) {
    if (!value || typeof value !== 'object') return null;
    const row = value as Record<string, unknown>;
    const eventId = typeof row.event_id === 'string' ? row.event_id : '';
    const roundTypeId = typeof row.round_type_id === 'string' ? row.round_type_id : '';
    const groupId = typeof row.group_id === 'string' ? row.group_id : '';
    const scramble = typeof row.scramble === 'string' ? row.scramble : '';
    const scrambleNumber = row.scramble_num;
    const extra = row.is_extra;
    const optimal = row.optimal_scramble;
    if (!eventId || !roundTypeId || !groupId || !scramble
      || typeof scrambleNumber !== 'number'
      || !Number.isInteger(scrambleNumber)
      || scrambleNumber < 1
      || ![true, false, 0, 1].includes(extra as boolean | number)
      || (optimal !== undefined && optimal !== null && typeof optimal !== 'string')) {
      return null;
    }
    rows.push({
      eventId,
      roundTypeId,
      groupId,
      isExtra: extra === true || extra === 1,
      scrambleNumber,
      scramble,
      optimalScramble: typeof optimal === 'string' ? optimal : null,
    });
  }
  return rows;
}

export interface ResolvedTimerWcaSourceCore {
  mode: TimerWcaSourceMode;
  comp: string;
  compName: string;
  compCountry: string;
  round: string;
  group: string;
  from: string;
  to: string;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isTimerIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day;
}

export function normalizeTimerWcaSourceCoreSettings(
  value: Partial<TimerWcaSourceCoreSettings> | null | undefined,
): TimerWcaSourceCoreSettings {
  const mode = value?.wcaScrambleMode === 'date' ? 'date' : 'comp';
  const from = isTimerIsoDate(value?.wcaDateFrom) ? value.wcaDateFrom : '';
  const to = isTimerIsoDate(value?.wcaDateTo) ? value.wcaDateTo : '';
  const orderedFrom = from && to && from > to ? to : from;
  const orderedTo = from && to && from > to ? from : to;
  return {
    wcaScrambleMode: mode,
    wcaComp: text(value?.wcaComp),
    wcaCompName: text(value?.wcaCompName),
    wcaCompCountry: text(value?.wcaCompCountry).toUpperCase(),
    wcaRound: text(value?.wcaRound),
    wcaGroup: text(value?.wcaGroup),
    wcaDateFrom: orderedFrom,
    wcaDateTo: orderedTo,
  };
}

/** Sanitize the complete source model at storage and host boundaries. */
export function normalizeTimerWcaSourceSettings(
  value: Partial<TimerWcaSourceSettings> | null | undefined,
): TimerWcaSourceSettings {
  return {
    ...normalizeTimerWcaSourceCoreSettings(value),
    ...normalizeTimerWcaDifficultySettings(value),
  };
}

/**
 * The Web product treats an unpicked competition as an all-history date source.
 * Keeping this resolution here prevents a native host from silently dropping to
 * generated scrambles while the visible source still says WCA.
 */
export function resolveTimerWcaSourceCore(
  settings: TimerWcaSourceCoreSettings,
): ResolvedTimerWcaSourceCore {
  const value = normalizeTimerWcaSourceCoreSettings(settings);
  const compMissing = value.wcaScrambleMode === 'comp' && !value.wcaComp;
  return {
    mode: compMissing ? 'date' : value.wcaScrambleMode,
    comp: value.wcaComp,
    compName: value.wcaCompName,
    compCountry: value.wcaCompCountry,
    round: compMissing ? '' : value.wcaRound,
    group: compMissing ? '' : value.wcaGroup,
    from: compMissing ? '' : value.wcaDateFrom,
    to: compMissing ? '' : value.wcaDateTo,
  };
}

/** Core identity used by Web/Mobile pools, cache, in-flight and stale-result guards. */
export function timerWcaSourceCoreIdentity(
  event: EventId,
  wcaEventId: string | null | undefined,
  settings: TimerWcaSourceCoreSettings,
): string | null {
  if (!wcaEventId) return null;
  const source = resolveTimerWcaSourceCore(settings);
  // Persistence restore can contain arbitrary strings. JSON keeps every field
  // boundary unambiguous, unlike delimiter joins (`A|B`,`C` vs `A`,`B|C`).
  return JSON.stringify(source.mode === 'comp'
    ? ['c', event, wcaEventId, source.comp, source.round, source.group]
    : ['d', event, wcaEventId, source.from, source.to]);
}

export function timerWcaRandomQuery(
  wcaEventId: string,
  settings: TimerWcaSourceCoreSettings,
  count: number,
): URLSearchParams {
  const source = resolveTimerWcaSourceCore(settings);
  const query = new URLSearchParams({ event: wcaEventId, count: String(count) });
  if (source.from) query.set('from', source.from);
  if (source.to) query.set('to', source.to);
  return query;
}

export interface TimerWcaResolvedFilterOptions {
  /** The selected competition is confirmed absent from the stage-step index. */
  competitionUnindexed?: boolean;
  /** Host-only conditional stages (currently second layer) must not filter real WCA rows. */
  suppressDifficulty?: boolean;
  /** 2x2 exposes original/optimal through its dedicated shared mode control. */
  optimalOverride?: boolean;
}

/**
 * Whether the row text should use the same-state optimal equivalent. Length
 * filtering deliberately suppresses this: its selected number describes the
 * original WCA scramble text, not the shortest equivalent state solution.
 */
export function timerWcaOptimalRequested(
  wcaEventId: string | null | undefined,
  rawSettings: TimerWcaDifficultySettings,
  options: TimerWcaResolvedFilterOptions = {},
): boolean {
  if (!timerWcaSupportsOptimal(wcaEventId)) return false;
  const settings = normalizeTimerWcaDifficultySettings(rawSettings);
  const requested = options.optimalOverride ?? settings.wcaUseOptimal;
  const difficulty = timerWcaDifficultyFilter(wcaEventId, settings, {
    competitionUnindexed: options.competitionUnindexed,
    suppress: options.suppressDifficulty,
  });
  return requested && difficulty?.variant !== LENGTH_VARIANT;
}

/** Full identity shared by queue, cache, in-flight and stale-result guards. */
export function timerWcaSourceIdentity(
  event: EventId,
  wcaEventId: string | null | undefined,
  settings: TimerWcaSourceSettings,
  options: TimerWcaResolvedFilterOptions = {},
): string | null {
  const core = timerWcaSourceCoreIdentity(event, wcaEventId, settings);
  if (!core) return null;
  return JSON.stringify([
    core,
    timerWcaOptimalRequested(wcaEventId, settings, options) ? 1 : 0,
    timerWcaDifficultyIdentity(wcaEventId, settings, {
      competitionUnindexed: options.competitionUnindexed,
      suppress: options.suppressDifficulty,
    }),
  ]);
}

/** Complete `/random` query; hosts only provide the URL and transport. */
export function timerWcaRandomRequestQuery(
  wcaEventId: string,
  rawSettings: TimerWcaSourceSettings,
  count: number,
  options: TimerWcaResolvedFilterOptions = {},
): URLSearchParams {
  const settings = normalizeTimerWcaSourceSettings(rawSettings);
  const query = timerWcaRandomQuery(wcaEventId, settings, count);
  if (timerWcaOptimalRequested(wcaEventId, settings, options)) query.set('optimal', '1');
  const difficulty = timerWcaDifficultyFilter(wcaEventId, settings, {
    competitionUnindexed: options.competitionUnindexed,
    suppress: options.suppressDifficulty,
  });
  if (difficulty) {
    query.set('variant', difficulty.variant);
    query.set('stage', difficulty.stage);
    query.set('colors', difficulty.colors);
    query.set('steps', difficulty.steps.join(','));
    if (difficulty.merged) query.set('family', '1');
  }
  return query;
}

/** Website Timer competition order: qualification/round 1 through finals. */
const TIMER_WCA_COMP_ROUND_ORDER: Readonly<Record<string, number>> = {
  '0': 0,
  h: 0,
  '1': 1,
  d: 1,
  '2': 2,
  e: 2,
  '3': 3,
  g: 3,
  b: 4,
  c: 4,
  f: 4,
};

export function timerWcaCompetitionRoundOrder(roundTypeId: string): number {
  return TIMER_WCA_COMP_ROUND_ORDER[roundTypeId] ?? Number.MAX_SAFE_INTEGER;
}

export function timerWcaGroupIndex(group: string): number {
  const letters = group.toUpperCase().replace(/[^A-Z]/g, '');
  if (!letters) return 0;
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return index - 1;
}

export interface TimerWcaCompetitionScrambleOrderRow {
  roundTypeId: string;
  groupId: string;
  isExtra: boolean;
  scrambleNumber: number;
}

export interface TimerWcaCompetitionScrambleSlot
  extends TimerWcaCompetitionScrambleOrderRow {
  competitionId: string;
  eventId: string;
}

/**
 * Stable identity of one official competition scramble slot.
 *
 * Scramble text is deliberately absent: two official slots can contain the
 * same moves and must still retain their own provenance and queue position.
 * JSON tuple encoding also keeps arbitrary restored field boundaries
 * unambiguous for Web and Mobile persistence adapters.
 */
export function timerWcaCompetitionScrambleSlotIdentity(
  row: TimerWcaCompetitionScrambleSlot,
): string {
  return JSON.stringify([
    row.competitionId,
    row.eventId,
    row.roundTypeId,
    row.groupId,
    row.isExtra ? 1 : 0,
    row.scrambleNumber,
  ]);
}

/** Canonical Web/Mobile ordering for all rows from one selected competition. */
export function compareTimerWcaCompetitionScrambleOrder(
  left: TimerWcaCompetitionScrambleOrderRow,
  right: TimerWcaCompetitionScrambleOrderRow,
): number {
  const round = timerWcaCompetitionRoundOrder(left.roundTypeId)
    - timerWcaCompetitionRoundOrder(right.roundTypeId);
  if (round !== 0) return round;
  const group = timerWcaGroupIndex(left.groupId) - timerWcaGroupIndex(right.groupId);
  if (group !== 0) return group;
  if (left.isExtra !== right.isExtra) return left.isExtra ? 1 : -1;
  return left.scrambleNumber - right.scrambleNumber;
}

export function timerWcaRoundGroupOptions(
  rows: readonly TimerWcaScrambleSourceRow[] | null,
  eventId: string | null | undefined,
  round: string,
): { rounds: string[]; groups: string[]; hasEvent: boolean | null } {
  if (rows === null || !eventId) return { rounds: [], groups: [], hasEvent: null };
  const eventRows = rows.filter((row) => row.eventId === eventId);
  const rounds = [...new Set(eventRows.map((row) => row.roundTypeId).filter(Boolean))]
    .sort((a, b) => roundChronologicalOrder(a) - roundChronologicalOrder(b));
  const groups = [...new Set(eventRows
    .filter((row) => !round || row.roundTypeId === round)
    .map((row) => row.groupId)
    .filter(Boolean))]
    .sort((a, b) => timerWcaGroupIndex(a) - timerWcaGroupIndex(b));
  return { rounds, groups, hasEvent: eventRows.length > 0 };
}

const TIMER_WCA_ROUND_SHORT: Readonly<Record<string, string>> = {
  '0': 'Q',
  '1': 'R1',
  '2': 'R2',
  '3': 'R3',
  b: 'BF',
  c: 'Fi',
  d: 'R1',
  e: 'R2',
  f: 'Fi',
  g: 'R3',
  h: 'Q',
};

export function timerWcaRoundShortLabel(roundTypeId: string): string {
  return TIMER_WCA_ROUND_SHORT[roundTypeId] ?? roundTypeId;
}

/** Compact real-scramble provenance used by every timer host: `Fi,A,2` / `Fi,A,E1`. */
export function timerWcaScrambleSourceLine(
  roundTypeId: string,
  groupId: string,
  scrambleNumber: number,
  isExtra = false,
): string {
  const tag = isExtra ? `E${scrambleNumber}` : String(scrambleNumber);
  return [timerWcaRoundShortLabel(roundTypeId), groupId, tag].filter(Boolean).join(',');
}

const TIMER_COMP_NAME_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  '锦标赛': ['championship'],
  '世锦赛': ['world', 'championship'],
  '中锦赛': ['china', 'championship'],
  '公开赛': ['open'],
  wc: ['world', 'championship'],
  '亚锦赛': ['asian', 'championship'],
  '亚洲锦标赛': ['asian', 'championship'],
  '非锦赛': ['african', 'championship'],
  '非洲锦标赛': ['african', 'championship'],
  '欧锦赛': ['european', 'championship'],
  '欧洲锦标赛': ['european', 'championship'],
  '北美锦标赛': ['north', 'american', 'championship'],
  '南美锦赛': ['south', 'american', 'championship'],
  '南美锦标赛': ['south', 'american', 'championship'],
  '大洋锦赛': ['oceanic', 'championship'],
  '大洋洲锦标赛': ['oceanic', 'championship'],
};

/** Shared deterministic competition search; hosts only load/localize the data. */
export function searchTimerWcaCompetitions(
  query: string,
  competitions: readonly TimerWcaCompetition[],
  limit = 20,
): TimerWcaCompetition[] {
  const raw = query.trim();
  const lowered = raw.toLowerCase();
  if (!lowered) return [];
  const tokens = lowered.split(/\s+/).filter(Boolean);
  const scored: Array<{ competition: TimerWcaCompetition; score: number }> = [];
  for (const competition of competitions) {
    const id = competition.id.toLowerCase();
    const canonicalName = competition.name.toLowerCase();
    const fields = [
      canonicalName,
      competition.displayName?.toLowerCase() ?? '',
      competition.selectedDisplayName?.toLowerCase() ?? '',
      competition.city?.toLowerCase() ?? '',
      competition.displayCity?.toLowerCase() ?? '',
      ...(competition.searchAliases ?? []).map((alias) => alias.toLowerCase()),
    ];
    const haystack = fields.join(' ');
    let score = 0;
    if (id === lowered) score = 1000;
    else if (id.startsWith(lowered)) score = 900;
    else if (canonicalName.startsWith(lowered)) score = 800;
    else if (id.includes(lowered)) score = 700;
    else if (tokens.every((token) => haystack.includes(token))) score = 500;
    else {
      const expanded = tokens.map((token) => (
        Object.entries(TIMER_COMP_NAME_SYNONYMS)
          .find(([name]) => name.includes(token))?.[1] ?? [token]
      ));
      if (expanded.every((parts) => parts.every((part) => haystack.includes(part)))) score = 500;
    }
    if (!score) continue;
    const dateBoost = competition.startDate
      ? Number(competition.startDate.replaceAll('-', '')) / 1e10
      : 0;
    scored.push({ competition, score: score + dateBoost });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((item) => item.competition);
}
