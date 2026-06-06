// Inline <script> body injected before hydration so html[data-theme] is set
// BEFORE any CSS resolves. Avoids the white→dark FOUC on first paint.
//
// Keep this self-contained (no imports), since it's stringified and runs in
// the document head context.

export const THEME_BOOTSTRAP = `(() => {
  try {
    var t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
      document.documentElement.style.colorScheme = t;
    }
    var eff = (t === 'light' || t === 'dark')
      ? t
      : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
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
    document.documentElement.lang = (p === '/zh' || p.indexOf('/zh/') === 0) ? 'zh' : 'en';
  } catch (_) {}
})();`;
