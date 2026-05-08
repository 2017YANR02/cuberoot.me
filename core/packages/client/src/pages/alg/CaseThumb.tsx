/**
 * CaseThumb — single source for any (puzzle, set, case) preview thumbnail.
 *
 * Used by case-list cards (AlgCategoryPage), set-grid landing cards (AlgPuzzlePage),
 * and the trainer home (HomePage). Picks the right backend (sr-puzzlegen for sq1/
 * megaminx/pyraminx/skewb, VisualCube for NxN) and the right view based on sticker
 * shape and set.
 */
import type { AlgPuzzle, AlgSticker } from '@cuberoot/shared';
import { VisualCube } from '../../components/VisualCube';
import { PuzzleSVG, type PuzzleKind } from '../../components/PuzzleSVG';

export const PUZZLE_SIZE: Record<AlgPuzzle, number> = {
  '2x2': 2, '3x3': 3, '4x4': 4, '5x5': 5,
  'sq1': 3, 'megaminx': 3, 'pyraminx': 3, 'skewb': 3,
};

export const SR_PUZZLES: AlgPuzzle[] = ['sq1', 'megaminx', 'pyraminx', 'skewb'];

export function srPuzzleKind(p: AlgPuzzle): PuzzleKind | null {
  if (p === 'sq1')      return 'sq1-net';
  if (p === 'megaminx') return 'megaminx-top';
  if (p === 'pyraminx') return 'pyraminx';
  if (p === 'skewb')    return 'skewb';
  return null;
}

export function pickView(puzzle: AlgPuzzle, set: string, sticker: AlgSticker): 'f2l' | 'oll' | 'pll' | 'pll-iso' {
  if (puzzle === '3x3' && sticker.kind === 'f2l') return 'f2l';
  if (set === 'oll' || set === 'oll-parity') return 'oll';
  return 'pll';
}

/** Sets that should use a corner-only LL preview (LL edges grayed). Matches
 *  speedcubedb's COLL/CMLL pages — only LL corners are recognition-relevant. */
const CORNER_LL_MASK: Partial<Record<string, string>> = {
  coll: 'coll',
  cmll: 'cmll',
};

export function CaseThumb({
  puzzle, set, sticker, alg, setup, size = 88, mask: maskOverride,
}: {
  puzzle: AlgPuzzle;
  set: string;
  sticker: AlgSticker;
  alg: string;
  setup?: string;
  size?: number;
  /** Explicit mask (e.g. "coll" / "cmll" / "vh") — overrides the set-implied mask.
   *  Use for "level-2 picker" thumbs where the recognition axis is a subset of
   *  the full case (ZBLL grouped by COLL → corners-only preview). */
  mask?: string;
}) {
  if (SR_PUZZLES.includes(puzzle)) {
    const kind = srPuzzleKind(puzzle)!;
    const driver = setup && setup.trim() ? { alg: setup } : { case: alg };
    return <PuzzleSVG kind={kind} {...driver} size={size} />;
  }
  if (maskOverride) {
    return <VisualCube algorithm={alg} setup={setup} view="pll" mask={maskOverride} size={size} />;
  }
  const isZbls = puzzle === '3x3' && set === 'zbls';
  if (isZbls) {
    return <VisualCube algorithm={alg} setup={setup} view="iso" mask="vh" size={size} />;
  }
  const cornerMask = puzzle === '3x3' ? CORNER_LL_MASK[set] : undefined;
  if (cornerMask) {
    return <VisualCube algorithm={alg} setup={setup} view="pll" mask={cornerMask} size={size} />;
  }
  return (
    <VisualCube
      algorithm={alg}
      setup={setup}
      view={pickView(puzzle, set, sticker)}
      size={size}
      puzzleSize={PUZZLE_SIZE[puzzle]}
    />
  );
}
