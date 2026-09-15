'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { persistItem } from '@/lib/safe-storage';
import { PINNED_COUNTRIES_KEY, parsePinnedCountries, pinnedCountriesKey, resolvePinnedCountries, togglePinnedCountry } from '@/lib/pinned-countries';
import { loadIpCountry } from '@/lib/ip-country';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';
import { loadFlagData, personFlagIso2 } from '@/lib/country-flags';

const CHANGE_EVENT = 'pinned-countries-change';
const visitValues = new Map<string, string>();

function read(key: string) {
  if (visitValues.has(key)) return visitValues.get(key)!;
  try { return localStorage.getItem(key); }
  catch { return null; }
}

function subscribe(notify: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key?.startsWith(`${PINNED_COUNTRIES_KEY}:`) || event.key === null) {
      if (event.key === null) visitValues.clear();
      else visitValues.delete(event.key);
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

export function usePinnedCountries() {
  const user = useAuthUser();
  const key = pinnedCountriesKey(user);
  const wcaId = user?.wcaId.trim().toUpperCase() ?? '';
  const [, setFlagVersion] = useState(0);
  const [ipCountry, setIpCountry] = useState('');
  useEffect(() => {
    let cancelled = false;
    void loadIpCountry().then(country => { if (!cancelled) setIpCountry(country); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!wcaId) return;
    let cancelled = false;
    void loadFlagData().then(version => { if (!cancelled) setFlagVersion(version); });
    return () => { cancelled = true; };
  }, [wcaId]);

  const snapshot = useCallback(() => key ? read(key) : null, [key]);
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const country = wcaId ? personFlagIso2(wcaId) : '';
  const pins = useMemo(() => resolvePinnedCountries(raw, country, ipCountry), [raw, country, ipCountry]);
  const toggleCountry = useCallback((iso2: string) => {
    // Recheck the live session: an event from a previous account must not write its preferences.
    if (!key || pinnedCountriesKey(useAuthStore.getState().user) !== key) return;
    const pin = parsePinnedCountries(JSON.stringify([iso2]))[0];
    if (!pin) return;
    const next = togglePinnedCountry(read(key), wcaId ? personFlagIso2(wcaId) : '', ipCountry, pin);
    if (persistItem(key, next)) visitValues.delete(key);
    else visitValues.set(key, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [key, wcaId, ipCountry]);
  return [pins, toggleCountry] as const;
}
