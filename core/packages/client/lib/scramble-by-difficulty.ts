// /scramble/stats 难度页「查看全部」用:按 (方法,阶段,子集,步数) 列举全部 WCA 真题(+ 比赛名/日期筛选 + 分页)。
// 后端 GET /v1/wca/scrambles/by-difficulty(packages/server),数据来自 wca_scramble_steps(逐底色步数索引)
// JOIN wca_scrambles(文本)+ wca_scramble_optimal(最优打乱)+ wca_competitions(比赛名/日期)。
import { apiUrl } from '@/lib/api-base';

export interface ByDifficultyRow {
  scramble: string;
  ci: string;      // competition_id
  cn: string;      // 比赛名
  cd: string;      // 比赛日期串
  e: string;       // event_id
  r: string;       // round_type_id
  g: string;       // group_id
  n: number;       // scramble_num
  x: 0 | 1;        // is_extra
  o?: string;      // 最优等价打乱(同态项目才有)
  cols: number[];  // 该 (方法,阶段) 的 6 底色最优步数 [B,G,O,R,W,Y](客户端挑 argmin 底色画色点)
}

export interface ByDifficultyResult {
  total: number;
  page: number;
  pageSize: number;
  scrambles: ByDifficultyRow[];
}

export interface ByDifficultyParams {
  variant: string;
  stage: string;
  colors: string;   // 子集 key(BGORWY / W / WY …)
  bin: number;      // 步数
  event?: string;   // WCA event_id;省略 = 合并池(全 3x3-family)
  q?: string;       // 比赛名子串
  from?: string;    // YYYY-MM-DD
  to?: string;      // YYYY-MM-DD
  country?: string; // WCA country_id(comp 所属国;= comp_countries.json 的值)
  page?: number;
  pageSize?: number;
}

export const BY_DIFFICULTY_PAGE_SIZE = 50;

export async function fetchByDifficulty(p: ByDifficultyParams): Promise<ByDifficultyResult | null> {
  const qs = new URLSearchParams();
  qs.set('variant', p.variant);
  qs.set('stage', p.stage);
  qs.set('colors', p.colors);
  qs.set('bin', String(p.bin));
  if (p.event) qs.set('event', p.event);
  if (p.q) qs.set('q', p.q);
  if (p.from) qs.set('from', p.from);
  if (p.to) qs.set('to', p.to);
  if (p.country) qs.set('country', p.country);
  if (p.page) qs.set('page', String(p.page));
  if (p.pageSize) qs.set('pageSize', String(p.pageSize));
  try {
    const r = await fetch(apiUrl(`/v1/wca/scrambles/by-difficulty?${qs.toString()}`));
    if (!r.ok) return null;
    return (await r.json()) as ByDifficultyResult;
  } catch {
    return null;
  }
}
