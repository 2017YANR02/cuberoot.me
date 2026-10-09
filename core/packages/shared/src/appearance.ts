/** Web token -> native token boundary. CSS remains the color source of truth. */
export const NATIVE_APPEARANCE_TOKENS = {
  '--cr-bg': '--background',
  '--cr-surface': '--card',
  '--cr-text': '--foreground',
  '--cr-muted': '--muted-foreground',
  '--cr-faint': '--faint-foreground',
  '--cr-line': '--border-default',
  '--cr-accent': '--accent',
  '--cr-accent-soft': '--accent-soft',
  '--cr-ready': '--signal-success',
  '--cr-danger': '--destructive',
} as const;
export type NativeAppearanceColors = Record<keyof typeof NATIVE_APPEARANCE_TOKENS, string>;
export interface NativeBackgroundScene {
  id: string;
  position: string;
}
export const NATIVE_BACKGROUND_ASSETS = '/assets/home-backgrounds/v1';
export interface NativeAppearance {
  type: 'cuberoot:appearance';
  scheme: 'light' | 'dark';
  followSystem: boolean;
  colors: NativeAppearanceColors;
  systemColors?: Record<'light' | 'dark', NativeAppearanceColors>;
  backgrounds?: Record<'light' | 'dark', NativeBackgroundScene | null>;
  softBackground?: boolean;
}
export function decodeNativeAppearance(value: unknown): NativeAppearance | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as Partial<NativeAppearance>;
  if (message.type !== 'cuberoot:appearance'
    || (message.scheme !== 'light' && message.scheme !== 'dark')
    || typeof message.followSystem !== 'boolean'
    || !message.colors || typeof message.colors !== 'object') return null;
  const colors = {} as NativeAppearanceColors;
  for (const key of Object.keys(NATIVE_APPEARANCE_TOKENS) as (keyof NativeAppearanceColors)[]) {
    const color = message.colors[key];
    if (typeof color !== 'string' || !/^#[\da-f]{6}$/i.test(color)) return null;
    colors[key] = color;
  }
  const appearance: NativeAppearance = { type: 'cuberoot:appearance', scheme: message.scheme, followSystem: message.followSystem, colors };
  if (message.systemColors) {
    const light = decodeNativeAppearance({ type: message.type, scheme: 'light', followSystem: false, colors: message.systemColors.light });
    const dark = decodeNativeAppearance({ type: message.type, scheme: 'dark', followSystem: false, colors: message.systemColors.dark });
    if (light && dark) appearance.systemColors = { light: light.colors, dark: dark.colors };
  }
  // Old senders remain compatible; malformed scene metadata cannot become CSS or a URL.
  if (message.backgrounds && typeof message.backgrounds === 'object') {
    appearance.backgrounds = { light: null, dark: null };
    for (const scheme of ['light', 'dark'] as const) {
      const scene = message.backgrounds[scheme];
      if (scene && typeof scene.id === 'string' && /^(0[1-9]|10)$/.test(scene.id)
        && typeof scene.position === 'string' && /^(100|[0-9]{1,2})%$/.test(scene.position)) {
        appearance.backgrounds[scheme] = { id: scene.id, position: scene.position };
      }
    }
    appearance.softBackground = message.softBackground === true;
  }
  return appearance;
}

/** Persisted choices, separate from resolved native paint colors. */
export interface MiniProgramPreferences {
  locale: 'en' | 'zh';
  theme: 'system' | 'light' | 'dark';
  palette: string | null;
  contrast: 'normal' | 'soft';
  lightBackground: string;
  darkBackground: string;
}
export const MINI_PROGRAM_PREFERENCES_QUERY = 'mpPreferences';
export function decodeMiniProgramPreferences(value: unknown): MiniProgramPreferences | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as MiniProgramPreferences;
  const background = (v: unknown) => typeof v === 'string' && /^(auto|none|transparent|0[1-9]|10)$/.test(v);
  if (!['en', 'zh'].includes(p.locale) || !['system', 'light', 'dark'].includes(p.theme)
    || !(p.palette === null || (typeof p.palette === 'string' && /^[a-z][a-z0-9-]{0,40}$/.test(p.palette)))
    || !['normal', 'soft'].includes(p.contrast) || !background(p.lightBackground) || !background(p.darkBackground)) return null;
  return { locale: p.locale, theme: p.theme, palette: p.palette, contrast: p.contrast,
    lightBackground: p.lightBackground, darkBackground: p.darkBackground };
}
