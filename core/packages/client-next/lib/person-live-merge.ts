// 选手页「直播·非官方成绩」与官方成绩的合并 / 去重(纯函数,便于回归测试)。
//
// 规则(比赛粒度去重):官方成绩一旦收录某场比赛(WCA 上传是按场整体完成的),该场的直播行
// 全部丢弃 —— 官方权威。剩下的直播行(官方还没收录的近期比赛)追加到 results;对应的比赛元数据
// 追加到 comps(否则 ByCompList 不遍历 → 不渲染)。
//
// 注意:本函数只服务「成绩 tab」展示。直播(非官方)成绩绝不能进 PR 表 / Hero / 最优组合 /
// 名次和,调用方只把合并结果喂给 ResultsTab。

import type { WcaResultRow, WcaCompetition } from './wca-person-api';

export function mergePersonLive(
  official: WcaResultRow[],
  officialComps: WcaCompetition[],
  live: WcaResultRow[],
  liveComps: WcaCompetition[],
): { results: WcaResultRow[]; comps: WcaCompetition[] } {
  const officialCompIds = new Set(official.map((r) => r.competition_id));
  // 官方已收录的比赛 → 直播行整场丢弃
  const freshLive = live.filter((r) => !officialCompIds.has(r.competition_id));
  const freshCompIds = new Set(freshLive.map((r) => r.competition_id));

  const existingCompIds = new Set(officialComps.map((c) => c.id));
  const freshLiveComps = liveComps.filter(
    (c) => freshCompIds.has(c.id) && !existingCompIds.has(c.id) && !officialCompIds.has(c.id),
  );

  return {
    results: [...official, ...freshLive],
    comps: [...officialComps, ...freshLiveComps],
  };
}
