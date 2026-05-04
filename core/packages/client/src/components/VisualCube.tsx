import { useMemo } from 'react';

interface Props {
  /** WCA notation alg. The cube renders the STATE produced by inverting this alg from solved
   *  (i.e. the case to be solved by `algorithm`). Pass empty string for solved cube. */
  algorithm: string;
  /** Visual mode:
   *   - 'iso'     → isometric 3D, no mask (full cube state — use this for scrambles / patterns)
   *   - 'f2l'     → isometric 3D, F2L mask (LL stickers grayed)
   *   - 'oll'     → top-down plan view, OLL orientation pattern (yellow vs gray, PHP stage=oll style)
   *   - 'pll'     → top-down plan view, LL mask (canonical PLL preview)
   *   - 'pll-iso' → isometric 3D, LL mask (last-layer 3D preview, ZBLL-style) */
  view: 'iso' | 'f2l' | 'oll' | 'pll' | 'pll-iso';
  /** Explicit Masking enum value (e.g. 'vh', 'wv', 'els'). Overrides the view-implied mask. */
  mask?: string;
  /** SVG width/height in px. Default 88. */
  size?: number;
  /** NxN puzzle dimension. 2..7 supported. Default 3 (3x3). */
  puzzleSize?: number;
  /** Accessible label / image alt. */
  alt?: string;
}

// 走 server 端 /api/visualcube.svg → 右键 "Copy image address" 拿到干净 URL，
// 浏览器原生缓存 24h。代价：每张图一个 HTTP（HTTP/2 多路复用，可接受）。
// Dev 时 Vite 中间件 (visualcubeDev) 本地渲染，不走 prod 代理。
export function VisualCube({ algorithm, view, mask, size = 88, puzzleSize = 3, alt = 'Cube state' }: Props) {
  const src = useMemo(() => {
    const params = new URLSearchParams({
      alg: algorithm,
      view,
      size: String(size),
    });
    if (mask) params.set('mask', mask);
    if (puzzleSize !== 3) params.set('pzl', String(puzzleSize));
    return `/api/visualcube.svg?${params}`;
  }, [algorithm, view, mask, size, puzzleSize]);

  return <img src={src} width={size} height={size} alt={alt} />;
}
