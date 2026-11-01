'use client';

import { useEffect } from 'react';

/** Keep the home position in this tab, including returns via a HomeLink. */
export function useHomeScrollRestoration(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const path = window.location.pathname;
    const key = `home-scroll:${path}`;
    let saved = 0;
    try { saved = Number(sessionStorage.getItem(key)) || 0; } catch { /* Storage is optional. */ }
    if (!Number.isFinite(saved) || saved < 0) saved = 0;
    let restoring = saved > 0 && !window.location.hash;
    let leaving = false;
    let frame = 0;
    let observer: ResizeObserver | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const onHome = () => window.location.pathname === path;
    const stopRestoring = () => {
      restoring = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      clearTimeout(timeout);
    };
    const remember = () => {
      if (restoring || leaving || !onHome()) return;
      try { sessionStorage.setItem(key, String(window.scrollY)); } catch { /* Storage is optional. */ }
    };
    const restore = () => {
      if (!restoring || !onHome()) return;
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const top = Math.min(saved, max);
      if (window.scrollY !== top) window.scrollTo({ top, behavior: 'instant' });
      if (max >= saved) stopRestoring();
    };
    const scheduleRestore = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(restore);
    };
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.download || (anchor.target && anchor.target !== '_self')) return;
      const destination = new URL(anchor.href);
      if (destination.origin === location.origin && destination.pathname === path) return;
      remember();
      // Do not save Next's navigation-time scroll reset over the departure position.
      leaving = true;
      stopRestoring();
    };
    const onInput = () => { stopRestoring(); leaving = false; };
    const onKey = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) onInput();
    };
    if (restoring) {
      observer = new ResizeObserver(scheduleRestore);
      observer.observe(document.body);
      scheduleRestore();
      // Bound retries when the home layout has become shorter since departure.
      timeout = setTimeout(stopRestoring, 3000);
    }
    window.addEventListener('scroll', remember, { passive: true });
    window.addEventListener('pagehide', remember);
    document.addEventListener('click', onClick, true);
    window.addEventListener('wheel', onInput, { passive: true });
    window.addEventListener('touchstart', onInput, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      stopRestoring();
      window.removeEventListener('scroll', remember);
      window.removeEventListener('pagehide', remember);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('wheel', onInput);
      window.removeEventListener('touchstart', onInput);
      window.removeEventListener('keydown', onKey);
    };
  }, [ready]);
}
