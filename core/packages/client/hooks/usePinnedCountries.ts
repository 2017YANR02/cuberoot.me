'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { persistItem } from '@/lib/safe-storage';
import { PINNED_COUNTRIES_KEY, parsePinnedCountries } from '@/lib/pinned-countries';

const CHANGE_EVENT = 'pinned-countries-change';
let visitValue: string | null = null;

function read() {
  if (visitValue !== null) return visitValue;
  try { return localStorage.getItem(PINNED_COUNTRIES_KEY) ?? '[]'; }
  catch { return '[]'; }
}

function subscribe(notify: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key === PINNED_COUNTRIES_KEY || event.key === null) {
      visitValue = null;
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

function toggleCountry(iso2: string) {
  const country = parsePinnedCountries(JSON.stringify([iso2]))[0];
  if (!country) return;
  const current = parsePinnedCountries(read());
  const next = JSON.stringify(current.includes(country)
    ? current.filter(value => value !== country) : [...current, country]);
  visitValue = persistItem(PINNED_COUNTRIES_KEY, next) ? null : next;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function usePinnedCountries() {
  const raw = useSyncExternalStore(subscribe, read, () => '[]');
  const pins = useMemo(() => parsePinnedCountries(raw), [raw]);
  return [pins, toggleCountry] as const;
}
