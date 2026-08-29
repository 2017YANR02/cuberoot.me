// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONTRAST_KEY,
  THEME_KEY,
  applyPalette,
  beginAppearancePreview,
  endAppearancePreview,
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
    document.documentElement.removeAttribute('data-appearance-preview');
    document.documentElement.style.colorScheme = '';
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: undefined,
    });
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
  });

  it('handles the expected ready rejection when persisted transitions overlap', () => {
    const firstReadyCatch = vi.fn(() => Promise.resolve());
    const secondReadyCatch = vi.fn(() => Promise.resolve());
    const firstSkip = vi.fn();
    const transitions = [
      {
        ready: { catch: firstReadyCatch } as unknown as Promise<unknown>,
        finished: new Promise<unknown>(() => undefined),
        skipTransition: firstSkip,
      },
      {
        ready: { catch: secondReadyCatch } as unknown as Promise<unknown>,
        finished: Promise.resolve(),
        skipTransition: vi.fn(),
      },
    ];
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: vi.fn((update: () => void) => {
        update();
        return transitions.shift();
      }),
    });

    applyPalette('hantan', true);
    applyPalette('xinhuang', true);

    expect(firstSkip).toHaveBeenCalledOnce();
    expect(firstReadyCatch).toHaveBeenCalledOnce();
    expect(secondReadyCatch).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.palette).toBe('xinhuang');
  });

  it('keeps rapid previews out of the full-page transition layer', () => {
    const startViewTransition = vi.fn();
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    });

    beginAppearancePreview();
    previewPalette('hantan');
    previewPalette('xinhuang');

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(document.documentElement.hasAttribute('data-appearance-preview')).toBe(true);
    expect(document.documentElement.dataset.palette).toBe('xinhuang');

    endAppearancePreview();
    expect(document.documentElement.hasAttribute('data-appearance-preview')).toBe(false);
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
