// Ported from packages/client-vite/src/utils/country_flags.ts.
// WCA country_id / country.name → ISO 3166-1 alpha-2 + async-loaded person/comp country maps.

import { apiUrl } from './api-base';
import { statsUrl } from './stats-base';
import { createCompNameEnResolver } from '@cuberoot/shared/comp-localize';
import {
  countryToIso2,
  iso2ToCountryName,
} from '@cuberoot/shared/country-flag';

export { countryToIso2, iso2ToCountryName };

export { searchCountries } from '@cuberoot/shared/country-search';

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
// fallback). Accepts official and shortened display names; unknown names stay unchanged.
let _compNamesEnByZh: ((name: string) => string) | null = null;
let _compNamesEnByZhVer = -1;

export function compNameEnFromZh(zhName: string): string {
  if (!zhName || !_compNamesZh) return '';
  if (_compNamesEnByZh === null || _compNamesEnByZhVer !== _flagDataVersion) {
    _compNamesEnByZh = createCompNameEnResolver({ ..._compNamesZh, ...MANUAL_COMP_NAMES_ZH });
    _compNamesEnByZhVer = _flagDataVersion;
  }
  return _compNamesEnByZh(zhName);
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
