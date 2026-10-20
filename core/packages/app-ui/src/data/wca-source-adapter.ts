import { createTimerWcaCompetitionCatalog } from '@cuberoot/shared/timer/wca-competition-catalog';
import type {
  TimerWcaCompetitionScramble,
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

export interface MobileWcaScrambleRow extends TimerWcaCompetitionScramble {}
const scramblePromises = new Map<string, Promise<MobileWcaScrambleRow[] | null>>();
const competitionCatalog = createTimerWcaCompetitionCatalog({ statsUrl: mobileStaticUrl, fetcher: (...args) => fetch(...args) });
export const displayMobileWcaCompetitionName = competitionCatalog.displayName;
export const loadMobileWcaCompetitions = competitionCatalog.load;

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
