'use client';

// Single chokepoint for user-facing bilingual text.
//
// WHY: the bare `isZh ? '中' : 'EN'` ternary hardcodes a 2-language assumption at
// every call site, so adding a locale meant editing thousands of sites. Routing
// all text through tr() / <T> makes a new locale a one-place change.
//
// Two locales: en + zh (Simplified). No runtime conversion; SSR and client
// render identical text.

import { I18nContext } from 'react-i18next';
import { useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react';
import i18n, { normalizeAppLang, type AppLang } from './i18n-client';

export type Lang = AppLang;

// Map any incoming language string to one of our two locales (en, zh).
export const normalizeLang = normalizeAppLang;

export interface Msg {
  en: string;
  zh: string;
}

// Pure resolver. Reads the i18n singleton's current language, owned by
// I18nProvider. It does not subscribe; a component rendering these values uses
// useT/useLang or another subscription. Use in props and computed string values.
//
// Generic: defaults to string (`tr({ en, zh })`), but also selects a localized
// value of any type — `tr(obj)` where obj is `{ en, zh }` returns the picked
// branch, so `tr(card).title` / ReactNode branches work too.
export function tr<T = string>(m: { en: T; zh: T }): T {
  return normalizeLang(i18n.language) === 'en' ? m.en : m.zh;
}

// Hook form: subscribes to language changes (re-renders on toggle) and returns
// the current normalized locale. Use when a component needs the lang value.
export function useLang(): Lang {
  const context = useContext(I18nContext);
  const instance = context?.i18n ?? i18n;
  const subscribe = useCallback((notify: () => void) => {
    instance.on('languageChanged', notify);
    return () => { instance.off('languageChanged', notify); };
  }, [instance]);
  const snapshot = useCallback(() => normalizeLang(instance.language), [instance]);
  // A route can render before the provider changes language, then subscribe
  // after that event. React rechecks this snapshot when subscribing, including
  // Suspense commits; an event-only passive subscription misses that window.
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

// JSX text node. Self-subscribing (re-renders on language toggle). Accepts plain
// strings or ReactNode branches.
export function T(props: { en: ReactNode; zh: ReactNode }): ReactNode {
  return useLang() === 'en' ? props.en : props.zh;
}
