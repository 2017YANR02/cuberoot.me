'use client';

// Ported from packages/client/src/utils/theme.ts.
// Differences from Vite original:
//   - Bootstrap is inlined into <head> as a beforeInteractive script (lib/theme-bootstrap-script.ts)
//     so no FOUC between SSR document arrival and React hydration.
//   - Favicon swap kept but operates on whatever <link id="app-favicon"> exists.

import { useEffect, useState } from 'react';
import { PALETTE_KEY, isPaletteId, paletteScheme } from './palettes';

export type Theme = 'system' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';
export const THEME_KEY = 'theme';

type DocumentWithViewTransition = Document & {
  startViewTransition?: (cb: () => void) => unknown;
};

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// 用户主动切换且浏览器支持时,用 View Transitions 让整页旧→新交叉淡出(晕染);
// 否则(首屏恢复 / 不支持 / reduced-motion)直接瞬切。
function runTransition(commit: () => void, animate: boolean) {
  const doc = document as DocumentWithViewTransition;
  if (animate && typeof doc.startViewTransition === 'function' && !prefersReducedMotion()) {
    doc.startViewTransition(commit);
  } else {
    commit();
  }
}

// clearPalette: 用户点 light/dark 开关时退出配色主题,回到经典明暗。
export function applyTheme(theme: Theme, animate = false, clearPalette = false) {
  const root = document.documentElement;
  const commit = () => {
    if (clearPalette) {
      root.removeAttribute('data-palette');
      try { localStorage.removeItem(PALETTE_KEY); } catch { /* ignore */ }
    }
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
  };
  runTransition(commit, animate);
}

// 选 / 清配色主题。id=null → 回到经典(移除 data-palette,恢复 theme 的 color-scheme)。
export function applyPalette(id: string | null, animate = false) {
  const root = document.documentElement;
  if (isPaletteId(id)) {
    try { localStorage.setItem(PALETTE_KEY, id); } catch { /* ignore */ }
  } else {
    try { localStorage.removeItem(PALETTE_KEY); } catch { /* ignore */ }
  }
  const commit = () => {
    const scheme = paletteScheme(id);
    if (isPaletteId(id) && scheme) {
      root.setAttribute('data-palette', id);
      root.style.colorScheme = scheme;
    } else {
      root.removeAttribute('data-palette');
      const t = (localStorage.getItem(THEME_KEY) as Theme | null) || 'system';
      root.style.colorScheme = t === 'light' || t === 'dark' ? t : '';
    }
    applyFavicon();
  };
  runTransition(commit, animate);
  window.dispatchEvent(new Event('theme-change'));
}

export function readPalette(): string | null {
  try {
    const p = localStorage.getItem(PALETTE_KEY);
    return isPaletteId(p) ? p : null;
  } catch {
    return null;
  }
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
  // 配色主题优先:它自带明/暗,决定 favicon / theme-color。
  const palScheme = paletteScheme(readPalette());
  if (palScheme) return palScheme;
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
