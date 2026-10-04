import { NATIVE_APPEARANCE_TOKENS, type NativeAppearance, type NativeAppearanceColors } from '@cuberoot/shared/appearance';
import { confirmMiniProgramEnvironment, loadMiniProgramNavigationApi, mayUseMiniProgramBridge } from './miniprogram-bridge';
import { readEffective, readPalette, THEME_KEY } from './theme';

let lastPublished = '';

/** Send committed home appearance, never a hover preview or a page-local theme. */
export async function syncMiniProgramAppearance(): Promise<void> {
  if (!mayUseMiniProgramBridge() || !/^\/(?:zh\/?)?$/.test(location.pathname)) return;
  try {
    const api = await loadMiniProgramNavigationApi();
    if (!api?.postMessage || !await confirmMiniProgramEnvironment(api)) return;
    const root = document.documentElement;
    const palette = readPalette();
    const scheme = readEffective();
    if (root.hasAttribute('data-appearance-preview')
      || (root.getAttribute('data-palette') || null) !== palette
      || (root.getAttribute('data-theme') || scheme) !== scheme) return;
    const style = getComputedStyle(root);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) return;
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
    const savedTheme = localStorage.getItem(THEME_KEY);
    const message: NativeAppearance = { type: 'cuberoot:appearance', scheme, colors,
      followSystem: !palette && savedTheme !== 'light' && savedTheme !== 'dark' };
    const serialized = JSON.stringify(message);
    if (serialized === lastPublished) return;
    api.postMessage({ data: message });
    lastPublished = serialized;
  } catch { /* Appearance sync must not interrupt the page. */ }
}
