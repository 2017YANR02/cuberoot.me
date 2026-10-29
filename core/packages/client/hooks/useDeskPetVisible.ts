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

/** Plays the mounted pet's exit; returns a cancel function, or nothing to hide at once. */
export type DeskPetExitRequest = (done: () => void) => (() => void) | undefined;
let exitRequest: DeskPetExitRequest | undefined;
let cancelExit: (() => void) | undefined;
let finishExit: (() => void) | undefined;

function readVisible() {
  if (visitChoice !== undefined) return visitChoice;
  try { return localStorage.getItem(STORAGE_KEY) !== 'false'; }
  catch { return true; }
}

function subscribe(notify: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    if (event.newValue !== 'false') {
      const cancel = cancelExit;
      cancelExit = undefined;
      finishExit = undefined;
      cancel?.();
    }
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

function commit(visible: boolean) {
  visitChoice = persistItem(STORAGE_KEY, String(visible)) ? undefined : visible;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Hiding waits for the mounted pet to finish its exit; the preference changes
 * only then. Repeated hide requests join the running exit, and showing again
 * cancels it.
 */
export function setDeskPetVisible(visible: boolean) {
  setVisibility(visible, readVisible, commit);
}

function setVisibility(visible: boolean, read: () => boolean, write: (value: boolean) => void) {
  if (visible) {
    const cancel = cancelExit;
    cancelExit = undefined;
    finishExit = undefined;
    cancel?.();
    write(true);
    return;
  }
  if (cancelExit) return;
  if (!exitRequest || !read()) { write(false); return; }
  let pending = true;
  const done = () => {
    if (!pending) return;
    pending = false;
    cancelExit = undefined;
    finishExit = undefined;
    write(false);
  };
  finishExit = done;
  const cancel = exitRequest(done);
  if (!pending) return;
  if (!cancel) { done(); return; }
  cancelExit = () => { pending = false; cancel(); };
}

/** The mounted pet registers its exit animation; returns the unregister function. */
export function registerDeskPetExit(request: DeskPetExitRequest) {
  exitRequest = request;
  return () => {
    if (exitRequest !== request) return;
    exitRequest = undefined;
    // An engine replacement must not leave a cancelled exit locking future hides.
    finishExit?.();
  };
}

/** Browser-local preference shared by the pet and appearance controls. */
export function useDeskPetVisible() {
  const pathname = usePathname();
  const quietPage = deskPetQuietPage(pathname ?? '/');
  const visible = useSyncExternalStore(subscribe,
    () => quietPage ? pageChoices.get(quietPage) ?? false : readVisible(),
    () => !quietPage);
  const setPageVisible = (value: boolean) => {
    if (!quietPage) { setDeskPetVisible(value); return; }
    // Explicitly showing a pet here must not change the preference on other pages.
    setVisibility(value, () => pageChoices.get(quietPage) ?? false, next => {
      pageChoices.set(quietPage, next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    });
  };
  return [visible, setPageVisible] as const;
}
