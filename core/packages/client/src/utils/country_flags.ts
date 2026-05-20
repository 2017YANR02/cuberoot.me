import { apiUrl } from './api_base';

// NOTE: WCA country_id / country.name → ISO 3166-1 alpha-2 映射
// 用于前端渲染国旗（flag-icons CSS 库需要小写 ISO2 代码）
// 数据源：WCA countries 表（https://www.worldcubeassociation.org/export/developer）

// NOTE: WCA 数据库中国家值有两种格式：
// 1. country_id（如 "China", "USA"）— round_metric/ao_rounds 等基类直接输出
// 2. country.name（如 "China", "United States"）— rankings 等通过 JOIN 输出
// 此映射需覆盖两种格式
const COUNTRY_TO_ISO2: Record<string, string> = {
  // NOTE: 非标准地区（WCA 特有的 XK = Kosovo, XE/XS/XM/XN = 前南斯拉夫/前苏联地区）
  // NOTE: "Multiple Countries (Region)" 是 stats-build 跨国汇总行，无国旗
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
  'Congo': 'cg', 'Côte d\'Ivoire': 'ci', 'Cote d_Ivoire': 'ci', 'Democratic Republic of the Congo': 'cd',
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

/**
 * 从国家文本值获取 ISO2 代码
 * NOTE: 支持 WCA 两种格式（country_id 和 country.name）
 * @param country WCA 国家值（如 "China", "United States", "USA"）
 * @returns 小写 ISO2 代码（如 "cn"），未知国家返回空字符串
 */
export function countryToIso2(country: string): string {
  return COUNTRY_TO_ISO2[country] ?? '';
}

// NOTE: iso2 → 规范名（首次出现的别名作为规范名；"United States" 早于 "USA" 注册，自然胜出）
const ISO2_TO_CANONICAL_NAME: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [name, iso2] of Object.entries(COUNTRY_TO_ISO2)) {
    if (iso2 && !(iso2 in out)) out[iso2] = name;
  }
  return out;
})();

/** 通过 iso2 查规范名（找不到返回原 iso2 大写） */
export function iso2ToCountryName(iso2: string): string {
  return ISO2_TO_CANONICAL_NAME[iso2.toLowerCase()] ?? iso2.toUpperCase();
}

interface SearchCountriesOpts {
  limit?: number;
  /** 仅在此集合内的 iso2 才返回（用于限定下拉范围，如"只显示有数据的国家"） */
  restrictTo?: Iterable<string>;
}

/**
 * 搜索国家——支持英文全名、缩写（USA / UK）和 ISO2 直输（us / cn）。
 * @returns 去重后的 { iso2, name } 列表，按相关性排序
 */
export function searchCountries(
  query: string,
  opts: SearchCountriesOpts = {},
): Array<{ iso2: string; name: string }> {
  const q = query.trim().toLowerCase();
  const limit = opts.limit ?? 10;
  const restrict = opts.restrictTo ? new Set([...opts.restrictTo].map(s => s.toLowerCase())) : null;

  // NOTE: 空 query——按 restrict 顺序，或自由模式按规范名字母序，返回完整列表
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

  const byIso2 = new Map<string, { iso2: string; name: string; score: number }>();
  for (const [aliasName, iso2] of Object.entries(COUNTRY_TO_ISO2)) {
    if (!iso2) continue;
    if (restrict && !restrict.has(iso2)) continue;
    const lower = aliasName.toLowerCase();
    let score = 0;
    if (iso2 === q) score = 100;            // ISO2 完全匹配最优先
    else if (lower === q) score = 90;       // 国名完全匹配
    else if (lower.startsWith(q)) score = 60;
    else if (lower.includes(q)) score = 30;
    if (score === 0) continue;
    const canonical = ISO2_TO_CANONICAL_NAME[iso2] ?? aliasName;
    const cur = byIso2.get(iso2);
    if (!cur || score > cur.score) {
      byIso2.set(iso2, { iso2, name: canonical, score });
    }
  }
  return Array.from(byIso2.values())
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ iso2, name }) => ({ iso2, name }));
}

// ── 选手 / 比赛国旗数据（异步加载，模块级缓存） ──

// NOTE: 缓存——模块生命周期内只 fetch 一次
let _personCountries: Record<string, string> | null = null; // WCA ID → iso2
let _compCountries: Record<string, string> | null = null;   // comp ID → WCA country_id
let _compNamesZh: Record<string, string> | null = null;     // cell_name → 中文比赛名
let _loadPromise: Promise<void> | null = null;
// NOTE: 版本号——每次数据加载完成后递增，触发消费者 re-render
let _flagDataVersion = 0;

/**
 * 异步加载 person_countries.json + comp_countries.json + comp_names_zh.json（幂等）
 * NOTE: comp_names_zh.json 静态版每天 UTC 20:00 CI 刷一次,
 *       /v1/cn-comp-names 兜底 24h 内新公示但未进静态 JSON 的中国比赛
 *       (后到先到、覆盖静态,version 触发组件 re-render)。
 * @returns 当前版本号（用于 useEffect 依赖）
 */
export function loadFlagData(): Promise<number> {
  if (!_loadPromise) {
    _loadPromise = Promise.all([
      fetch('/stats/person_countries.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch('/stats/comp_countries.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch('/stats/comp_names_zh.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ]).then(async ([persons, comps, compZh]) => {
      _personCountries = persons;
      _compCountries = comps;
      _compNamesZh = compZh as Record<string, string>;
      // 兜底端点合并完才 resolve。/v1/cn-comp-names 有 nginx 1h cache + server in-memory,
      // 命中 < 50ms。await 进流程是为了 CompDetailPage / 列表渲染时新公示 CN 比赛也直接中文
      // (不会"先英文后中文闪一下")。失败已在内部 swallow,不会 hang。
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
    // 调用方在 await 完后统一 bump _flagDataVersion,这里不重复
  } catch {
    // 静默失败 — 静态 JSON 仍然可用,只是新公示赛事可能没中文
  }
}

/** 当前版本号（供 React state 对比） */
export function flagDataVersion(): number {
  return _flagDataVersion;
}

// ── URL 提取辅助 ──

/** 从 WCA persons URL 提取 WCA ID（如 2023GENG02） */
export function extractWcaId(url: string): string | null {
  const m = url.match(/\/persons\/([A-Z0-9]+)/);
  return m ? m[1] : null;
}

/** 从 WCA competitions URL 提取比赛 ID */
export function extractCompId(url: string): string | null {
  const m = url.match(/\/competitions\/([^/#?]+)/);
  return m ? m[1] : null;
}

// ── 查询函数（同步，加载前返回空字符串） ──

/**
 * 根据 WCA ID 获取选手国籍的 ISO2 代码
 * NOTE: person_countries.json 已是小写 iso2，直接返回
 */
export function personFlagIso2(wcaId: string): string {
  return _personCountries?.[wcaId] ?? '';
}

/**
 * 根据比赛 ID 获取比赛所在国家的 ISO2 代码
 * NOTE: comp_countries.json 值是 WCA country_id（如 \"China\"），复用 countryToIso2 转换
 */
export function compFlagIso2(compId: string): string {
  const countryId = _compCountries?.[compId] ?? '';
  if (!countryId) return '';
  return countryToIso2(countryId);
}

// cubing.com 没收录的比赛(取消 / 早期 / 数据缺失)手动补 — 优先级高于 _compNamesZh.
const MANUAL_COMP_NAMES_ZH: Record<string, string> = {
  'China Championship 2020': '中国锦标赛2020',
};

/**
 * 根据英文比赛名（cell_name）获取中文比赛名
 * NOTE: 数据源为 recon_aux_data.json 的 compNamesZh 映射表;
 *       手动 override 表 MANUAL_COMP_NAMES_ZH 优先,覆盖 cubing.com 漏录的比赛.
 * @param cellName 英文比赛名（如 "Beijing Winter 2026"）
 * @returns 中文比赛名（如 "2026WCA北京冬季魔方赛"），未找到返回空字符串
 */
export function compNameZh(cellName: string): string {
  return MANUAL_COMP_NAMES_ZH[cellName] ?? _compNamesZh?.[cellName] ?? '';
}
