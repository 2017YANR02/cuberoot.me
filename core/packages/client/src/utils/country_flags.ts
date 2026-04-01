// NOTE: WCA country_id / country.name → ISO 3166-1 alpha-2 映射
// 用于前端渲染国旗（flag-icons CSS 库需要小写 ISO2 代码）
// 数据源：WCA countries 表（https://www.worldcubeassociation.org/export/developer）
// DRY：国旗 CSS 类名生成复用 recon_utils.ts 的 flagClass()

import { flagClass } from './recon_utils';

// NOTE: WCA 数据库中国家值有两种格式：
// 1. country_id（如 "China", "USA"）— round_metric/ao_rounds 等基类直接输出
// 2. country.name（如 "China", "United States"）— rankings 等通过 JOIN 输出
// 此映射需覆盖两种格式
const COUNTRY_TO_ISO2: Record<string, string> = {
  // NOTE: 非标准地区（WCA 特有的 XK = Kosovo, XE/XS/XM/XN = 前南斯拉夫/前苏联地区）
  'Multiple Countries': '',
  'XK': 'xk',

  // Africa
  'Algeria': 'dz', 'Angola': 'ao', 'Benin': 'bj', 'Botswana': 'bw',
  'Burkina Faso': 'bf', 'Burundi': 'bi', 'Cabo Verde': 'cv', 'Cameroon': 'cm',
  'Central African Republic': 'cf', 'Chad': 'td', 'Comoros': 'km',
  'Congo': 'cg', 'Côte d\'Ivoire': 'ci', 'Democratic Republic of the Congo': 'cd',
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
  'Hong Kong': 'hk', 'India': 'in', 'Indonesia': 'id', 'Iran': 'ir',
  'Iraq': 'iq', 'Israel': 'il', 'Japan': 'jp', 'Jordan': 'jo',
  'Kazakhstan': 'kz', 'Korea': 'kr', 'Kuwait': 'kw', 'Kyrgyzstan': 'kg',
  'Laos': 'la', 'Lebanon': 'lb', 'Macau': 'mo', 'Malaysia': 'my',
  'Maldives': 'mv', 'Mongolia': 'mn', 'Myanmar': 'mm', 'Nepal': 'np',
  'North Korea': 'kp', 'Oman': 'om', 'Pakistan': 'pk', 'Palestine': 'ps',
  'Philippines': 'ph', 'Qatar': 'qa', 'Saudi Arabia': 'sa', 'Singapore': 'sg',
  'South Korea': 'kr', 'Republic of Korea': 'kr',
  'Sri Lanka': 'lk', 'Syria': 'sy', 'Taiwan': 'tw', 'Chinese Taipei': 'tw',
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

/**
 * 获取国旗 CSS 类名（封装 flagClass + countryToIso2）
 * NOTE: 一步到位——传入 WCA 国家文本，返回 flag-icons CSS 类名
 * @param country WCA 国家值
 * @returns CSS 类名（如 "fi fi-cn"），未知返回空字符串
 */
export function countryFlagClass(country: string): string {
  const iso2 = countryToIso2(country);
  return flagClass(iso2);
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
 * NOTE: comp_names_zh.json 由 compute_index.ts 从 recon_aux_data.json 提取
 * @returns 当前版本号（用于 useEffect 依赖）
 */
export function loadFlagData(): Promise<number> {
  if (_personCountries && _compCountries) return Promise.resolve(_flagDataVersion);
  if (!_loadPromise) {
    _loadPromise = Promise.all([
      fetch('/stats/person_countries.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch('/stats/comp_countries.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch('/stats/data/comp_names_zh.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ]).then(([persons, comps, compZh]) => {
      _personCountries = persons;
      _compCountries = comps;
      _compNamesZh = compZh as Record<string, string>;
      _flagDataVersion++;
    });
  }
  return _loadPromise.then(() => _flagDataVersion);
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

/**
 * 根据英文比赛名（cell_name）获取中文比赛名
 * NOTE: 数据源为 recon_aux_data.json 的 compNamesZh 映射表
 * @param cellName 英文比赛名（如 "Beijing Winter 2026"）
 * @returns 中文比赛名（如 "2026WCA北京冬季魔方赛"），未找到返回空字符串
 */
export function compNameZh(cellName: string): string {
  return _compNamesZh?.[cellName] ?? '';
}
