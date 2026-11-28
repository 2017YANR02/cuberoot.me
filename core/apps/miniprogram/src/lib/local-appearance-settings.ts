import {
  ACCENT_COLORS, DEFAULT_APPEARANCE_PREFERENCES, findAccentColor, HOME_BACKGROUNDS, HOME_BACKGROUND_ASSETS,
  isHomeBackgroundChoice, isPaletteId, normalizeAppearancePreferences, PALETTES,
  resolveAppearanceScheme, resolveHomeBackground, type AppearancePreferences,
  type NativeAppearance, type NativeAppearanceColors,
} from '@cuberoot/shared/appearance';
import { nativeAppearanceScheme } from './appearance';
import { getMiniProgramLocale, tr } from './i18n';
import { miniProgramApi } from './platform';
import { SITE_ORIGIN } from './runtime-config';
import { readNativePreferences, receiveNativePreferences } from './preferences';
import themes from '../theme.json';

type Scheme = 'light' | 'dark';

// Native chrome requires solid RGB colors. Use the same palette swatches and
// accent variants as the App, then blend the remaining native surface tokens.
function mix(base: string, color: string, ratio: number): string {
  return '#' + [1, 3, 5].map(i => {
    const from = parseInt(base.slice(i, i + 2), 16);
    const to = parseInt(color.slice(i, i + 2), 16);
    return Math.round(from + (to - from) * ratio).toString(16).padStart(2, '0');
  }).join('');
}

function resolveColors(value: AppearancePreferences, scheme: Scheme): NativeAppearanceColors {
  const chrome = themes[scheme];
  const dark = scheme === 'dark';
  const palette = PALETTES.find(item => item.id === value.palette);
  const bg = palette?.swatch[0] ?? chrome.backgroundColor;
  const text = palette?.swatch[2] ?? (dark ? themes.light.backgroundColor : themes.dark.backgroundColor);
  const accent = findAccentColor(value.accent)?.[scheme] ?? palette?.swatch[1] ?? chrome.tabBarSelectedColor;
  const soft = value.contrast === 'soft';
  const background = soft ? mix(bg, chrome.tabBarColor, 0.33) : bg;
  return {
    '--cr-bg': background,
    '--cr-surface': mix(background, text, 0.05),
    '--cr-text': soft ? mix(text, chrome.tabBarColor, 0.5) : text,
    '--cr-muted': mix(bg, text, soft ? 0.69 : 0.58),
    '--cr-faint': mix(bg, text, soft ? 0.57 : 0.42),
    '--cr-line': mix(background, text, soft ? 0.12 : 0.1),
    '--cr-accent': accent,
    '--cr-accent-soft': mix(background, accent, 0.16),
    '--cr-ready': dark ? '#67b580' : '#2f7d4a',
    '--cr-danger': dark ? '#e47777' : '#b33a3a',
  };
}

function backgroundScene(choice: AppearancePreferences['lightBackground'], scheme: Scheme) {
  const scene = resolveHomeBackground(choice, scheme);
  return scene ? { id: scene.id, position: scene.position } : null;
}

const backgroundKey = (scheme: Scheme) => scheme === 'light' ? 'lightBackground' : 'darkBackground';
const rememberedKey = (scheme: Scheme) => `cuberoot.preferences.last-image.${scheme}`;

export function readLocalAppearanceSettings(): AppearancePreferences {
  const stored = readNativePreferences();
  if (!stored) return { ...DEFAULT_APPEARANCE_PREFERENCES, locale: getMiniProgramLocale() };
  return normalizeAppearancePreferences({
    ...stored,
    palette: isPaletteId(stored.palette) ? stored.palette : null,
    accent: findAccentColor(stored.accent)?.id ?? null,
    lightBackground: isHomeBackgroundChoice(stored.lightBackground) ? stored.lightBackground : undefined,
    darkBackground: isHomeBackgroundChoice(stored.darkBackground) ? stored.darkBackground : undefined,
  });
}

export function saveLocalAppearanceSettings(value: AppearancePreferences): boolean {
  // For System, supply both schemes. The native host selects the current one
  // at runtime and can update on an OS theme change without rewriting settings.
  const scheme = resolveAppearanceScheme(value, nativeAppearanceScheme() === 'dark');
  const followSystem = !value.palette && value.theme === 'system';
  const appearance: NativeAppearance = {
    type: 'cuberoot:appearance',
    scheme,
    followSystem,
    colors: resolveColors(value, scheme),
    ...(followSystem && { systemColors: { light: resolveColors(value, 'light'), dark: resolveColors(value, 'dark') } }),
    backgrounds: {
      light: backgroundScene(value.lightBackground, 'light'),
      dark: backgroundScene(value.darkBackground, 'dark'),
    },
    softBackground: value.contrast === 'soft',
  };
  const previous = readLocalAppearanceSettings();
  if (!receiveNativePreferences({ preferences: value, appearance })) return false;
  for (const scheme of ['light', 'dark'] as const) {
    const choice = value[backgroundKey(scheme)];
    const old = previous[backgroundKey(scheme)];
    const remembered = resolveHomeBackground(choice, scheme) ? choice : resolveHomeBackground(old, scheme) ? old : null;
    if (remembered) {
      try { miniProgramApi().setStorageSync(rememberedKey(scheme), remembered); }
      catch { /* The committed background is still usable. */ }
    }
  }
  return true;
}


function rememberedBackground(scheme: Scheme): AppearancePreferences['lightBackground'] {
  try {
    const saved: unknown = miniProgramApi().getStorageSync(rememberedKey(scheme));
    if (isHomeBackgroundChoice(saved) && resolveHomeBackground(saved, scheme)) return saved;
  } catch { /* Use App's automatic background by default. */ }
  return 'auto';
}

function options(value: AppearancePreferences) {
  const labels = (copy: { zh: string; en: string }) => tr(copy, value.locale);
  return {
    locale: [{ value: 'en' as const, label: 'English' }, { value: 'zh' as const, label: '简体中文' }],
    theme: [
      { value: 'system' as const, label: labels({ zh: '跟随系统', en: 'System' }), icon: 'monitor', swatch: '' },
      { value: 'dark' as const, label: labels({ zh: '深色', en: 'Dark' }), icon: 'moon', swatch: '' },
      { value: 'light' as const, label: labels({ zh: '浅色', en: 'Light' }), icon: 'sun', swatch: '' },
      ...PALETTES.map(palette => ({ value: palette.id, label: palette[value.locale], icon: '', swatch: palette.swatch[1] })),
    ],
    accent: [
      { value: null, label: labels({ zh: '跟随配色', en: 'Follow color theme' }), swatch: 'var(--cr-accent)' },
      ...ACCENT_COLORS.map(accent => ({ value: accent.id, label: accent[value.locale], swatch: accent.swatch })),
      { value: 'custom' as const, label: labels({ zh: '自定义', en: 'Custom' }), swatch: value.accent?.startsWith('#') ? value.accent : ACCENT_COLORS[0].swatch },
    ],
    backdrop: [
      { value: false, label: labels({ zh: '纯色', en: 'Solid color' }) },
      { value: true, label: labels({ zh: '背景', en: 'Image' }) },
    ],
  };
}

export function localAppearanceView(scheme = nativeAppearanceScheme()) {
  const value = readLocalAppearanceSettings();
  const list = options(value);
  const choice = resolveHomeBackground(value[backgroundKey(scheme)], scheme);
  const theme = list.theme.find(item => item.value === (value.palette ?? value.theme))!;
  const custom = value.accent?.startsWith('#') ?? false;
  const accent = list.accent.find(item => item.value === (custom ? 'custom' : value.accent))!;
  return {
    list, theme, accent, custom, hex: custom ? value.accent : '', contrast: value.contrast === 'soft',
    localeIndex: list.locale.findIndex(item => item.value === value.locale),
    themeIndex: list.theme.indexOf(theme),
    accentIndex: list.accent.indexOf(accent),
    backdropIndex: choice ? 1 : 0,
    scenes: choice ? HOME_BACKGROUNDS.map(scene => ({
      id: scene.id, label: scene[value.locale], selected: scene.id === choice.id,
      image: `${SITE_ORIGIN}${HOME_BACKGROUND_ASSETS}/${scene.id}-thumb.webp`,
    })) : [],
  };
}

export function appearanceOptionPatch(field: unknown, index: number): Partial<AppearancePreferences> | null {
  const value = readLocalAppearanceSettings();
  const list = options(value);
  if (field === 'locale') {
    const selected = list.locale[index];
    return selected ? { locale: selected.value } : null;
  }
  if (field === 'theme') {
    const selected = list.theme[index];
    if (!selected) return null;
    return isPaletteId(selected.value) ? { palette: selected.value } : { palette: null, theme: selected.value };
  }
  if (field === 'accent') {
    const selected = list.accent[index];
    if (!selected) return null;
    return { accent: findAccentColor(selected.value === 'custom' ? selected.swatch : selected.value)?.id ?? null };
  }
  if (field === 'backdrop') {
    const selected = list.backdrop[index];
    if (!selected) return null;
    const scheme = nativeAppearanceScheme();
    return { [backgroundKey(scheme)]: selected.value ? rememberedBackground(scheme) : 'none' };
  }
  return null;
}
