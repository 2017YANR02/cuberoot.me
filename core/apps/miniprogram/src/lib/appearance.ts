import { decodeNativeAppearance, type NativeAppearance } from '@cuberoot/shared/appearance';
import { miniProgramApi } from './platform';
import themes from '../theme.json';

const STORAGE_KEY = 'cuberoot.appearance.v1';
let current: NativeAppearance | null | undefined;
function readAppearance() {
  if (current !== undefined) return current;
  try { current = decodeNativeAppearance(miniProgramApi().getStorageSync(STORAGE_KEY)); }
  catch { current = null; }
  return current;
}

export function nativeAppearanceStyle(): string {
  const appearance = readAppearance();
  return appearance && !appearance.followSystem
    ? Object.entries(appearance.colors).map(([key, value]) => `${key}:${value}`).join(';')
    : '';
}

export function applyNativeAppearance(): void {
  const api = miniProgramApi();
  try { if (api.getLaunchOptionsSync?.().scene === 1154) return; } catch { /* optional host API */ }
  const appearance = readAppearance();
  let systemDark = false;
  try {
    systemDark = (typeof api.getAppBaseInfo === 'function'
      ? api.getAppBaseInfo() : api.getSystemInfoSync()).theme === 'dark';
  } catch { /* light fallback */ }
  const dark = appearance && !appearance.followSystem ? appearance.scheme === 'dark' : systemDark;
  const defaults = dark ? themes.dark : themes.light;
  const colors = appearance && !appearance.followSystem ? appearance.colors : null;
  const backgroundColor = colors?.['--cr-bg'] ?? defaults.backgroundColor;
  // Existing pages (including the visible native account page) update when the
  // hidden tools WebView finally delivers its queued appearance message.
  if (typeof getCurrentPages === 'function') {
    for (const page of getCurrentPages()) page.setData({ appearanceStyle: nativeAppearanceStyle() });
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
