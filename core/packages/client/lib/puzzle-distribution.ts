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
  provisional?: boolean;  // sq1 slash:仍有未判定的歧义态怪物 ⇒ dist 含紧上界(非全可证最优)
  ambiguous?: number;     // sq1 slash:歧义态总数(W=2s-1,需精确判定)
  improved?: number;      // sq1 slash:真省刀(t=s-1)的歧义态数(meta.less;实测恒 0)
  resolved?: number;      // sq1 slash:已穷尽判定 = 此上界的歧义态数(meta.eq)
  residual?: number;      // sq1 slash:穷尽证明超时不可行、取紧上界的最深残留态数(meta.fallback)
}

export interface PuzzleDistEntry {
  event: string;          // WCA event_id(语料口径,如 '222')
  label: string;
  label_zh: string | null;
  metric: string;         // 主口径('htm' / 'wca' 等;sq1 = wca,值为可证 WCA 12c4 最优,近最优档已退役)
  sample_count: number;
  dist: PuzzleHistEntry;
  alt?: PuzzleAltDist;    // 备选口径(sq1: wca 主 + slash 备,前端可切)
  wcaOptSlash?: PuzzleHistEntry; // sq1 2×2 格3:WCA 最优解的 slash 含量分布(数 opt 解里的 /;≥ slash 最优)
}

export interface PuzzleDistributionJson {
  meta: { generated_at: string; puzzles: string[] };
  puzzles: Record<string, PuzzleDistEntry>; // key = puzzle 名(pocket / pyraminx / skewb / sq1)
}

// shape 变更或数据全量重灌时 bump(防缓存旧 JSON)
const V = '20260619sq1slashub';

export async function fetchPuzzleDistribution(): Promise<PuzzleDistributionJson> {
  const r = await fetch(statsUrl('/stats/scramble/puzzle_distribution.json') + `?v=${V}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<PuzzleDistributionJson>;
}
