'use client';

import { useEffect, useState } from 'react';
import { crossDigits } from '@/lib/comp-cross';

interface CrossMapState {
  /** scramble → optimal cross length per colour (BADGE_ORDER). */
  map: Map<string, number[]>;
  ready: boolean;
}

const EMPTY: CrossMapState = { map: new Map(), ready: false };

/**
 * Compute optimal 6-colour cross lengths for a fixed set of scrambles.
 * Runs once per distinct `scrambles` reference, deferred to a macrotask so the
 * first ~0.5s cross-table build never blocks paint. Callers must memoise the
 * `scrambles` array (stable reference) or this re-runs every render.
 */
export function useCrossMap(scrambles: string[]): CrossMapState {
  const [state, setState] = useState<CrossMapState>(EMPTY);
  useEffect(() => {
    if (scrambles.length === 0) { setState(EMPTY); return; }
    let cancelled = false;
    setState((s) => (s.ready ? EMPTY : s));
    const id = setTimeout(() => {
      const map = new Map<string, number[]>();
      for (const s of scrambles) {
        if (map.has(s)) continue;
        const d = crossDigits(s);
        if (d) map.set(s, d);
      }
      if (!cancelled) setState({ map, ready: true });
    }, 0);
    return () => { cancelled = true; clearTimeout(id); };
  }, [scrambles]);
  return state;
}
