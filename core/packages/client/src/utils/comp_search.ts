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

// 中文搜索词 → 英文 name 子串同义词。
// 现状:很多 WCA 比赛没有中文名映射(compNameZh 返回空),用户搜"锦标赛"匹配不到 "Championship".
// 这张表把常见中文比赛关键词翻成英文小写子串,在 q 之外额外用 name.includes(syn) 命中.
// 触发词(中文 / 英文缩写)→ haystack 匹配规则.
// tokens: 必须出现的英文 token 列表
// phrase: true 时要求相邻(只允许空白分隔),false / 缺省时自由 AND(中间可夹任何词).
// 顺序重要:Object.entries 用 find 取首个 prefix-match.'锦标赛' 放最前,
// 用户只敲"锦"时返回最广的 championship,更具体的得敲全词.
// 'wc' 让 "wc" / "wc 2015" 都能命中 "World Rubik's Cube Championship 2015" 类老命名.
// '中锦赛' 用 phrase:China Championship 命名严格 "China Championship YYYY",
//   宽松 AND 会把 "China's 10th Anniversary Championship 2017" 这种误判进来.
interface SynEntry { tokens: string[]; phrase?: boolean }
const NAME_SYNONYMS: Record<string, SynEntry> = {
  '锦标赛': { tokens: ['championship'] },
  '世锦赛': { tokens: ['world', 'championship'] },
  '中锦赛': { tokens: ['china', 'championship'], phrase: true },
  '公开赛': { tokens: ['open'] },
  'wc': { tokens: ['world', 'championship'] },
};

function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function haystackHasSyn(haystack: string, syn: SynEntry): boolean {
  if (syn.phrase) {
    return new RegExp(syn.tokens.map(escapeRe).join('\\s+')).test(haystack);
  }
  return syn.tokens.every(t => haystack.includes(t));
}

/** haystack 是否包含 rawQuery 的全部空格分词(AND).任一 token 命中 NAME_SYNONYMS
 *  键(支持前缀:'锦'→'锦标赛','wc'→'wc')时按其 phrase / AND 规则在 haystack 上匹配同义词.
 *  "wc 2015" → 'wc' 同义词 ['world','championship'] AND + '2015' 直接 includes → 都满足才返 true.
 *  haystack 调用方负责传 lowercase. */
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

/**
 * 按 query 模糊匹配 comp。打分：id 完全 > id 前缀 > name 前缀 > id 子串 > name/nameZh/city/cityZh 子串。
 * 把"想找这个地方的比赛"和"想找这个名字的比赛"放同档,内部按 start_date 倒序(最新先)。
 * city 同时匹配英文原值和中文化结果("徐州" 命中 city="Xuzhou")。
 * 中文比赛类型词("锦标赛"/"公开赛")通过 ZH_NAME_SYNONYMS 映射到英文 name 子串。
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
    else if (
      compNameMatches(name, raw) || nameZh.includes(raw) ||
      city.includes(q) || (cityZh && cityZh.includes(raw))
    ) {
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
