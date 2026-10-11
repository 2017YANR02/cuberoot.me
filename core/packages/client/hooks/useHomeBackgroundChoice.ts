'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { persistItem } from '@/lib/safe-storage';
import { readEffective, type EffectiveTheme } from '@/lib/theme';
import { HOME_BACKGROUND_KEY, isHomeBackgroundChoice, resolveHomeBackground, type HomeBackgroundChoice } from '@/lib/home-backgrounds';

export const HOME_BACKGROUND_CHANGE_EVENT = 'home-background-change';
const DEFAULT_BACKGROUND = 'transparent';
const visitChoice: Partial<Record<EffectiveTheme, HomeBackgroundChoice>> = {};
const visitLastImage: Partial<Record<EffectiveTheme, HomeBackgroundChoice>> = {};

function rememberImage(theme: EffectiveTheme, choice: HomeBackgroundChoice) {
  if (!resolveHomeBackground(choice, theme)) return;
  if (persistItem(`${HOME_BACKGROUND_KEY}.last-image.${theme}`, choice)) delete visitLastImage[theme];
  else visitLastImage[theme] = choice;
}

function restoreImage(theme: EffectiveTheme): HomeBackgroundChoice {
  if (visitLastImage[theme] !== undefined) return visitLastImage[theme];
  try {
    const saved = localStorage.getItem(`${HOME_BACKGROUND_KEY}.last-image.${theme}`);
    if (isHomeBackgroundChoice(saved) && resolveHomeBackground(saved, theme)) return saved;
  } catch { /* A first-time selection uses the theme's default image. */ }
  return 'auto';
}

export function readHomeBackgroundChoice(theme: EffectiveTheme): HomeBackgroundChoice {
  if (visitChoice[theme] !== undefined) return visitChoice[theme];
  try {
    const saved = localStorage.getItem(`${HOME_BACKGROUND_KEY}.${theme}`);
    if (isHomeBackgroundChoice(saved)) return saved;
  } catch { /* Keep working when browser storage is unavailable. */ }
  return DEFAULT_BACKGROUND;
}

function subscribe(notify: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key?.startsWith(HOME_BACKGROUND_KEY) || event.key === null) {
      delete visitChoice.light;
      delete visitChoice.dark;
      delete visitLastImage.light;
      delete visitLastImage.dark;
      notify();
    }
  };
  window.addEventListener(HOME_BACKGROUND_CHANGE_EVENT, notify);
  window.addEventListener('storage', sync);
  return () => {
    window.removeEventListener(HOME_BACKGROUND_CHANGE_EVENT, notify);
    window.removeEventListener('storage', sync);
  };
}

function setChoice(theme: EffectiveTheme, value: HomeBackgroundChoice) {
  if (!isHomeBackgroundChoice(value)) return;
  rememberImage(theme, readHomeBackgroundChoice(theme));
  rememberImage(theme, value);
  if (persistItem(`${HOME_BACKGROUND_KEY}.${theme}`, value)) delete visitChoice[theme];
  else visitChoice[theme] = value;
  window.dispatchEvent(new Event(HOME_BACKGROUND_CHANGE_EVENT));
}

/** Shared across pages and tabs, with an independent choice for each color scheme. */
export function useHomeBackgroundChoice(theme: EffectiveTheme) {
  const choice = useSyncExternalStore<HomeBackgroundChoice>(subscribe, () => readHomeBackgroundChoice(theme), () => DEFAULT_BACKGROUND);
  useEffect(() => {
    // Site materials are always transparent; retired preferences no longer apply.
    for (const scheme of ['light', 'dark']) {
      try { localStorage.removeItem(`${HOME_BACKGROUND_KEY}.transparency.${scheme}`); }
      catch { /* Blocked storage cannot change the fixed material policy. */ }
    }
    // Keep the old selection in the saved theme; the other theme starts at its default.
    try {
      if (localStorage.getItem(`${HOME_BACKGROUND_KEY}.light`) !== null
        || localStorage.getItem(`${HOME_BACKGROUND_KEY}.dark`) !== null
        || visitChoice.light !== undefined || visitChoice.dark !== undefined) return;
      const saved = localStorage.getItem(HOME_BACKGROUND_KEY);
      if (isHomeBackgroundChoice(saved)) {
        const savedTheme = readEffective();
        setChoice(savedTheme, saved);
      }
    } catch { /* The default remains usable without storage. */ }
  }, []);
  return [choice, (value: HomeBackgroundChoice) => setChoice(theme, value),
    Boolean(resolveHomeBackground(choice, theme)), (enabled: boolean) => {
      if (enabled === Boolean(resolveHomeBackground(readHomeBackgroundChoice(theme), theme))) return;
      setChoice(theme, enabled ? restoreImage(theme) : 'none');
    }] as const;
}
