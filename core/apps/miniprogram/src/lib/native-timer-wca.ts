import { createWcaScramblePool, type WcaSourceSpec } from '@cuberoot/shared/timer/wca-scramble-pool';
import { createTimerWcaDifficultyDataAdapter } from '@cuberoot/shared/timer/wca-difficulty-data';
import { parseTimerWcaCompetitionScrambles } from '@cuberoot/shared/timer/wca-source-config';
import { createTimerWcaCompetitionCatalog } from '@cuberoot/shared/timer/wca-competition-catalog';
import { ApiError, requestJson, requestStaticJson } from './auth';
import { nativeTimerFetch as fetcher } from './native-timer-network';
import { miniProgramApi } from './platform';

export const nativeCompetitionCatalog = createTimerWcaCompetitionCatalog({ statsUrl: path => path,
  fetcher: async path => ({ ok: true, status: 200, json: async () => requestStaticJson(path) }),
});
let competitionCountries: Promise<Record<string, unknown>> | undefined;
export async function loadNativeCompetitionCountry(id: string): Promise<string> {
  competitionCountries ??= requestStaticJson<Record<string, unknown>>('/stats/comp_countries.json').catch(() => {
    competitionCountries = undefined;
    return {};
  });
  const countries = await competitionCountries;
  return typeof countries?.[id] === 'string' ? countries[id] : '';
}
export async function loadNativeCompetitionScrambles(id: string, signal?: AbortSignal) {
  return parseTimerWcaCompetitionScrambles(await requestJson(`/wca/scrambles?compId=${encodeURIComponent(id)}`, { signal }));
}

export const nativeWcaDifficulty = createTimerWcaDifficultyDataAdapter({
  apiUrl: path => path,
  statsUrl: path => path,
  async fetcher(path, init) {
    if (!path.startsWith('/stats/')) return fetcher(path, init);
    try {
      const data = await requestStaticJson(path);
      return { ok: true, status: 200, json: async () => data };
    } catch (error) {
      if (error instanceof ApiError) return { ok: false, status: error.status, json: async () => null };
      throw error;
    }
  },
});

export function createNativeWcaPool() {
  return createWcaScramblePool({
    apiUrl: path => path, fetcher,
    difficulty: nativeWcaDifficulty,
    loadCompetition: loadNativeCompetitionScrambles,
    // Specialized step/difficulty training is intentionally disabled on Douyin.
    loadExamples: async () => null,
    storage: () => ({
      getItem: key => { try { const value = miniProgramApi().getStorageSync(key); return typeof value === 'string' ? value : null; } catch { return null; } },
      setItem: (key, value) => miniProgramApi().setStorageSync(key, value),
    }),
    storageKey: 'cuberoot.native.wca-pool.v1',
  });
}
export type { WcaSourceSpec };
