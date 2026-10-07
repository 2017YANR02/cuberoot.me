'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { BldConfig } from '@cuberoot/shared/bld/types';

export const DEFAULT_BLD_CONFIG: BldConfig = {
  cBuf: 'J',
  eBuf: 'A',
  cOrder: 'GADXWRO',
  eOrder: 'GECIKMOQSWY',
  keepHueC: false,
  keepHueE: false,
  skipC: 0,
  skipE: 0,
  scheme: 'chichu',
  orientation: 0,
};

interface BldConfigState {
  config: BldConfig;
  setConfig(partial: Partial<BldConfig>): void;
  reset(): void;
}
const listeners = new Set<() => void>();
function publish(config: BldConfig) {
  snapshot = { ...snapshot, config };
  try { localStorage.setItem('bld-config', JSON.stringify({ state: { config }, version: 0 })); } catch { /* storage may be unavailable */ }
  listeners.forEach(listener => listener());
}
const initial: BldConfigState = {
  config: DEFAULT_BLD_CONFIG,
  setConfig: partial => publish({ ...snapshot.config, ...partial }),
  reset: () => publish({ ...DEFAULT_BLD_CONFIG }),
};
let snapshot = initial;
let hydrated = false;
function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const value = JSON.parse(localStorage.getItem('bld-config') ?? 'null');
    if (value?.state?.config) snapshot = { ...initial, config: { ...DEFAULT_BLD_CONFIG, ...value.state.config } };
  } catch { /* use defaults for unreadable storage */ }
  listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useBldConfigStore<T>(select: (state: BldConfigState) => T): T {
  return select(useSyncExternalStore(subscribe, () => snapshot, () => initial));
}
export function useBldConfigHydrated(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => { hydrate(); setReady(true); }, []);
  return ready;
}
