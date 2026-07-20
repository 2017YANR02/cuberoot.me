'use client';

/**
 * CaseThumb — single source for any (puzzle, set, case) preview thumbnail.
 * Ported from packages/client-vite/src/pages/alg/CaseThumb.tsx.
 */
import type { AlgPuzzle, AlgSticker } from '@cuberoot/shared';
import { toWca as toWcaSkewb } from '@cuberoot/shared/skewb-notation';
import { VisualCube } from '@/components/VisualCube';
import { PuzzleSVG, type PuzzleKind } from '@/components/PuzzleSVG';
import { apiUrl } from '@/lib/api-base';

export const PUZZLE_SIZE: Record<AlgPuzzle, number> = {
  '2x2': 2, '3x3': 3, '4x4': 4, '5x5': 5,
  'sq1': 3, 'megaminx': 3, 'pyraminx': 3, 'skewb': 3,
};

export const SR_PUZZLES: AlgPuzzle[] = ['sq1', 'megaminx', 'pyraminx', 'skewb'];

export function srPuzzleKind(p: AlgPuzzle): PuzzleKind | null {
  if (p === 'sq1')      return 'sq1-net';
  if (p === 'megaminx') return 'megaminx-top';
  if (p === 'pyraminx') return 'pyraminx';
  if (p === 'skewb')    return 'skewb-top';
  return null;
}

export function pickView(puzzle: AlgPuzzle, set: string, sticker: AlgSticker): 'f2l' | 'oll' | 'pll' | 'pll-iso' {
  if (puzzle === '3x3' && sticker.kind === 'f2l') return 'f2l';
  if (set === 'oll' || set === 'oll-parity') return 'oll';
  return 'pll';
}

const CORNER_LL_MASK: Partial<Record<string, string>> = {
  coll: 'coll',
  cmll: 'cmll',
};

export function CaseThumb({
  puzzle, set, sticker, alg, setup, size = 88, mask: maskOverride, local,
}: {
  puzzle: AlgPuzzle;
  set: string;
  sticker: AlgSticker;
  alg: string;
  setup?: string;
  size?: number;
  mask?: string;
  /** NxN 走本地渲染(瞬时、与同屏其它图同帧出现)。见 `VisualCube` 的 `local`。 */
  local?: boolean;
}) {
  if (puzzle === 'sq1') {
    const params = new URLSearchParams({ pzl: 'sq1', variant: 'net' });
    if (setup && setup.trim()) params.set('setup', setup);
    else if (alg) params.set('case', alg);
    return (
      <img
        src={apiUrl(`/v1/visualcube.svg?${params}`)}
        alt="Square-1 case"
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
    );
  }
  if (SR_PUZZLES.includes(puzzle)) {
    const kind = srPuzzleKind(puzzle)!;
    const xform = puzzle === 'skewb' ? (s: string) => toWcaSkewb(s, 'sarah') : (s: string) => s;
    const driver = setup && setup.trim() ? { alg: xform(setup) } : { case: xform(alg) };
    return <PuzzleSVG kind={kind} {...driver} size={size} />;
  }
  if (maskOverride) {
    return <VisualCube algorithm={alg} setup={setup} view="pll" mask={maskOverride} size={size} local={local} />;
  }
  const isZbls = puzzle === '3x3' && set === 'zbls';
  if (isZbls) {
    return <VisualCube algorithm={alg} setup={setup} view="iso" mask="vh" size={size} local={local} />;
  }
  const cornerMask = puzzle === '3x3' ? CORNER_LL_MASK[set] : undefined;
  if (cornerMask) {
    return <VisualCube algorithm={alg} setup={setup} view="pll" mask={cornerMask} size={size} local={local} />;
  }
  return (
    <VisualCube
      algorithm={alg}
      setup={setup}
      view={pickView(puzzle, set, sticker)}
      size={size}
      puzzleSize={PUZZLE_SIZE[puzzle]}
      local={local}
    />
  );
}
