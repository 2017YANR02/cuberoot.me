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

export interface PuzzleAltDist {
  metric: string;         // 备选口径 key(sq1: 'slash')
  dist: PuzzleHistEntry;
}

export interface PuzzleExactDist {
  metric: string;         // 精确档 key(sq1: 'wca_exact')
  sample_count: number;   // 精确档样本数(可能 < 主档,如全量灌注未完时)
  dist: PuzzleHistEntry;
}

export interface PuzzleDistEntry {
  event: string;          // WCA event_id(语料口径,如 '222')
  label: string;
  label_zh: string | null;
  metric: string;         // 主口径('htm' / 'wca' 等)
  sample_count: number;
  dist: PuzzleHistEntry;
  alt?: PuzzleAltDist;    // 备选口径(sq1: wca 主 + slash 备,前端可切)
  exact?: PuzzleExactDist; // 精确档(sq1: WCA 12c4 可证最优;主档仍为近最优供对照)
}

export interface PuzzleDistributionJson {
  meta: { generated_at: string; puzzles: string[] };
  puzzles: Record<string, PuzzleDistEntry>; // key = puzzle 名(pocket / pyraminx / skewb / sq1)
}

// shape 变更或数据全量重灌时 bump(防缓存旧 JSON)
const V = '20260617a';

export async function fetchPuzzleDistribution(): Promise<PuzzleDistributionJson> {
  const r = await fetch(statsUrl('/stats/scramble/puzzle_distribution.json') + `?v=${V}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<PuzzleDistributionJson>;
}
