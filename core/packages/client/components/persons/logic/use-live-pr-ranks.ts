'use client';
// 直播(非官方)成绩的 PR / PRn 名次。
//
// 官方 PR 染色(computePrRank)只算官方成绩,直播行被排除,所以直播的单次/平均原本不显示
// 「PR几」。这里对直播行单独从 cubing-live 源(/v1/cubing-live/:comp)取服务端算好的 pS/pA
// dense rank —— 与 /wca/comp 领奖台弹窗同一口径(pS=1 → PR,pS=26 → PR26)。
// fetchCubingPrRanks 按比赛缓存,同场多行只发一次网络。

import { useEffect, useState } from 'react';
import { fetchCubingLiveResultInfo } from '@/lib/wca-results-api';
import type { WcaResultRow } from '@/lib/wca-person-api';

export interface LivePrRank {
  pS: number | null; pA: number | null;
  singleTag: string; averageTag: string;  // WR / CR / NR / '' — 与 /wca/comp 结果表同口径
}

export function useLivePrRanks(rows: WcaResultRow[] | null, personId: string): Map<number, LivePrRank> {
  const [map, setMap] = useState<Map<number, LivePrRank>>(new Map());

  const liveRows = (rows ?? []).filter((r) => r.live);
  // 行集(及其 best/avg)变了才重拉;依赖串避免每次 render 重跑 effect。
  const sig = liveRows
    .map((r) => `${r.id}:${r.competition_id}:${r.event_id}:${r.round_type_id}:${r.best}:${r.average}`)
    .join('|');

  useEffect(() => {
    if (!personId || liveRows.length === 0) { setMap(new Map()); return; }
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(liveRows.map(async (r) => {
        const info = await fetchCubingLiveResultInfo(
          r.competition_id, r.event_id, r.round_type_id, personId,
          r.best || null, r.average || null,
        );
        return [r.id, {
          pS: info?.pS ?? null, pA: info?.pA ?? null,
          singleTag: info?.singleTag ?? '', averageTag: info?.averageTag ?? '',
        }] as const;
      }));
      if (!cancelled) setMap(new Map(entries));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, personId]);

  return map;
}
