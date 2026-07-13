'use client';

/**
 * PuzzleSVG — React wrapper around `sr-puzzlegen` for sq1 / megaminx / pyraminx / skewb.
 *
 * Ported from packages/client-vite/src/components/PuzzleSVG.tsx.
 */
import { useEffect, useMemo, useRef } from 'react';
import { renderSkewbPyramidSvgParametric } from '@cuberoot/shared/skewb-pyramid-svg';
import { canonicalSq1Alg } from '@/lib/sq1-svg';
import { patchSrPuzzlegen } from '@/components/sr-puzzlegen-patch';
import { parseMask, toSrMask, type StickerId } from '@/lib/puzzle-image/puzzle-mask';
import type { PuzzleType } from '@/lib/puzzle-image/types';

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
  'skewb-top':     '__custom__',
};

/** sr `IColor`. */
export interface SrColor { value: string; stroke?: string }
export interface SrArrow {
  start: { face: string; sticker: number };
  end: { face: string; sticker: number };
}

/** sr's own puzzle key, for the mask id space. sq1 has no derived map on purpose. */
const MASK_PUZZLE: Partial<Record<PuzzleKind, PuzzleType>> = {
  megaminx: 'megaminx', 'megaminx-net': 'megaminx', 'megaminx-top': 'megaminx',
  pyraminx: 'pyraminx', 'pyraminx-net': 'pyraminx',
  skewb: 'skewb', 'skewb-net': 'skewb',
};

interface PuzzleSVGBaseProps {
  kind: PuzzleKind;
  alg?: string;
  case?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  minx?: number;
  miny?: number;
  svgWidth?: number;
  svgHeight?: number;
  rotations?: { x?: number; y?: number; z?: number }[];
  /** Per-face colors. Honored ALONGSIDE a mask (sr applies the scheme after its
   *  simulator, so mask + alg survive) — prefer this over `stickerColors`. */
  scheme?: Record<string, SrColor>;
  arrows?: SrArrow[];
  arrowColor?: SrColor;
}

/**
 * `mask` and `stickerColors` are mutually exclusive BY TYPE, because sr silently
 * drops the mask when both are given: visualizer.js:114-122 — `applyColors()`
 * takes the `stickerColors` branch (`puzzleGeometry.setColors(stickerColors)`)
 * and never reaches `applySimulatorColors()`, which is where `applyMask()` and
 * `applyAlgorithm()` live. So `stickerColors` loses the mask AND the alg.
 * Custom colors next to a mask must go through `scheme`, which IS honored
 * (applySimulatorColors → applyColorScheme(faceValues, options.scheme)).
 */
export type PuzzleSVGProps = PuzzleSVGBaseProps & (
  | {
      /** Canonical sticker ids to gray out — the `U:0,2;F:3-5` DSL or the parsed set.
       *  Ignored for sq1 and for `skewb-top` (which is not an sr render). */
      mask?: string | Set<StickerId>;
      stickerColors?: never;
    }
  | {
      mask?: never;
      /** Per-sticker colors. Bypasses sr's simulator entirely — no mask, no alg. */
      stickerColors?: Record<string, SrColor[]>;
    }
);

export function PuzzleSVG({
  kind, alg, case: caseAlg, size = 88, strokeWidth, className,
  minx, miny, svgWidth, svgHeight, rotations,
  mask, stickerColors, scheme, arrows, arrowColor,
}: PuzzleSVGProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  const srMask = useMemo(() => {
    const puzzle = MASK_PUZZLE[kind];
    if (!mask || !puzzle) return undefined;
    const ids = typeof mask === 'string' ? parseMask(mask) : mask;
    if (!ids.size) return undefined;
    return toSrMask(puzzle, ids);
  }, [kind, mask]);

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
      patchSrPuzzlegen(mod);
      host.innerHTML = '';
      const puzzle: Record<string, unknown> = {};
      const isSq1 = kind === 'sq1' || kind === 'sq1-net';
      const norm = (s: string) => isSq1 ? canonicalSq1Alg(s) : s;
      if (caseAlg && caseAlg.trim()) puzzle.case = norm(caseAlg);
      else if (alg && alg.trim()) puzzle.alg = norm(alg);
      if (rotations && rotations.length > 0) puzzle.rotations = rotations;
      const hasMask = !!srMask && Object.keys(srMask).length > 0;
      if (hasMask) puzzle.mask = srMask;
      // Belt-and-braces for a JS caller that dodges the type-level exclusion:
      // handing sr both would drop the mask on the floor (visualizer.js:114-122).
      if (stickerColors && hasMask) {
        console.error('[PuzzleSVG] stickerColors + mask is invalid — sr drops the mask; ignoring stickerColors (use `scheme`)');
      } else if (stickerColors) {
        puzzle.stickerColors = stickerColors;
      }
      if (scheme) puzzle.scheme = scheme;
      if (arrows && arrows.length > 0) puzzle.arrows = arrows;
      try {
        (mod as { SVG: (host: HTMLElement, type: string, opts: unknown) => void }).SVG(host, TYPE_MAP[kind], {
          width: size, height: size,
          ...(strokeWidth !== undefined ? { strokeWidth } : {}),
          ...(minx !== undefined ? { minx } : {}),
          ...(miny !== undefined ? { miny } : {}),
          ...(svgWidth !== undefined ? { svgWidth } : {}),
          ...(svgHeight !== undefined ? { svgHeight } : {}),
          ...(arrowColor !== undefined ? { arrowColor } : {}),
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
  }, [kind, alg, caseAlg, size, strokeWidth, minx, miny, svgWidth, svgHeight, rotations,
      srMask, stickerColors, scheme, arrows, arrowColor]);

  if (customSvg !== null) {
    return (
      <div
        className={className}
        style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0 }}
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
