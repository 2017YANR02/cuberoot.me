'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { persistItem } from '@/lib/safe-storage';
import { readEffective, type EffectiveTheme } from '@/lib/theme';
import { HOME_BACKGROUND_KEY, isHomeBackgroundChoice, type HomeBackgroundChoice } from '@/lib/home-backgrounds';

const CHANGE_EVENT = 'home-background-change';
const visitChoice: Partial<Record<EffectiveTheme, HomeBackgroundChoice>> = {};

function readChoice(theme: EffectiveTheme): HomeBackgroundChoice {
  if (visitChoice[theme] !== undefined) return visitChoice[theme];
  try {
    const saved = localStorage.getItem(`${HOME_BACKGROUND_KEY}.${theme}`);
    if (isHomeBackgroundChoice(saved)) return saved;
  } catch { /* Keep working when browser storage is unavailable. */ }
  return 'auto';
}

function subscribe(notify: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key?.startsWith(HOME_BACKGROUND_KEY) || event.key === null) {
      delete visitChoice.light;
      delete visitChoice.dark;
      notify();
    }
  };
  window.addEventListener(CHANGE_EVENT, notify);
  window.addEventListener('storage', sync);
  return () => {
    window.removeEventListener(CHANGE_EVENT, notify);
    window.removeEventListener('storage', sync);
  };
}

function setChoice(theme: EffectiveTheme, value: HomeBackgroundChoice) {
  if (!isHomeBackgroundChoice(value)) return;
  if (persistItem(`${HOME_BACKGROUND_KEY}.${theme}`, value)) delete visitChoice[theme];
  else visitChoice[theme] = value;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Shared across pages and tabs, with an independent choice for each color scheme. */
export function useHomeBackgroundChoice(theme: EffectiveTheme) {
  const choice = useSyncExternalStore(subscribe, () => readChoice(theme), () => 'auto' as const);
  useEffect(() => {
    // Keep the old selection in the saved theme; the other theme starts at its default.
    try {
      if (localStorage.getItem(`${HOME_BACKGROUND_KEY}.light`) !== null
        || localStorage.getItem(`${HOME_BACKGROUND_KEY}.dark`) !== null
        || visitChoice.light !== undefined || visitChoice.dark !== undefined) return;
      const saved = localStorage.getItem(HOME_BACKGROUND_KEY);
      if (isHomeBackgroundChoice(saved)) setChoice(readEffective(), saved);
    } catch { /* The default remains usable without storage. */ }
  }, []);
  return [choice, (value: HomeBackgroundChoice) => setChoice(theme, value)] as const;
}
