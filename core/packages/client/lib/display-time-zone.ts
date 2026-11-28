'use client';

import { siteSettingEdited } from '@/lib/site-setting-change';
import { useSyncExternalStore } from 'react';
import { isValidZone, localZone } from '@cuberoot/shared/tz';
import { persistItem } from './safe-storage';

const KEY = 'cuberoot.display-time-zone';
const CHANGE = 'cuberoot:display-time-zone';
export const CALENDAR_PREFS_KEY = 'cuberoot-calendar.prefs.v1';
let sessionChoice: string | undefined;

export function readDisplayTimeZoneChoice(): string {
  if (sessionChoice !== undefined) return sessionChoice;
  try {
    const saved = localStorage.getItem(KEY) ?? JSON.parse(localStorage.getItem(CALENDAR_PREFS_KEY) ?? 'null')?.tz;
    return typeof saved === 'string' && saved && isValidZone(saved) ? saved : '';
  } catch {
    return '';
  }
}

export function applyDisplayTimeZone(zone: string) {
  if (zone && !isValidZone(zone)) return;
  sessionChoice = persistItem(KEY, zone) ? undefined : zone;
  window.dispatchEvent(new Event(CHANGE));
}

export function setDisplayTimeZone(zone: string) {
  if (zone && !isValidZone(zone)) return;
  applyDisplayTimeZone(zone);
  siteSettingEdited({ timeZone: zone });
}

function subscribe(notify: () => void) {
  const storage = (e: StorageEvent) => {
    if (e.key === null || e.key === KEY || e.key === CALENDAR_PREFS_KEY) {
      if (e.key !== CALENDAR_PREFS_KEY) sessionChoice = undefined;
      notify();
    }
  };
  window.addEventListener(CHANGE, notify);
  window.addEventListener('focus', notify);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(CHANGE, notify);
    window.removeEventListener('focus', notify);
    window.removeEventListener('storage', storage);
  };
}

// Include the resolved device zone in the snapshot so returning from travel or
// changing the OS time zone also updates a page that was left open.
const snapshot = () => readDisplayTimeZoneChoice() || `device:${localZone()}`;
export function useDisplayTimeZone() {
  const value = useSyncExternalStore(subscribe, snapshot, () => 'device:UTC');
  const followsDevice = value.startsWith('device:');
  return { zone: followsDevice ? value.slice(7) : value, followsDevice };
}
