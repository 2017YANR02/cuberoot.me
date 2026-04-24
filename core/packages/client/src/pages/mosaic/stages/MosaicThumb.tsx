import { useEffect, useRef } from 'react';
import type { ChooseSet } from '../state/types';
import { applyMethod } from '../engine/render';

interface Props {
  chooseSet: ChooseSet;
  opt: number | number[];
  base: ImageData;
  onClick: () => void;
  maxWidth?: number;
  decimals?: number;
}

/** Canvas thumbnail showing the mosaic produced by (chooseSet, opt). Shared by Method/Variant stages. */
export default function MosaicThumb({ chooseSet, opt, base, onClick, maxWidth = 180, decimals = 1 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const cv = ref.current;
    cv.width = base.width;
    cv.height = base.height;
    const ctx = cv.getContext('2d')!;
    const result = applyMethod(base, chooseSet.palette, chooseSet.method, opt);
    ctx.putImageData(result, 0, 0);
  }, [chooseSet, opt, base]);

  const caption = typeof opt === 'number' ? opt.toFixed(decimals) : '';
  const w = Math.min(maxWidth, base.width * 4);
  return (
    <div className="mosaic-canvas-card" onClick={onClick} title={caption}>
      <canvas ref={ref} style={{ width: w, height: 'auto' }} />
      {caption && <span className="mosaic-canvas-card-caption">{caption}</span>}
    </div>
  );
}
