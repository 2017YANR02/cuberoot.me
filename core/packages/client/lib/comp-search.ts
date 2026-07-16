// Ported from packages/client-vite/src/utils/comp_search.ts.
import { compNameZh, countryToIso2, loadFlagData } from './country-flags';
import { localizeCity } from './city-localize';
import { statsUrl } from './stats-base';

export interface Comp {
  id: string;
  name: string;
  city?: string;
  country: string;
  start_date: string;
  end_date: string;
  events?: string[];
  /** 比赛场地经度 — 用来估算比赛当地时区,按比赛本地日期分桶(当前/未来/往期)。 */
  longitude_degrees?: number;
  /** 比赛场地纬度 — 多地代码(XW/XA/…)为 null/缺省。地理之最统计用。 */
  latitude_degrees?: number | null;
  /** 场馆海拔(整数米,管道由经纬度反查 DEM,可为负);无坐标 / 尚未回填时缺省。 */
  elevation?: number;
  /** 报名开放/截止时刻（ISO 8601 UTC）— 仅 upcoming JSON 有；首页「报名」标签用。 */
  registration_open?: string | null;
  registration_close?: string | null;
  /** 人数上限（0/缺省=无上限）— upcoming JSON 有。 */
  competitor_limit?: number;
  /** event 短码 → 该项目轮次数（all_past_comps / all_upcoming_comps 静态字段，~90% 覆盖）。卡片项目图标下显示。 */
  rounds?: Record<string, number>;
}

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
        fetch(statsUrl('/stats/all_past_comps.json')).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(statsUrl('/stats/all_upcoming_comps.json')).then(r => r.ok ? r.json() : []).catch(() => []),
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

interface SynEntry { tokens: string[]; phrase?: boolean }
const NAME_SYNONYMS: Record<string, SynEntry> = {
  '锦标赛': { tokens: ['championship'] },
  '世锦赛': { tokens: ['world', 'championship'] },
  '中锦赛': { tokens: ['china', 'championship'], phrase: true },
  '公开赛': { tokens: ['open'] },
  'wc': { tokens: ['world', 'championship'] },
  // 六大洲锦标赛(WCA championship_type _Africa/_Asia/_Europe/_North America/_Oceania/_South America)常用简称。
  '亚锦赛': { tokens: ['asian', 'championship'] },
  '亚洲锦标赛': { tokens: ['asian', 'championship'] },
  '非锦赛': { tokens: ['african', 'championship'] },
  '非洲锦标赛': { tokens: ['african', 'championship'] },
  '欧锦赛': { tokens: ['european', 'championship'] },
  '欧洲锦标赛': { tokens: ['european', 'championship'] },
  '北美锦标赛': { tokens: ['north', 'american', 'championship'] },
  '南美锦赛': { tokens: ['south', 'american', 'championship'] },
  '南美锦标赛': { tokens: ['south', 'american', 'championship'] },
  '大洋锦赛': { tokens: ['oceanic', 'championship'] },
  '大洋洲锦标赛': { tokens: ['oceanic', 'championship'] },
};

function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function haystackHasSyn(haystack: string, syn: SynEntry): boolean {
  if (syn.phrase) {
    return new RegExp(syn.tokens.map(escapeRe).join('\\s+')).test(haystack);
  }
  return syn.tokens.every(t => haystack.includes(t));
}

export function compNameMatches(haystack: string, rawQuery: string): boolean {
  if (!rawQuery) return false;
  const tokens = rawQuery.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.every(t => haystack.includes(t))) return true;
  let anyExpanded = false;
  for (const t of tokens) {
    const syn = Object.entries(NAME_SYNONYMS).find(([k]) => k.includes(t))?.[1];
    if (syn) {
      anyExpanded = true;
      if (!haystackHasSyn(haystack, syn)) return false;
    } else if (!haystack.includes(t)) {
      return false;
    }
  }
  return anyExpanded;
}

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
    const cityZh = c.city ? localizeCity(c.city, true, c.country) : '';
    let s = 0;
    if (id === q) s = 1000;
    else if (id.startsWith(q)) s = Math.max(s, 900);
    else if (name.startsWith(q)) s = Math.max(s, 800);
    else if (id.includes(q)) s = Math.max(s, 700);
    else if (
      compNameMatches(name, raw) || nameZh.includes(raw) ||
      city.includes(q) || (cityZh && cityZh.includes(raw))
    ) {
      s = 500;
    }
    if (s === 0) continue;
    const dateBoost = c.start_date ? Number(c.start_date.replaceAll('-', '')) / 1e10 : 0;
    scored.push({ c, s: s + dateBoost });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map(x => x.c);
}
