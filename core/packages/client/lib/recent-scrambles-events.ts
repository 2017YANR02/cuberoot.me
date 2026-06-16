// 近期打乱(全项目)数据契约 + 加载路径。
// 生产端:scramble-stats-build/src/build_recent_scrambles_events.ts(改 shape 必须两处同步 + bump V)。
// 覆盖除 3x3 外的所有 WCA 项目:每项目按「打乱长度」分桶;222 / 金字塔 / 斜转 额外按「难度」
// (整解最优步数)分桶。3x3 本身仍走 recent_scrambles.json 的变体×类型×底色富控件。
import { statsUrl } from '@/lib/stats-base';

export interface RecentEventBuckets {
  length: Record<string, string[]>; // 打乱长度 -> 该长度的样例 id(每桶 ≤12,按 id 升序)
  difficulty?: {
    metric: string;                 // 'htm'(222/pyram/skewb 整解最优步数口径)
    byStep: Record<string, string[]>;
  };
}

export interface RecentScrMeta {
  ci: string; cn: string; cd: string; r: string; g: string; n: number; e: string; x?: 0 | 1;
}

export interface RecentScramblesEventsJson {
  export_date: string;
  generated_at: string;
  new_count: number;
  scr: Record<string, string>;          // id -> 打乱文字
  meta: Record<string, RecentScrMeta>;   // id -> 比赛元数据
  events: Record<string, RecentEventBuckets>;
}

// shape 变更或数据全量重灌时 bump(防缓存旧 JSON)
const V = '20260616';

export async function fetchRecentScramblesEvents(): Promise<RecentScramblesEventsJson | null> {
  try {
    const r = await fetch(statsUrl('/stats/scramble/recent_scrambles_events.json') + `?v=${V}`, { cache: 'no-cache' });
    return r.ok ? (r.json() as Promise<RecentScramblesEventsJson>) : null;
  } catch {
    return null;
  }
}
