// 取某场某轮「第 solveNum 把」(1-based)单次的时间序 PR 名次 —— 口径同选手页逐把角标
// (computePrRank 的 attemptRanks)。近期未被官方收录的直播比赛会先合并 live 成绩再算,
// 与选手页 prRankLive 一致。返回标准竞赛排名(1=PR / n=PRn)或 null(无效把 / 取不到行)。
//
// recon 提交页的「单次纪录」自动填充用:以前只填本轮最佳那把,这里补齐任意把。

import {
  fetchWcaPersonResults, fetchWcaPersonCompetitions, fetchWcaPersonLiveResults, wcaResultRowKey,
} from './wca-person-api';
import { mergePersonCompetitionResults, mergePersonLive } from './person-live-merge';
import { extractPersonCompetitionResults, fetchWcaResults, matchRoundType } from './wca-results-api';
import { fetchCompInfo } from './comp-wcif';
import { toWcaEventId } from './wca-events';
import { computePrRank } from '@/components/persons/logic/progress';

export async function fetchAttemptPrRank(
  personId: string,
  reconEvent: string,
  reconRound: string,
  compId: string,
  solveNum: number,
): Promise<number | null> {
  if (!personId || !compId || !reconEvent || !reconRound || !solveNum) return null;
  const wcaEventId = toWcaEventId(reconEvent);
  const [official, comps, live, competitionData, compInfo] = await Promise.all([
    fetchWcaPersonResults(personId).catch(() => []),
    fetchWcaPersonCompetitions(personId).catch(() => []),
    fetchWcaPersonLiveResults(personId).catch(() => null),
    fetchWcaResults(compId, wcaEventId).catch(() => null),
    fetchCompInfo(compId).catch(() => null),
  ]);
  const merged = mergePersonLive(official, comps, live?.results ?? [], live?.comps ?? []);
  const competitionRows = extractPersonCompetitionResults(competitionData, personId);
  const results = mergePersonCompetitionResults(merged.results, competitionRows);
  const rankComps = merged.comps.some((c) => c.id === compId) ? merged.comps : [...merged.comps, {
    id: compId,
    name: compInfo?.name ?? compId,
    city: compInfo?.city ?? '',
    country_iso2: compInfo?.country_iso2 ?? '',
    start_date: compInfo?.start_date ?? '9999-12-31',
    end_date: compInfo?.end_date ?? compInfo?.start_date ?? '9999-12-31',
  }];
  const row = results.find(
    (r) => r.competition_id === compId && r.event_id === wcaEventId && matchRoundType(reconRound, r.round_type_id),
  );
  if (!row) return null;
  // 官方行只用官方成绩算名次;直播行用「官方 + 直播」合并算(与选手页 prRank / prRankLive 同口径)。
  const map = row.live
    ? computePrRank(results, rankComps)
    : computePrRank(results.filter((result) => !result.live), rankComps);
  return map.get(wcaResultRowKey(row))?.attemptRanks?.[solveNum - 1] ?? null;
}
