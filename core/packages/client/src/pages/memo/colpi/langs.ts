/**
 * 41 个上游 colpi 词汇语言（外加 'other' 兜底）。
 * code 与 server `LANGUAGES` 集合保持一致。
 * iso2 用于 <Flag> 渲染（多数语言→所在国国旗，无国一对一者取代表国）。
 */
export interface LangEntry {
  code: string;
  iso2: string;       // for <Flag iso2=...>
  en: string;
  zh: string;
}

export const LANGS: LangEntry[] = [
  { code: 'en', iso2: 'GB', en: 'English',     zh: '英语' },
  { code: 'zh', iso2: 'CN', en: 'Chinese',     zh: '中文' },
  { code: 'ja', iso2: 'JP', en: 'Japanese',    zh: '日语' },
  { code: 'kr', iso2: 'KR', en: 'Korean',      zh: '韩语' },
  { code: 'fr', iso2: 'FR', en: 'French',      zh: '法语' },
  { code: 'de', iso2: 'DE', en: 'German',      zh: '德语' },
  { code: 'es', iso2: 'ES', en: 'Spanish',     zh: '西班牙语' },
  { code: 'pt', iso2: 'PT', en: 'Portuguese',  zh: '葡萄牙语' },
  { code: 'it', iso2: 'IT', en: 'Italian',     zh: '意大利语' },
  { code: 'ru', iso2: 'RU', en: 'Russian',     zh: '俄语' },
  { code: 'pl', iso2: 'PL', en: 'Polish',      zh: '波兰语' },
  { code: 'nl', iso2: 'NL', en: 'Dutch',       zh: '荷兰语' },
  { code: 'cz', iso2: 'CZ', en: 'Czech',       zh: '捷克语' },
  { code: 'sk', iso2: 'SK', en: 'Slovak',      zh: '斯洛伐克语' },
  { code: 'sl', iso2: 'SI', en: 'Slovene',     zh: '斯洛文尼亚语' },
  { code: 'hr', iso2: 'HR', en: 'Croatian',    zh: '克罗地亚语' },
  { code: 'mk', iso2: 'MK', en: 'Macedonian',  zh: '马其顿语' },
  { code: 'bg', iso2: 'BG', en: 'Bulgarian',   zh: '保加利亚语' },
  { code: 'hu', iso2: 'HU', en: 'Hungarian',   zh: '匈牙利语' },
  { code: 'ro', iso2: 'RO', en: 'Romanian',    zh: '罗马尼亚语' },
  { code: 'uk', iso2: 'UA', en: 'Ukrainian',   zh: '乌克兰语' },
  { code: 'lt', iso2: 'LT', en: 'Lithuanian',  zh: '立陶宛语' },
  { code: 'da', iso2: 'DK', en: 'Danish',      zh: '丹麦语' },
  { code: 'no', iso2: 'NO', en: 'Norwegian',   zh: '挪威语' },
  { code: 'se', iso2: 'SE', en: 'Swedish',     zh: '瑞典语' },
  { code: 'fi', iso2: 'FI', en: 'Finnish',     zh: '芬兰语' },
  { code: 'tr', iso2: 'TR', en: 'Turkish',     zh: '土耳其语' },
  { code: 'ar', iso2: 'SA', en: 'Arabic',      zh: '阿拉伯语' },
  { code: 'fa', iso2: 'IR', en: 'Persian',     zh: '波斯语' },
  { code: 'he', iso2: 'IL', en: 'Hebrew',      zh: '希伯来语' },
  { code: 'hi', iso2: 'IN', en: 'Hindi',       zh: '印地语' },
  { code: 'gu', iso2: 'IN', en: 'Gujarati',    zh: '古吉拉特语' },
  { code: 'th', iso2: 'TH', en: 'Thai',        zh: '泰语' },
  { code: 'vi', iso2: 'VN', en: 'Vietnamese',  zh: '越南语' },
  { code: 'id', iso2: 'ID', en: 'Indonesian',  zh: '印尼语' },
  { code: 'ms', iso2: 'MY', en: 'Malay',       zh: '马来语' },
  { code: 'uz', iso2: 'UZ', en: 'Uzbek',       zh: '乌兹别克语' },
  { code: 'ca', iso2: 'ES', en: 'Catalan',     zh: '加泰罗尼亚语' },
  { code: 'eu', iso2: 'ES', en: 'Basque',      zh: '巴斯克语' },
  { code: 'af', iso2: 'ZA', en: 'Afrikaans',   zh: '南非语' },
  { code: 'zu', iso2: 'ZA', en: 'Zulu',        zh: '祖鲁语' },
  { code: 'other', iso2: 'XW', en: 'Other',    zh: '其它' },
];

export const LANG_MAP: Record<string, LangEntry> = Object.fromEntries(
  LANGS.map(l => [l.code, l]),
);

/** Lang code (any 41 + 'other') → display name. */
export function langDisplay(code: string, isZh: boolean): string {
  const entry = LANG_MAP[code];
  if (!entry) return code;
  return isZh ? entry.zh : entry.en;
}
