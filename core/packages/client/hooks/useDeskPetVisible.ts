'use client';

import { siteSettingEdited } from '@/lib/site-setting-change';
import { useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { persistItem } from '@/lib/safe-storage';

const STORAGE_KEY = 'clawd-deskpet-visible';
const CHANGE_EVENT = 'deskpet-visibility-change';
let visitChoice: boolean | undefined;
const pageChoices = new Map<string, boolean>();

/** Focused tools and dense data workspaces default to quiet, without changing the global preference. */
export function deskPetQuietPage(pathname: string): string | null {
  const path = pathname.replace(/^\/(zh|en)(?=\/|$)/, '').replace(/\/$/, '') || '/';
  if (/^\/(calc|frame-count|mosaic|paint|wb|notation|recon)(\/|$)/.test(path)
    || /^\/wca\/(results|records|comp)(\/|$)/.test(path)
    || /^\/scramble\/(solver|analyzer)(\/|$)/.test(path)
    || /^\/tutorial\/(lbl|f2l)(\/|$)/.test(path)
    || /^\/recognize\/[^/]+$/.test(path)
    || /^\/alg\/3bld\/lookup(\/|$)/.test(path)
    || /^\/(timer|alg-trainers|algTrainer)(\/|$)/.test(path)
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
let visibleDuringExit: boolean | undefined;

function readVisible() {
  if (visibleDuringExit !== undefined) return visibleDuringExit;
  return readDeskPetPreference();
}

export function readDeskPetPreference() {
  if (visitChoice !== undefined) return visitChoice;
  try { return localStorage.getItem(STORAGE_KEY) !== 'false'; }
  catch { return true; }
}

function cancelPendingExit() {
  const cancel = cancelExit;
  cancelExit = undefined;
  finishExit = undefined;
  visibleDuringExit = undefined;
  cancel?.();
}

function subscribe(notify: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    cancelPendingExit();
    if (event.newValue === 'false') pageChoices.clear();
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

function saveVisibility(visible: boolean) {
  visitChoice = persistItem(STORAGE_KEY, String(visible)) ? undefined : visible;
}

export function restoreDeskPetPreference(visible: boolean) {
  cancelPendingExit();
  pageChoices.clear();
  saveVisibility(visible);
  notifyVisibility();
}

function notifyVisibility() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function hideDeskPet(wasVisible: boolean) {
  if (finishExit) return;
  // Save before animating so a reload during the exit still remembers the choice.
  visibleDuringExit = readVisible();
  saveVisibility(false);
  siteSettingEdited({ deskPetVisible: false });
  let pending = true;
  const done = () => {
    if (!pending) return;
    pending = false;
    cancelExit = undefined;
    finishExit = undefined;
    visibleDuringExit = undefined;
    pageChoices.clear();
    notifyVisibility();
  };
  finishExit = done;
  const cancel = wasVisible ? exitRequest?.(done) : undefined;
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
    if (!value) { hideDeskPet(visible); return; }
    cancelPendingExit();
    // Opening on a quiet page applies only to that page.
    if (quietPage) pageChoices.set(quietPage, true);
    else {
      saveVisibility(true);
      siteSettingEdited({ deskPetVisible: true });
    }
    notifyVisibility();
  };
  return [visible, setPageVisible] as const;
}
