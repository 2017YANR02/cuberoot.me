/**
 * PuzzleSVG — React wrapper around `sr-puzzlegen` for sq1 / megaminx / pyraminx / skewb.
 *
 * sr-puzzlegen's `SVG()` mounts an `<svg>` to a host element. We clear & remount
 * on every prop change. For 3x3 / 2x2 we fall back to our own `<VisualCube>`.
 *
 * `skewb-top` is a 2D 5-face fan layout (U + L/F/R/B, no D) rendered locally
 * via `renderSkewbPyramidSvgParametric` — 3D coords + Euler projection at
 * render time so view rotation works.
 */
import { useEffect, useMemo, useRef } from 'react';
import { renderSkewbPyramidSvgParametric } from '../pages/gen/skewb_pyramid_svg';

/** Reverse a skewb alg token-by-token (R → R', R' → R, R2 → R2). */
function invertSkewbAlg(alg: string): string {
  return alg.trim().split(/\s+/).filter(Boolean).reverse().map((t) => {
    if (t.endsWith("'")) return t.slice(0, -1);
    if (t.endsWith('2')) return t;
    return t + "'";
  }).join(' ');
}

export type PuzzleKind =
  | 'sq1' | 'sq1-net'
  | 'megaminx' | 'megaminx-net' | 'megaminx-top'
  | 'pyraminx' | 'pyraminx-net'
  | 'skewb' | 'skewb-net' | 'skewb-top';

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
  // Bypasses sr-puzzlegen — rendered locally as 2D fan SVG.
  'skewb-top':     '__custom__',
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
  /** Sequential Euler-angle viewport rotations applied before render.
   *  No-op for `skewb-top` (custom 2D layout, no 3D camera). */
  rotations?: { x?: number; y?: number; z?: number }[];
}

export function PuzzleSVG({
  kind, alg, case: caseAlg, size = 88, strokeWidth, className,
  minx, miny, svgWidth, svgHeight, rotations,
}: PuzzleSVGProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  // skewb-top: synthesize SVG from local 2D fan layout.
  const customSvg = useMemo(() => {
    if (kind !== 'skewb-top') return null;
    const scramble = caseAlg && caseAlg.trim()
      ? invertSkewbAlg(caseAlg)
      : (alg ?? '');
    try {
      return renderSkewbPyramidSvgParametric(scramble, rotations);
    } catch (err) {
      console.warn('[PuzzleSVG] skewb-top render failed', err);
      return '<div style="font-size:11px;color:#c66;padding:4px">render fail</div>';
    }
  }, [kind, alg, caseAlg, rotations]);

  useEffect(() => {
    if (kind === 'skewb-top') return;
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    import('sr-puzzlegen').then((mod) => {
      if (cancelled || !host) return;
      host.innerHTML = '';
      const puzzle: { alg?: string; case?: string; rotations?: { x?: number; y?: number; z?: number }[] } = {};
      if (caseAlg && caseAlg.trim()) puzzle.case = caseAlg;
      else if (alg && alg.trim()) puzzle.alg = alg;
      if (rotations && rotations.length > 0) puzzle.rotations = rotations;
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
  }, [kind, alg, caseAlg, size, strokeWidth, minx, miny, svgWidth, svgHeight, rotations]);

  if (customSvg !== null) {
    return (
      <div
        className={className}
        style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0 }}
        // Local-rendered SVG, no user HTML.
        dangerouslySetInnerHTML={{ __html: customSvg }}
      />
    );
  }
  return (
    <div
      ref={hostRef}
      className={className}
      style={{ width: size, height: size, display: 'inline-block', lineHeight: 0 }}
    />
  );
}
