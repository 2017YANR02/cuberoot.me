// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_APPEARANCE_PREFERENCES, decodeAppearancePreferences, resolveAppearanceScheme } from '@cuberoot/shared/appearance';
import { applyAppearancePreferences, persistAppearancePreferences, readAppearancePreferences, readRememberedAppearanceBackground } from '@cuberoot/app-ui/appearance';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('style');
  for (const key of ['theme', 'palette', 'palette-scheme', 'contrast', 'accent']) document.documentElement.removeAttribute(`data-${key}`);
});
afterEach(() => vi.restoreAllMocks());

it('migrates missing shell choices from timer preferences without overriding saved global choices', () => {
  expect(readAppearancePreferences({ theme: 'dark', locale: 'zh' })).toEqual({ ...DEFAULT_APPEARANCE_PREFERENCES, theme: 'dark', locale: 'zh' });
  persistAppearancePreferences({ ...DEFAULT_APPEARANCE_PREFERENCES, palette: 'hantan', locale: 'en' });
  expect(readAppearancePreferences({ theme: 'dark', locale: 'zh' })).toEqual({ ...DEFAULT_APPEARANCE_PREFERENCES, palette: 'hantan' });
});

it('applies palette, contrast and independent accent together without overwriting the saved theme choice', () => {
  const value = { ...DEFAULT_APPEARANCE_PREFERENCES, theme: 'system' as const, palette: 'hantan' as const, contrast: 'soft' as const, accent: '#123456' as const };
  persistAppearancePreferences(value);
  applyAppearancePreferences(value);
  expect(document.documentElement.dataset).toMatchObject({ theme: 'dark', palette: 'hantan', contrast: 'soft', accent: '#123456' });
  expect(document.documentElement.style.colorScheme).toBe('dark');
  expect(localStorage.getItem('theme')).toBe('system');
  applyAppearancePreferences(DEFAULT_APPEARANCE_PREFERENCES);
  expect(document.documentElement.hasAttribute('data-palette')).toBe(false);
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  expect(document.documentElement.hasAttribute('data-accent')).toBe(false);
  expect(document.documentElement.style.colorScheme).toBe('');
});

it.each([
  ['system', false, 'light'], ['system', true, 'dark'], ['light', true, 'light'], ['dark', false, 'dark'],
] as const)('resolves %s with systemDark=%s as %s', (theme, systemDark, expected) => {
  expect(resolveAppearanceScheme({ theme, palette: null }, systemDark)).toBe(expected);
});

it('remembers distinct light and dark images when backgrounds are disabled', () => {
  persistAppearancePreferences({ ...DEFAULT_APPEARANCE_PREFERENCES, lightBackground: '07', darkBackground: '08' });
  persistAppearancePreferences({ ...DEFAULT_APPEARANCE_PREFERENCES, lightBackground: 'none', darkBackground: 'transparent' });
  expect(readRememberedAppearanceBackground('light')).toBe('07');
  expect(readRememberedAppearanceBackground('dark')).toBe('08');
});

it('rejects malformed palettes, accents and background paths at the shared boundary', () => {
  for (const patch of [{ palette: 'constructor' }, { palette: ['hantan'] }, { accent: ['#123456'] }, { accent: 'url(x)' }, { darkBackground: '../x' }]) {
    expect(decodeAppearancePreferences({ ...DEFAULT_APPEARANCE_PREFERENCES, ...patch })).toBeNull();
  }
});

it('reports storage failure and restores prior preferences instead of announcing a successful partial save', () => {
  persistAppearancePreferences({ ...DEFAULT_APPEARANCE_PREFERENCES, theme: 'light' });
  const notify = vi.fn(); window.addEventListener('cuberoot:appearance-change', notify);
  const set = Storage.prototype.setItem;
  const mock = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === 'palette' && value === 'wujin') throw new Error('quota');
    set.call(this, key, value);
  });
  try {
    expect(() => persistAppearancePreferences({ ...DEFAULT_APPEARANCE_PREFERENCES, theme: 'dark', palette: 'wujin' })).toThrow('quota');
    expect(readAppearancePreferences().theme).toBe('light');
    expect(readAppearancePreferences().palette).toBeNull();
    expect(notify).not.toHaveBeenCalled();
  } finally { mock.mockRestore(); window.removeEventListener('cuberoot:appearance-change', notify); }
});
