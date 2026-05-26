'use client';

import { useMemo } from 'react';
import { apiUrl } from '@/lib/api-base';

interface Props {
  /** WCA notation alg. Treated as a SOLUTION — cube renders the case state that `algorithm`
   *  solves (i.e. inverse(algorithm) applied to solved). Pass empty string for solved cube. */
  algorithm: string;
  /** Forward scramble — applied DIRECTLY without inversion. When set, takes precedence over
   *  `algorithm`. */
  setup?: string;
  view: 'iso' | 'f2l' | 'oll' | 'pll' | 'pll-iso' | 'trans';
  /** Explicit Masking enum value (e.g. 'vh', 'wv', 'els'). Overrides the view-implied mask. */
  mask?: string;
  size?: number;
  puzzleSize?: number;
  alt?: string;
}

// Ported from packages/client/src/components/VisualCube.tsx — minus the SW interception note
// (Next.js bundles a fresh SW; for now this hits the api.cuberoot.me endpoint directly in prod).
export function VisualCube({ algorithm, setup, view, mask, size = 88, puzzleSize = 3, alt = 'Cube state' }: Props) {
  const src = useMemo(() => {
    const params = new URLSearchParams({ view, size: String(size) });
    if (setup) params.set('setup', setup);
    else params.set('case', algorithm);
    if (mask) params.set('mask', mask);
    if (puzzleSize !== 3) params.set('pzl', String(puzzleSize));
    return apiUrl(`/v1/visualcube.svg?${params}`);
  }, [algorithm, setup, view, mask, size, puzzleSize]);

  return <img src={src} width={size} height={size} alt={alt} />;
}
