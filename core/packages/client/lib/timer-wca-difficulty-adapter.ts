import {
  createTimerWcaDifficultyDataAdapter,
  type TimerWcaHttpFetch,
} from '@cuberoot/shared/timer';
import { apiUrl } from '@/lib/api-base';
import { statsUrl } from '@/lib/stats-base';

const webTimerWcaFetch: TimerWcaHttpFetch = (url, init) => fetch(url, init);

/** Shared singleton: UI and WCA pool observe one catalog/coverage cache identity. */
export const webTimerWcaDifficultyAdapter = createTimerWcaDifficultyDataAdapter({
  apiUrl,
  fetcher: webTimerWcaFetch,
  statsUrl,
});
