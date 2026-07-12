// 金字塔「所有本质状态」分布 — 数据契约 + 加载路径(不含小角 tips)。
// 生产端:scripts/build_pyram_essential.py(自有枚举 933,120 态,BFS 求 H、cstimer 12 帧求 V,
// 四面体 S4 群去重到 39,035 本质案例;一次性生成静态 JSON,永不变化 → 直接 commit)。
// 主文件小(边际 + 联合 V×H + 全空间边际 + 致谢/记号),案例大文件(39,035 条)按需懒加载。
import { statsUrl } from '@/lib/stats-base';

export interface PyramHist {
  min: number;
  max: number;
  counts: Record<string, number>; // 步数 -> 状态数
}

// 联合 V×H 表:grid[vi][hi] = (V=v[vi], H=h[hi]) 的本质案例数。
export interface PyramJoint {
  v: number[];
  h: number[];
  grid: number[][];
}

export interface PyramBilingual { zh: string; en: string }
export interface PyramNotation { sym: string; zh: string; en: string }
export interface PyramCredits {
  author: PyramBilingual;
  classify: PyramBilingual;
  algorithm: PyramBilingual;
  source_url: string;
}

export interface PyramEssentialJson {
  meta: {
    total_positions: number;   // 933,120(不含小角的完整状态空间)
    essential_count: number;   // 39,035
    god_htm: number;           // 11
    avg_h: number;             // 本质案例平均 H
    avg_v: number;             // 本质案例平均 V
    avg_h_full: number;        // 全空间平均 H
    avg_v_full: number;        // 全空间平均 V
    generated_at: string;
    credits: PyramCredits;
    notation: PyramNotation[];
  };
  h: PyramHist;      // 本质案例(39,035)的 H 边际
  v: PyramHist;      // 本质案例的 V 边际
  joint: PyramJoint; // 本质案例的联合 V×H
  full_h: PyramHist; // 全空间(933,120)H 边际 —— 随机打乱的真实难度分布
  full_v: PyramHist; // 全空间 V 边际
}

// 案例:每条 = [idx, alg, V, H]。alg = 自产整解最优解(H 步,不含小角)。
export type PyramCaseRow = [number, string, number, number];
export interface PyramEssentialCasesJson {
  meta: { generated_at: string; total: number; cols: string[]; note: string };
  rows: PyramCaseRow[];
}

const V = '20260711b';

export async function fetchPyramEssential(): Promise<PyramEssentialJson> {
  const r = await fetch(statsUrl('/stats/scramble/pyram_essential.json') + `?v=${V}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<PyramEssentialJson>;
}

export async function fetchPyramEssentialCases(): Promise<PyramEssentialCasesJson> {
  const r = await fetch(statsUrl('/stats/scramble/pyram_essential_cases.json') + `?v=${V}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<PyramEssentialCasesJson>;
}

// 案例存的是「解法」(还原到复原态);打乱 = 解法的逆序(金字塔无 180° 转,只翻转 ')。
export function invertPyramAlg(alg: string): string {
  return alg
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map((m) => (m.endsWith("'") ? m.slice(0, -1) : `${m}'`))
    .join(' ');
}
