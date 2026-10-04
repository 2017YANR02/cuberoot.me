'use client';

// Keeps <meta name="theme-color"> in sync with the page's real background so
// iOS Safari paints its top/bottom chrome to match — dark mode no longer leaks
// white at the screen edges. Reading the resolved <html> background-color is
// correct for every page kind: dual-theme (token flips), dark-locked (/wca/*,
// always #171717) and light-locked (/calc) alike, and it matches whatever the
// overscroll rubber-band shows. The pre-paint bootstrap sets a first guess from
// the stored/OS theme; this corrects it after CSS resolves and on every change.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CONTRAST_KEY, THEME_KEY, restorePersistedAppearance } from '@/lib/theme';
import { PALETTE_KEY } from '@/lib/palettes';
import { syncMiniProgramAppearance } from '@/lib/miniprogram-appearance';

export default function ThemeColorSync() {
  const pathname = usePathname();
  useEffect(() => {
    const publish = () => { void syncMiniProgramAppearance(); };
    const observer = new MutationObserver(publish);
    observer.observe(document.documentElement, { attributes: true,
      attributeFilter: ['data-theme', 'data-palette', 'data-contrast', 'data-appearance-preview'] });
    window.addEventListener('theme-change', publish);
    publish();
    return () => {
      observer.disconnect();
      window.removeEventListener('theme-change', publish);
    };
  }, [pathname]);
  useEffect(() => {
    // Mini-program tabs keep separate WebView documents alive. Their storage
    // is shared, but changing it does not update another document's html attrs.
    const restore = () => {
      restorePersistedAppearance();
      window.dispatchEvent(new Event('theme-change'));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === THEME_KEY
        || event.key === PALETTE_KEY || event.key === CONTRAST_KEY) restore();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') restore();
    };
    restore();
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', restore);
    window.addEventListener('focus', restore);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', restore);
      window.removeEventListener('focus', restore);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  useEffect(() => {
    const sync = () => {
      const bg = getComputedStyle(document.documentElement).backgroundColor;
      if (!bg) return;
      // React 19 head-hoisting can leave a second (stale) theme-color meta next
      // to the one the bootstrap mutated — same as the favicon. Update every
      // one so whichever the browser picks matches the real background.
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((m) => m.setAttribute('content', bg));
    };
    sync();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', sync);
    window.addEventListener('theme-change', sync);
    return () => {
      mq.removeEventListener('change', sync);
      window.removeEventListener('theme-change', sync);
    };
  }, [pathname]);
  return null;
}
