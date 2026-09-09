'use client';

import { useSyncExternalStore } from 'react';
import { persistItem } from '@/lib/safe-storage';
import { HOME_BACKGROUND_KEY, isHomeBackgroundChoice, type HomeBackgroundChoice } from '@/lib/home-backgrounds';

const CHANGE_EVENT = 'home-background-change';
let visitChoice: HomeBackgroundChoice | null = null;

function readChoice(): HomeBackgroundChoice {
  if (visitChoice !== null) return visitChoice;
  try {
    const saved = localStorage.getItem(HOME_BACKGROUND_KEY);
    if (isHomeBackgroundChoice(saved)) return saved;
  } catch { /* Keep working when browser storage is unavailable. */ }
  return 'auto';
}

function subscribe(notify: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key === HOME_BACKGROUND_KEY || event.key === null) {
      visitChoice = null;
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

function setChoice(value: HomeBackgroundChoice) {
  if (!isHomeBackgroundChoice(value)) return;
  visitChoice = persistItem(HOME_BACKGROUND_KEY, value) ? null : value;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** One preference across the homepage, gallery and other open tabs. */
export function useHomeBackgroundChoice() {
  const choice = useSyncExternalStore(subscribe, readChoice, () => 'auto' as const);
  return [choice, setChoice] as const;
}
