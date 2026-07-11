// 2×2×2「所有本质状态」分布 — 数据契约 + 加载路径。
// 生产端:scripts/build_2x2_essential.py(读 .tmp 的 xlsx 研究产物,一次性生成静态 JSON;
// 这是 2×2 的完整状态空间 3,674,160,永不变化 → 直接 commit)。
// 主文件小(marginal + 联合表 + 首面/首层子分布 + 案例聚合 + 致谢),案例大文件(77,801 条)按需懒加载。
import { statsUrl } from '@/lib/stats-base';

export interface EssHistEntry {
  min: number;
  max: number;
  counts: Record<string, number>; // 最优步数 -> 状态数
}

// 联合 HTM×QTM 表:grid[qi][hi] = 该 (QTM=qtm[qi], HTM=htm[hi]) 的状态数。
export interface EssJointTable {
  htm: number[];
  qtm: number[];
  grid: number[][];
}

export interface EssStatRow {
  m: number;               // 步数(HTM)
  cases: number;           // 该步数的案例/状态数
  inv: number | null;      // 1/prob(1-in-N)
  dist: number | null;     // 密度(占比)
  cumm: number | null;     // 累计占比
}
export interface EssStatGroup {
  key: string;
  label: { zh: string; en: string };
  rows: EssStatRow[];
  total: number | null;
  mean: number | null;
}
export interface EssNotation { sym: string; zh: string; en: string }
export interface EssBilingual { zh: string; en: string }
export interface EssCredits {
  author: EssBilingual;
  dedup: EssBilingual;
  classify: EssBilingual;
  source_url: string;
}

export interface Essential2x2Json {
  meta: {
    generated_at: string;
    total_positions: number;   // 3,674,160
    wca_legal_min4h: number;   // 需 ≥4 HTM 的状态数(WCA 打乱不会给近解态)
    god_htm: number;           // 11
    god_qtm: number;           // 14
    avg_htm: number;           // 8.7556
    avg_qtm: number;           // 10.666
    credits: EssCredits;
    notation: EssNotation[];
  };
  htm: EssHistEntry;
  qtm: EssHistEntry;
  joint: EssJointTable;
  stat: { groups: EssStatGroup[]; note: string | null };
  case_agg: {
    F: Record<string, number>;
    H: Record<string, number>;
    Q: Record<string, number>;
    QH: Record<string, number>;
    dqhq: Record<string, number>; // (Q|H)−Q:HTM 最优解比 QTM 最优解多花的四分之一转数
    total: number;
  };
}

// 案例大文件:每条 = [idx, hAlg, F, H, QH, Q, qAlg|null, f6|null, dqhq]。
// qAlg=null ⇒ 同 hAlg(HTM 最优解也是 QTM 最优解);f6=null ⇒ 六朝向面转步数都等于 F。
export type EssCaseRow = [
  number, string, number, number, number, number, string | null, number[] | null, number,
];
export interface Essential2x2CasesJson {
  meta: { generated_at: string; total: number; cols: string[]; note: string };
  rows: EssCaseRow[];
}

const V = '20260711';

export async function fetchEssential2x2(): Promise<Essential2x2Json> {
  const r = await fetch(statsUrl('/stats/scramble/2x2_essential.json') + `?v=${V}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<Essential2x2Json>;
}

export async function fetchEssential2x2Cases(): Promise<Essential2x2CasesJson> {
  const r = await fetch(statsUrl('/stats/scramble/2x2_essential_cases.json') + `?v=${V}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<Essential2x2CasesJson>;
}

// 案例存的是「解法」(还原到复原态);打乱 = 解法的逆序。喂 ScramblePreview2D 展示乱态。
export function invertAlg(alg: string): string {
  return alg
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map((m) => (m.endsWith('2') ? m : m.endsWith("'") ? m.slice(0, -1) : `${m}'`))
    .join(' ');
}
