// Inline <script> body injected before hydration so html[data-theme] is set
// BEFORE any CSS resolves. Avoids the white→dark FOUC on first paint.
//
// Keep this self-contained (no imports), since it's stringified and runs in
// the document head context.

export const THEME_BOOTSTRAP = `(() => {
  try {
    var t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    var link = document.getElementById('app-favicon');
    if (link) {
      var eff = t;
      if (eff !== 'light' && eff !== 'dark') {
        eff = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      link.href = eff === 'dark' ? '/icons/CubeRoot-dark.png' : '/icons/CubeRoot.png';
    }
  } catch (_) {}
})();`;
