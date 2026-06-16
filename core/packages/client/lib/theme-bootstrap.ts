// Inline <script> body injected before hydration so html[data-theme] /
// html[data-palette] is set BEFORE any CSS resolves. Avoids the white→dark FOUC
// on first paint.
//
// The runtime script body is self-contained (no imports). The palette→scheme
// map below is baked into the string at build time from lib/palettes.ts, so it
// can't drift from the real palette list.

import { PALETTES } from './palettes';

const PALETTE_SCHEMES = JSON.stringify(
  Object.fromEntries(PALETTES.map((p) => [p.id, p.scheme])),
);

export const THEME_BOOTSTRAP = `(() => {
  try {
    var de = document.documentElement;
    var schemes = ${PALETTE_SCHEMES};
    var pal = localStorage.getItem('palette');
    var eff;
    if (pal && schemes[pal]) {
      // 配色主题优先:整套覆盖 light/dark,自带明暗。
      de.setAttribute('data-palette', pal);
      de.setAttribute('data-palette-scheme', schemes[pal]);
      eff = schemes[pal];
      de.style.colorScheme = eff;
    } else {
      var t = localStorage.getItem('theme');
      if (t === 'light' || t === 'dark') {
        de.setAttribute('data-theme', t);
        de.style.colorScheme = t;
      }
      eff = (t === 'light' || t === 'dark')
        ? t
        : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
    var link = document.getElementById('app-favicon');
    if (link) {
      link.href = eff === 'dark' ? '/icons/CubeRoot-dark.png' : '/icons/CubeRoot.png';
    }
    // iOS Safari tints its top/bottom chrome from <meta name=theme-color>;
    // without it dark mode leaks white at the screen edges. Set a pre-paint
    // guess here (ThemeColorSync refines it to the exact page bg after render).
    var tc = document.getElementById('app-theme-color');
    if (tc) tc.setAttribute('content', eff === 'dark' ? '#171717' : '#fafafa');
  } catch (_) {}
})();`;

// Sets html[lang] from the URL locale prefix before paint. Root layout is now
// static (no cookies/headers) so it can't read the request locale at render;
// the /en /zh content language is owned by I18nProvider in [lang]/layout — this
// only fixes the <html lang> attribute for the current page.
export const LANG_BOOTSTRAP = `(() => {
  try {
    var p = location.pathname;
    var lang = 'en';
    if (p === '/zh' || p.indexOf('/zh/') === 0) lang = 'zh';
    document.documentElement.lang = lang;
  } catch (_) {}
})();`;
