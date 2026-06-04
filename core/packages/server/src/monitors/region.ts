/**
 * 国家 / 洲际纪录辅助 —— 纯常量,无 DB。
 * COUNTRY_EN_MAP 1:1 移植自 Python /opt/wca-monitor/record_format.py:用于把
 * cubing.com region 给的英文国名映射回 ISO2(再喂 record_format 的洲际推导)。
 */

// 英文国名 → ISO2(faithful copy of Python COUNTRY_EN_MAP)
export const COUNTRY_EN_MAP: Record<string, string> = {
  China: 'CN', 'Hong Kong': 'HK', Taiwan: 'TW', Macau: 'MO', Macao: 'MO',
  Japan: 'JP', Korea: 'KR', 'South Korea': 'KR', 'North Korea': 'KP',
  Singapore: 'SG', Malaysia: 'MY', Thailand: 'TH', Vietnam: 'VN',
  Indonesia: 'ID', Philippines: 'PH', India: 'IN', Pakistan: 'PK',
  Mongolia: 'MN', Kazakhstan: 'KZ', Uzbekistan: 'UZ',
  'United States': 'US', USA: 'US', Canada: 'CA', Mexico: 'MX',
  'United Kingdom': 'GB', France: 'FR', Germany: 'DE', Italy: 'IT',
  Spain: 'ES', Russia: 'RU', Poland: 'PL', Netherlands: 'NL',
  Australia: 'AU', 'New Zealand': 'NZ', Brazil: 'BR',
};

/**
 * 洲际纪录缩写集 —— 1:1 对应 Python record_format.CR_ABBR_CN 的 6 个 key。
 * 不含泛指 "CR"(cubing.com 只发具体洲缩写)、不含 WR/NR/PR。
 */
export const CONTINENTAL_TAGS: ReadonlySet<string> = new Set([
  'AsR', 'ER', 'AfR', 'OcR', 'SAR', 'NAR',
]);

/**
 * 是否洲际纪录类 tag。等价 Python 的 `tag in CR_ABBR_CN`。
 * 显式白名单:只认上面 6 个,绝不把 PR / WR / NR 误判成 CR。
 */
export function isContinentalTag(tag: string): boolean {
  return CONTINENTAL_TAGS.has(tag);
}
