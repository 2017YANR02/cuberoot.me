import { createWcaScramblePool, type WcaSourceSpec } from '@cuberoot/shared/timer/wca-scramble-pool';
import { createTimerWcaDifficultyDataAdapter } from '@cuberoot/shared/timer/wca-difficulty-data';
import { parseTimerWcaCompetitionScrambles } from '@cuberoot/shared/timer/wca-source-config';
import { createTimerWcaCompetitionCatalog } from '@cuberoot/shared/timer/wca-competition-catalog';
import { requestJson, requestStaticJson } from './auth';
import { nativeTimerFetch as fetcher } from './native-timer-network';
import { miniProgramApi } from './platform';

export const nativeCompetitionCatalog = createTimerWcaCompetitionCatalog({ statsUrl: path => path,
  fetcher: async path => ({ ok: true, status: 200, json: async () => requestStaticJson(path) }),
});
export async function loadNativeCompetitionScrambles(id: string, signal?: AbortSignal) {
  return parseTimerWcaCompetitionScrambles(await requestJson(`/wca/scrambles?compId=${encodeURIComponent(id)}`, { signal }));
}

export function createNativeWcaPool() {
  return createWcaScramblePool({
    apiUrl: path => path, fetcher,
    difficulty: createTimerWcaDifficultyDataAdapter({ apiUrl: path => path, statsUrl: path => path, fetcher }),
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
