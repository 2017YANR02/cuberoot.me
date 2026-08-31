// Ported from packages/client-vite/src/utils/country_flags.ts.
// WCA country_id / country.name → ISO 3166-1 alpha-2 + async-loaded person/comp country maps.

import { apiUrl } from './api-base';
import { statsUrl } from './stats-base';
import { countryName } from './country-name';
import {
  WCA_COUNTRY_TO_ISO2,
  canonicalCountryNamesByIso2,
  countryToIso2,
  iso2ToCountryName,
} from '@cuberoot/shared/country-flag';

export { countryToIso2, iso2ToCountryName };

const ISO2_TO_CANONICAL_NAME = canonicalCountryNamesByIso2();

// iso2 → 中文名(懒构建一次)。/zh 用户用中文搜国家时匹配用,数据来自 country-name
// 的 curated 表 + Intl.DisplayNames('zh-CN') 兜底。
let _iso2ToZh: Record<string, string> | null = null;
function iso2ToZhIndex(): Record<string, string> {
  if (!_iso2ToZh) {
    _iso2ToZh = {};
    for (const iso2 of Object.keys(ISO2_TO_CANONICAL_NAME)) {
      _iso2ToZh[iso2] = countryName(iso2, true);
    }
  }
  return _iso2ToZh;
}

interface SearchCountriesOpts { limit?: number; restrictTo?: Iterable<string>; }

export function searchCountries(
  query: string,
  opts: SearchCountriesOpts = {},
): Array<{ iso2: string; name: string }> {
  const q = query.trim().toLowerCase();
  const limit = opts.limit ?? 10;
  const restrict = opts.restrictTo ? new Set([...opts.restrictTo].map(s => s.toLowerCase())) : null;
  if (!q) {
    if (restrict) {
      return Array.from(restrict)
        .map(iso2 => ({ iso2, name: ISO2_TO_CANONICAL_NAME[iso2] ?? iso2.toUpperCase() }))
        .slice(0, limit);
    }
    return Object.entries(ISO2_TO_CANONICAL_NAME)
      .map(([iso2, name]) => ({ iso2, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);
  }
  const qRaw = query.trim();
  const byIso2 = new Map<string, { iso2: string; name: string; score: number }>();
  const bump = (iso2: string, score: number) => {
    if (score === 0) return;
    const cur = byIso2.get(iso2);
    if (!cur || score > cur.score) {
      byIso2.set(iso2, { iso2, name: ISO2_TO_CANONICAL_NAME[iso2] ?? iso2.toUpperCase(), score });
    }
  };
  for (const [aliasName, iso2] of Object.entries(WCA_COUNTRY_TO_ISO2)) {
    if (!iso2) continue;
    if (restrict && !restrict.has(iso2)) continue;
    const lower = aliasName.toLowerCase();
    let score = 0;
    if (iso2 === q) score = 100;
    else if (lower === q) score = 90;
    else if (lower.startsWith(q)) score = 60;
    else if (lower.includes(q)) score = 30;
    bump(iso2, score);
  }
  // 中文名匹配(/zh 用户直接打中文国家名,如「澳大利亚」「澳大」)
  for (const [iso2, zhName] of Object.entries(iso2ToZhIndex())) {
    if (restrict && !restrict.has(iso2)) continue;
    let score = 0;
    if (zhName === qRaw) score = 90;
    else if (zhName.startsWith(qRaw)) score = 60;
    else if (zhName.includes(qRaw)) score = 30;
    bump(iso2, score);
  }
  return Array.from(byIso2.values())
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ iso2, name }) => ({ iso2, name }));
}

// ── Async-loaded per-person + per-comp country maps ──

let _personCountries: Record<string, string> | null = null;
let _compCountries: Record<string, string> | null = null;
let _compNamesZh: Record<string, string> | null = null;
let _personsPromise: Promise<void> | null = null;
let _compsPromise: Promise<void> | null = null;
let _flagDataVersion = 0;

function loadPersons(): Promise<void> {
  if (!_personsPromise) {
    _personsPromise = fetch(statsUrl('/stats/person_countries.json'))
      .then(r => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((persons) => { _personCountries = persons; _flagDataVersion++; });
  }
  return _personsPromise;
}

function loadComps(): Promise<void> {
  if (!_compsPromise) {
    _compsPromise = Promise.all([
      fetch(statsUrl('/stats/comp_countries.json')).then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch(statsUrl('/stats/comp_names_zh.json')).then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ]).then(async ([comps, compZh]) => {
      _compCountries = comps;
      _compNamesZh = compZh as Record<string, string>;
      await refreshCnCompNamesFallback();
      _flagDataVersion++;
    });
  }
  return _compsPromise;
}

/**
 * 加载国旗 / 中文名映射表。
 *
 * person_countries.json 是全站最大的一张表 (1.3MB gzip),但只有 personFlagIso2 用得到 ——
 * 按比赛渲染国旗的页面 (比赛详情页等) 走 countryToIso2(user.region) + compFlagIso2,一个字节
 * 都用不上。`persons: false` 跳过它,只拉 comp_countries + comp_names_zh (共 ~170KB)。
 * 两部分各自 memoize,先瘦后全 / 先全后瘦都只各拉一次。
 */
export function loadFlagData(opts?: { persons?: boolean }): Promise<number> {
  const wantPersons = opts?.persons !== false;
  const parts = wantPersons ? [loadPersons(), loadComps()] : [loadComps()];
  return Promise.all(parts).then(() => _flagDataVersion);
}

async function refreshCnCompNamesFallback(): Promise<void> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5_000);
    const r = await fetch(apiUrl('/v1/cn-comp-names'), { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return;
    const j = (await r.json()) as { names?: Record<string, string> };
    if (!j.names || !_compNamesZh) return;
    for (const [k, v] of Object.entries(j.names)) {
      if (!_compNamesZh[k]) _compNamesZh[k] = v;
    }
  } catch {
    // silently ignore
  }
}

export function flagDataVersion(): number { return _flagDataVersion; }

export function extractWcaId(url: string): string | null {
  const m = url.match(/\/persons\/([A-Z0-9]+)/);
  return m ? m[1] : null;
}

export function extractCompId(url: string): string | null {
  const m = url.match(/\/competitions\/([^/#?]+)/);
  return m ? m[1] : null;
}

export function personFlagIso2(wcaId: string): string {
  return _personCountries?.[wcaId] ?? '';
}

export function compFlagIso2(compId: string): string {
  const countryId = _compCountries?.[compId] ?? '';
  if (!countryId) return '';
  return countryToIso2(countryId);
}

// 原始 WCA country_id(= comp_countries.json 的值 = wca_competitions.country_id),
// 未经 iso2 归一 —— 按国精确筛选(服务端 c.country_id=? / 客户端相等比较)用它,别用 iso2(多名同 iso2)。
export function compCountryId(compId: string): string {
  return _compCountries?.[compId] ?? '';
}

const MANUAL_COMP_NAMES_ZH: Record<string, string> = {
  'China Championship 2020': '中国锦标赛2020',
};

export function compNameZh(cellName: string): string {
  return MANUAL_COMP_NAMES_ZH[cellName] ?? _compNamesZh?.[cellName] ?? '';
}

// Reverse of comp_names_zh (Chinese official name → WCA canonical English name).
// Recon rows sometimes store a Chinese comp's *Chinese* name in `comp`; on the
// English site we recover the English name from it so it doesn't render Chinese.
// Memoized against _flagDataVersion (the map can grow via the cn-comp-names
// fallback). Exact-match on the raw value; falls back to '' when unknown.
let _compNamesEnByZh: Record<string, string> | null = null;
let _compNamesEnByZhVer = -1;

export function compNameEnFromZh(zhName: string): string {
  if (!zhName || !_compNamesZh) return '';
  if (_compNamesEnByZh === null || _compNamesEnByZhVer !== _flagDataVersion) {
    const rev: Record<string, string> = {};
    for (const [en, zh] of Object.entries(_compNamesZh)) {
      if (zh && !(zh in rev)) rev[zh] = en;
    }
    for (const [en, zh] of Object.entries(MANUAL_COMP_NAMES_ZH)) {
      if (zh && !(zh in rev)) rev[zh] = en;
    }
    _compNamesEnByZh = rev;
    _compNamesEnByZhVer = _flagDataVersion;
  }
  return _compNamesEnByZh[zhName] ?? '';
}

// All WCA canonical English names whose localized Chinese name CONTAINS `sub`
// (substring, case-insensitive). Powers Chinese-name search over data that only
// stores Latin comp names — caller sends the returned names to the backend.
// Returns [] until flag data has loaded (comp_names_zh empty).
export function compNamesByZhSubstring(sub: string): string[] {
  const s = sub.trim().toLowerCase();
  if (!s) return [];
  const out: string[] = [];
  const scan = (map: Record<string, string> | null) => {
    if (!map) return;
    for (const [en, zh] of Object.entries(map)) {
      if (zh && zh.toLowerCase().includes(s)) out.push(en);
    }
  };
  scan(MANUAL_COMP_NAMES_ZH);
  scan(_compNamesZh);
  return Array.from(new Set(out));
}
