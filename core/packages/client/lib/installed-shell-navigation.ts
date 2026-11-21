'use client';

import { useSyncExternalStore } from 'react';
import type { MobileEmbedSurface } from '@cuberoot/shared/mobile-embed';

let openAppearance: (() => void) | null = null;
let surface: MobileEmbedSurface | null = null;
let inlineAccountSettings = false;
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
export function setInstalledShellNavigation(open: (() => void) | null, nextSurface: MobileEmbedSurface | null = null, inlineSettings = false): void {
  const wasAvailable = snapshot();
  const previousSurface = surface;
  const previousInlineSettings = inlineAccountSettings;
  openAppearance = open;
  surface = open ? nextSurface : null;
  inlineAccountSettings = surface === 'account' && inlineSettings;
  if (wasAvailable !== snapshot() || previousSurface !== surface || previousInlineSettings !== inlineAccountSettings) for (const listener of listeners) listener();
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
