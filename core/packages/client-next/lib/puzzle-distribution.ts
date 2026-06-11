// 非 3x3 puzzle 整解最优步数分布 — 数据契约 + 加载路径(EPIC 3 新管线)。
// 生产端:scramble-stats-build/src/build_puzzle_dist.ts(改 shape 必须两处同步 + bump V)。
// dist 形状与 distribution.json 的 HistEntry 一致,/scramble/stats 的
// DiscreteHistogram / computeStats 可直接复用。
import { statsUrl } from '@/lib/stats-base';

export interface PuzzleHistEntry {
  min: number;
  max: number;
  counts: Record<string, number>; // 最优步数 -> 打乱条数
}

export interface PuzzleDistEntry {
  event: string;          // WCA event_id(语料口径,如 '222')
  label: string;
  label_zh: string | null;
  metric: string;         // 步数度量('htm' 等)
  sample_count: number;
  dist: PuzzleHistEntry;
}

export interface PuzzleDistributionJson {
  meta: { generated_at: string; puzzles: string[] };
  puzzles: Record<string, PuzzleDistEntry>; // key = puzzle 名(pocket / pyraminx / skewb / sq1)
}

// shape 变更时 bump(防缓存旧 JSON)
const V = '20260611';

export async function fetchPuzzleDistribution(): Promise<PuzzleDistributionJson> {
  const r = await fetch(statsUrl('/stats/scramble/puzzle_distribution.json') + `?v=${V}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<PuzzleDistributionJson>;
}
