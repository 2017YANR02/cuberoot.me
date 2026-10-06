import i18n, { normalizeAppLang } from '@/i18n/i18n-client';
import { NATIVE_APPEARANCE_TOKENS, type NativeAppearance, type NativeAppearanceColors, type MiniProgramPreferences } from '@cuberoot/shared/appearance';
import { confirmMiniProgramEnvironment, loadMiniProgramNavigationApi, mayUseMiniProgramBridge } from './miniprogram-bridge';
import { readContrast, readEffective, readPalette, THEME_KEY } from './theme';

import { readHomeBackgroundChoice } from '@/hooks/useHomeBackgroundChoice';
import { resolveHomeBackground } from './home-backgrounds';

let lastPublished = '';
let lastLocale = '';
let lastPreferences = '';
let publishing = false;

function backgroundScene(scheme: 'light' | 'dark') {
  const scene = resolveHomeBackground(readHomeBackgroundChoice(scheme), scheme);
  return scene ? { id: scene.id, position: scene.position } : null;
}


function resolveColors(scheme: 'light' | 'dark', palette: string | null): NativeAppearanceColors | null {
    // Reuse the global palette scopes so an art-directed page cannot publish
    // its local colors as the user's global preference.
    const probe = document.createElement('div');
    probe.className = 'native-appearance-scope palette-scope';
    probe.dataset.theme = scheme;
    if (palette) probe.dataset.palette = palette;
    probe.style.display = 'none';
    const contrast = document.createElement('div');
    contrast.className = 'contrast-scope';
    probe.appendChild(contrast);
    document.body.appendChild(probe);
    const style = getComputedStyle(contrast);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) { probe.remove(); return null; }
    const colors = {} as NativeAppearanceColors;
    for (const [native, web] of Object.entries(NATIVE_APPEARANCE_TOKENS)) {
      // Composite transparent tokens over the page background for native APIs,
      // which accept solid hex colors. Resolve color-mix through the browser.
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = style.getPropertyValue('--background').trim();
      context.fillRect(0, 0, 1, 1);
      context.fillStyle = style.getPropertyValue(web).trim();
      context.fillRect(0, 0, 1, 1);
      const pixels = context.getImageData(0, 0, 1, 1).data;
      colors[native as keyof NativeAppearanceColors] = `#${[pixels[0], pixels[1], pixels[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    }
    probe.remove();
    return colors;
}

/** Send committed home appearance, never a hover preview or a page-local theme. */
export async function syncMiniProgramAppearance(): Promise<void> {
  if (!mayUseMiniProgramBridge()) return;
  if (publishing || document.visibilityState === 'hidden' || location.pathname.startsWith('/auth/')) return;
  publishing = true;
  try {
    const api = await loadMiniProgramNavigationApi();
    if (!api?.postMessage || !await confirmMiniProgramEnvironment(api)) return;
    const locale = normalizeAppLang(i18n.language);
    const immediate = sessionStorage.getItem('cuberoot.native-preferences') === '2';
    if (!immediate && locale !== lastLocale) {
      api.postMessage({ data: { type: 'cuberoot:locale', locale } });
      lastLocale = locale;
    }
    const root = document.documentElement;
    const palette = readPalette();
    const scheme = readEffective();
    if (root.hasAttribute('data-appearance-preview')
      || (root.getAttribute('data-palette') || null) !== palette
      || (root.getAttribute('data-theme') || scheme) !== scheme) return;
    const colors = resolveColors(scheme, palette);
    if (!colors) return;
    const savedTheme = localStorage.getItem(THEME_KEY);
    const message: NativeAppearance = { type: 'cuberoot:appearance', scheme, colors,
      followSystem: !palette && savedTheme !== 'light' && savedTheme !== 'dark',
      backgrounds: { light: backgroundScene('light'), dark: backgroundScene('dark') },
      softBackground: readContrast() === 'soft' };
    if (message.followSystem) {
      const light = resolveColors('light', null);
      const dark = resolveColors('dark', null);
      if (light && dark) message.systemColors = { light, dark };
    }
    const serialized = JSON.stringify(message);
    if (immediate) {
      const preferences: MiniProgramPreferences = { locale,
        theme: savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'system',
        palette, contrast: readContrast(), lightBackground: readHomeBackgroundChoice('light'),
        darkBackground: readHomeBackgroundChoice('dark') };
      const payload = JSON.stringify({ preferences, appearance: message });
      if (payload === lastPreferences) return;
      const previous = lastPreferences;
      lastPreferences = payload;
      api.navigateTo({ url: `/pages/preferences/index?value=${encodeURIComponent(payload)}`,
        fail: () => { lastPreferences = previous; } });
    } else {
      if (serialized === lastPublished) return;
      api.postMessage({ data: message });
      lastPublished = serialized;
    }
  } catch { /* Appearance sync must not interrupt the page. */ }
  finally { publishing = false; }
}
