'use client';

// Single chokepoint for user-facing bilingual text.
//
// WHY: the bare `isZh ? '中' : 'EN'` ternary hardcodes a 2-language assumption at
// every call site, so adding a locale meant editing thousands of sites. Routing
// all text through tr() / <T> makes a new locale a one-place change.
//
// FULLY STATIC: for zh-Hant a `zhHant` field carries the Traditional string,
// pre-generated at build by scripts/inject-zhhant.mjs (OpenCC s2twp). No runtime
// conversion → SSR and client render identical text (no hydration mismatch, no
// flash). If `zhHant` is absent (dynamic value, or conversion was a no-op), it
// falls back to the Simplified `zh`.

import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import i18n, { normalizeAppLang, type AppLang } from './i18n-client';

export type Lang = AppLang;

// Map any incoming language string to one of our 3 canonical locales.
export const normalizeLang = normalizeAppLang;

// "Is this ANY Chinese (Simplified or Traditional)?" — for NON-text conditionals
// (Chinese font stack, CJK date/number format, layout) that must hold for
// zh-Hant too. Do NOT use this to pick text; use tr()/<T> for that.
export function isZhAny(l: string | undefined | null): boolean {
  return !!l && l.startsWith('zh');
}

export interface Msg {
  en: string;
  zh: string;
  zhHant?: string;
}

// Pure resolver. Reads the i18n singleton's current language — set synchronously
// per render by I18nProvider (the same model the old `i18n.language` ternaries
// relied on). Use in string contexts (props, aria-label, computed values).
export function tr(m: Msg): string {
  const lang = normalizeLang(i18n.language);
  if (lang === 'en') return m.en;
  if (lang === 'zh-Hant') return m.zhHant ?? m.zh;
  return m.zh;
}

// Hook form: subscribes to language changes (re-renders on toggle) and returns
// the current normalized locale. Use when a component needs the lang value.
export function useLang(): Lang {
  const { i18n: inst } = useTranslation();
  return normalizeLang(inst.language);
}

// JSX text node. Self-subscribing (re-renders on language toggle). Accepts plain
// strings or ReactNode branches. For zh-Hant an explicit `zhHant` wins, else it
// falls back to `zh` (string branches should pass `zhHant` for Traditional;
// pure-Simplified is the fallback).
export function T(props: { en: ReactNode; zh: ReactNode; zhHant?: ReactNode }): ReactNode {
  const lang = useLang();
  if (lang === 'en') return props.en;
  if (lang === 'zh-Hant') return props.zhHant ?? props.zh;
  return props.zh;
}
