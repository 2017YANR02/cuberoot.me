// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { THEME_BOOTSTRAP } from '@/lib/theme-bootstrap';
const preferences = { locale: 'en', theme: 'dark', palette: 'hantan', contrast: 'soft', lightBackground: '07', darkBackground: '08' };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubGlobal('matchMedia', () => ({ matches: false })); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('restores all native settings before paint even in an empty WebView store', () => {
  window.history.replaceState(null, '', '/timer?mpPreferences=' + encodeURIComponent(JSON.stringify({ preferences, nonce: 1 })));
  window.eval(THEME_BOOTSTRAP);
  expect(localStorage.getItem('trainer-lang')).toBe('en');
  expect(localStorage.getItem('theme')).toBe('dark');
  expect(localStorage.getItem('palette')).toBe('hantan');
  expect(localStorage.getItem('contrast')).toBe('soft');
  expect(localStorage.getItem('home-background.v1.light')).toBe('07');
  expect(localStorage.getItem('home-background.v1.dark')).toBe('08');
  expect(document.documentElement.dataset.palette).toBe('hantan');
  expect(document.documentElement.dataset.theme).toBe('dark');
  // Refreshing a document must not undo changes committed since it opened.
  localStorage.setItem('palette', 'xinhuang');
  window.eval(THEME_BOOTSTRAP);
  expect(localStorage.getItem('palette')).toBe('xinhuang');
  window.history.replaceState(null, '', '/timer?mpPreferences=' + encodeURIComponent(JSON.stringify({ preferences: { ...preferences, palette: null, theme: 'light', contrast: 'normal', darkBackground: 'none' }, nonce: 2 })));
  window.eval(THEME_BOOTSTRAP);
  expect(localStorage.getItem('palette')).toBeNull();
  expect(localStorage.getItem('theme')).toBe('light');
  expect(localStorage.getItem('home-background.v1.dark')).toBe('none');
});
it('rejects malformed preferences without overwriting existing storage', () => {
  localStorage.setItem('theme', 'light');
  window.history.replaceState(null, '', '/timer?mpPreferences=' + encodeURIComponent(JSON.stringify({ preferences: { ...preferences, darkBackground: 'url(evil)' } })));
  window.eval(THEME_BOOTSTRAP);
  expect(localStorage.getItem('theme')).toBe('light');
});
it('still initializes the existing theme when native preference writes exceed quota', () => {
  localStorage.setItem('theme', 'dark');
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-palette');
  window.history.replaceState(null, '', '/timer?mpPreferences=' + encodeURIComponent(JSON.stringify({ preferences, nonce: 3 })));
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (this === localStorage) throw new DOMException('Full', 'QuotaExceededError');
    original.call(this, key, value);
  });
  window.eval(THEME_BOOTSTRAP);
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.documentElement.style.colorScheme).toBe('dark');
});
