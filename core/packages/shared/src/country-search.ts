import { WCA_COUNTRY_TO_ISO2, canonicalCountryNamesByIso2 } from './country_flag';
import { countryName } from './country-name';

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
