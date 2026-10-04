// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeColorSync from '@/components/ThemeColorSync';
import { previewPalette } from '@/lib/theme';
import { syncMiniProgramAppearance } from '@/lib/miniprogram-appearance';
vi.mock('next/navigation', () => ({ usePathname: () => '/zh/timer' }));
vi.mock('@/lib/miniprogram-appearance', () => ({ syncMiniProgramAppearance: vi.fn() }));

describe('persisted appearance across WebView documents', () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(createElement(ThemeColorSync)));
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });
  it('applies another tab’s dark mode, palette, contrast and reset', () => {
    localStorage.setItem('theme', 'dark');
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    localStorage.setItem('palette', 'xinhuang');
    window.dispatchEvent(new StorageEvent('storage', { key: 'palette' }));
    expect(document.documentElement.dataset.palette).toBe('xinhuang');
    expect(document.documentElement.dataset.paletteScheme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    localStorage.setItem('contrast', 'soft');
    window.dispatchEvent(new StorageEvent('storage', { key: 'contrast' }));
    expect(document.documentElement.dataset.contrast).toBe('soft');
    localStorage.removeItem('palette');
    window.dispatchEvent(new StorageEvent('storage', { key: 'palette' }));
    expect(document.documentElement.dataset.palette).toBeUndefined();
    expect(document.documentElement.dataset.theme).toBe('dark');
    localStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.documentElement.dataset.paletteScheme).toBeUndefined();
    expect(document.documentElement.dataset.contrast).toBeUndefined();
    expect(document.documentElement.style.colorScheme).toBe('');
  });
  it.each(['pageshow', 'focus', 'visibilitychange'])('restores missed changes on %s', (name) => {
    localStorage.setItem('palette', 'hantan');
    const changed = vi.fn();
    window.addEventListener('theme-change', changed);
    if (name === 'visibilitychange') {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event(name));
    } else window.dispatchEvent(new Event(name));
    expect(document.documentElement.dataset.palette).toBe('hantan');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(changed).toHaveBeenCalledTimes(1);
    window.removeEventListener('theme-change', changed);
  });
  it('publishes background-only changes from the picker and other documents', () => {
    vi.mocked(syncMiniProgramAppearance).mockClear();
    window.dispatchEvent(new Event('home-background-change'));
    expect(syncMiniProgramAppearance).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new StorageEvent('storage', { key: 'home-background.v1.dark' }));
    expect(syncMiniProgramAppearance).toHaveBeenCalledTimes(2);
  });
  it('preserves local previews on unrelated storage updates', () => {
    previewPalette('hantan');
    window.dispatchEvent(new StorageEvent('storage', { key: 'timer.settings' }));
    expect(document.documentElement.dataset.palette).toBe('hantan');
  });
});
