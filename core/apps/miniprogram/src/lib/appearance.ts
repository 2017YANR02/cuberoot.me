import { decodeNativeAppearance, NATIVE_APPEARANCE_TOKENS, NATIVE_BACKGROUND_ASSETS, type NativeAppearance } from '@cuberoot/shared/appearance';
import { isDouyinMiniProgram, miniProgramApi } from './platform';
import themes from '../theme.json';
import { SITE_ORIGIN } from './runtime-config';

const STORAGE_KEY = 'cuberoot.appearance.v1';
let current: NativeAppearance | null | undefined;
function readAppearance() {
  // Each page entry bundles its own copy of this module. A cached null or old
  // palette here would overwrite settings saved by the tools page on tab return.
  // Native storage is shared across those bundles; memory is only a read fallback.
  try { current = decodeNativeAppearance(miniProgramApi().getStorageSync(STORAGE_KEY)); }
  catch { /* Keep the last available preference if native storage is unavailable. */ }
  return current ?? null;
}

function systemIsDark(): boolean {
  const api = miniProgramApi();
  try {
    return (typeof api.getAppBaseInfo === 'function'
      ? api.getAppBaseInfo() : api.getSystemInfoSync()).theme === 'dark';
  } catch { return false; }
}

function appearanceScheme(appearance: NativeAppearance | null): 'light' | 'dark' {
  return appearance && !appearance.followSystem ? appearance.scheme : systemIsDark() ? 'dark' : 'light';
}

function appearanceColors(appearance: NativeAppearance | null, scheme: 'light' | 'dark') {
  if (!appearance) return null;
  if (!appearance.followSystem) return appearance.colors;
  return appearance.systemColors?.[scheme] ?? null;
}

export function nativeAppearanceStyle(): string {
  const appearance = readAppearance();
  const scheme = appearanceScheme(appearance);
  return styleForAppearance(appearance, scheme, appearanceColors(appearance, scheme));
}

function styleForAppearance(appearance: NativeAppearance | null, scheme: 'light' | 'dark', colors: NativeAppearance['colors'] | null): string {
  const styles = colors
    ? Object.entries(colors).map(([key, value]) => `${key}:${value}`)
    : isDouyinMiniProgram()
      ? Object.keys(NATIVE_APPEARANCE_TOKENS).map(key => `${key}:var(--cr-${scheme}-${key.slice('--cr-'.length)})`)
      : [];
  if (appearance?.backgrounds) {
    const scene = appearance.backgrounds[scheme];
    styles.push(`--cr-scene-image:${scene ? `url("${SITE_ORIGIN}${NATIVE_BACKGROUND_ASSETS}/${scene.id}.webp")` : 'none'}`);
    styles.push(`--cr-scene-position:${scene?.position ?? '50%'}`);
    styles.push(`--cr-scene-filter:${appearance.softBackground ? 'saturate(.65) contrast(.85)' : 'none'}`);
  }
  return styles.join(';');
}

export function applyNativeAppearance(): void {
  const api = miniProgramApi();
  try { if (api.getLaunchOptionsSync?.().scene === 1154) return; } catch { /* optional host API */ }
  const appearance = readAppearance();
  const scheme = appearanceScheme(appearance);
  const dark = scheme === 'dark';
  const defaults = themes[scheme];
  const colors = appearanceColors(appearance, scheme);
  const backgroundColor = colors?.['--cr-bg'] ?? defaults.backgroundColor;
  // Existing pages (including the visible native account page) update when the
  // hidden tools WebView finally delivers its queued appearance message.
  if (typeof getCurrentPages === 'function') {
    const appearanceStyle = styleForAppearance(appearance, scheme, colors);
    for (const page of getCurrentPages()) {
      page.setData(page.data?.nativeTimerPage
        ? { appearanceStyle, appearanceScheme: scheme }
        : { appearanceStyle });
    }
  }
  try { api.setNavigationBarColor({ backgroundColor, frontColor: dark ? '#ffffff' : '#000000' }); } catch { /* optional host API */ }
  try { api.setBackgroundColor({ backgroundColor }); } catch { /* optional host API */ }
  try { api.setTabBarStyle({ backgroundColor,
    color: colors?.['--cr-muted'] ?? defaults.tabBarColor,
    selectedColor: colors?.['--cr-accent'] ?? defaults.tabBarSelectedColor,
    borderStyle: dark ? 'black' : 'white' }); } catch { /* optional host API */ }
}

export function receiveNativeAppearance(value: unknown): void {
  const appearance = decodeNativeAppearance(value);
  if (!appearance) return;
  current = appearance;
  try { miniProgramApi().setStorageSync(STORAGE_KEY, appearance); } catch { /* use in-memory preference */ }
  applyNativeAppearance();
}
