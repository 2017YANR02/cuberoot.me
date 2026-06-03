'use client';

// 3BLD config store — zustand + localStorage persist (same shape as lib/trainer-store.ts).
// Holds a single BldConfig with the upstream helper.html defaults.

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BldConfig } from '../_lib/types';

// Upstream helper.html defaults (spooncuber).
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
  setConfig: (partial: Partial<BldConfig>) => void;
  reset: () => void;
}

export const useBldConfigStore = create<BldConfigState>()(
  persist(
    (set) => ({
      config: { ...DEFAULT_BLD_CONFIG },
      setConfig: (partial) =>
        set((s) => ({ config: { ...s.config, ...partial } })),
      reset: () => set({ config: { ...DEFAULT_BLD_CONFIG } }),
    }),
    {
      name: 'bld-config',
      storage: createJSONStorage(() => localStorage),
      // Skip auto-hydration so SSR + first client render both see defaults
      // (no hydration mismatch). Pages gate on useBldConfigHydrated().
      skipHydration: true,
      // Merge persisted partials over defaults so newly added fields stay populated.
      merge: (persisted, current) => {
        const p = (persisted as Partial<BldConfigState>) ?? {};
        return {
          ...current,
          config: { ...DEFAULT_BLD_CONFIG, ...(p.config ?? {}) },
        };
      },
    },
  ),
);

/**
 * Rehydrate the persisted config from localStorage in an effect and report when
 * done. Trainer pages gate config-dependent render on this to avoid SSR/CSR
 * hydration mismatch (matches lib/session-store.ts useSessionHydrated()).
 */
export function useBldConfigHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    useBldConfigStore.persist.rehydrate();
    setHydrated(true);
  }, []);
  return hydrated;
}
