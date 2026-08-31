import {
  parseTimerWcaByDifficultyResult,
  timerWcaByDifficultyQuery,
  type TimerWcaByDifficultyRequest,
  type TimerWcaByDifficultyResult,
  type TimerWcaDifficultyCatalog,
  type TimerWcaDifficultyDistribution,
  type TimerWcaDifficultyStepsLayout,
  type TimerWcaEventLengths,
} from './wca-difficulty';

export interface TimerWcaHttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type TimerWcaHttpFetch = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<TimerWcaHttpResponse>;

export interface TimerWcaDifficultyDataAdapter {
  /** Invalid/unpublished resources resolve to null; callers use static variant definitions. */
  loadCatalog(): Promise<TimerWcaDifficultyCatalog>;
  loadDistribution(): Promise<TimerWcaDifficultyDistribution | null>;
  loadEventLengths(): Promise<TimerWcaEventLengths | null>;
  loadLayout(): Promise<TimerWcaDifficultyStepsLayout | null>;
  fetchByDifficulty(
    request: TimerWcaByDifficultyRequest,
    signal?: AbortSignal,
  ): Promise<TimerWcaByDifficultyResult | null>;
  getCompetitionCoverage(competitionId: string, wcaEventId: string): boolean | null;
  probeCompetitionCoverage(
    competitionId: string,
    competitionName: string,
    wcaEventId: string,
  ): Promise<boolean | null>;
}

export interface TimerWcaDifficultyDataAdapterOptions {
  apiUrl(path: string): string;
  fetcher: TimerWcaHttpFetch;
  statsUrl(path: string): string;
}

type CatalogPart = 'distribution' | 'eventLengths' | 'layout';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseDistribution(value: unknown): TimerWcaDifficultyDistribution | null {
  return isRecord(value) && isRecord(value.sets)
    ? value as unknown as TimerWcaDifficultyDistribution
    : null;
}

function parseEventLengths(value: unknown): TimerWcaEventLengths | null {
  return isRecord(value) && isRecord(value.events)
    ? value as unknown as TimerWcaEventLengths
    : null;
}

function parseLayout(value: unknown): TimerWcaDifficultyStepsLayout | null {
  return isRecord(value) && isRecord(value.variants)
    ? value as unknown as TimerWcaDifficultyStepsLayout
    : null;
}

const CATALOG_PATHS: Readonly<Record<CatalogPart, string>> = {
  distribution: '/stats/scramble/distribution.json',
  eventLengths: '/stats/scramble/event_lengths.json',
  layout: '/stats/scramble/steps/steps_layout.json',
};

const COVERAGE_VARIANT = 'std';
const COVERAGE_STAGE = 'cross';
const COVERAGE_COLORS = 'BGORWY';

/**
 * Shared transport/cache contract for Web and native hosts. In particular an
 * unpublished `steps_layout.json` (currently a normal 404) is cached as null:
 * it activates the static scramble-variant fallback and never becomes a fake
 * loading/error state. Network and malformed responses stay retryable.
 */
export function createTimerWcaDifficultyDataAdapter(
  options: TimerWcaDifficultyDataAdapterOptions,
): TimerWcaDifficultyDataAdapter {
  const cache = new Map<CatalogPart, unknown>();
  const inflight = new Map<CatalogPart, Promise<unknown>>();
  const coverage = new Map<string, boolean>();
  const coverageInflight = new Map<string, Promise<boolean | null>>();

  async function loadPart<T>(
    part: CatalogPart,
    parse: (value: unknown) => T | null,
  ): Promise<T | null> {
    if (cache.has(part)) return cache.get(part) as T | null;
    const pending = inflight.get(part);
    if (pending) return pending as Promise<T | null>;
    let request!: Promise<T | null>;
    request = options.fetcher(options.statsUrl(CATALOG_PATHS[part]))
      .then(async (response) => {
        // A missing optional catalog is authoritative for this deployment and
        // shares the static fallback. Other failures remain retryable.
        if (response.status === 404) {
          cache.set(part, null);
          return null;
        }
        if (!response.ok) return null;
        const parsed = parse(await response.json());
        if (parsed) cache.set(part, parsed);
        return parsed;
      })
      .catch(() => null)
      .finally(() => {
        if (inflight.get(part) === request) inflight.delete(part);
      });
    inflight.set(part, request);
    return request;
  }

  const loadDistribution = () => loadPart('distribution', parseDistribution);
  const loadEventLengths = () => loadPart('eventLengths', parseEventLengths);
  const loadLayout = () => loadPart('layout', parseLayout);

  async function fetchByDifficulty(
    request: TimerWcaByDifficultyRequest,
    signal?: AbortSignal,
  ): Promise<TimerWcaByDifficultyResult | null> {
    try {
      const query = timerWcaByDifficultyQuery(request);
      const response = await options.fetcher(
        options.apiUrl(`/v1/wca/scrambles/by-difficulty?${query.toString()}`),
        { signal },
      );
      if (!response.ok) return null;
      return parseTimerWcaByDifficultyResult(await response.json());
    } catch {
      return null;
    }
  }

  const coverageKey = (competitionId: string, wcaEventId: string) => (
    JSON.stringify([competitionId, wcaEventId])
  );

  async function fetchCompetitionCoverage(
    competitionName: string,
    wcaEventId: string,
  ): Promise<boolean | null> {
    const distribution = await loadDistribution();
    const histogram = distribution?.sets?.wca?.variants?.[COVERAGE_VARIANT]
      ?.data?.[COVERAGE_STAGE]?.[COVERAGE_COLORS];
    if (!histogram
      || !Number.isFinite(histogram.min)
      || !Number.isFinite(histogram.max)
      || histogram.max < histogram.min) return null;
    const bins: number[] = [];
    for (let bin = Math.ceil(histogram.min); bin <= Math.floor(histogram.max); bin++) bins.push(bin);
    const results = await Promise.all(bins.map((bin) => fetchByDifficulty({
      bin,
      colors: COVERAGE_COLORS,
      event: wcaEventId,
      names: competitionName ? [competitionName] : undefined,
      pageSize: 1,
      stage: COVERAGE_STAGE,
      variant: COVERAGE_VARIANT,
    })));
    if (results.every((result) => result === null)) return null;
    return results.some((result) => (result?.total ?? 0) > 0);
  }

  return {
    async loadCatalog() {
      const [distribution, eventLengths, layout] = await Promise.all([
        loadDistribution(), loadEventLengths(), loadLayout(),
      ]);
      return { distribution, eventLengths, layout };
    },
    loadDistribution,
    loadEventLengths,
    loadLayout,
    fetchByDifficulty,
    getCompetitionCoverage(competitionId, wcaEventId) {
      const value = coverage.get(coverageKey(competitionId, wcaEventId));
      return value === undefined ? null : value;
    },
    async probeCompetitionCoverage(competitionId, competitionName, wcaEventId) {
      if (!competitionId || !wcaEventId) return null;
      const key = coverageKey(competitionId, wcaEventId);
      const cached = coverage.get(key);
      if (cached !== undefined) return cached;
      const pending = coverageInflight.get(key);
      if (pending) return pending;
      let request!: Promise<boolean | null>;
      request = fetchCompetitionCoverage(competitionName, wcaEventId)
        .then((value) => {
          if (value !== null) coverage.set(key, value);
          return value;
        })
        .catch(() => null)
        .finally(() => {
          if (coverageInflight.get(key) === request) coverageInflight.delete(key);
        });
      coverageInflight.set(key, request);
      return request;
    },
  };
}
