import { statsUrl } from './stats-base';
import { fetchUserUpcoming, WCA_ID_REGEX } from './wca-api';
import type { Comp } from './comp-search';

/** Registration indexes can lag behind the calendar; retain only ongoing/future competitions. */
export function selectPersonUpcomingCompetitions(
  competitionIds: readonly string[],
  competitions: readonly Comp[],
  todayIso: string,
): Comp[] {
  const wantedIds = new Set(competitionIds);
  return competitions
    .filter((competition) => wantedIds.has(competition.id)
      && (competition.end_date || competition.start_date) >= todayIso)
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id.localeCompare(b.id));
}

interface TopUpcomingData {
  competitions?: Array<{
    id?: string;
    top_cubers?: Array<{ id?: string }>;
  }>;
}

type CnUpcomingRegistrations = Record<string, string[]>;

async function loadStatsJson<T>(path: string): Promise<T> {
    // These indexes are regenerated daily. Always revalidate instead of keeping
    // one stale Promise for the lifetime of a long-open browser tab.
    const response = await fetch(statsUrl(path), { cache: 'no-cache' });
    if (!response.ok) throw new Error('registration index unavailable');
    return await response.json() as T;
}

/** 与比赛中心一致：静态报名索引先命中，WCA upcoming API 再补全。 */
export async function fetchPersonUpcomingCompetitionIds(wcaId: string): Promise<string[]> {
  return (await fetchPersonUpcomingCompetitions(wcaId)).ids;
}

/** 保留可用来源，同时把来源失败与“确实没有报名”区分开。 */
export async function fetchPersonUpcomingCompetitions(wcaId: string): Promise<{ ids: string[]; incomplete: boolean }> {
  const id = wcaId.trim().toUpperCase();
  if (!WCA_ID_REGEX.test(id)) return { ids: [], incomplete: false };

  const [top, cn, api] = await Promise.allSettled([
    loadStatsJson<TopUpcomingData>('/stats/upcoming_comps.json'),
    loadStatsJson<CnUpcomingRegistrations>('/stats/cn_upcoming_registrations.json'),
    fetchUserUpcoming(id, { strict: true }),
  ]);
  const topData = top.status === 'fulfilled' ? top.value : {};
  const cnRegistrations = cn.status === 'fulfilled' ? cn.value : {};
  const apiIds = api.status === 'fulfilled' ? api.value : [];
  const competitionIds = new Set(apiIds);

  for (const competition of topData.competitions ?? []) {
    if (competition.id && competition.top_cubers?.some((person) => person.id === id)) {
      competitionIds.add(competition.id);
    }
  }
  for (const [competitionId, personIds] of Object.entries(cnRegistrations)) {
    if (personIds.includes(id)) competitionIds.add(competitionId);
  }

  return { ids: [...competitionIds], incomplete: [top, cn, api].some((r) => r.status === 'rejected') };
}
