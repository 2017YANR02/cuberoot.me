import { localizeCity } from '../city_localize';
import { localizeCompName } from '../comp_localize';
import { mergeCompetitionIndexes } from '../competition_index';
import { countryToIso2 } from '../country_flag';
import type { TimerWcaCompetition } from './wca-source-config';
import type { TimerHttpFetch } from './http';

/** Existing competition catalog with host-supplied transport and asset URLs. */
export function createTimerWcaCompetitionCatalog({ statsUrl, fetcher }: { statsUrl(path: string): string; fetcher: TimerHttpFetch }) {
  interface RawCompetition {
    id: string;
    name: string;
    city?: unknown;
    country: string;
    start_date: string;
    end_date?: unknown;
  }


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

  function displayName(
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
          const response = await fetcher(url);
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
        loadCompetitionList(statsUrl('/stats/all_past_comps.json')),
        loadCompetitionList(statsUrl('/stats/all_upcoming_comps.json')),
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
      competitionNamesZhPromise = fetcher(statsUrl('/stats/comp_names_zh.json'))
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

  async function load(
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

  return { load, displayName };
}
