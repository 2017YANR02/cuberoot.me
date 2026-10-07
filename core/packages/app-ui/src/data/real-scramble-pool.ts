import { cube222StateTypeMatchesScramble } from '@cuberoot/puzzle-solvers/cube222';
import { createWcaScramblePool, type WcaSourceSpec, type WcaDispensedScramble } from '@cuberoot/timer-ui/wca-scramble-pool';
import {
  DEFAULT_SCRAMBLE_222_MODE,
  DEFAULT_SCRAMBLE_222_TYPE,
  WCA_SCRAMBLE_222_TYPES,
  compareTimerWcaCompetitionScrambleOrder,
  decodeTimerWcaCompetitionScrambleSlot,
  isCube222StateType,
  isTimerWcaScrambleEventId,
  normalizeTimerByStepsSettings,
  normalizeTimerWcaSourceSettings,
  resolveTimerWcaSourceCore,
  timerWcaDifficultyFilter,
  timerWcaOptimalRequested,
  timerWcaCompetitionScrambleSlotIdentity,
  timerWcaScrambleEventId,
  timerWcaSourceIdentity,
  timerByStepsFilter,
  timerByStepsIdentity,
  type EventId,
  type Scramble222Mode,
  type Scramble222Type,
  type TimerWcaScrambleEventId,
  type TimerWcaSourceSettings,
  type TimerByStepsSettings,
} from '@cuberoot/shared/timer';
import { filterMobileCube222BySteps } from './cube222-step-filter';
import {
  loadMobilePuzzleExamples,
  loadMobileWcaCompetitionScrambles,
  mobileApiUrl,
  mobileTimerWcaDifficultyAdapter,
} from './wca-source-adapter';

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

export function isAllTimeRealScrambleDateSource(input: RealScrambleSourceInput): boolean {
  const source = resolveTimerWcaSourceCore(normalizeRealScrambleSourceSpec(input));
  return source.mode === 'date' && !source.from && !source.to;
}

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
  if (typeof rawScramble !== 'string') return null;
  const isExtra = value.x === 1 || value.x === true
    ? true
    : value.x === 0 || value.x === false
      ? false
      : null;
  if (isExtra === null) return null;
  const slot = decodeTimerWcaCompetitionScrambleSlot({
    competitionId: value.ci,
    eventId: value.e,
    groupId: value.g,
    isExtra,
    roundTypeId: value.r,
    scrambleNumber: value.n,
  });
  if (!slot || slot.eventId !== requestedEvent) return null;
  const scramble = normalizeScramble(rawScramble);
  if (!scramble || scramble.length > MAX_SCRAMBLE_CHARS) return null;
  return {
    competitionId: slot.competitionId,
    competitionName: typeof value.cn === 'string' && value.cn.trim()
      ? value.cn.trim()
      : slot.competitionId,
    eventId: requestedEvent,
    groupId: slot.groupId,
    roundTypeId: slot.roundTypeId,
    scramble,
    scrambleNumber: slot.scrambleNumber,
    isExtra: slot.isExtra,
    ...(useOptimal && !hasOptimal ? { nonOptimal: true } : {}),
  };
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


/** Convert persisted App settings into the shared source request. */
export function realSpecToWcaSource(input: RealScrambleSourceInput): WcaSourceSpec {
  const spec = normalizeRealScrambleSourceSpec(input);
  const source = resolveTimerWcaSourceCore(spec);
  const wca = timerWcaScrambleEventId(spec.event);
  const difficulty = wca ? timerWcaDifficultyFilter(wca, spec) : null;
  return {
    event: spec.event, mode: source.mode, comp: source.comp, compName: source.compName,
    round: source.round, group: source.group, from: source.from, to: source.to,
    optimal: !!wca && timerWcaOptimalRequested(wca, spec, {
      optimalOverride: spec.event === '222' ? spec.scramble222Mode === 'optimal' : undefined }),
    diff: difficulty ?? undefined,
    stepFilter: timerByStepsFilter(spec.event, 'wca', spec) ?? undefined,
    typeFilter: spec.event === '222' && isCube222StateType(spec.scramble222Type ?? 'full') ? spec.scramble222Type as import('@cuberoot/puzzle-solvers/cube222').Cube222StateType : undefined,
  };
}
export function wcaRowToReal(row: WcaDispensedScramble): RealScramble {
  const m = row.meta;
  if (!m || !isTimerWcaScrambleEventId(m.e)) throw new Error('invalid official WCA row');
  return { scramble: row.scramble, competitionId: m.ci, competitionName: m.cn,
    eventId: m.e, roundTypeId: m.r, groupId: m.g, scrambleNumber: m.n, isExtra: m.x === 1,
    ...(m.nonOptimal ? { nonOptimal: true } : {}) };
}
export function createMobileWcaPool(fetcher?: typeof fetch, examplesFetcher: typeof fetch | undefined = (...args) => fetch(...args), persistent = true) {
  return createWcaScramblePool({
    apiUrl: mobileApiUrl, fetcher,
    difficulty: mobileTimerWcaDifficultyAdapter,
    loadCompetition: (id, signal) => loadMobileWcaCompetitionScrambles(id, fetcher ?? fetch, signal),
    loadExamples: signal => examplesFetcher ? loadMobilePuzzleExamples(examplesFetcher, signal) : Promise.resolve(null),
    filter222: filterMobileCube222BySteps,
    storage: () => persistent && typeof localStorage !== 'undefined' ? localStorage : null,
    storageKey: 'cuberoot.mobile.wca-pool.v1',
    restoreSource: persistent ? source => {
      if (typeof localStorage === 'undefined') return [];
      const rows = readRealScrambleCache({
        event: source.event, wcaScrambleMode: source.mode, wcaComp: source.comp,
        wcaCompName: source.compName, wcaRound: source.round, wcaGroup: source.group,
        wcaDateFrom: source.from, wcaDateTo: source.to, wcaUseOptimal: source.optimal,
        wcaDifficultyOn: !!source.diff, wcaDiffVariant: source.diff?.variant,
        wcaDiffStage: source.diff?.stage, wcaDiffColors: source.diff?.colors,
        wcaDiffSteps: source.diff?.steps, wcaDiffMerged: source.diff?.merged,
        scramble222Mode: source.optimal ? 'optimal' : 'wca', scramble222Type: source.typeFilter ?? 'full',
        genByStepsOn: !!source.stepFilter, genStepsMetric: source.stepFilter?.metric,
        genSteps: source.stepFilter ? [source.stepFilter.lo, source.stepFilter.hi] : [],
      });
      return rows.map(row => ({ scramble: row.scramble, slot: timerWcaCompetitionScrambleSlotIdentity(row),
        meta: { ci: row.competitionId, cn: row.competitionName, e: row.eventId, r: row.roundTypeId,
          g: row.groupId, n: row.scrambleNumber, x: row.isExtra ? 1 as const : 0 as const,
          ...(row.nonOptimal ? { nonOptimal: true } : {}) } }));
    } : undefined,
  });
}

/** Compatibility batch API for non-page callers; it uses the same pool engine. */
export async function fetchRealScrambles(
  input: RealScrambleSourceInput, fetcher: typeof fetch = fetch, signal?: AbortSignal,
  examplesFetcher?: typeof fetch, onClosedSet?: (rows: readonly RealScramble[]) => void,
): Promise<RealScramble[]> {
  const pool = createMobileWcaPool(fetcher, examplesFetcher ?? (async () => new Response(null, { status: 503 })), false);
  try {
    const spec = realSpecToWcaSource(input);
    if (!pool.hasWcaSource(spec)) throw new Error(`real WCA scrambles unsupported for timer event ${spec.event}`);
    const result = await pool.loadBatch(spec, signal);
    if (signal?.aborted) throw new DOMException('WCA request cancelled', 'AbortError');
    if (result.kind !== 'ready') throw new RealScrambleFetchError(result.kind, 'real scramble source unavailable');
    const rows = (spec.mode === 'comp' ? result.rows : result.rows.slice(0, 50)).map(wcaRowToReal);
    if (result.closed) onClosedSet?.(rows);
    return rows;
  } finally { pool.dispose(); }
}
