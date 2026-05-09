// 每个项目的领奖台计数.
// 仅决赛轮(round_type_id ∈ {f, c, b})的 pos = 1 / 2 / 3 算入金/银/铜.

import type { WcaResultRow } from '../wca_api';

const FINAL_ROUND_TYPES = new Set(['f', 'c', 'b']);

export interface PodiumCounts { gold: number; silver: number; bronze: number; }

export function countPodiumByEvent(results: WcaResultRow[]): Map<string, PodiumCounts> {
  const out = new Map<string, PodiumCounts>();
  for (const r of results) {
    if (!FINAL_ROUND_TYPES.has(r.round_type_id)) continue;
    if (r.pos < 1 || r.pos > 3) continue;
    const cur = out.get(r.event_id) ?? { gold: 0, silver: 0, bronze: 0 };
    if (r.pos === 1) cur.gold++;
    else if (r.pos === 2) cur.silver++;
    else cur.bronze++;
    out.set(r.event_id, cur);
  }
  return out;
}
