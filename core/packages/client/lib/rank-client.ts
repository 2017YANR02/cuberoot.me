import { createTimerRankClient } from '@cuberoot/shared/timer/rank-client';
import { apiUrl } from './api-base';
export type { RankResult, RegionRank } from '@cuberoot/shared/timer/rank-client';
export const { fetchRankFor, fetchRankForWca, prefetchRanksForWca, getCachedRankForWca } = createTimerRankClient({ apiUrl, fetcher: (...args) => fetch(...args) });
