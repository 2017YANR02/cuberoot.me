'use client';

import { useSyncExternalStore } from 'react';
import { isDouyinWebViewCandidate } from './miniprogram-bridge';

const subscribe = () => () => {};
const serverSnapshot = () => false;

/** Native entry marker persists through same-WebView navigation and auth redirects. */
export function isDouyinToolSurface(): boolean {
  if (typeof window === 'undefined') return false;
  return isDouyinWebViewCandidate()
    || document.documentElement.dataset.douyinSurface === 'true';
}

export function useDouyinToolSurface(): boolean {
  return useSyncExternalStore(subscribe, isDouyinToolSurface, serverSnapshot);
}
