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

export interface PuzzleSVGProps {
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
}

export function PuzzleSVG({
  kind, alg, case: caseAlg, size = 88, strokeWidth, className,
  minx, miny, svgWidth, svgHeight, rotations,
}: PuzzleSVGProps) {
  const hostRef = useRef<HTMLDivElement>(null);

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
      const puzzle: { alg?: string; case?: string; rotations?: { x?: number; y?: number; z?: number }[] } = {};
      const isSq1 = kind === 'sq1' || kind === 'sq1-net';
      const norm = (s: string) => isSq1 ? canonicalSq1Alg(s) : s;
      if (caseAlg && caseAlg.trim()) puzzle.case = norm(caseAlg);
      else if (alg && alg.trim()) puzzle.alg = norm(alg);
      if (rotations && rotations.length > 0) puzzle.rotations = rotations;
      try {
        (mod as { SVG: (host: HTMLElement, type: string, opts: unknown) => void }).SVG(host, TYPE_MAP[kind], {
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
