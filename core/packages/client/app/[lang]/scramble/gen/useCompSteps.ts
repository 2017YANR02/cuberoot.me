'use client';

import { useEffect, useState } from 'react';
import { fetchCompSteps, type CompStepsVariant } from '@/lib/comp-steps';
export { normScramble, type CompStepsVariant } from '@/lib/comp-steps';

export interface CompStepsState {
  map: Map<string, number[]> | null;
  ready: boolean;
}
const EMPTY: CompStepsState = { map: null, ready: false };

/** Read the shared static shard; a missing shard lets existing callers solve live. */
export function useCompSteps(compId: string | null, variant: CompStepsVariant = 'std'): CompStepsState {
  const key = variant + ':' + (compId ?? '');
  const [state, setState] = useState<{ key: string; value: CompStepsState } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!compId) return;
    fetchCompSteps(compId, variant).then(map => {
      if (!cancelled) setState({ key, value: { map, ready: true } });
    }).catch(() => {
      if (!cancelled) setState({ key, value: { map: null, ready: true } });
    });
    return () => { cancelled = true; };
  }, [compId, variant, key]);
  if (!compId) return { map: null, ready: true };
  return state?.key === key ? state.value : EMPTY;
}
