'use client';

import { useEffect, useState } from 'react';

// True when the primary pointer is coarse (finger / touch). Used to enlarge hit
// tolerances and selection handles so the editor is usable on phones / tablets.
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const handler = (e: MediaQueryListEvent) => setCoarse(e.matches);
    mq.addEventListener('change', handler);
    setCoarse(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return coarse;
}
