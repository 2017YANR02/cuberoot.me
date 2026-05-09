/**
 * PuzzleSVG — React wrapper around `sr-puzzlegen` for sq1 / megaminx / pyraminx / skewb.
 *
 * sr-puzzlegen's `SVG()` mounts an `<svg>` to a host element. We clear & remount
 * on every prop change. For 3x3 / 2x2 we fall back to our own `<VisualCube>`.
 */
import { useEffect, useRef } from 'react';

export type PuzzleKind =
  | 'sq1' | 'sq1-net'
  | 'megaminx' | 'megaminx-net' | 'megaminx-top'
  | 'pyraminx' | 'pyraminx-net'
  | 'skewb' | 'skewb-net'
  | 'cube-net' | 'cube-top';

const TYPE_MAP: Record<PuzzleKind, string> = {
  'sq1':           'square1',
  'sq1-net':       'square1-net',
  'megaminx':      'megaminx',
  'megaminx-net':  'megaminx-net',
  'megaminx-top':  'megaminx-top',
  'pyraminx':      'pyraminx',
  'pyraminx-net':  'pyraminx-net',
  'skewb':         'skewb',
  'skewb-net':     'skewb-net',
  'cube-net':      'cube-net',
  'cube-top':      'cube-top',
};

export interface PuzzleSVGProps {
  kind: PuzzleKind;
  /** Algorithm to apply (forward). Pass either `alg` OR `case` (inverse). */
  alg?: string;
  /** Apply the alg in REVERSE (i.e. show the case the alg solves). */
  case?: string;
  /** CSS px size of the rendered <svg>. */
  size?: number;
  /** Stroke width on each sticker polygon (sr-puzzlegen units, ~0.02 default). */
  strokeWidth?: number;
  className?: string;
  /** SVG viewBox tweak (rare). */
  minx?: number;
  miny?: number;
  svgWidth?: number;
  svgHeight?: number;
  /** NxN dimension. Only honored for `cube-net` / `cube-top` (and `megaminx-*` where puzzle-gen accepts size=2). */
  cubeSize?: number;
}

export function PuzzleSVG({
  kind, alg, case: caseAlg, size = 88, strokeWidth, className,
  minx, miny, svgWidth, svgHeight, cubeSize,
}: PuzzleSVGProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    import('sr-puzzlegen').then((mod) => {
      if (cancelled || !host) return;
      host.innerHTML = '';
      const puzzle: { alg?: string; case?: string; size?: number } = {};
      if (caseAlg && caseAlg.trim()) puzzle.case = caseAlg;
      else if (alg && alg.trim()) puzzle.alg = alg;
      if (cubeSize !== undefined && (kind === 'cube-net' || kind === 'cube-top')) {
        puzzle.size = cubeSize;
      }
      try {
        mod.SVG(host, TYPE_MAP[kind] as never, {
          width: size, height: size,
          ...(strokeWidth !== undefined ? { strokeWidth } : {}),
          ...(minx !== undefined ? { minx } : {}),
          ...(miny !== undefined ? { miny } : {}),
          ...(svgWidth !== undefined ? { svgWidth } : {}),
          ...(svgHeight !== undefined ? { svgHeight } : {}),
          puzzle,
        });
      } catch (err) {
        host.innerHTML = `<div style="font-size:11px;color:#c66;padding:4px">render fail</div>`;
        console.warn('[PuzzleSVG] render failed', kind, err);
      }
    }).catch((err) => {
      console.warn('[PuzzleSVG] sr-puzzlegen import failed', err);
    });

    return () => { cancelled = true; };
  }, [kind, alg, caseAlg, size, strokeWidth, minx, miny, svgWidth, svgHeight, cubeSize]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ width: size, height: size, display: 'inline-block', lineHeight: 0 }}
    />
  );
}
