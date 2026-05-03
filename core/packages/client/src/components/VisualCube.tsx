import { useMemo } from 'react';

interface Props {
  /** WCA notation alg. The cube renders the STATE produced by inverting this alg from solved
   *  (i.e. the case to be solved by `algorithm`). Pass empty string for solved cube. */
  algorithm: string;
  /** Visual mode:
   *   - 'f2l'     → isometric 3D, F2L mask (LL stickers grayed)
   *   - 'oll'     → top-down plan view, OLL orientation pattern (yellow vs gray, PHP stage=oll style)
   *   - 'pll'     → top-down plan view, LL mask (canonical PLL preview)
   *   - 'pll-iso' → isometric 3D, LL mask (last-layer 3D preview, ZBLL-style) */
  view: 'f2l' | 'oll' | 'pll' | 'pll-iso';
  /** SVG width/height in px. Default 88. */
  size?: number;
  /** Accessible label / image alt. */
  alt?: string;
}

// 走 server 端 /api/visualcube.svg → 右键 "Copy image address" 拿到干净 URL，
// 浏览器原生缓存 24h。代价：每张图一个 HTTP（HTTP/2 多路复用，可接受）。
export function VisualCube({ algorithm, view, size = 88, alt = 'Cube state' }: Props) {
  const src = useMemo(() => {
    const params = new URLSearchParams({
      alg: algorithm,
      view,
      size: String(size),
    });
    return `/api/visualcube.svg?${params}`;
  }, [algorithm, view, size]);

  return <img src={src} width={size} height={size} alt={alt} />;
}
