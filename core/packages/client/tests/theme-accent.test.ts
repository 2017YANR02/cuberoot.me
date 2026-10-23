// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { ACCENT_COLORS, ACCENT_KEY, findAccentColor, setAccentRoot } from '@/lib/accent-colors';
import { THEME_BOOTSTRAP } from '@/lib/theme-bootstrap';
import { applyAccent, applyPalette, previewTheme, readAccent, restorePersistedAppearance } from '@/lib/theme';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  for (const attribute of ['data-theme', 'data-palette', 'data-palette-scheme', 'data-accent', 'style']) {
    document.documentElement.removeAttribute(attribute);
  }
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});

it('restores the chosen accent before hydration using the same root values as the UI', () => {
  localStorage.setItem(ACCENT_KEY, 'pink');
  window.eval(THEME_BOOTSTRAP);
  expect(document.documentElement.dataset.accent).toBe('pink');
  const firstPaint = document.documentElement.style.cssText;
  restorePersistedAppearance();
  expect(document.documentElement.style.cssText).toBe(firstPaint);
});

it('keeps the accent independent of palette selection and temporary scheme previews', () => {
  applyAccent('purple');
  applyPalette('hantan');
  previewTheme('light');
  expect(document.documentElement.dataset.accent).toBe('purple');
  restorePersistedAppearance();
  expect(document.documentElement.dataset.palette).toBe('hantan');
  expect(readAccent()).toBe('purple');
  applyAccent(null);
  expect(document.documentElement.dataset.palette).toBe('hantan');
  expect(document.documentElement.dataset.accent).toBeUndefined();
  expect(document.documentElement.style.getPropertyValue('--user-accent-dark')).toBe('');
  expect(readAccent()).toBeNull();
});

it('ignores invalid stored colors and does not rewrite unchanged root attributes', async () => {
  localStorage.setItem(ACCENT_KEY, 'invalid');
  window.eval(THEME_BOOTSTRAP);
  expect(document.documentElement.dataset.accent).toBeUndefined();
  setAccentRoot(document.documentElement, findAccentColor('blue'));
  const mutations = vi.fn();
  const observer = new MutationObserver(mutations);
  observer.observe(document.documentElement, { attributes: true });
  for (let i = 0; i < 5; i++) setAccentRoot(document.documentElement, findAccentColor('blue'));
  await Promise.resolve();
  observer.disconnect();
  expect(mutations).not.toHaveBeenCalled();
});

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map(value => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

it('keeps button text readable for every color in both schemes', () => {
  for (const color of ACCENT_COLORS) {
    for (const [scheme, foreground] of [['light', '#FFFFFF'], ['dark', '#171717']] as const) {
      const bg = luminance(color[scheme]);
      const fg = luminance(foreground);
      const ratio = (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
      expect(ratio, `${color.id} ${scheme}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});
