'use client';

import { useEffect } from 'react';
import { entryNavigationHref } from '@/lib/entry-navigation';

/** Native anchors in prose, map popups and generated HTML share AppLink's entry contract. */
export default function EntryNavigationBridge() {
  useEffect(() => {
    const originals = new WeakMap<HTMLAnchorElement, { original: string; applied: string }>();
    const prepare = (event: Event) => {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!anchor || anchor.hasAttribute('download') || anchor.hasAttribute('data-entry-navigation')) return;
      const previous = originals.get(anchor);
      const original = previous?.applied === anchor.getAttribute('href') ? previous.original : anchor.getAttribute('href')!;
      if (!original.startsWith('/') || original.startsWith('//')) return;
      const current = window.location.pathname + window.location.search + window.location.hash;
      const applied = entryNavigationHref(original, current);
      if (applied !== anchor.getAttribute('href')) anchor.setAttribute('href', applied);
      originals.set(anchor, { original, applied });
    };
    const events = ['pointerdown', 'focusin', 'contextmenu', 'click'];
    for (const event of events) document.addEventListener(event, prepare, true);
    return () => { for (const event of events) document.removeEventListener(event, prepare, true); };
  }, []);
  return null;
}
