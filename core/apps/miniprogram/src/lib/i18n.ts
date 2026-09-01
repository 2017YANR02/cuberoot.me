import { miniProgramApi } from './platform';

export type MiniProgramLocale = 'en' | 'zh';

export interface BilingualText {
  readonly en: string;
  readonly zh: string;
}

export function localeFromLanguage(language: unknown): MiniProgramLocale {
  if (typeof language !== 'string' || language.trim() === '') return 'zh';
  return language.trim().toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function getMiniProgramLocale(): MiniProgramLocale {
  try {
    const api = miniProgramApi();
    if (typeof api.getAppBaseInfo === 'function') {
      try {
        return localeFromLanguage(api.getAppBaseInfo().language);
      } catch {
        // Fall back to the older system snapshot below.
      }
    }
    if (typeof api.getSystemInfoSync === 'function') {
      return localeFromLanguage(api.getSystemInfoSync().language);
    }
  } catch {
    // Build tools and tests do not always provide a Mini Program runtime.
  }
  return 'zh';
}

export function tr(text: BilingualText, locale = getMiniProgramLocale()): string {
  return text[locale];
}

export function localizedWebsitePath(href: string): string {
  const path = href.length > 1 ? href.replace(/\/$/, '') : href;
  if (getMiniProgramLocale() === 'en') return path;
  if (path === '/') return '/zh';
  return `/zh${path}`;
}

export function applyLocalizedTabBar(): void {
  const labels = [
    tr({ en: 'Timer', zh: '计时' }),
    tr({ en: 'Tools', zh: '工具' }),
    tr({ en: 'Me', zh: '我的' }),
  ];

  try {
    const api = miniProgramApi();
    if (typeof api.setTabBarItem !== 'function') return;
    labels.forEach((text, index) => {
      try {
        api.setTabBarItem({ index, text });
      } catch {
        // A localized label is cosmetic and must not block app startup.
      }
    });
  } catch {
    // The tab bar keeps its app.json fallback when the runtime is unavailable.
  }
}
