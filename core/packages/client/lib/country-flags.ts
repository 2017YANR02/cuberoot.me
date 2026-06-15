// Ported from packages/client-vite/src/utils/country_flags.ts.
// WCA country_id / country.name → ISO 3166-1 alpha-2 + async-loaded person/comp country maps.

import { apiUrl } from './api-base';
import { statsUrl } from './stats-base';
import { countryName } from './country-name';

const COUNTRY_TO_ISO2: Record<string, string> = {
  'Multiple Countries': '',
  'Multiple Countries (World)': '', 'Multiple Countries (Africa)': '',
  'Multiple Countries (Americas)': '', 'Multiple Countries (North America)': '',
  'Multiple Countries (South America)': '', 'Multiple Countries (Asia)': '',
  'Multiple Countries (Europe)': '', 'Multiple Countries (Oceania)': '',
  'XK': 'xk',

  // Africa
  'Algeria': 'dz', 'Angola': 'ao', 'Benin': 'bj', 'Botswana': 'bw',
  'Burkina Faso': 'bf', 'Burundi': 'bi', 'Cabo Verde': 'cv', 'Cameroon': 'cm',
  'Central African Republic': 'cf', 'Chad': 'td', 'Comoros': 'km',
  'Congo': 'cg', "Côte d'Ivoire": 'ci', 'Cote d_Ivoire': 'ci', 'Democratic Republic of the Congo': 'cd',
  'Djibouti': 'dj', 'Egypt': 'eg', 'Equatorial Guinea': 'gq', 'Eritrea': 'er',
  'Eswatini': 'sz', 'Ethiopia': 'et', 'Gabon': 'ga', 'Gambia': 'gm',
  'Ghana': 'gh', 'Guinea': 'gn', 'Guinea-Bissau': 'gw', 'Ivory Coast': 'ci',
  'Kenya': 'ke', 'Lesotho': 'ls', 'Liberia': 'lr', 'Libya': 'ly',
  'Madagascar': 'mg', 'Malawi': 'mw', 'Mali': 'ml', 'Mauritania': 'mr',
  'Mauritius': 'mu', 'Morocco': 'ma', 'Mozambique': 'mz', 'Namibia': 'na',
  'Niger': 'ne', 'Nigeria': 'ng', 'Rwanda': 'rw',
  'São Tomé and Príncipe': 'st', 'Senegal': 'sn', 'Seychelles': 'sc',
  'Sierra Leone': 'sl', 'Somalia': 'so', 'South Africa': 'za', 'South Sudan': 'ss',
  'Sudan': 'sd', 'Tanzania': 'tz', 'Togo': 'tg', 'Tunisia': 'tn',
  'Uganda': 'ug', 'Zambia': 'zm', 'Zimbabwe': 'zw',

  // Americas
  'Antigua and Barbuda': 'ag', 'Argentina': 'ar', 'Bahamas': 'bs',
  'Barbados': 'bb', 'Belize': 'bz', 'Bolivia': 'bo', 'Brazil': 'br',
  'Canada': 'ca', 'Chile': 'cl', 'Colombia': 'co', 'Costa Rica': 'cr',
  'Cuba': 'cu', 'Dominica': 'dm', 'Dominican Republic': 'do', 'Ecuador': 'ec',
  'El Salvador': 'sv', 'Grenada': 'gd', 'Guatemala': 'gt', 'Guyana': 'gy',
  'Haiti': 'ht', 'Honduras': 'hn', 'Jamaica': 'jm', 'Mexico': 'mx',
  'Nicaragua': 'ni', 'Panama': 'pa', 'Paraguay': 'py', 'Peru': 'pe',
  'Saint Kitts and Nevis': 'kn', 'Saint Lucia': 'lc',
  'Saint Vincent and the Grenadines': 'vc', 'Suriname': 'sr',
  'Trinidad and Tobago': 'tt', 'United States': 'us', 'USA': 'us',
  'Uruguay': 'uy', 'Venezuela': 've',

  // Asia
  'Afghanistan': 'af', 'Armenia': 'am', 'Azerbaijan': 'az', 'Bahrain': 'bh',
  'Bangladesh': 'bd', 'Bhutan': 'bt', 'Brunei': 'bn', 'Cambodia': 'kh',
  'China': 'cn', 'Cyprus': 'cy', 'East Timor': 'tl', 'Georgia': 'ge',
  'Hong Kong': 'hk', 'Hong Kong, China': 'hk', 'India': 'in', 'Indonesia': 'id', 'Iran': 'ir',
  'Iraq': 'iq', 'Israel': 'il', 'Japan': 'jp', 'Jordan': 'jo',
  'Kazakhstan': 'kz', 'Korea': 'kr', 'Kuwait': 'kw', 'Kyrgyzstan': 'kg',
  'Laos': 'la', 'Lebanon': 'lb', 'Macau': 'mo', 'Macau, China': 'mo', 'Malaysia': 'my',
  'Maldives': 'mv', 'Mongolia': 'mn', 'Myanmar': 'mm', 'Nepal': 'np',
  'North Korea': 'kp', 'Oman': 'om', 'Pakistan': 'pk', 'Palestine': 'ps',
  'Philippines': 'ph', 'Qatar': 'qa', 'Saudi Arabia': 'sa', 'Singapore': 'sg',
  'South Korea': 'kr', 'Republic of Korea': 'kr',
  'Sri Lanka': 'lk', 'Syria': 'sy', 'Chinese Taipei': 'tw', 'Taiwan': 'tw',
  'Tajikistan': 'tj', 'Thailand': 'th', 'Timor-Leste': 'tl',
  'Turkey': 'tr', 'Turkmenistan': 'tm',
  'United Arab Emirates': 'ae', 'Uzbekistan': 'uz', 'Vietnam': 'vn', 'Yemen': 'ye',

  // Europe
  'Albania': 'al', 'Andorra': 'ad', 'Austria': 'at', 'Belarus': 'by',
  'Belgium': 'be', 'Bosnia and Herzegovina': 'ba', 'Bulgaria': 'bg',
  'Croatia': 'hr', 'Czech Republic': 'cz', 'Czechia': 'cz',
  'Denmark': 'dk', 'Estonia': 'ee', 'Finland': 'fi', 'France': 'fr',
  'Germany': 'de', 'Greece': 'gr', 'Hungary': 'hu', 'Iceland': 'is',
  'Ireland': 'ie', 'Italy': 'it', 'Kosovo': 'xk', 'Latvia': 'lv',
  'Liechtenstein': 'li', 'Lithuania': 'lt', 'Luxembourg': 'lu',
  'Malta': 'mt', 'Moldova': 'md', 'Monaco': 'mc', 'Montenegro': 'me',
  'Netherlands': 'nl', 'North Macedonia': 'mk', 'Norway': 'no',
  'Poland': 'pl', 'Portugal': 'pt', 'Romania': 'ro', 'Russia': 'ru',
  'San Marino': 'sm', 'Serbia': 'rs', 'Slovakia': 'sk', 'Slovenia': 'si',
  'Spain': 'es', 'Sweden': 'se', 'Switzerland': 'ch',
  'Ukraine': 'ua', 'United Kingdom': 'gb',

  // Oceania
  'Australia': 'au', 'Fiji': 'fj', 'Kiribati': 'ki',
  'Marshall Islands': 'mh', 'Micronesia': 'fm', 'Nauru': 'nr',
  'New Zealand': 'nz', 'Palau': 'pw', 'Papua New Guinea': 'pg',
  'Samoa': 'ws', 'Solomon Islands': 'sb', 'Tonga': 'to',
  'Tuvalu': 'tv', 'Vanuatu': 'vu',
};

export function countryToIso2(country: string): string {
  return COUNTRY_TO_ISO2[country] ?? '';
}

const ISO2_TO_CANONICAL_NAME: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [name, iso2] of Object.entries(COUNTRY_TO_ISO2)) {
    if (iso2 && !(iso2 in out)) out[iso2] = name;
  }
  return out;
})();

export function iso2ToCountryName(iso2: string): string {
  return ISO2_TO_CANONICAL_NAME[iso2.toLowerCase()] ?? iso2.toUpperCase();
}

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
  for (const [aliasName, iso2] of Object.entries(COUNTRY_TO_ISO2)) {
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
let _loadPromise: Promise<void> | null = null;
let _flagDataVersion = 0;

export function loadFlagData(): Promise<number> {
  if (!_loadPromise) {
    _loadPromise = Promise.all([
      fetch(statsUrl('/stats/person_countries.json')).then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch(statsUrl('/stats/comp_countries.json')).then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch(statsUrl('/stats/comp_names_zh.json')).then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ]).then(async ([persons, comps, compZh]) => {
      _personCountries = persons;
      _compCountries = comps;
      _compNamesZh = compZh as Record<string, string>;
      await refreshCnCompNamesFallback();
      _flagDataVersion++;
    });
  }
  return _loadPromise.then(() => _flagDataVersion);
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

const MANUAL_COMP_NAMES_ZH: Record<string, string> = {
  'China Championship 2020': '中国锦标赛2020',
};

export function compNameZh(cellName: string): string {
  return MANUAL_COMP_NAMES_ZH[cellName] ?? _compNamesZh?.[cellName] ?? '';
}
