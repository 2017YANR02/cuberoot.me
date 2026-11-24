/** Browser-only appearance adapter shared by the website and installed shell.
 * Import this entry directly; it does not load the App or timer product. */
import {
  findAccentColor, isPaletteId, normalizeAppearancePreferences, paletteScheme, type AppearancePreferences,
} from '@cuberoot/shared/appearance';
import { setAccentRoot } from './appearance-accent';

export { runViewTransition } from './view-transition';
export { setAccentRoot } from './appearance-accent';
export { AppearanceBackground } from './AppearanceBackground';
export { AppearanceSettings, AppearanceThemeControl, AppearanceAccentControl, AppearanceBackgroundControl, AppearanceBackdropControls } from './AppearanceSettings';
export { AppAppearanceSettings } from './AppAppearanceSettings';
export { PrimaryNavigationOptics } from './PrimaryNavigationOptics';

export { APPEARANCE_CHANGE_EVENT, readAppearancePreferences, persistAppearancePreferences, readRememberedAppearanceBackground } from './appearance-storage';

export function applyAppearanceThemeRoot(theme: AppearancePreferences['theme'], clearPalette = false): void {
  const root = document.documentElement;
  if (clearPalette) { root.removeAttribute('data-palette'); root.removeAttribute('data-palette-scheme'); }
  if (theme === 'light' || theme === 'dark') { root.dataset.theme = theme; root.style.colorScheme = theme; }
  else { delete root.dataset.theme; root.style.colorScheme = ''; }
}

export function applyAppearancePaletteRoot(palette: string | null, theme: AppearancePreferences['theme']): void {
  const root = document.documentElement;
  const scheme = paletteScheme(palette);
  if (isPaletteId(palette) && scheme) {
    root.dataset.palette = palette; root.dataset.paletteScheme = scheme;
    root.dataset.theme = scheme; root.style.colorScheme = scheme;
  } else applyAppearanceThemeRoot(theme, true);
}

export function applyAppearanceContrastRoot(contrast: AppearancePreferences['contrast']): void {
  if (contrast === 'soft') document.documentElement.dataset.contrast = contrast;
  else delete document.documentElement.dataset.contrast;
}

/** Apply committed or preview values without writing storage or emitting a commit. */
export function applyAppearancePreferences(input: AppearancePreferences): void {
  const value = normalizeAppearancePreferences(input);
  applyAppearancePaletteRoot(value.palette, value.theme);
  applyAppearanceContrastRoot(value.contrast);
  setAccentRoot(document.documentElement, findAccentColor(value.accent));
  document.documentElement.lang = value.locale === 'zh' ? 'zh-Hans' : 'en';
}
