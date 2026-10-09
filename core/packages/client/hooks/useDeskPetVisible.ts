'use client';

import { useSyncExternalStore } from 'react';
import { persistItem } from '@/lib/safe-storage';

const STORAGE_KEY = 'clawd-deskpet-visible';
const CHANGE_EVENT = 'deskpet-visibility-change';
let visitChoice: boolean | undefined;

function readVisible() {
  if (visitChoice !== undefined) return visitChoice;
  try { return localStorage.getItem(STORAGE_KEY) !== 'false'; }
  catch { return true; }
}

function subscribe(notify: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    visitChoice = undefined;
    notify();
  };
  window.addEventListener(CHANGE_EVENT, notify);
  window.addEventListener('storage', sync);
  return () => {
    window.removeEventListener(CHANGE_EVENT, notify);
    window.removeEventListener('storage', sync);
  };
}

function setVisible(visible: boolean) {
  visitChoice = persistItem(STORAGE_KEY, String(visible)) ? undefined : visible;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Browser-local preference shared by the pet and appearance controls. */
export function useDeskPetVisible() {
  const visible = useSyncExternalStore(subscribe, readVisible, () => true);
  return [visible, setVisible] as const;
}
