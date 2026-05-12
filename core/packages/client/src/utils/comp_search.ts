// 比赛搜索：合并 all_past_comps + all_upcoming_comps，按 id / name / city 模糊匹配
// NOTE: all_past_comps.json ~4.4MB，按需加载（首次聚焦比赛输入框时）；模块级缓存。
//       数据 schema 见 .claude/skills/comp-data-schema/SKILL.md
//       重要：past 的 country 是 WCA 全名（"Hungary"），upcoming 的 country 是 ISO alpha-2（"SE"）。
//       本模块在加载时统一归一为小写 ISO2，下游一律按小写 ISO2 处理。
import { compNameZh, countryToIso2, loadFlagData } from './country_flags';
import { localizeCity } from './city_localize';

export interface Comp {
  id: string;
  name: string;
  city?: string;
  country: string;
  start_date: string;
  end_date: string;
  events?: string[];
}

/** 启发式:past comp 结束 60+ 天仍 0 events ⇒ 实际没办成 ⇒ 视为已取消。
 *  60 天 buffer 避免最近结束、results 还没传到 WCA dump 的真比赛被误标。 */
export const CANCELLED_BUFFER_DAYS = 60;

export function defaultCancelledCutoffIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - CANCELLED_BUFFER_DAYS);
  return d.toISOString().slice(0, 10);
}

export function isCancelledComp(
  c: { end_date?: string; start_date: string; events?: string[] },
  cutoffIso: string = defaultCancelledCutoffIso(),
): boolean {
  const endIso = c.end_date || c.start_date;
  return !!endIso && endIso < cutoffIso && (c.events ?? []).length === 0;
}

let cache: Comp[] | null = null;
let inflight: Promise<Comp[]> | null = null;

function normalizeCountry(raw: string): string {
  if (!raw) return '';
  if (raw.length === 2) return raw.toLowerCase();
  return countryToIso2(raw);
}

export async function loadComps(): Promise<Comp[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = (async () => {
      const [past, upcoming] = await Promise.all([
        fetch('/stats/all_past_comps.json').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/stats/all_upcoming_comps.json').then(r => r.ok ? r.json() : []).catch(() => []),
        loadFlagData().catch(() => 0),
      ]);
      const map = new Map<string, Comp>();
      const norm = (c: Comp): Comp => ({ ...c, country: normalizeCountry(c.country) });
      for (const c of past as Comp[]) map.set(c.id, norm(c));
      for (const c of upcoming as Comp[]) map.set(c.id, norm(c));
      cache = [...map.values()];
      return cache;
    })();
  }
  return inflight;
}

/**
 * 按 query 模糊匹配 comp。打分：id 完全 > id 前缀 > name 前缀 > id 子串 > name/nameZh/city/cityZh 子串。
 * 把"想找这个地方的比赛"和"想找这个名字的比赛"放同档,内部按 start_date 倒序(最新先)。
 * city 同时匹配英文原值和中文化结果("徐州" 命中 city="Xuzhou")。
 */
export function searchComps(query: string, comps: Comp[], limit = 20): Comp[] {
  const raw = query.trim();
  const q = raw.toLowerCase();
  if (!q) return [];
  const scored: { c: Comp; s: number }[] = [];
  for (const c of comps) {
    const id = c.id.toLowerCase();
    const name = c.name.toLowerCase();
    const nameZh = compNameZh(c.name);
    const city = (c.city || '').toLowerCase();
    const cityZh = c.city ? localizeCity(c.city, true) : '';
    let s = 0;
    if (id === q) s = 1000;
    else if (id.startsWith(q)) s = Math.max(s, 900);
    else if (name.startsWith(q)) s = Math.max(s, 800);
    else if (id.includes(q)) s = Math.max(s, 700);
    else if (name.includes(q) || nameZh.includes(raw) || city.includes(q) || (cityZh && cityZh.includes(raw))) {
      s = 500;
    }
    if (s === 0) continue;
    // tie-break: newer first (start_date YYYY-MM-DD lexicographic == chronological)
    const dateBoost = c.start_date ? Number(c.start_date.replaceAll('-', '')) / 1e10 : 0;
    scored.push({ c, s: s + dateBoost });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map(x => x.c);
}
