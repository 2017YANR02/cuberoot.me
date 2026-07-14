// 近期打乱(全项目)数据契约 + 加载路径。
// 生产端:scramble-stats-build/src/build_recent_scrambles_events.ts(改 shape 必须两处同步 + bump V)。
// 覆盖全部 WCA 项目:每项目按「打乱长度」分桶;222 / 金字塔 / 斜转 额外按「难度」(整解最优步数)分桶。
// 3x3 只取这里的长度桶(其打乱长度不定,12–23 步);3x3 的难度(变体×类型×底色)仍走
// recent_scrambles.json 的富控件。
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
  scr: Record<string, string>;          // id -> 原始 WCA 打乱
  // id -> 最优等态打乱(与原打乱同态、步数最短,其长度即难度值)。仅 222/金字塔/斜转有。
  // 难度视图强制显示这份;长度视图仍用 scr(那按的就是原打乱长度)。
  opt?: Record<string, string>;
  meta: Record<string, RecentScrMeta>;   // id -> 比赛元数据
  events: Record<string, RecentEventBuckets>;
}

// shape 变更或数据全量重灌时 bump(防缓存旧 JSON)
const V = '20260714len333';

export async function fetchRecentScramblesEvents(): Promise<RecentScramblesEventsJson | null> {
  try {
    const r = await fetch(statsUrl('/stats/scramble/recent_scrambles_events.json') + `?v=${V}`, { cache: 'no-cache' });
    return r.ok ? (r.json() as Promise<RecentScramblesEventsJson>) : null;
  } catch {
    return null;
  }
}
