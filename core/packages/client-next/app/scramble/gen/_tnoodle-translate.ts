// TNoodle-style translation lookup + locale metadata.
// Mirrors tnoodle's `Translate(key, locale, substitutions)` and Font.fontForLocale().
//
// Translation data is generated from upstream tnoodle YAMLs by
// `scripts/build_tnoodle_i18n.mjs`. See `tnoodle_i18n.ts`.

import { TNOODLE_I18N, TNOODLE_LOCALES, type TnoodleLocale, type TnoodleTranslations } from './_tnoodle-i18n';

export { TNOODLE_LOCALES, type TnoodleLocale };

/** 中文模式下的语言名(翻译为中文)。 */
export const LOCALE_DISPLAY_NAME: Record<TnoodleLocale, string> = {
  br: '布列塔尼语',
  da: '丹麦语',
  de: '德语',
  en: '英语',
  eo: '世界语',
  es: '西班牙语',
  et: '爱沙尼亚语',
  fi: '芬兰语',
  fr: '法语',
  hr: '克罗地亚语',
  hu: '匈牙利语',
  id: '印尼语',
  it: '意大利语',
  ja: '日语',
  ko: '韩语',
  nb: '挪威语',
  pl: '波兰语',
  pt: '葡萄牙语',
  'pt-BR': '葡萄牙语 (巴西)',
  rm: '罗曼什语',
  ro: '罗马尼亚语',
  ru: '俄语',
  sl: '斯洛文尼亚语',
  vi: '越南语',
  'zh-CN': '中文 (简)',
  'zh-TW': '中文 (繁)',
};

/** English display name (for the en-mode UI grid). Matches WCA/Translations dialog. */
export const LOCALE_DISPLAY_NAME_EN: Record<TnoodleLocale, string> = {
  br: 'Breton',
  da: 'Danish',
  de: 'German',
  en: 'English',
  eo: 'Esperanto',
  es: 'Spanish',
  et: 'Estonian',
  fi: 'Finnish',
  fr: 'French',
  hr: 'Croatian',
  hu: 'Hungarian',
  id: 'Indonesian',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  nb: 'Norwegian Bokmål',
  pl: 'Polish',
  pt: 'Portuguese',
  'pt-BR': 'Portuguese (Brazil)',
  rm: 'Romansh',
  ro: 'Romanian',
  ru: 'Russian',
  sl: 'Slovenian',
  vi: 'Vietnamese',
  'zh-CN': 'Chinese (China)',
  'zh-TW': 'Chinese (Taiwan)',
};

const CJK_LOCALES: ReadonlySet<TnoodleLocale> = new Set(['ja', 'ko', 'zh-CN', 'zh-TW'] as TnoodleLocale[]);

/** Tnoodle's Font.fontForLocale: CJK locales need wqy-microhei; everything else NotoSans. */
export function fontForLocale(locale: TnoodleLocale): 'wqy-microhei' | 'NotoSans' {
  return CJK_LOCALES.has(locale) ? 'wqy-microhei' : 'NotoSans';
}

export function isCjkLocale(locale: TnoodleLocale): boolean {
  return CJK_LOCALES.has(locale);
}

/** Get a translation, walking dotted key path. Falls back to en if missing. */
export function translate(
  key: string,
  locale: TnoodleLocale,
  substitutions?: Record<string, string>,
): string {
  const tryLocale = (loc: TnoodleLocale): string | undefined => {
    let cur: unknown = TNOODLE_I18N[loc];
    for (const part of key.split('.')) {
      if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[part];
      } else return undefined;
    }
    return typeof cur === 'string' ? cur : undefined;
  };
  let raw = tryLocale(locale) ?? tryLocale('en') ?? key;
  if (substitutions) {
    for (const [k, v] of Object.entries(substitutions)) {
      raw = raw.replaceAll(`%{${k}}`, v);
    }
  }
  return raw;
}

/** Convenience: shortcut for the FMC namespace. */
export function tFmc<K extends keyof TnoodleTranslations['fmc']>(
  key: K,
  locale: TnoodleLocale,
  substitutions?: Record<string, string>,
): string {
  return translate(`fmc.${key}`, locale, substitutions);
}
