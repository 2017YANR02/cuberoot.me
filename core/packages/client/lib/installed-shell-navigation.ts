'use client';

import { useSyncExternalStore } from 'react';
import type { MobileEmbedSurface } from '@cuberoot/shared/mobile-embed';

let openAppearance: (() => void) | null = null;
let surface: MobileEmbedSurface | null = null;
let inlineAccountSettings = false;
let accountDetailNavigation = false;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const snapshot = () => openAppearance !== null;
const serverSnapshot = () => false;
const surfaceSnapshot = () => surface;
const serverSurfaceSnapshot = () => null;

/** Set only after MobileEmbedBridge validates the parent init and capability. */
export function setInstalledShellNavigation(open: (() => void) | null, nextSurface: MobileEmbedSurface | null = null, inlineSettings = false, detailNavigation = false): void {
  const wasAvailable = snapshot();
  const previousSurface = surface;
  const previousInlineSettings = inlineAccountSettings;
  const previousDetailNavigation = accountDetailNavigation;
  openAppearance = open;
  surface = open ? nextSurface : null;
  inlineAccountSettings = surface === 'account' && inlineSettings;
  accountDetailNavigation = surface === 'account' && detailNavigation;
  if (wasAvailable !== snapshot() || previousSurface !== surface || previousInlineSettings !== inlineAccountSettings
    || previousDetailNavigation !== accountDetailNavigation) {
    for (const listener of listeners) listener();
  }
}

export function useInstalledShellSurface(): MobileEmbedSurface | null {
  return useSyncExternalStore(subscribe, surfaceSnapshot, serverSurfaceSnapshot);
}

export function useInstalledShellNavigation(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export function openInstalledAppearance(): boolean {
  if (!openAppearance) return false;
  openAppearance();
  return true;
}

export function useInlineInstalledAccountSettings(): boolean {
  return useSyncExternalStore(subscribe, () => inlineAccountSettings, serverSnapshot);
}

export function useInstalledAccountDetailNavigation(): boolean {
  return useSyncExternalStore(subscribe, () => accountDetailNavigation, serverSnapshot);
}
