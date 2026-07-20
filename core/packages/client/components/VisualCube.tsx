'use client';

import { useMemo } from 'react';
import { renderFromSimpleQuery } from '@cuberoot/visualcube';
import { apiUrl } from '@/lib/api-base';

interface Props {
  /** WCA notation alg. Treated as a SOLUTION — cube renders the case state that `algorithm`
   *  solves (i.e. inverse(algorithm) applied to solved). Defaults to '' (solved); ignored when
   *  `setup` is given. */
  algorithm?: string;
  /** Forward scramble — applied DIRECTLY without inversion. When set, takes precedence over
   *  `algorithm`. */
  setup?: string;
  view: 'iso' | 'plan' | 'f2l' | 'oll' | 'pll' | 'pll-iso' | 'trans';
  /** Explicit Masking enum value (e.g. 'vh', 'wv', 'els'). Overrides the view-implied mask. */
  mask?: string;
  size?: number;
  puzzleSize?: number;
  alt?: string;
  /** Native <img> loading hint. Defaults to browser eager; pass 'lazy' for below-the-fold. */
  loading?: 'lazy' | 'eager';
  /**
   * Render the SVG in-process instead of fetching `/v1/visualcube.svg`.
   *
   * Same renderer as the server route (`renderFromSimpleQuery`), so the picture is identical —
   * it just costs main-thread work instead of a request. Use it where several cubes must appear
   * *together and instantly* (the trainer's three-at-once screen: a network `<img>` per cube
   * lands one by one, so the images visibly lag the scrambles and each other).
   *
   * Do NOT switch a grid of dozens of thumbnails to this — that's what `<img>` (parallel fetch +
   * HTTP cache) is good at; rendering them all synchronously would block paint.
   */
  local?: boolean;
}

// Ported from packages/client-vite/src/components/VisualCube.tsx — minus the SW interception note
// (Next.js bundles a fresh SW; for now this hits the api.cuberoot.me endpoint directly in prod).
export function VisualCube({ algorithm = '', setup, view, mask, size = 88, puzzleSize = 3, alt = 'Cube state', loading, local }: Props) {
  // 同一组参数喂两条路:本地渲染直接调 server 端点用的那个函数,URL 版把它们拼成 query。
  const svg = useMemo(() => {
    if (!local) return null;
    return renderFromSimpleQuery({
      ...(setup ? { setup } : { case: algorithm }),
      view, size, pzl: puzzleSize, ...(mask ? { mask } : {}),
    });
  }, [local, algorithm, setup, view, mask, size, puzzleSize]);

  const src = useMemo(() => {
    if (local) return '';
    const params = new URLSearchParams({ view, size: String(size) });
    if (setup) params.set('setup', setup);
    else params.set('case', algorithm);
    if (mask) params.set('mask', mask);
    if (puzzleSize !== 3) params.set('pzl', String(puzzleSize));
    return apiUrl(`/v1/visualcube.svg?${params}`);
  }, [local, algorithm, setup, view, mask, size, puzzleSize]);

  if (svg) {
    return (
      <span
        role="img"
        aria-label={alt}
        style={{ display: 'inline-flex', width: size, height: size }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
  return <img src={src} width={size} height={size} alt={alt} loading={loading} />;
}
