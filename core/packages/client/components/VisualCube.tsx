'use client';

import { useMemo } from 'react';
import { renderFromSimpleQuery, type PlanSimplifyOptions } from '@cuberoot/visualcube';
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
  /** Exact final-state 6N² compact colour codes in U R F D L B order. */
  faceletColors?: string;
  /** Forward whole-cube rotation applied only when `faceletColors` is present. */
  faceletAlg?: string;
  /** U R F D L B face colours, using the visualcube `sch=` format. Only for semantic diagrams. */
  scheme?: string;
  /** Plan simplification: keep every sticker carrying the U-face colour. Defaults to renderer behavior. */
  showLastLayerColor?: boolean;
  /** Recognition projection for plan views: retain only salient bars, pairs and U-face features. */
  planSimplify?: PlanSimplifyOptions;
  /**
   * Plan views (`plan` / `oll` / `pll`) only — drop the grey (masked) side-rim stickers
   * instead of drawing them, so an OLL thumbnail is just the yellow bars. The 9 U-face
   * stickers are byte-identical either way. Bare `view="plan"` already does this by
   * default; use the prop for aliases such as `oll`. No-op on iso views and on `pll`,
   * whose rim carries real colours.
   */
  hideGreySides?: boolean;
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
export function VisualCube({ algorithm = '', setup, view, mask, faceletColors, faceletAlg, scheme, showLastLayerColor, planSimplify, size = 88, puzzleSize = 3, alt = 'Cube state', loading, local, hideGreySides }: Props) {
  // Exact facelet states are already available in the client bundle and may use
  // query features that an older deployed API does not know yet. Render them
  // locally so the page and its data stay atomic during rolling deployments.
  const renderLocally = Boolean(local || faceletColors);
  // 同一组参数喂两条路:本地渲染直接调 server 端点用的那个函数,URL 版把它们拼成 query。
  const svg = useMemo(() => {
    if (!renderLocally) return null;
    return renderFromSimpleQuery({
      ...(faceletColors ? { fc: faceletColors, ...(faceletAlg ? { alg: faceletAlg } : {}) } : setup ? { setup } : { case: algorithm }),
      view, size, pzl: puzzleSize, ...(mask ? { mask } : {}),
      ...(scheme ? { sch: scheme } : {}),
      ...(hideGreySides ? { ngs: '1' } : {}),
      ...((planSimplify?.showYellow ?? showLastLayerColor) !== undefined
        ? { psy: (planSimplify?.showYellow ?? showLastLayerColor) ? '1' : '0' }
        : {}),
      ...(planSimplify?.side ? { psr: planSimplify.side } : {}),
      ...(planSimplify?.up ? { pur: planSimplify.up } : {}),
      ...(planSimplify?.forceShow ? { pfs: planSimplify.forceShow } : {}),
      ...(planSimplify?.forceHide ? { pfh: planSimplify.forceHide } : {}),
    });
  }, [renderLocally, algorithm, setup, view, mask, faceletColors, faceletAlg, scheme, showLastLayerColor, planSimplify, size, puzzleSize, hideGreySides]);

  const src = useMemo(() => {
    if (renderLocally) return '';
    const params = new URLSearchParams({ view, size: String(size) });
    if (faceletColors) {
      params.set('fc', faceletColors);
      if (faceletAlg) params.set('alg', faceletAlg);
    } else if (setup) params.set('setup', setup);
    else params.set('case', algorithm);
    if (mask) params.set('mask', mask);
    if (scheme) params.set('sch', scheme);
    const keepLastLayer = planSimplify?.showYellow ?? showLastLayerColor;
    if (keepLastLayer !== undefined) params.set('psy', keepLastLayer ? '1' : '0');
    if (planSimplify?.side) params.set('psr', planSimplify.side);
    if (planSimplify?.up) params.set('pur', planSimplify.up);
    if (planSimplify?.forceShow) params.set('pfs', planSimplify.forceShow);
    if (planSimplify?.forceHide) params.set('pfh', planSimplify.forceHide);
    if (puzzleSize !== 3) params.set('pzl', String(puzzleSize));
    // 新 query key = 新缓存键,老链接的 24h CDN 缓存不受影响,无需 bump v=。
    if (hideGreySides) params.set('ngs', '1');
    return apiUrl(`/v1/visualcube.svg?${params}`);
  }, [renderLocally, algorithm, setup, view, mask, faceletColors, faceletAlg, scheme, showLastLayerColor, planSimplify, size, puzzleSize, hideGreySides]);

  // puzzle-art:柔和度的统一钩子(见 globals.css),贴纸色不走 token,靠它跟。
  if (svg) {
    return (
      <span
        role="img"
        className="puzzle-art"
        aria-label={alt}
        style={{ display: 'inline-flex', width: size, height: size }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
  return <img className="puzzle-art" src={src} width={size} height={size} alt={alt} loading={loading} />;
}
