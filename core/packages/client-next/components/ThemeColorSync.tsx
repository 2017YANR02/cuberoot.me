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

export default function ThemeColorSync() {
  const pathname = usePathname();
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
