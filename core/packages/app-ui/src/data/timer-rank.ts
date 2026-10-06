import { createTimerRankClient } from '@cuberoot/shared/timer/rank-client';
import { WCA_ID_REGEX, getWcaPerson } from '@cuberoot/shared/wca-person';
import type { TimerRankHost, TimerRankOfficialRow } from '@cuberoot/timer-ui/rank-badge';
import { mobileApiUrl } from './wca-source-adapter';
const ranks = createTimerRankClient({ apiUrl: mobileApiUrl, fetcher: (...args) => fetch(...args) });
export const timerRankHost: TimerRankHost = {
  fetchRankFor: ranks.fetchRankFor,
  async fetchOfficial(wcaId) {
    if (!WCA_ID_REGEX.test(wcaId)) return [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(mobileApiUrl('/v1/wca/person-page?wcaId=' + encodeURIComponent(wcaId) + '&v=1'), { signal: controller.signal });
      if (!response.ok) throw new Error('Person unavailable');
      const data = await response.json() as { results?: TimerRankOfficialRow[] };
      if (!Array.isArray(data.results)) throw new Error('Results unavailable');
      return data.results;
    } finally { clearTimeout(timeout); }
  },
};
export { getWcaPerson };
