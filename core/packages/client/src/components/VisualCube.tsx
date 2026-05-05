import { useMemo } from 'react';

interface Props {
  /** WCA notation alg. Treated as a SOLUTION — cube renders the case state that `algorithm`
   *  solves (i.e. inverse(algorithm) applied to solved). Pass empty string for solved cube.
   *  Internally maps to URL `?case=` so the same alg always produces the same image regardless
   *  of /api endpoint defaults. */
  algorithm: string;
  /** Forward scramble — applied DIRECTLY without inversion. When set, takes precedence over
   *  `algorithm`. Use this when you have a clean rotation-free case-setup string (e.g.
   *  speedcubedb's `setup`); avoids the "alg starts with `d`/`y` so cube ends up rotated" bug. */
  setup?: string;
  /** Visual mode:
   *   - 'iso'     → isometric 3D, no mask (full cube state — use this for scrambles / patterns)
   *   - 'f2l'     → isometric 3D, F2L mask (LL stickers grayed)
   *   - 'oll'     → top-down plan view, OLL orientation pattern (yellow vs gray, PHP stage=oll style)
   *   - 'pll'     → top-down plan view, LL mask (canonical PLL preview)
   *   - 'pll-iso' → isometric 3D, LL mask (last-layer 3D preview, ZBLL-style)
   *   - 'trans'   → silver translucent shell, masked-out stickers transparent (PHP view=trans) */
  view: 'iso' | 'f2l' | 'oll' | 'pll' | 'pll-iso' | 'trans';
  /** Explicit Masking enum value (e.g. 'vh', 'wv', 'els'). Overrides the view-implied mask. */
  mask?: string;
  /** SVG width/height in px. Default 88. */
  size?: number;
  /** NxN puzzle dimension. 2..10 supported. Default 3 (3x3). */
  puzzleSize?: number;
  /** Accessible label / image alt. */
  alt?: string;
}

// `<img src="/api/visualcube.svg?...">` — 干净 URL，右键 "Copy image address" 拿得到。
// 实际请求由 src/sw.ts (public/sw.js) 拦截，本地用 renderFromSimpleQuery 生成 SVG 返回，
// 不打真后端。包源码改动后必须 rebuild SW (`pnpm --filter @cuberoot/client build-sw`)
// 才会让所有 <VisualCube> 取到新代码（SW 内联了包，dev middleware 是 fallback）。
export function VisualCube({ algorithm, setup, view, mask, size = 88, puzzleSize = 3, alt = 'Cube state' }: Props) {
  const src = useMemo(() => {
    const params = new URLSearchParams({ view, size: String(size) });
    if (setup) params.set('setup', setup);
    else params.set('case', algorithm);
    if (mask) params.set('mask', mask);
    if (puzzleSize !== 3) params.set('pzl', String(puzzleSize));
    return `/api/visualcube.svg?${params}`;
  }, [algorithm, setup, view, mask, size, puzzleSize]);

  return <img src={src} width={size} height={size} alt={alt} />;
}
