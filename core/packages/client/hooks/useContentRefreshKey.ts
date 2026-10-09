'use client';

import { useEffect, useState } from 'react';

/** Re-run a page's read effect on return, without polling or interrupting edits. */
export function useContentRefreshKey(enabled = true): number {
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let lastRefresh = -Infinity;
    const refresh = () => {
      if (document.visibilityState === 'hidden' ||
        document.querySelector('[role="dialog"], dialog[open]') ||
        document.activeElement?.matches('input, textarea, [contenteditable="true"]')) return;
      // Browsers commonly send both focus and visibilitychange for one return.
      const now = Date.now();
      if (now - lastRefresh < 1000) return;
      lastRefresh = now;
      setKey(value => value + 1);
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled]);
  return key;
}
