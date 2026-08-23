'use client';

import { useEffect } from 'react';

/** Keeps the screen awake while a CubeRoot page is visible, when allowed. */
export default function ScreenWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    const wakeLock = navigator.wakeLock;
    let sentinel: WakeLockSentinel | null = null;
    let requestPending: Promise<void> | null = null;
    let disposed = false;

    const release = () => {
      const current = sentinel;
      sentinel = null;
      if (current && !current.released) void current.release().catch(() => undefined);
    };

    const acquire = () => {
      if (
        disposed
        || document.visibilityState !== 'visible'
        || (sentinel && !sentinel.released)
        || requestPending
      ) return;

      requestPending = (async () => {
        try {
          const next = await wakeLock.request('screen');
          if (disposed || document.visibilityState !== 'visible') {
            void next.release().catch(() => undefined);
            return;
          }
          sentinel = next;
          next.addEventListener('release', () => {
            if (sentinel === next) sentinel = null;
          }, { once: true });
        } catch {
          // Expected when unsupported by policy, battery state, or user activation rules.
        } finally {
          requestPending = null;
        }
      })();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') acquire();
      else release();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', release);
    window.addEventListener('pageshow', acquire);
    // WebKit can require transient user activation for the first request.
    document.addEventListener('pointerdown', acquire, true);
    document.addEventListener('touchend', acquire, true);
    document.addEventListener('keydown', acquire, true);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', release);
      window.removeEventListener('pageshow', acquire);
      document.removeEventListener('pointerdown', acquire, true);
      document.removeEventListener('touchend', acquire, true);
      document.removeEventListener('keydown', acquire, true);
      release();
    };
  }, []);

  return null;
}
