// ISO alpha-2 → 国家名（英 / 中），UI 展示用。
// NOTE: 这是 i18n 的合法例外（GlobePage 既有惯例）：国家名表既要英又要中且 ~60 行，不走 t() JSON。
//       新代码渲染国家名一律 `countryName(iso, isZh)`，不要再 inline 一份表。
export const COUNTRY_EN: Record<string, string> = {
  CN: 'China', US: 'USA', JP: 'Japan', KR: 'Korea', IN: 'India',
  DE: 'Germany', FR: 'France', GB: 'UK', IT: 'Italy', ES: 'Spain',
  PL: 'Poland', BR: 'Brazil', CA: 'Canada', AU: 'Australia', MX: 'Mexico',
  TW: 'Chinese Taipei', HK: 'Hong Kong', RU: 'Russia', TR: 'Turkey', ID: 'Indonesia',
  NL: 'Netherlands', BE: 'Belgium', SE: 'Sweden', NO: 'Norway', FI: 'Finland',
  DK: 'Denmark', CH: 'Switzerland', AT: 'Austria', CZ: 'Czechia', SK: 'Slovakia',
  HU: 'Hungary', RO: 'Romania', BG: 'Bulgaria', GR: 'Greece', PT: 'Portugal',
  IE: 'Ireland', NZ: 'New Zealand', SG: 'Singapore', MY: 'Malaysia', TH: 'Thailand',
  VN: 'Vietnam', PH: 'Philippines', AR: 'Argentina', CL: 'Chile', CO: 'Colombia',
  PE: 'Peru', ZA: 'South Africa', EG: 'Egypt', AE: 'UAE', SA: 'Saudi Arabia',
  IL: 'Israel', IR: 'Iran', PK: 'Pakistan', BD: 'Bangladesh', LK: 'Sri Lanka',
  NP: 'Nepal', UA: 'Ukraine', BY: 'Belarus', EE: 'Estonia', LV: 'Latvia', LT: 'Lithuania',
};

export const COUNTRY_ZH: Record<string, string> = {
  CN: '中国', US: '美国', JP: '日本', KR: '韩国', IN: '印度',
  DE: '德国', FR: '法国', GB: '英国', IT: '意大利', ES: '西班牙',
  PL: '波兰', BR: '巴西', CA: '加拿大', AU: '澳大利亚', MX: '墨西哥',
  TW: '中华台北', HK: '中国香港', RU: '俄罗斯', TR: '土耳其', ID: '印度尼西亚',
  NL: '荷兰', BE: '比利时', SE: '瑞典', NO: '挪威', FI: '芬兰',
  DK: '丹麦', CH: '瑞士', AT: '奥地利', CZ: '捷克', SK: '斯洛伐克',
  HU: '匈牙利', RO: '罗马尼亚', BG: '保加利亚', GR: '希腊', PT: '葡萄牙',
  IE: '爱尔兰', NZ: '新西兰', SG: '新加坡', MY: '马来西亚', TH: '泰国',
  VN: '越南', PH: '菲律宾', AR: '阿根廷', CL: '智利', CO: '哥伦比亚',
  PE: '秘鲁', ZA: '南非', EG: '埃及', AE: '阿联酋', SA: '沙特',
  IL: '以色列', IR: '伊朗', PK: '巴基斯坦', BD: '孟加拉国', LK: '斯里兰卡',
  NP: '尼泊尔', UA: '乌克兰', BY: '白俄罗斯', EE: '爱沙尼亚', LV: '拉脱维亚', LT: '立陶宛',
};

// Intl.DisplayNames 提供全 ISO 区域的母语名（zh: 阿富汗 / 阿尔巴尼亚…），覆盖 ~250 国
// curated COUNTRY_ZH/EN 优先：让 TW="中华台北"、HK="中国香港"、GB="UK" 等 WCA 惯例覆盖原生本地化
let _zhNames: Intl.DisplayNames | null = null;
let _enNames: Intl.DisplayNames | null = null;
function getDn(isZh: boolean): Intl.DisplayNames | null {
  try {
    if (isZh) return _zhNames ??= new Intl.DisplayNames(['zh-CN'], { type: 'region' });
    return _enNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
}

export function countryName(iso2: string, isZh: boolean): string {
  const up = (iso2 || '').toUpperCase();
  if (!up) return '';
  if (isZh && COUNTRY_ZH[up]) return COUNTRY_ZH[up];
  if (!isZh && COUNTRY_EN[up]) return COUNTRY_EN[up];
  const dn = getDn(isZh);
  if (dn) {
    try { return dn.of(up) ?? up; } catch { /* fall through */ }
  }
  return up;
}
