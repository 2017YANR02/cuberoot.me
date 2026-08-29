// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONTRAST_KEY,
  THEME_KEY,
  previewContrast,
  previewPalette,
  previewTheme,
  restorePersistedAppearance,
} from '@/lib/theme';
import { PALETTE_KEY } from '@/lib/palettes';

describe('appearance preview', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-palette');
    document.documentElement.removeAttribute('data-palette-scheme');
    document.documentElement.removeAttribute('data-contrast');
    document.documentElement.style.colorScheme = '';
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
  });

  it('previews a palette without changing the saved appearance', () => {
    localStorage.setItem(THEME_KEY, 'light');
    localStorage.setItem(CONTRAST_KEY, 'soft');

    previewPalette('hantan');

    expect(document.documentElement.dataset.palette).toBe('hantan');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(PALETTE_KEY)).toBeNull();
    expect(localStorage.getItem(THEME_KEY)).toBe('light');

    restorePersistedAppearance();

    expect(document.documentElement.dataset.palette).toBeUndefined();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.contrast).toBe('soft');
  });

  it('restores a saved palette after previewing a classic theme', () => {
    localStorage.setItem(PALETTE_KEY, 'xinhuang');

    previewTheme('dark');

    expect(document.documentElement.dataset.palette).toBeUndefined();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(PALETTE_KEY)).toBe('xinhuang');

    restorePersistedAppearance();

    expect(document.documentElement.dataset.palette).toBe('xinhuang');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('previews softness without persisting it', () => {
    previewContrast('soft');

    expect(document.documentElement.dataset.contrast).toBe('soft');
    expect(localStorage.getItem(CONTRAST_KEY)).toBeNull();

    restorePersistedAppearance();

    expect(document.documentElement.dataset.contrast).toBeUndefined();
  });
});
