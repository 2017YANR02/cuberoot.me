import { statsUrl } from './stats-base';
import { fetchUserUpcoming, WCA_ID_REGEX } from './wca-api';

interface TopUpcomingData {
  competitions?: Array<{
    id?: string;
    top_cubers?: Array<{ id?: string }>;
  }>;
}

type CnUpcomingRegistrations = Record<string, string[]>;

async function loadStatsJson<T>(path: string, fallback: T): Promise<T> {
  try {
    // These indexes are regenerated daily. Always revalidate instead of keeping
    // one stale Promise for the lifetime of a long-open browser tab.
    const response = await fetch(statsUrl(path), { cache: 'no-cache' });
    return response.ok ? await response.json() as T : fallback;
  } catch {
    return fallback;
  }
}

function loadStaticUpcoming(): Promise<[TopUpcomingData, CnUpcomingRegistrations]> {
  return Promise.all([
    loadStatsJson<TopUpcomingData>('/stats/upcoming_comps.json', {}),
    loadStatsJson<CnUpcomingRegistrations>('/stats/cn_upcoming_registrations.json', {}),
  ]);
}

/** 与比赛中心一致：静态报名索引先命中，WCA upcoming API 再补全。 */
export async function fetchPersonUpcomingCompetitionIds(wcaId: string): Promise<string[]> {
  const id = wcaId.trim().toUpperCase();
  if (!WCA_ID_REGEX.test(id)) return [];

  const [[topData, cnRegistrations], apiIds] = await Promise.all([
    loadStaticUpcoming(),
    fetchUserUpcoming(id),
  ]);
  const competitionIds = new Set(apiIds);

  for (const competition of topData.competitions ?? []) {
    if (competition.id && competition.top_cubers?.some((person) => person.id === id)) {
      competitionIds.add(competition.id);
    }
  }
  for (const [competitionId, personIds] of Object.entries(cnRegistrations)) {
    if (personIds.includes(id)) competitionIds.add(competitionId);
  }

  return [...competitionIds];
}
