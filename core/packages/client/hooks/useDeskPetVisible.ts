'use client';

import { useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { persistItem } from '@/lib/safe-storage';

const STORAGE_KEY = 'clawd-deskpet-visible';
const CHANGE_EVENT = 'deskpet-visibility-change';
let visitChoice: boolean | undefined;
const pageChoices = new Map<string, boolean>();

/** Training surfaces default to quiet; catalog and help pages keep the global preference. */
export function deskPetQuietPage(pathname: string): string | null {
  const path = pathname.replace(/^\/(zh|en)(?=\/|$)/, '').replace(/\/$/, '') || '/';
  if (/^\/(timer|alg-trainers|algTrainer)(\/|$)/.test(path)
    || /^\/[^/]+_trainer(\/|$)/.test(path)
    || /^\/alg\/[^/]+\/[^/]+\/(run|simple)(\/|$)/.test(path)
    || /^\/alg\/(roux|skewb-trainer)(\/|$)/.test(path)
    || /^\/alg\/sq1\/(train|algorithm-trainer)(\/|$)/.test(path)
    || /^\/sq1\/cs\/name\/train(\/|$)/.test(path)) return path;
  return null;
}

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
  const pathname = usePathname();
  const quietPage = deskPetQuietPage(pathname ?? '/');
  const visible = useSyncExternalStore(subscribe,
    () => quietPage ? pageChoices.get(quietPage) ?? false : readVisible(),
    () => !quietPage);
  const setPageVisible = (value: boolean) => {
    if (!quietPage) { setVisible(value); return; }
    // Explicitly showing a pet here must not change the preference on other pages.
    pageChoices.set(quietPage, value);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return [visible, setPageVisible] as const;
}
