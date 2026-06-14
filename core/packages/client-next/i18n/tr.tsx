'use client';

// Single chokepoint for user-facing bilingual text.
//
// WHY: the bare `isZh ? '中' : 'EN'` ternary hardcodes a 2-language assumption at
// every call site, so adding a locale meant editing thousands of sites. Routing
// all text through tr() / <T> makes a new locale a one-place change.
//
// Two locales: en + zh (Simplified). No runtime conversion; SSR and client
// render identical text.

import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import i18n, { normalizeAppLang, type AppLang } from './i18n-client';

export type Lang = AppLang;

// Map any incoming language string to one of our 3 canonical locales.
export const normalizeLang = normalizeAppLang;

// "Is this Chinese?" — for NON-text conditionals (Chinese font stack, CJK
// date/number format, layout). Do NOT use this to pick text; use tr()/<T>.
export function isZhAny(l: string | undefined | null): boolean {
  return !!l && l.startsWith('zh');
}

export interface Msg {
  en: string;
  zh: string;
}

// Pure resolver. Reads the i18n singleton's current language — set synchronously
// per render by I18nProvider (the same model the old `i18n.language` ternaries
// relied on). Use in string contexts (props, aria-label, computed values).
export function tr(m: Msg): string {
  return normalizeLang(i18n.language) === 'en' ? m.en : m.zh;
}

// Hook form: subscribes to language changes (re-renders on toggle) and returns
// the current normalized locale. Use when a component needs the lang value.
export function useLang(): Lang {
  const { i18n: inst } = useTranslation();
  return normalizeLang(inst.language);
}

// JSX text node. Self-subscribing (re-renders on language toggle). Accepts plain
// strings or ReactNode branches.
export function T(props: { en: ReactNode; zh: ReactNode }): ReactNode {
  return useLang() === 'en' ? props.en : props.zh;
}
