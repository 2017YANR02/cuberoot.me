'use client';

// Ported from packages/client/src/utils/theme.ts.
// Differences from Vite original:
//   - Bootstrap is inlined into <head> as a beforeInteractive script (lib/theme-bootstrap-script.ts)
//     so no FOUC between SSR document arrival and React hydration.
//   - Favicon swap kept but operates on whatever <link id="app-favicon"> exists.

import { useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';
export const THEME_KEY = 'theme';

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') {
    root.setAttribute('data-theme', theme);
    // Pin the browser-level color-scheme to the chosen theme. Without this the
    // page keeps `color-scheme: light dark` (follows OS), so an explicit dark
    // theme on an OS-light machine paints embedded <object>/<iframe> docs (the
    // cloudling gallery) with an opaque white canvas backdrop.
    root.style.colorScheme = theme;
  } else {
    // system: follow OS for both tokens and color-scheme
    root.removeAttribute('data-theme');
    root.style.colorScheme = '';
  }
  applyFavicon();
}

function applyFavicon() {
  const link = document.getElementById('app-favicon') as HTMLLinkElement | null;
  if (!link) return;
  const eff = readEffective();
  const href = eff === 'dark' ? '/icons/CubeRoot-dark.png' : '/icons/CubeRoot.png';
  if (link.href.endsWith(href)) return;
  link.href = href;
}

export function readEffective(): EffectiveTheme {
  const saved = (localStorage.getItem(THEME_KEY) as Theme | null) || 'system';
  if (saved === 'light' || saved === 'dark') return saved;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useEffectiveTheme(): EffectiveTheme {
  const [t, setT] = useState<EffectiveTheme>(() =>
    typeof window === 'undefined' ? 'light' : readEffective(),
  );
  useEffect(() => {
    const refresh = () => setT(readEffective());
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('theme-change', refresh);
    return () => {
      mq.removeEventListener('change', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('theme-change', refresh);
    };
  }, []);
  return t;
}
