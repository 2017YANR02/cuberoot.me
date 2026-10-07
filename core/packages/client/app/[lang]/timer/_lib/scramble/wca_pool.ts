/** Web transport adapter; queue, retry, filtering and persistence are shared. */
import { createWcaScramblePool } from '@cuberoot/timer-ui/wca-scramble-pool';
import { apiUrl } from '@/lib/api-base';
import { fetchWcaScrambles } from '@/lib/wca-results-api';
import { webTimerWcaDifficultyAdapter } from '@/lib/timer-wca-difficulty-adapter';
import { fetchPuzzleExamples } from '@/lib/puzzle-examples';
export type { WcaSourceSpec, WcaScrambleMeta, WcaDispensedScramble } from '@cuberoot/timer-ui/wca-scramble-pool';
const pool = createWcaScramblePool({
  apiUrl,
  difficulty: webTimerWcaDifficultyAdapter,
  loadExamples: signal => fetchPuzzleExamples(fetch, signal),
  loadCompetition: async (id) => (await fetchWcaScrambles(id))?.map(row => ({
    eventId: row.event_id, roundTypeId: row.round_type_id, groupId: row.group_id,
    scrambleNumber: row.scramble_num, isExtra: row.is_extra, scramble: row.scramble,
    optimalScramble: row.optimal_scramble ?? null,
  })) ?? null,
});
export const { hasWcaSource, isWcaSourceEmpty, isWcaCompUnindexed, prefetchWca, peekWcaRow,
  peekWca, nextWcaRow, nextWca, wcaMetaFor, wcaMetaForSlot, wcaEventId,
  probeCompCoverage, getCompCoverage, wcaPoolProgress, startNext: startWcaScrambleRetry,
  cancelSource: cancelWcaSource } = pool;
