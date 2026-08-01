// /timezone 的时区目录 —— 常用城市的双语名 + 国旗码,外加平台自带的全量 IANA 列表兜底。
//
// 为什么手维护:Intl 能给出「中国标准时间」这种时区名,给不出「上海 / 洛杉矶」这种城市名的
// 中文,而选时区时人找的是城市。所以常用的 ~120 条手写双语名 + 搜索别名(北京→上海时区、
// LA→洛杉矶、印度→加尔各答时区),其余走 Intl.supportedValuesOf 全量表、显示 IANA 原文。

export interface ZoneEntry {
  /** IANA id */
  tz: string;
  zh: string;
  en: string;
  /** ISO alpha-2,用于渲染国旗;UTC 这种无国别的留空 */
  iso2: string;
  /** 额外可搜命中的词(同区大城市 / 国名 / 缩写),空格分隔 */
  alias?: string;
}

// 常用时区,大致按洲 → 由东往西排。同一偏移的近邻城市不重复列(墨尔本例外:
// 它和悉尼同区但搜索量高,靠 alias 命中而不是单列一行)。
export const POPULAR_ZONES: ZoneEntry[] = [
  // 东亚 / 东南亚
  { tz: 'Asia/Shanghai', zh: '上海', en: 'Shanghai', iso2: 'CN', alias: '北京 Beijing 中国 China 深圳 广州 杭州 成都 CST 国内' },
  { tz: 'Asia/Urumqi', zh: '乌鲁木齐', en: 'Urumqi', iso2: 'CN', alias: '新疆 Xinjiang' },
  { tz: 'Asia/Hong_Kong', zh: '香港', en: 'Hong Kong', iso2: 'HK', alias: 'HK HKT' },
  { tz: 'Asia/Macau', zh: '澳门', en: 'Macau', iso2: 'MO' },
  { tz: 'Asia/Taipei', zh: '台北', en: 'Taipei', iso2: 'TW', alias: '台湾 Taiwan' },
  { tz: 'Asia/Tokyo', zh: '东京', en: 'Tokyo', iso2: 'JP', alias: '日本 Japan 大阪 Osaka JST' },
  { tz: 'Asia/Seoul', zh: '首尔', en: 'Seoul', iso2: 'KR', alias: '韩国 Korea KST' },
  { tz: 'Asia/Pyongyang', zh: '平壤', en: 'Pyongyang', iso2: 'KP', alias: '朝鲜' },
  { tz: 'Asia/Manila', zh: '马尼拉', en: 'Manila', iso2: 'PH', alias: '菲律宾 Philippines' },
  { tz: 'Asia/Singapore', zh: '新加坡', en: 'Singapore', iso2: 'SG', alias: 'SGT' },
  { tz: 'Asia/Kuala_Lumpur', zh: '吉隆坡', en: 'Kuala Lumpur', iso2: 'MY', alias: '马来西亚 Malaysia' },
  { tz: 'Asia/Jakarta', zh: '雅加达', en: 'Jakarta', iso2: 'ID', alias: '印度尼西亚 印尼 Indonesia 巴厘岛 Bali' },
  { tz: 'Asia/Bangkok', zh: '曼谷', en: 'Bangkok', iso2: 'TH', alias: '泰国 Thailand' },
  { tz: 'Asia/Ho_Chi_Minh', zh: '胡志明市', en: 'Ho Chi Minh City', iso2: 'VN', alias: '越南 Vietnam 西贡 Saigon 河内 Hanoi' },
  { tz: 'Asia/Yangon', zh: '仰光', en: 'Yangon', iso2: 'MM', alias: '缅甸 Myanmar' },
  { tz: 'Asia/Ulaanbaatar', zh: '乌兰巴托', en: 'Ulaanbaatar', iso2: 'MN', alias: '蒙古 Mongolia' },

  // 南亚 / 中亚 / 西亚
  { tz: 'Asia/Kolkata', zh: '加尔各答', en: 'Kolkata', iso2: 'IN', alias: '印度 India 新德里 Delhi 孟买 Mumbai 班加罗尔 Bangalore IST' },
  { tz: 'Asia/Kathmandu', zh: '加德满都', en: 'Kathmandu', iso2: 'NP', alias: '尼泊尔 Nepal' },
  { tz: 'Asia/Dhaka', zh: '达卡', en: 'Dhaka', iso2: 'BD', alias: '孟加拉国 Bangladesh' },
  { tz: 'Asia/Colombo', zh: '科伦坡', en: 'Colombo', iso2: 'LK', alias: '斯里兰卡 Sri Lanka' },
  { tz: 'Asia/Karachi', zh: '卡拉奇', en: 'Karachi', iso2: 'PK', alias: '巴基斯坦 Pakistan 拉合尔 Lahore' },
  { tz: 'Asia/Kabul', zh: '喀布尔', en: 'Kabul', iso2: 'AF', alias: '阿富汗 Afghanistan' },
  { tz: 'Asia/Tashkent', zh: '塔什干', en: 'Tashkent', iso2: 'UZ', alias: '乌兹别克斯坦 Uzbekistan' },
  { tz: 'Asia/Almaty', zh: '阿拉木图', en: 'Almaty', iso2: 'KZ', alias: '哈萨克斯坦 Kazakhstan' },
  { tz: 'Asia/Dubai', zh: '迪拜', en: 'Dubai', iso2: 'AE', alias: '阿联酋 UAE 阿布扎比 Abu Dhabi' },
  { tz: 'Asia/Qatar', zh: '多哈', en: 'Doha', iso2: 'QA', alias: '卡塔尔 Qatar' },
  { tz: 'Asia/Riyadh', zh: '利雅得', en: 'Riyadh', iso2: 'SA', alias: '沙特 Saudi' },
  { tz: 'Asia/Tehran', zh: '德黑兰', en: 'Tehran', iso2: 'IR', alias: '伊朗 Iran' },
  { tz: 'Asia/Baghdad', zh: '巴格达', en: 'Baghdad', iso2: 'IQ', alias: '伊拉克 Iraq' },
  { tz: 'Asia/Jerusalem', zh: '耶路撒冷', en: 'Jerusalem', iso2: 'IL', alias: '以色列 Israel 特拉维夫 Tel Aviv' },
  { tz: 'Asia/Baku', zh: '巴库', en: 'Baku', iso2: 'AZ', alias: '阿塞拜疆 Azerbaijan' },
  { tz: 'Asia/Tbilisi', zh: '第比利斯', en: 'Tbilisi', iso2: 'GE', alias: '格鲁吉亚 Georgia' },
  { tz: 'Asia/Yerevan', zh: '埃里温', en: 'Yerevan', iso2: 'AM', alias: '亚美尼亚 Armenia' },

  // 俄罗斯
  { tz: 'Asia/Vladivostok', zh: '符拉迪沃斯托克', en: 'Vladivostok', iso2: 'RU', alias: '海参崴 俄罗斯 Russia' },
  { tz: 'Asia/Novosibirsk', zh: '新西伯利亚', en: 'Novosibirsk', iso2: 'RU', alias: '俄罗斯 Russia' },
  { tz: 'Asia/Yekaterinburg', zh: '叶卡捷琳堡', en: 'Yekaterinburg', iso2: 'RU', alias: '俄罗斯 Russia' },
  { tz: 'Europe/Moscow', zh: '莫斯科', en: 'Moscow', iso2: 'RU', alias: '俄罗斯 Russia 圣彼得堡 MSK' },

  // 欧洲
  { tz: 'Europe/Istanbul', zh: '伊斯坦布尔', en: 'Istanbul', iso2: 'TR', alias: '土耳其 Turkey 安卡拉' },
  { tz: 'Europe/Athens', zh: '雅典', en: 'Athens', iso2: 'GR', alias: '希腊 Greece' },
  { tz: 'Europe/Bucharest', zh: '布加勒斯特', en: 'Bucharest', iso2: 'RO', alias: '罗马尼亚 Romania' },
  { tz: 'Europe/Sofia', zh: '索非亚', en: 'Sofia', iso2: 'BG', alias: '保加利亚 Bulgaria' },
  { tz: 'Europe/Kyiv', zh: '基辅', en: 'Kyiv', iso2: 'UA', alias: '乌克兰 Ukraine Kiev' },
  { tz: 'Europe/Helsinki', zh: '赫尔辛基', en: 'Helsinki', iso2: 'FI', alias: '芬兰 Finland' },
  { tz: 'Europe/Berlin', zh: '柏林', en: 'Berlin', iso2: 'DE', alias: '德国 Germany 慕尼黑 Munich 法兰克福 Frankfurt CET' },
  { tz: 'Europe/Paris', zh: '巴黎', en: 'Paris', iso2: 'FR', alias: '法国 France' },
  { tz: 'Europe/Amsterdam', zh: '阿姆斯特丹', en: 'Amsterdam', iso2: 'NL', alias: '荷兰 Netherlands' },
  { tz: 'Europe/Brussels', zh: '布鲁塞尔', en: 'Brussels', iso2: 'BE', alias: '比利时 Belgium' },
  { tz: 'Europe/Zurich', zh: '苏黎世', en: 'Zurich', iso2: 'CH', alias: '瑞士 Switzerland 日内瓦 Geneva' },
  { tz: 'Europe/Vienna', zh: '维也纳', en: 'Vienna', iso2: 'AT', alias: '奥地利 Austria' },
  { tz: 'Europe/Prague', zh: '布拉格', en: 'Prague', iso2: 'CZ', alias: '捷克 Czechia' },
  { tz: 'Europe/Warsaw', zh: '华沙', en: 'Warsaw', iso2: 'PL', alias: '波兰 Poland' },
  { tz: 'Europe/Budapest', zh: '布达佩斯', en: 'Budapest', iso2: 'HU', alias: '匈牙利 Hungary' },
  { tz: 'Europe/Belgrade', zh: '贝尔格莱德', en: 'Belgrade', iso2: 'RS', alias: '塞尔维亚 Serbia' },
  { tz: 'Europe/Rome', zh: '罗马', en: 'Rome', iso2: 'IT', alias: '意大利 Italy 米兰 Milan' },
  { tz: 'Europe/Madrid', zh: '马德里', en: 'Madrid', iso2: 'ES', alias: '西班牙 Spain 巴塞罗那 Barcelona' },
  { tz: 'Europe/Stockholm', zh: '斯德哥尔摩', en: 'Stockholm', iso2: 'SE', alias: '瑞典 Sweden' },
  { tz: 'Europe/Oslo', zh: '奥斯陆', en: 'Oslo', iso2: 'NO', alias: '挪威 Norway' },
  { tz: 'Europe/Copenhagen', zh: '哥本哈根', en: 'Copenhagen', iso2: 'DK', alias: '丹麦 Denmark' },
  { tz: 'Europe/London', zh: '伦敦', en: 'London', iso2: 'GB', alias: '英国 UK Britain 曼彻斯特 Manchester GMT BST' },
  { tz: 'Europe/Dublin', zh: '都柏林', en: 'Dublin', iso2: 'IE', alias: '爱尔兰 Ireland' },
  { tz: 'Europe/Lisbon', zh: '里斯本', en: 'Lisbon', iso2: 'PT', alias: '葡萄牙 Portugal' },
  { tz: 'Atlantic/Reykjavik', zh: '雷克雅未克', en: 'Reykjavik', iso2: 'IS', alias: '冰岛 Iceland' },

  // 非洲
  { tz: 'Africa/Cairo', zh: '开罗', en: 'Cairo', iso2: 'EG', alias: '埃及 Egypt' },
  { tz: 'Africa/Johannesburg', zh: '约翰内斯堡', en: 'Johannesburg', iso2: 'ZA', alias: '南非 South Africa 开普敦 Cape Town' },
  { tz: 'Africa/Nairobi', zh: '内罗毕', en: 'Nairobi', iso2: 'KE', alias: '肯尼亚 Kenya' },
  { tz: 'Africa/Addis_Ababa', zh: '亚的斯亚贝巴', en: 'Addis Ababa', iso2: 'ET', alias: '埃塞俄比亚 Ethiopia' },
  { tz: 'Africa/Lagos', zh: '拉各斯', en: 'Lagos', iso2: 'NG', alias: '尼日利亚 Nigeria' },
  { tz: 'Africa/Accra', zh: '阿克拉', en: 'Accra', iso2: 'GH', alias: '加纳 Ghana' },
  { tz: 'Africa/Casablanca', zh: '卡萨布兰卡', en: 'Casablanca', iso2: 'MA', alias: '摩洛哥 Morocco' },
  { tz: 'Africa/Algiers', zh: '阿尔及尔', en: 'Algiers', iso2: 'DZ', alias: '阿尔及利亚 Algeria' },
  { tz: 'Africa/Tunis', zh: '突尼斯', en: 'Tunis', iso2: 'TN' },

  // 北美
  { tz: 'America/St_Johns', zh: '圣约翰斯', en: "St. John's", iso2: 'CA', alias: '纽芬兰 Newfoundland 加拿大 Canada' },
  { tz: 'America/Halifax', zh: '哈利法克斯', en: 'Halifax', iso2: 'CA', alias: '加拿大 Canada 大西洋时间 Atlantic' },
  { tz: 'America/New_York', zh: '纽约', en: 'New York', iso2: 'US', alias: '美国 USA 东部 华盛顿 Washington 波士顿 Boston 迈阿密 Miami 亚特兰大 Atlanta EST EDT' },
  { tz: 'America/Toronto', zh: '多伦多', en: 'Toronto', iso2: 'CA', alias: '加拿大 Canada 渥太华 Ottawa 蒙特利尔 Montreal' },
  { tz: 'America/Chicago', zh: '芝加哥', en: 'Chicago', iso2: 'US', alias: '美国 USA 中部 休斯顿 Houston 达拉斯 Dallas CST CDT' },
  { tz: 'America/Winnipeg', zh: '温尼伯', en: 'Winnipeg', iso2: 'CA', alias: '加拿大 Canada' },
  { tz: 'America/Denver', zh: '丹佛', en: 'Denver', iso2: 'US', alias: '美国 USA 山地 盐湖城 Salt Lake City MST MDT' },
  { tz: 'America/Edmonton', zh: '埃德蒙顿', en: 'Edmonton', iso2: 'CA', alias: '加拿大 Canada 卡尔加里 Calgary' },
  { tz: 'America/Phoenix', zh: '凤凰城', en: 'Phoenix', iso2: 'US', alias: '美国 USA 亚利桑那 Arizona 不用夏令时' },
  { tz: 'America/Los_Angeles', zh: '洛杉矶', en: 'Los Angeles', iso2: 'US', alias: '美国 USA 西部 LA 旧金山 San Francisco 西雅图 Seattle 硅谷 PST PDT' },
  { tz: 'America/Vancouver', zh: '温哥华', en: 'Vancouver', iso2: 'CA', alias: '加拿大 Canada' },
  { tz: 'America/Anchorage', zh: '安克雷奇', en: 'Anchorage', iso2: 'US', alias: '美国 USA 阿拉斯加 Alaska' },
  { tz: 'Pacific/Honolulu', zh: '檀香山', en: 'Honolulu', iso2: 'US', alias: '美国 USA 夏威夷 Hawaii' },
  { tz: 'America/Mexico_City', zh: '墨西哥城', en: 'Mexico City', iso2: 'MX', alias: '墨西哥 Mexico' },
  { tz: 'America/Tijuana', zh: '蒂华纳', en: 'Tijuana', iso2: 'MX', alias: '墨西哥 Mexico' },
  { tz: 'America/Guatemala', zh: '危地马拉城', en: 'Guatemala City', iso2: 'GT' },
  { tz: 'America/Costa_Rica', zh: '圣何塞', en: 'San José', iso2: 'CR', alias: '哥斯达黎加 Costa Rica' },
  { tz: 'America/Panama', zh: '巴拿马城', en: 'Panama City', iso2: 'PA', alias: '巴拿马 Panama' },
  { tz: 'America/Havana', zh: '哈瓦那', en: 'Havana', iso2: 'CU', alias: '古巴 Cuba' },
  { tz: 'America/Jamaica', zh: '金斯敦', en: 'Kingston', iso2: 'JM', alias: '牙买加 Jamaica' },
  { tz: 'America/Santo_Domingo', zh: '圣多明各', en: 'Santo Domingo', iso2: 'DO', alias: '多米尼加 Dominican' },
  { tz: 'America/Puerto_Rico', zh: '圣胡安', en: 'San Juan', iso2: 'PR', alias: '波多黎各 Puerto Rico' },

  // 南美
  { tz: 'America/Bogota', zh: '波哥大', en: 'Bogotá', iso2: 'CO', alias: '哥伦比亚 Colombia' },
  { tz: 'America/Lima', zh: '利马', en: 'Lima', iso2: 'PE', alias: '秘鲁 Peru' },
  { tz: 'America/Guayaquil', zh: '瓜亚基尔', en: 'Guayaquil', iso2: 'EC', alias: '厄瓜多尔 Ecuador 基多 Quito' },
  { tz: 'America/Caracas', zh: '加拉加斯', en: 'Caracas', iso2: 'VE', alias: '委内瑞拉 Venezuela' },
  { tz: 'America/La_Paz', zh: '拉巴斯', en: 'La Paz', iso2: 'BO', alias: '玻利维亚 Bolivia' },
  { tz: 'America/Santiago', zh: '圣地亚哥', en: 'Santiago', iso2: 'CL', alias: '智利 Chile' },
  { tz: 'America/Asuncion', zh: '亚松森', en: 'Asunción', iso2: 'PY', alias: '巴拉圭 Paraguay' },
  { tz: 'America/Manaus', zh: '马瑙斯', en: 'Manaus', iso2: 'BR', alias: '巴西 Brazil 亚马逊' },
  { tz: 'America/Sao_Paulo', zh: '圣保罗', en: 'São Paulo', iso2: 'BR', alias: '巴西 Brazil 里约 Rio' },
  { tz: 'America/Argentina/Buenos_Aires', zh: '布宜诺斯艾利斯', en: 'Buenos Aires', iso2: 'AR', alias: '阿根廷 Argentina' },
  { tz: 'America/Montevideo', zh: '蒙得维的亚', en: 'Montevideo', iso2: 'UY', alias: '乌拉圭 Uruguay' },

  // 大洋洲
  { tz: 'Australia/Perth', zh: '珀斯', en: 'Perth', iso2: 'AU', alias: '澳大利亚 Australia 西澳' },
  { tz: 'Australia/Darwin', zh: '达尔文', en: 'Darwin', iso2: 'AU', alias: '澳大利亚 Australia' },
  { tz: 'Australia/Adelaide', zh: '阿德莱德', en: 'Adelaide', iso2: 'AU', alias: '澳大利亚 Australia' },
  { tz: 'Australia/Brisbane', zh: '布里斯班', en: 'Brisbane', iso2: 'AU', alias: '澳大利亚 Australia 昆士兰 黄金海岸' },
  { tz: 'Australia/Sydney', zh: '悉尼', en: 'Sydney', iso2: 'AU', alias: '澳大利亚 Australia 墨尔本 Melbourne 堪培拉 Canberra AEST' },
  { tz: 'Australia/Hobart', zh: '霍巴特', en: 'Hobart', iso2: 'AU', alias: '澳大利亚 Australia 塔斯马尼亚' },
  { tz: 'Pacific/Port_Moresby', zh: '莫尔兹比港', en: 'Port Moresby', iso2: 'PG', alias: '巴布亚新几内亚' },
  { tz: 'Pacific/Guam', zh: '关岛', en: 'Guam', iso2: 'GU' },
  { tz: 'Pacific/Auckland', zh: '奥克兰', en: 'Auckland', iso2: 'NZ', alias: '新西兰 New Zealand 惠灵顿 Wellington' },
  { tz: 'Pacific/Fiji', zh: '苏瓦', en: 'Suva', iso2: 'FJ', alias: '斐济 Fiji' },
  { tz: 'Pacific/Tahiti', zh: '帕皮提', en: 'Papeete', iso2: 'PF', alias: '塔希提 大溪地 Tahiti' },

  // 无国别
  { tz: 'UTC', zh: '协调世界时', en: 'UTC', iso2: '', alias: 'UTC GMT 格林尼治 世界时 零时区' },
];

const BY_TZ = new Map(POPULAR_ZONES.map((z) => [z.tz, z]));

// IANA 前缀的中文,给不在常用表里的时区拼名用。
const AREA_ZH: Record<string, string> = {
  Africa: '非洲', America: '美洲', Antarctica: '南极洲', Arctic: '北极',
  Asia: '亚洲', Atlantic: '大西洋', Australia: '澳洲', Europe: '欧洲',
  Indian: '印度洋', Pacific: '太平洋', Etc: '其它',
};

/** IANA id 的最后一段 → 可读城市名(Sao_Paulo → Sao Paulo)。 */
function tailCity(tz: string): string {
  const seg = tz.split('/').pop() ?? tz;
  return seg.replace(/_/g, ' ');
}

/** 显示名:常用表命中就用双语名,否则「洲 · 城市」拼出来(城市保持英文原文)。 */
export function zoneLabel(tz: string, isZh: boolean): string {
  const hit = BY_TZ.get(tz);
  if (hit) return isZh ? hit.zh : hit.en;
  if (!isZh) return tailCity(tz);
  const area = AREA_ZH[tz.split('/')[0]];
  return area ? `${area} ${tailCity(tz)}` : tailCity(tz);
}

/** 是否在手维护的常用表里。选择器只给这些算 UTC 偏移(全量 400+ 条逐个建格式化器会卡首帧)。 */
export function isPopularZone(tz: string): boolean {
  return BY_TZ.has(tz);
}

/** 国旗码;不在常用表里的时区没有(返回空串,调用方不渲染国旗)。 */
export function zoneIso2(tz: string): string {
  return BY_TZ.get(tz)?.iso2 ?? '';
}

let allZonesCache: string[] | null = null;

/** 平台全量 IANA 列表(Intl.supportedValuesOf,老引擎缺这个 API 时退回常用表)。 */
export function allZones(): string[] {
  if (allZonesCache) return allZonesCache;
  let list: string[] = [];
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (typeof supported === 'function') list = supported('timeZone');
  } catch {
    list = [];
  }
  if (list.length === 0) list = POPULAR_ZONES.map((z) => z.tz);
  allZonesCache = list;
  return list;
}

/**
 * 选择器用的完整候选:常用表在前(按表内顺序,即由东往西),其余 IANA 时区按 id 排在后面。
 * 一次算好缓存,选择器每次开都用同一份。
 */
let optionsCache: ZoneEntry[] | null = null;

export function zoneOptions(): ZoneEntry[] {
  if (optionsCache) return optionsCache;
  const rest = allZones()
    .filter((tz) => !BY_TZ.has(tz))
    .sort()
    .map<ZoneEntry>((tz) => ({ tz, zh: zoneLabel(tz, true), en: zoneLabel(tz, false), iso2: '' }));
  optionsCache = [...POPULAR_ZONES, ...rest];
  return optionsCache;
}

/** 一条时区的可搜文本(双语名 + IANA id + 别名),喂给 ListSelect 的 searchTerms。 */
export function zoneSearchTerms(z: ZoneEntry): string {
  return `${z.tz} ${z.tz.replace(/[_/]/g, ' ')} ${z.zh} ${z.en} ${z.alias ?? ''}`;
}
