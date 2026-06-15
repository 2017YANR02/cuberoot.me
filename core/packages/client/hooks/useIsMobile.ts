'use client';

// Ported verbatim from packages/client/src/hooks/useIsMobile.ts.
// SSR guard already in place via typeof window check.

import { useEffect, useState } from 'react';

export function useIsMobile(maxWidth = 768): boolean {
  const query = `(max-width: ${maxWidth}px)`;
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return isMobile;
}
