'use client';

// Ported from packages/client-vite/src/utils/theme.ts.
// Differences from Vite original:
//   - Bootstrap is inlined into <head> as a beforeInteractive script (lib/theme-bootstrap-script.ts)
//     so no FOUC between SSR document arrival and React hydration.

import { useEffect, useState } from 'react';
import { PALETTE_KEY, isPaletteId, paletteScheme, type PaletteId } from './palettes';
import { persistItem } from './safe-storage';

export type Theme = 'system' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';
export const THEME_KEY = 'theme';

// 柔和度 — 正交于明暗 / 配色的一档「降低对比」偏好(护眼)。写 <html data-contrast=x>,
// 实际混色在 app/globals.css(body 层 color-mix,见那里的注释)。normal = 不写属性。
export type ContrastLevel = 'normal' | 'soft';
export const CONTRAST_KEY = 'contrast';
export const CONTRAST_LEVELS: { id: ContrastLevel; zh: string; en: string }[] = [
  { id: 'normal', zh: '标准', en: 'Normal' },
  { id: 'soft', zh: '柔和', en: 'Soft' },
];

function isContrastLevel(v: string | null | undefined): v is ContrastLevel {
  return v === 'normal' || v === 'soft';
}

type ViewTransitionHandle = {
  ready?: Promise<unknown>;
  finished?: Promise<unknown>;
  skipTransition?: () => void;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: (cb: () => void) => ViewTransitionHandle;
};

let activeThemeTransition: ViewTransitionHandle | null = null;

const APPEARANCE_PREVIEW_DURATION_MS = 280;
const APPEARANCE_PREVIEW_TOKENS = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--faint-foreground',
  '--accent',
  '--accent-foreground',
  '--border-default',
  '--border-strong',
  '--input',
  '--toggle-on',
  '--article-red',
  '--article-blue',
  '--calc-a',
  '--calc-b',
  '--calc-target',
] as const;

type CssWithRegisterProperty = typeof CSS & {
  registerProperty?: (definition: {
    name: string;
    syntax: string;
    inherits: boolean;
    initialValue: string;
  }) => void;
};

let previewTokensRegistered = false;
let previewCleanupTimer: ReturnType<typeof setTimeout> | null = null;

function registerPreviewTokens() {
  if (previewTokensRegistered || typeof CSS === 'undefined') return;
  previewTokensRegistered = true;
  const css = CSS as CssWithRegisterProperty;
  if (typeof css.registerProperty !== 'function') return;
  for (const name of APPEARANCE_PREVIEW_TOKENS) {
    try {
      css.registerProperty({
        name,
        syntax: '<color>',
        inherits: true,
        initialValue: 'transparent',
      });
    } catch {
      // Another bundle or hot reload may already have registered the property.
    }
  }
}

// Hover previews must keep pointer hit-testing live. Registered color tokens animate
// without the full-page snapshot that View Transitions creates.
export function beginAppearancePreview() {
  registerPreviewTokens();
  if (previewCleanupTimer) clearTimeout(previewCleanupTimer);
  previewCleanupTimer = null;
  document.documentElement.setAttribute('data-appearance-preview', '');
}

export function endAppearancePreview(afterTransition = false) {
  if (previewCleanupTimer) clearTimeout(previewCleanupTimer);
  previewCleanupTimer = null;
  const clear = () => {
    document.documentElement.removeAttribute('data-appearance-preview');
    previewCleanupTimer = null;
  };
  if (afterTransition && !prefersReducedMotion()) {
    previewCleanupTimer = setTimeout(clear, APPEARANCE_PREVIEW_DURATION_MS);
  } else {
    clear();
  }
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// 外观切换且浏览器支持时,用 View Transitions 让整页旧→新交叉淡出(晕染);
// 否则(首屏恢复 / 不支持 / reduced-motion)直接瞬切。
function runTransition(commit: () => void, animate: boolean) {
  const doc = document as DocumentWithViewTransition;
  if (animate && typeof doc.startViewTransition === 'function' && !prefersReducedMotion()) {
    activeThemeTransition?.skipTransition?.();
    const transition = doc.startViewTransition(commit);
    activeThemeTransition = transition;
    // skipTransition() 会按规范拒绝 ready；快速扫过选项时这是预期取消，不应冒泡到错误层。
    void transition.ready?.catch(() => undefined);
    const clear = () => {
      if (activeThemeTransition === transition) activeThemeTransition = null;
    };
    void transition.finished?.then(clear, clear);
  } else {
    activeThemeTransition?.skipTransition?.();
    activeThemeTransition = null;
    commit();
  }
}

function readTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  } catch {
    return 'system';
  }
}

function applyThemeRoot(theme: Theme, clearPalette: boolean) {
  const root = document.documentElement;
  if (clearPalette) {
    root.removeAttribute('data-palette');
    root.removeAttribute('data-palette-scheme');
  }
  if (theme === 'light' || theme === 'dark') {
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
  } else {
    root.removeAttribute('data-theme');
    root.style.colorScheme = '';
  }
}

function applyPaletteRoot(id: string | null) {
  const root = document.documentElement;
  const scheme = paletteScheme(id);
  if (isPaletteId(id) && scheme) {
    root.setAttribute('data-palette', id);
    root.setAttribute('data-palette-scheme', scheme);
    root.setAttribute('data-theme', scheme);
    root.style.colorScheme = scheme;
  } else {
    applyThemeRoot(readTheme(), true);
  }
}

function applyContrastRoot(level: ContrastLevel) {
  const root = document.documentElement;
  if (level === 'normal') root.removeAttribute('data-contrast');
  else root.setAttribute('data-contrast', level);
}

// clearPalette: 用户点 light/dark 开关时退出配色主题,回到经典明暗。
export function applyTheme(theme: Theme, animate = false, clearPalette = false) {
  const commit = () => {
    if (clearPalette) {
      try { localStorage.removeItem(PALETTE_KEY); } catch { /* ignore */ }
    }
    applyThemeRoot(theme, clearPalette);
  };
  runTransition(commit, animate);
}

// 选 / 清配色主题。id=null → 回到经典(移除 data-palette,恢复 theme 的 color-scheme)。
export function applyPalette(id: string | null, animate = false) {
  if (isPaletteId(id)) {
    persistItem(PALETTE_KEY, id);
  } else {
    try { localStorage.removeItem(PALETTE_KEY); } catch { /* ignore */ }
  }
  const commit = () => {
    applyPaletteRoot(id);
  };
  runTransition(commit, animate);
  window.dispatchEvent(new Event('theme-change'));
}

// 选柔和度。与明暗 / 配色互不干扰:只调 token 的对比强度,不换色相。
export function applyContrast(level: ContrastLevel, animate = false) {
  if (level === 'normal') {
    try { localStorage.removeItem(CONTRAST_KEY); } catch { /* ignore */ }
  } else {
    persistItem(CONTRAST_KEY, level);
  }
  runTransition(() => applyContrastRoot(level), animate);
  window.dispatchEvent(new Event('theme-change'));
}

// 外观菜单 hover/focus 预览:只改当前文档,不写 localStorage。
export function previewTheme(theme: 'light' | 'dark') {
  applyThemeRoot(theme, true);
}

export function previewPalette(id: PaletteId) {
  applyPaletteRoot(id);
}

export function previewContrast(level: ContrastLevel) {
  applyContrastRoot(level);
}

export function restorePersistedAppearance() {
  const palette = readPalette();
  if (palette) applyPaletteRoot(palette);
  else applyThemeRoot(readTheme(), true);
  applyContrastRoot(readContrast());
}

export function readContrast(): ContrastLevel {
  try {
    const v = localStorage.getItem(CONTRAST_KEY);
    return isContrastLevel(v) ? v : 'normal';
  } catch {
    return 'normal';
  }
}

export function readPalette(): string | null {
  try {
    const p = localStorage.getItem(PALETTE_KEY);
    return isPaletteId(p) ? p : null;
  } catch {
    return null;
  }
}

export function readEffective(): EffectiveTheme {
  // 配色主题优先:它自带明/暗,决定 theme-color。
  const palScheme = paletteScheme(readPalette());
  if (palScheme) return palScheme;
  const saved = readTheme();
  if (saved === 'light' || saved === 'dark') return saved;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useEffectiveTheme(): EffectiveTheme {
  const [t, setT] = useState<EffectiveTheme>(() =>
    typeof window === 'undefined' ? 'light' : readEffective(),
  );
  useEffect(() => {
    const refresh = () => setT(readEffective());
    refresh();
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
