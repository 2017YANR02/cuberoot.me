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

const LOCALE_STORAGE_KEY = 'cuberoot.locale.v1';

/** Read storage each time: every page has its own bundled module instance. */
export function getMiniProgramLocale(): MiniProgramLocale {
  try {
    const api = miniProgramApi();
    // Moments single-page mode does not provide device storage.
    const saved = api.getLaunchOptionsSync?.().scene === 1154
      ? undefined : api.getStorageSync?.(LOCALE_STORAGE_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
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
  const locale = getMiniProgramLocale();
  const hashIndex = href.indexOf('#');
  const hash = hashIndex < 0 ? '' : href.slice(hashIndex);
  const withoutHash = hashIndex < 0 ? href : href.slice(0, hashIndex);
  const queryIndex = withoutHash.indexOf('?');
  const pathname = queryIndex < 0 ? withoutHash : withoutHash.slice(0, queryIndex);
  const query = queryIndex < 0 ? '' : withoutHash.slice(queryIndex)
    .replace(/([?&])lang=[^&]*/g, '$1lang=' + locale);
  const bare = pathname.replace(/^\/(?:en|zh)(?=\/|$)/, '').replace(/\/$/, '') || '/';
  const path = locale === 'en' ? bare : '/zh' + (bare === '/' ? '' : bare);
  return path + query + hash;
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

export function receiveNativeLocale(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  const message = value as { type?: unknown; locale?: unknown };
  if (message.type !== 'cuberoot:locale' || (message.locale !== 'en' && message.locale !== 'zh')) return;
  try { miniProgramApi().setStorageSync(LOCALE_STORAGE_KEY, message.locale); }
  catch { return; }
  applyLocalizedTabBar();
  // Tools messages can arrive after the destination page's onShow.
  if (typeof getCurrentPages === 'function') {
    for (const page of getCurrentPages()) page.refreshLocale?.();
  }
}
