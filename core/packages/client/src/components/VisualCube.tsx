import { useEffect, useRef } from 'react';
import { cubeSVG, Masking, type ICubeOptions } from '@cuberoot/visualcube';

interface Props {
  /** WCA notation alg. The cube renders the STATE produced by inverting this alg from solved
   *  (i.e. the case to be solved by `algorithm`). Pass empty string for solved cube. */
  algorithm: string;
  /** Visual mode:
   *   - 'f2l' → default isometric 3D view, F2L mask (LL stickers grayed)
   *   - 'oll' → top-down plan view, OLL mask (only yellow stickers colored on U)
   *   - 'pll' → top-down plan view, LL mask (full last layer + side stripes — no Masking.PLL exists, LL is the canonical PLL preview) */
  view: 'f2l' | 'oll' | 'pll';
  /** SVG width/height in px. Default 88. */
  size?: number;
}

export function VisualCube({ algorithm, view, size = 88 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    const opts: ICubeOptions = {
      case: algorithm,
      width: size,
      height: size,
      ...(view === 'f2l'
        ? { mask: Masking.F2L }
        : view === 'oll'
        ? { view: 'plan', mask: Masking.OLL }
        : { view: 'plan', mask: Masking.LL }),
    };
    cubeSVG(el, opts);
    return () => { el.innerHTML = ''; };
  }, [algorithm, view, size]);

  return <div ref={ref} style={{ width: size, height: size }} />;
}
