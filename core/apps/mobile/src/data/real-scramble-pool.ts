import {
  DEFAULT_SCRAMBLE_222_MODE,
  DEFAULT_SCRAMBLE_222_TYPE,
  WCA_SCRAMBLE_222_TYPES,
  compareTimerWcaCompetitionScrambleOrder,
  isCube222StateType,
  isTimerWcaScrambleEventId,
  isTimer222StepMetric,
  normalizeTimerByStepsSettings,
  normalizeTimerWcaSourceSettings,
  resolveTimerWcaSourceCore,
  timerWcaDifficultyFilter,
  timerWcaOptimalRequested,
  timerWcaRandomRequestQuery,
  timerWcaCompetitionScrambleSlotIdentity,
  timerWcaScrambleEventId,
  timerWcaSourceIdentity,
  timerByStepsFilter,
  timerByStepsIdentity,
  usesStepsIndex,
  type EventId,
  type Scramble222Mode,
  type Scramble222Type,
  type TimerWcaScrambleEventId,
  type TimerWcaSourceSettings,
  type TimerByStepsSettings,
  type Timer222StepMetric,
} from '@cuberoot/shared/timer';
import { cube222StateTypeMatchesScramble } from '@cuberoot/puzzle-solvers/cube222';
import { filterMobileCube222BySteps } from './cube222-step-filter';
import { filterMobileNon222BySteps } from './non222-steps-pool';
import {
  loadMobilePuzzleExamples,
  loadMobileWcaCompetitionScrambles,
  mobileApiUrl,
  mobileTimerWcaDifficultyAdapter,
} from './wca-source-adapter';

const API_RANDOM_PATH = '/v1/wca/scrambles/random';
const CACHE_PREFIX = 'cuberoot.mobile.real-scrambles';
const LEGACY_333_CACHE_KEY = 'cuberoot.mobile.real-scrambles.333.v1';
// v5 could only persist one row for repeated scramble text outside selected-
// competition mode. The lost official occurrences cannot be reconstructed
// from that envelope, so invalidate it instead of presenting an incomplete
// queue after an App upgrade.
const CACHE_VERSION = 6;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_CLOCK_SKEW_MS = 5 * 60 * 1000;
const CACHE_LIMIT = 50;
const MAX_SCRAMBLE_CHARS = 20_000;
const TYPE_FILTER_BATCHES = 30;
const TYPE_FILTER_BATCHES_WITH_PRECOMPUTED = 3;

function sampleWithoutReplacement<T>(items: readonly T[], limit: number): T[] {
  const pool = [...items];
  const picks = Math.min(limit, pool.length);
  for (let index = 0; index < picks; index++) {
    const remaining = pool.length - index;
    const offset = Math.floor(Math.random() * remaining);
    const selected = index + Math.min(remaining - 1, Math.max(0, offset));
    [pool[index], pool[selected]] = [pool[selected], pool[index]];
  }
  return pool.slice(0, picks);
}

export interface RealScrambleSourceSpec extends Partial<TimerWcaSourceSettings>, Partial<TimerByStepsSettings> {
  event: EventId;
  scramble222Mode?: Scramble222Mode;
  scramble222Type?: Scramble222Type;
}

interface NormalizedRealScrambleSourceSpec extends TimerWcaSourceSettings, TimerByStepsSettings {
  event: EventId;
  scramble222Mode?: Scramble222Mode;
  scramble222Type?: Scramble222Type;
}

export type RealScrambleSourceInput = EventId | RealScrambleSourceSpec;

/** Canonical identity for pools, in-flight requests, current rows and storage. */
export function normalizeRealScrambleSourceSpec(
  input: RealScrambleSourceInput,
): NormalizedRealScrambleSourceSpec {
  const spec = typeof input === 'string' ? { event: input } : input;
  const source = normalizeTimerWcaSourceSettings(spec);
  const bySteps = normalizeTimerByStepsSettings(spec.event, 'wca', {
    genByStepsOn: spec.genByStepsOn ?? false,
    genStepsMetric: spec.genStepsMetric ?? 'face',
    genSteps: spec.genSteps ?? [],
  });
  if (spec.event !== '222') return { event: spec.event, ...source, ...bySteps };
  const requestedType = spec.scramble222Type ?? DEFAULT_SCRAMBLE_222_TYPE;
  const normalizedType = WCA_SCRAMBLE_222_TYPES.includes(requestedType)
    ? requestedType
    : DEFAULT_SCRAMBLE_222_TYPE;
  return {
    event: '222',
    ...source,
    scramble222Mode: spec.scramble222Mode ?? DEFAULT_SCRAMBLE_222_MODE,
    // 3-gen describes a generation process and therefore has no WCA-state
    // filter. The website keeps the saved random preference but shows full.
    scramble222Type: normalizedType,
    ...(normalizedType === 'full' ? bySteps : {
      ...bySteps,
      genByStepsOn: false,
    }),
  };
}

export function realScrambleSourceKey(input: RealScrambleSourceInput): string {
  const spec = normalizeRealScrambleSourceSpec(input);
  const wcaEventId = timerWcaScrambleEventId(spec.event);
  const source = timerWcaSourceIdentity(spec.event, wcaEventId, spec, {
    competitionUnindexed: spec.wcaScrambleMode === 'comp' && !!spec.wcaComp && !!wcaEventId
      && mobileTimerWcaDifficultyAdapter.getCompetitionCoverage(spec.wcaComp, wcaEventId) === false,
    optimalOverride: spec.event === '222' ? spec.scramble222Mode === 'optimal' : undefined,
  });
  if (!source) {
    // Retained-Real for a non-WCA event delegates to that event's local
    // provider. Its identity must still include the exact local by-steps
    // selection so Ivy/Gear queues and stale-result guards cannot alias.
    const localBySteps = timerByStepsIdentity(spec.event, 'random', spec);
    return `unmapped|${spec.event}${localBySteps ? `|${localBySteps}` : ''}`;
  }
  const specialist = spec.event === '222'
    ? `|222:${spec.scramble222Mode}:${spec.scramble222Type}`
    : '';
  return `${source}${specialist}|${timerByStepsIdentity(spec.event, 'wca', spec)}`;
}

export type RealScrambleFetchFailureKind = 'confirmed-empty' | 'transient-error';

/**
 * Keeps an authoritative empty source distinct from transport/contract errors
 * so the shared retry coordinator can stop only for the former.
 */
export class RealScrambleFetchError extends Error {
  readonly kind: RealScrambleFetchFailureKind;

  constructor(kind: RealScrambleFetchFailureKind, message: string) {
    super(message);
    this.name = 'RealScrambleFetchError';
    this.kind = kind;
  }
}

export interface RealScramble {
  competitionId: string;
  competitionName: string;
  /** Exact event_id returned by the WCA-scramble API, not a Timer EventId alias. */
  eventId: TimerWcaScrambleEventId;
  groupId: string;
  roundTypeId: string;
  scramble: string;
  scrambleNumber: number;
  isExtra: boolean;
  /** Optimal was requested but this authoritative row had no equivalent text. */
  nonOptimal?: boolean;
}

function realScrambleOfficialSlotIdentity(item: RealScramble): string {
  return timerWcaCompetitionScrambleSlotIdentity(item);
}

/**
 * Keep official occurrences, not unique move strings. The same WCA scramble
 * text can legitimately occupy multiple competition/round/group/number slots.
 * If an endpoint or a precomputed index repeats one exact slot, retain its
 * first delivery so later duplicate pages cannot replace an already queued
 * occurrence with conflicting text or provenance.
 */
function uniqueRealScrambleOccurrences(
  items: readonly RealScramble[],
): RealScramble[] {
  const seen = new Set<string>();
  const unique: RealScramble[] = [];
  for (const item of items) {
    const identity = realScrambleOfficialSlotIdentity(item);
    if (seen.has(identity)) continue;
    seen.add(identity);
    unique.push(item);
  }
  return unique;
}

/**
 * Merge a refill without repeating the currently displayed row when another
 * true scramble is available. A one-row finite source must still loop instead
 * of reporting an error after a successful refill.
 */
export function mergeRealScramblePool(
  existing: readonly RealScramble[],
  incoming: readonly RealScramble[],
  current?: RealScramble,
  orderedCompetition = false,
): RealScramble[] {
  if (orderedCompetition) {
    const ordered = uniqueRealScrambleOccurrences(incoming);
    if (!current || ordered.length <= 1) return ordered;
    const currentIdentity = realScrambleOfficialSlotIdentity(current);
    const currentIndex = ordered.findIndex(
      (item) => realScrambleOfficialSlotIdentity(item) === currentIdentity,
    );
    if (currentIndex < 0) return ordered;
    return [...ordered.slice(currentIndex + 1), ...ordered.slice(0, currentIndex)];
  }
  const unique = uniqueRealScrambleOccurrences([...existing, ...incoming]);
  if (!current) return unique;
  const currentIdentity = realScrambleOfficialSlotIdentity(current);
  const withoutCurrent = unique.filter(
    (item) => realScrambleOfficialSlotIdentity(item) !== currentIdentity,
  );
  return withoutCurrent.length > 0 ? withoutCurrent : unique;
}

interface ApiScramble {
  scramble?: unknown;
  o?: unknown;
  ci?: unknown;
  cn?: unknown;
  e?: unknown;
  r?: unknown;
  g?: unknown;
  n?: unknown;
  x?: unknown;
}

interface CacheEnvelope {
  fetchedAt: number;
  sourceKey: string;
  timerEventId: EventId;
  wcaEventId: TimerWcaScrambleEventId;
  scrambles: RealScramble[];
}

interface LegacyCacheEnvelope {
  savedAt?: unknown;
  fetchedAt?: unknown;
  scrambles?: unknown;
}

function cacheKey(spec: RealScrambleSourceInput): string {
  return `${CACHE_PREFIX}.${realScrambleSourceKey(spec)}.v${CACHE_VERSION}`;
}

function normalizeScramble(value: string): string {
  return value.trim().replace(/[‘’ʼ′]/g, "'");
}

/**
 * Parse only rows for the exact requested WCA event. Scramble notation differs
 * across events (Square-1 tuples, Clock pins, MBLD multi-line groups, ...), so
 * the App deliberately does not reimplement a second notation parser here.
 * The canonical API owns syntax; this boundary validates shape and identity.
 */
function parseItem(
  value: ApiScramble,
  requestedEvent: TimerWcaScrambleEventId,
  useOptimal = false,
): RealScramble | null {
  const hasOptimal = typeof value.o === 'string' && value.o.trim().length > 0;
  const rawScramble = useOptimal && hasOptimal ? value.o : value.scramble;
  if (
    typeof rawScramble !== 'string'
    || typeof value.ci !== 'string'
    || !value.ci.trim()
    || value.e !== requestedEvent
    || typeof value.r !== 'string'
    || typeof value.g !== 'string'
    || typeof value.n !== 'number'
    || !Number.isInteger(value.n)
    || value.n < 1
  ) return null;
  const scramble = normalizeScramble(rawScramble);
  if (!scramble || scramble.length > MAX_SCRAMBLE_CHARS) return null;
  return {
    competitionId: value.ci.trim(),
    competitionName: typeof value.cn === 'string' && value.cn.trim() ? value.cn.trim() : value.ci.trim(),
    eventId: requestedEvent,
    groupId: value.g,
    roundTypeId: value.r,
    scramble,
    scrambleNumber: value.n,
    isExtra: value.x === 1 || value.x === true,
    ...(useOptimal && !hasOptimal ? { nonOptimal: true } : {}),
  };
}

async function fetchPrecomputed222Type(
  type: Exclude<Scramble222Type, 'full' | '3gen'>,
  useOptimal: boolean,
  fetcher: typeof fetch,
  signal?: AbortSignal,
): Promise<RealScramble[] | null> {
  try {
    const json = await loadMobilePuzzleExamples(fetcher, signal);
    const entry = json?.puzzles?.['222'];
    if (!entry || !entry.types || !Array.isArray(entry.types[type])) return [];
    const rows = entry.types[type]
      .map(([id, scramble, optimal]) => {
        const meta = entry.idMeta[id];
        if (!meta) return null;
        const [competitionId, eventId, scrambleNumber, roundTypeId, groupId, isExtra] = meta;
        if (eventId !== '222') return null;
        return parseItem({
          scramble,
          o: optimal,
          ci: competitionId,
          cn: entry.comps[competitionId]?.[0] ?? competitionId,
          e: eventId,
          r: roundTypeId,
          g: groupId,
          n: scrambleNumber,
          x: isExtra,
        }, '222', useOptimal);
      })
      .filter((item): item is RealScramble => item !== null)
      .filter((item) => cube222StateTypeMatchesScramble(item.scramble, type));
    return sampleWithoutReplacement(
      uniqueRealScrambleOccurrences(rows),
      CACHE_LIMIT,
    );
  } catch {
    // Static examples are an acceleration/rarity oracle. A failed download is
    // transient and must fall through to live sampling, never prove emptiness.
    return null;
  }
}

async function fetchPrecomputed222Steps(
  filter: { metric: Timer222StepMetric; lo: number; hi: number },
  useOptimal: boolean,
  fetcher: typeof fetch,
  signal: AbortSignal,
): Promise<RealScramble[] | null> {
  try {
    const json = await loadMobilePuzzleExamples(fetcher, signal);
    const entry = json?.puzzles?.['222'];
    const bins = entry?.metrics?.[filter.metric]?.bins
      ?? (filter.metric === 'htm' ? entry?.bins : undefined);
    if (!entry || !bins) return [];
    const samples = [];
    for (let value = filter.lo; value <= filter.hi; value++) {
      samples.push(...(bins[String(value)] ?? []));
    }
    const parsed = samples.map(([id, scramble, optimal]) => {
      const meta = entry.idMeta[id];
      if (!meta) return null;
      const [competitionId, eventId, scrambleNumber, roundTypeId, groupId, isExtra] = meta;
      if (eventId !== '222') return null;
      return parseItem({
        scramble,
        o: optimal,
        ci: competitionId,
        cn: entry.comps[competitionId]?.[0] ?? competitionId,
        e: eventId,
        r: roundTypeId,
        g: groupId,
        n: scrambleNumber,
        x: isExtra,
      }, '222', useOptimal);
    }).filter((item): item is RealScramble => item !== null);
    const measured = await filterMobileCube222BySteps(parsed, filter, signal);
    return sampleWithoutReplacement(
      uniqueRealScrambleOccurrences(measured),
      CACHE_LIMIT,
    );
  } catch (error) {
    if (signal.aborted) throw error;
    return null;
  }
}

async function applyLocalSourceFilters(
  spec: NormalizedRealScrambleSourceSpec,
  rows: readonly RealScramble[],
  typeFilter: Exclude<Scramble222Type, 'full' | '3gen'> | null,
  signal: AbortSignal,
): Promise<RealScramble[]> {
  const byType = typeFilter
    ? rows.filter((item) => cube222StateTypeMatchesScramble(item.scramble, typeFilter))
    : [...rows];
  if (typeFilter) return byType;
  const filter = timerByStepsFilter(spec.event, 'wca', spec);
  if (!filter) return byType;
  if (spec.event === '222' && isTimer222StepMetric(filter.metric)) {
    return filterMobileCube222BySteps(byType, {
      ...filter,
      metric: filter.metric,
    }, signal);
  }
  if (spec.event === 'pyra' || spec.event === 'skewb') {
    return filterMobileNon222BySteps(spec.event, byType, filter, signal);
  }
  return byType;
}

function cachedItem(
  value: unknown,
  requestedEvent: TimerWcaScrambleEventId,
  spec: NormalizedRealScrambleSourceSpec,
): RealScramble | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<RealScramble>;
  const parsed = parseItem({
    scramble: item.scramble,
    ci: item.competitionId,
    cn: item.competitionName,
    e: item.eventId,
    r: item.roundTypeId,
    g: item.groupId,
    n: item.scrambleNumber,
    x: item.isExtra,
  }, requestedEvent);
  if (!parsed) return null;
  if (item.nonOptimal === true) parsed.nonOptimal = true;
  return spec.event === '222'
    && spec.scramble222Type
    && isCube222StateType(spec.scramble222Type)
    && !cube222StateTypeMatchesScramble(parsed.scramble, spec.scramble222Type)
    ? null
    : parsed;
}

function rawCacheFor(
  storage: Pick<Storage, 'getItem'>,
  spec: NormalizedRealScrambleSourceSpec,
): string | null {
  const current = storage.getItem(cacheKey(spec));
  if (current) return current;
  // Event-only v2 caches cannot prove a 2x2 mode/type identity. Never migrate
  // them into a configured 2x2 pool; other events are safe to reuse once.
  if (spec.event !== '222' && !timerByStepsFilter(spec.event, 'wca', spec)) {
    const eventOnly = storage.getItem(`${CACHE_PREFIX}.${spec.event}.v2`);
    if (eventOnly) return eventOnly;
  }
  if (spec.event !== '333') return null;
  // One-time compatibility for installs that only had the original 333 cache.
  return storage.getItem(LEGACY_333_CACHE_KEY);
}

export function readRealScrambleCache(
  input: RealScrambleSourceInput,
  storage: Pick<Storage, 'getItem'> = localStorage,
  now = Date.now(),
): RealScramble[] {
  const spec = normalizeRealScrambleSourceSpec(input);
  const sourceKey = realScrambleSourceKey(spec);
  const wcaEventId = timerWcaScrambleEventId(spec.event);
  if (!wcaEventId) return [];
  try {
    const raw = rawCacheFor(storage, spec);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LegacyCacheEnvelope & { timerEventId?: unknown; wcaEventId?: unknown };
    const fetchedAt = typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : parsed.savedAt;
    if (
      typeof fetchedAt !== 'number'
      || !Number.isFinite(fetchedAt)
      || fetchedAt < 0
      || fetchedAt > now + MAX_CACHE_CLOCK_SKEW_MS
      || now - fetchedAt > CACHE_TTL_MS
      || !Array.isArray(parsed.scrambles)
      || ('sourceKey' in parsed && parsed.sourceKey !== sourceKey)
      || (parsed.timerEventId !== undefined && parsed.timerEventId !== spec.event)
      || (parsed.wcaEventId !== undefined && parsed.wcaEventId !== wcaEventId)
    ) return [];
    return uniqueRealScrambleOccurrences(parsed.scrambles
      .map((item) => cachedItem(item, wcaEventId, spec))
      .filter((item): item is RealScramble => item !== null))
      .slice(0, CACHE_LIMIT);
  } catch {
    return [];
  }
}

export function writeRealScrambleCache(
  input: RealScrambleSourceInput,
  scrambles: RealScramble[],
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  fetchedAt?: number,
): void {
  const spec = normalizeRealScrambleSourceSpec(input);
  const sourceKey = realScrambleSourceKey(spec);
  const wcaEventId = timerWcaScrambleEventId(spec.event);
  if (!wcaEventId) return;
  const valid = scrambles
    .map((item) => cachedItem(item, wcaEventId, spec))
    .filter((item): item is RealScramble => item !== null);
  const unique = uniqueRealScrambleOccurrences(valid)
    .slice(0, CACHE_LIMIT);
  const key = cacheKey(spec);
  try {
    let originalFetchedAt: number | undefined;
    if (fetchedAt === undefined) {
      const raw = storage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as LegacyCacheEnvelope;
        const timestamp = typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : parsed.savedAt;
        if (typeof timestamp === 'number') originalFetchedAt = timestamp;
      }
    }
    storage.setItem(key, JSON.stringify({
      fetchedAt: fetchedAt ?? originalFetchedAt ?? Date.now(),
      sourceKey,
      timerEventId: spec.event,
      wcaEventId,
      scrambles: unique,
    } satisfies CacheEnvelope));
  } catch {
    // Storage can be unavailable or full. The in-memory pool remains usable.
  }
}

export async function fetchRealScrambles(
  input: RealScrambleSourceInput,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
  examplesFetcher?: typeof fetch,
): Promise<RealScramble[]> {
  const spec = normalizeRealScrambleSourceSpec(input);
  const wcaEventId = timerWcaScrambleEventId(spec.event);
  if (!wcaEventId) {
    throw new Error(`real WCA scrambles unsupported for timer event ${spec.event}`);
  }
  const source = resolveTimerWcaSourceCore(spec);
  const requestedDifficulty = timerWcaDifficultyFilter(wcaEventId, spec);
  let competitionUnindexed = false;
  if (source.mode === 'comp'
    && source.comp
    && requestedDifficulty
    && usesStepsIndex(requestedDifficulty.variant)) {
    const cached = mobileTimerWcaDifficultyAdapter.getCompetitionCoverage(source.comp, wcaEventId);
    const coverage = cached ?? await mobileTimerWcaDifficultyAdapter.probeCompetitionCoverage(
      source.comp,
      source.compName,
      wcaEventId,
    );
    competitionUnindexed = coverage === false;
  }
  const difficulty = timerWcaDifficultyFilter(wcaEventId, spec, { competitionUnindexed });
  const useOptimal = timerWcaOptimalRequested(wcaEventId, spec, {
    competitionUnindexed,
    optimalOverride: spec.event === '222' ? spec.scramble222Mode === 'optimal' : undefined,
  });
  const typeFilter = spec.event === '222'
    && spec.scramble222Type
    && isCube222StateType(spec.scramble222Type)
    ? spec.scramble222Type
    : null;
  const rawStepFilter = spec.event === '222' && !typeFilter && spec.scramble222Type === 'full'
    ? timerByStepsFilter('222', 'wca', spec as TimerByStepsSettings)
    : null;
  const stepFilter = rawStepFilter && isTimer222StepMetric(rawStepFilter.metric)
    ? { ...rawStepFilter, metric: rawStepFilter.metric }
    : null;
  const requestSignal = signal ?? new AbortController().signal;

  if (source.mode === 'comp') {
    let parsedBeforeType: RealScramble[];
    let optimalUnavailable = false;
    if (difficulty) {
      const bins = [...new Set(difficulty.steps)].sort((left, right) => left - right);
      const results = await Promise.all(bins.map((bin) => (
        mobileTimerWcaDifficultyAdapter.fetchByDifficulty({
          bin,
          colors: difficulty.colors,
          event: difficulty.merged ? undefined : wcaEventId,
          names: source.compName ? [source.compName] : undefined,
          pageSize: 200,
          stage: difficulty.stage,
          variant: difficulty.variant,
        }, signal)
      )));
      if (results.every((result) => result === null)) {
        throw new RealScrambleFetchError(
          'transient-error',
          'competition difficulty request failed',
        );
      }
      const seen = new Set<string>();
      parsedBeforeType = [];
      for (const result of results) {
        for (const row of result?.scrambles ?? []) {
          if (row.ci !== source.comp
            || (source.round && row.r !== source.round)
            || (source.group && row.g !== source.group)
            || (!difficulty.merged && row.e !== wcaEventId)
            || (difficulty.merged && !isTimerWcaScrambleEventId(row.e))) continue;
          if (useOptimal && !row.o) {
            optimalUnavailable = true;
            continue;
          }
          const item = parseItem(row, row.e as TimerWcaScrambleEventId, useOptimal);
          if (!item) continue;
          const identity = realScrambleOfficialSlotIdentity(item);
          if (seen.has(identity)) continue;
          seen.add(identity);
          parsedBeforeType.push(item);
        }
      }
    } else {
      const rows = await loadMobileWcaCompetitionScrambles(source.comp, fetcher, signal);
      if (rows === null) {
        throw new RealScrambleFetchError(
          'transient-error',
          'competition scramble request failed',
        );
      }
      const matchingRows = rows.filter((row) => row.eventId === wcaEventId
        && (!source.round || row.roundTypeId === source.round)
        && (!source.group || row.groupId === source.group));
      if (matchingRows.length === 0) {
        throw new RealScrambleFetchError(
          'confirmed-empty',
          'competition has no matching real scrambles',
        );
      }
      optimalUnavailable = useOptimal && matchingRows.some((row) => !row.optimalScramble);
      parsedBeforeType = matchingRows
        .filter((row) => !useOptimal || !!row.optimalScramble)
        .map((row) => parseItem({
          scramble: row.scramble,
          o: row.optimalScramble,
          ci: source.comp,
          cn: source.compName || source.comp,
          e: row.eventId,
          r: row.roundTypeId,
          g: row.groupId,
          n: row.scrambleNumber,
          x: row.isExtra,
        }, wcaEventId, useOptimal))
        .filter((item): item is RealScramble => item !== null);
    }
    if (useOptimal && parsedBeforeType.length === 0 && optimalUnavailable) {
      throw new RealScrambleFetchError(
        'transient-error',
        'competition optimal scrambles are temporarily unavailable',
      );
    }
    const parsed = await applyLocalSourceFilters(spec, parsedBeforeType, typeFilter, requestSignal);
    const unique = uniqueRealScrambleOccurrences(parsed)
      .sort(compareTimerWcaCompetitionScrambleOrder);
    if (unique.length === 0) {
      throw new RealScrambleFetchError(
        'confirmed-empty',
        'competition has no matching real scrambles',
      );
    }
    // A selected competition is a finite ordered source, not a random page.
    // Keep the complete in-memory sequence; persistence remains separately
    // bounded by CACHE_LIMIT so a large competition cannot exhaust storage.
    return unique;
  }

  const query = timerWcaRandomRequestQuery(wcaEventId, spec, CACHE_LIMIT, {
    optimalOverride: spec.event === '222' ? spec.scramble222Mode === 'optimal' : undefined,
  });
  const localStepFilter = typeFilter ? null : timerByStepsFilter(spec.event, 'wca', spec);
  const precomputed = examplesFetcher && spec.event === '222' && !source.from && !source.to
    ? typeFilter
      ? await fetchPrecomputed222Type(typeFilter, useOptimal, examplesFetcher, signal)
      : stepFilter
        ? await fetchPrecomputed222Steps(stepFilter, useOptimal, examplesFetcher, requestSignal)
        : null
    : null;
  const seeded = precomputed ?? [];
  const batches = typeFilter || localStepFilter
    ? (seeded.length > 0 ? TYPE_FILTER_BATCHES_WITH_PRECOMPUTED : TYPE_FILTER_BATCHES)
    : 1;

  for (let batch = 0; batch < batches; batch++) {
    let response: Response;
    try {
      response = await fetcher(`${mobileApiUrl(API_RANDOM_PATH)}?${query.toString()}`, { signal });
    } catch (error) {
      if (seeded.length > 0) return seeded;
      throw error;
    }
    if (response.status === 404) {
      if (seeded.length > 0) return seeded;
      throw new RealScrambleFetchError('confirmed-empty', 'real scramble source is empty');
    }
    if (!response.ok) {
      if (seeded.length > 0) return seeded;
      throw new RealScrambleFetchError(
        'transient-error',
        `real scramble request failed (${response.status})`,
      );
    }
    const payload = await response.json() as { scrambles?: ApiScramble[] };
    if (!Array.isArray(payload.scrambles)) {
      if (seeded.length > 0) return seeded;
      throw new RealScrambleFetchError('transient-error', 'real scramble response is invalid');
    }
    if (payload.scrambles.length === 0) {
      if (seeded.length > 0) return seeded;
      throw new RealScrambleFetchError('confirmed-empty', 'real scramble source is empty');
    }
    const parsed = payload.scrambles
      .map((item) => {
        const rowEvent = difficulty?.merged && isTimerWcaScrambleEventId(item.e)
          ? item.e
          : wcaEventId;
        return parseItem(item, rowEvent, useOptimal);
      })
      .filter((item): item is RealScramble => item !== null);
    if (parsed.length === 0) {
      throw new RealScrambleFetchError(
        'transient-error',
        `real scramble response contains no valid ${wcaEventId} rows`,
      );
    }
    const matches = await applyLocalSourceFilters(spec, parsed, typeFilter, requestSignal);
    if (matches.length > 0) {
      // Live rows lead so a full static seed cannot starve freshly sampled
      // competition data from the bounded pool.
      return uniqueRealScrambleOccurrences([...matches, ...seeded])
        .slice(0, CACHE_LIMIT);
    }
  }
  if (seeded.length > 0) return seeded;
  throw new RealScrambleFetchError(
    'transient-error',
    'real scramble type was not found within the live sampling budget',
  );
}
