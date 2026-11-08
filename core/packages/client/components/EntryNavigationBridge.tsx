'use client';

import { useEffect } from 'react';
import { currentEntryHref, installEntryNavigation } from '@/lib/entry-navigation';

/** Native anchors in prose, map popups and generated HTML share AppLink's entry contract. */
export default function EntryNavigationBridge() {
  useEffect(() => {
    const dispose = installEntryNavigation();
    const prepare = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!anchor || anchor.hasAttribute('download') || anchor.hasAttribute('data-entry-navigation')
        || anchor.target && anchor.target !== '_self' || anchor.origin !== window.location.origin) return;
      if (anchor.getAttribute('href')?.startsWith('#')) return;
      currentEntryHref(anchor.pathname + anchor.search + anchor.hash);
    };
    // Bubble phase respects cancelled clicks. Copying, focusing and opening a new tab never mutate links.
    document.addEventListener('click', prepare);
    return () => { document.removeEventListener('click', prepare); dispose(); };
  }, []);
  return null;
}
