import { useMemo } from 'react';
import { renderCubeSVG, Masking, type ICubeOptions } from '@cuberoot/visualcube';

interface Props {
  /** WCA notation alg. The cube renders the STATE produced by inverting this alg from solved
   *  (i.e. the case to be solved by `algorithm`). Pass empty string for solved cube. */
  algorithm: string;
  /** Visual mode:
   *   - 'f2l'     → isometric 3D, F2L mask (LL stickers grayed)
   *   - 'oll'     → top-down plan view, OLL mask (only yellow stickers colored on U)
   *   - 'pll'     → top-down plan view, LL mask (canonical PLL preview)
   *   - 'pll-iso' → isometric 3D, LL mask (last-layer 3D preview, ZBLL-style) */
  view: 'f2l' | 'oll' | 'pll' | 'pll-iso';
  /** SVG width/height in px. Default 88. */
  size?: number;
  /** Accessible label / image alt. */
  alt?: string;
}

export function VisualCube({ algorithm, view, size = 88, alt = 'Cube state' }: Props) {
  const src = useMemo(() => {
    const opts: ICubeOptions = {
      case: algorithm,
      width: size,
      height: size,
      ...(view === 'f2l'
        ? { mask: Masking.F2L }
        : view === 'oll'
        ? { view: 'plan', mask: Masking.OLL }
        : view === 'pll'
        ? { view: 'plan', mask: Masking.LL }
        : { mask: Masking.LL }),
    };
    const svg = renderCubeSVG(opts);
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }, [algorithm, view, size]);

  return <img src={src} width={size} height={size} alt={alt} />;
}
