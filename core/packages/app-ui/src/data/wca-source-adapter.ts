import { localizeCity } from '@cuberoot/shared/city-localize';
import { localizeCompName } from '@cuberoot/shared/comp-localize';
import { mergeCompetitionIndexes } from '@cuberoot/shared/competition-index';
import { countryToIso2 } from '@cuberoot/shared/country-flag';
import type {
  TimerWcaCompetitionScramble,
  TimerWcaCompetition,
} from '@cuberoot/shared/timer';
import {
  createTimerWcaDifficultyDataAdapter,
  loadPuzzleExamples,
  parseTimerWcaCompetitionScrambles,
  type PuzzleExamplesJson,
  type TimerWcaHttpFetch,
} from '@cuberoot/shared/timer';

const STATIC_ORIGIN = 'https://static.cuberoot.me';
const API_ORIGIN = 'https://api.cuberoot.me';

export function mobileStaticUrl(path: string): string {
  return `${STATIC_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export function mobileApiUrl(path: string): string {
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

const mobileWcaFetch: TimerWcaHttpFetch = (url, init) => fetch(url, init);

/** One cache/in-flight identity for Mobile WCA difficulty UI and pools. */
export const mobileTimerWcaDifficultyAdapter = createTimerWcaDifficultyDataAdapter({
  apiUrl: mobileApiUrl,
  fetcher: mobileWcaFetch,
  statsUrl: mobileStaticUrl,
});

export function loadMobilePuzzleExamples(
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<PuzzleExamplesJson> {
  return loadPuzzleExamples({
    fetcher,
    url: mobileStaticUrl('/stats/scramble/puzzle_examples.json'),
  }, signal);
}

interface RawCompetition {
  id: string;
  name: string;
  city?: unknown;
  country: string;
  start_date: string;
  end_date?: unknown;
}

export interface MobileWcaScrambleRow extends TimerWcaCompetitionScramble {}

function isRawCompetition(value: unknown): value is RawCompetition {
  if (!value || typeof value !== 'object') return false;
  const row = value as RawCompetition;
  return typeof row.id === 'string' && row.id.length > 0
    && typeof row.name === 'string' && row.name.length > 0
    && typeof row.country === 'string'
    && typeof row.start_date === 'string';
}

let rawCompetitionsPromise: Promise<RawCompetition[]> | null = null;
let competitionNamesZhPromise: Promise<Record<string, string>> | null = null;
let competitionNamesZhCache: Record<string, string> = {};
const scramblePromises = new Map<string, Promise<MobileWcaScrambleRow[] | null>>();

export function displayMobileWcaCompetitionName(
  competitionId: string,
  canonicalName: string,
  language: 'en' | 'zh',
): string {
  return localizeCompName(competitionId, canonicalName, language === 'zh', {
    explicitNameZh: competitionNamesZhCache[canonicalName],
  });
}

function parseCompetition(
  value: RawCompetition,
  namesZh: Record<string, string>,
  language: 'en' | 'zh',
): TimerWcaCompetition | null {
  if (typeof value.id !== 'string' || !value.id
    || typeof value.name !== 'string' || !value.name
    || typeof value.country !== 'string'
    || typeof value.start_date !== 'string') return null;
  const nameZh = namesZh[value.name];
  const country = countryToIso2(value.country).toUpperCase();
  const city = typeof value.city === 'string' ? value.city : undefined;
  const isZh = language === 'zh';
  return {
    id: value.id,
    name: value.name,
    displayName: localizeCompName(value.id, value.name, isZh, {
      date: value.start_date,
      explicitNameZh: nameZh,
    }),
    selectedDisplayName: localizeCompName(value.id, value.name, isZh, {
      explicitNameZh: nameZh,
    }),
    city,
    displayCity: city ? localizeCity(city, isZh, country) : undefined,
    country,
    startDate: value.start_date,
    endDate: typeof value.end_date === 'string' ? value.end_date : value.start_date,
    searchAliases: nameZh ? [nameZh] : undefined,
  };
}

async function loadRawCompetitions(): Promise<RawCompetition[]> {
  if (!rawCompetitionsPromise) {
    const loadCompetitionList = async (url: string): Promise<{
      ok: boolean;
      rows: RawCompetition[];
    }> => {
      try {
        const response = await fetch(url);
        if (!response.ok) return { ok: false, rows: [] };
        const payload: unknown = await response.json();
        if (!Array.isArray(payload) || !payload.every(isRawCompetition)) {
          return { ok: false, rows: [] };
        }
        return { ok: true, rows: payload };
      } catch {
        return { ok: false, rows: [] };
      }
    };
    rawCompetitionsPromise = Promise.all([
      loadCompetitionList(mobileStaticUrl('/stats/all_past_comps.json')),
      loadCompetitionList(mobileStaticUrl('/stats/all_upcoming_comps.json')),
    ]).then(([past, upcoming]) => {
      if (!past.ok || !upcoming.ok) throw new Error('competition indexes unavailable');
      return mergeCompetitionIndexes(past.rows, upcoming.rows, {
        past: 'all_past_comps.json',
        upcoming: 'all_upcoming_comps.json',
      });
    }).catch((error) => {
      rawCompetitionsPromise = null;
      throw error;
    });
  }
  return rawCompetitionsPromise;
}

async function loadCompetitionNamesZh(): Promise<Record<string, string>> {
  if (!competitionNamesZhPromise) {
    competitionNamesZhPromise = fetch(mobileStaticUrl('/stats/comp_names_zh.json'))
      .then(async (response) => {
        if (!response.ok) throw new Error('competition translations unavailable');
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new Error('invalid competition translations');
        }
        competitionNamesZhCache = payload as Record<string, string>;
        return competitionNamesZhCache;
      })
      .catch((error) => {
        competitionNamesZhPromise = null;
        throw error;
      });
  }
  return competitionNamesZhPromise;
}

export async function loadMobileWcaCompetitions(
  language: 'en' | 'zh',
): Promise<readonly TimerWcaCompetition[]> {
  const [competitions, namesZh] = await Promise.all([
    loadRawCompetitions(),
    // Localization enriches search/display but is not allowed to take the
    // canonical competition index offline. A later call retries a failed asset.
    loadCompetitionNamesZh().catch(() => ({})),
  ]);
  const localized: TimerWcaCompetition[] = [];
  for (const raw of competitions) {
    const competition = parseCompetition(raw, namesZh, language);
    if (competition) localized.push(competition);
  }
  return localized;
}

function requireScrambleRows(payload: unknown): MobileWcaScrambleRow[] {
  const rows = parseTimerWcaCompetitionScrambles(payload);
  if (rows === null) throw new Error('invalid competition scramble response');
  return rows;
}

export function loadMobileWcaCompetitionScrambles(
  competitionId: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<MobileWcaScrambleRow[] | null> {
  const id = competitionId.trim();
  if (!id) return Promise.resolve(null);
  const cacheable = fetcher === fetch && signal === undefined;
  const cached = cacheable ? scramblePromises.get(id) : undefined;
  if (cached) return cached;
  const proxy = mobileApiUrl(`/v1/wca/scrambles?compId=${encodeURIComponent(id)}`);
  const direct = `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(id)}/scrambles`;
  const request = fetcher(proxy, { signal })
    .then((response) => response.ok
      ? response.json()
      : Promise.reject(new Error(`proxy ${response.status}`)))
    .then(requireScrambleRows)
    .catch((error: unknown) => {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        throw error;
      }
      return fetcher(direct, { signal })
      .then((response) => response.ok ? response.json() : null)
      .then(requireScrambleRows)
      .catch((directError: unknown) => {
        if (signal?.aborted
          || (directError instanceof DOMException && directError.name === 'AbortError')) {
          throw directError;
        }
        return null;
      });
    });
  if (cacheable) {
    scramblePromises.set(id, request);
    void request.then((rows) => {
      if (rows === null && scramblePromises.get(id) === request) scramblePromises.delete(id);
    }, () => {
      if (scramblePromises.get(id) === request) scramblePromises.delete(id);
    });
  }
  return request;
}
