'use client';

import { useEffect } from 'react';

const activeAttribute = 'data-site-scroll-active';
const idleDelay = 450;

export default function SiteScrollbars() {
  useEffect(() => {
    const timers = new Map<Element, number>();
    const onScroll = (event: Event) => {
      const target = event.target === document ? document.scrollingElement : event.target;
      if (!(target instanceof Element)) return;

      const previous = timers.get(target);
      if (previous === undefined) target.setAttribute(activeAttribute, '');
      else window.clearTimeout(previous);

      timers.set(target, window.setTimeout(() => {
        target.removeAttribute(activeAttribute);
        timers.delete(target);
      }, idleDelay));
    };

    // Capture element scrolls as well as viewport scrolls. No wheel handler is
    // needed, since attempts to scroll past an edge leave the bar hidden.
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      for (const [target, timer] of timers) {
        window.clearTimeout(timer);
        target.removeAttribute(activeAttribute);
      }
    };
  }, []);

  return null;
}
