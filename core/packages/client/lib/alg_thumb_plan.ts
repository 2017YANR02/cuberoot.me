/**
 * One case thumbnail decision for every consumer.
 *
 * The React catalog and the PDF exporter need different output forms (React
 * nodes versus SVG strings), but they must never decide independently which
 * puzzle renderer, view, mask, or colour scheme represents a case. Both ask
 * this module for the same plan and only adapt that plan to their output API.
 */
import type { AlgPuzzle, AlgSticker } from '@cuberoot/shared';
import { toWca as toWcaSkewb, invert as invertSkewbAlg } from '@cuberoot/shared/skewb-notation';
import { invertSq1Alg } from '@cuberoot/shared/sq1-notation';
import { renderSkewbPyramidSvgParametric } from '@cuberoot/shared/skewb-pyramid-svg';
import { renderSq1ScrambleSvg, DEFAULT_SQ1_COLORS } from '@/lib/sq1-svg';
import { sq1StageHiddenStickerIds } from '@/lib/sq1-stage-mask';

export const PUZZLE_SIZE: Record<AlgPuzzle, number> = {
  '2x2': 2, '3x3': 3, '4x4': 4, '5x5': 5,
  'sq1': 3, 'megaminx': 3, 'pyraminx': 3, 'skewb': 3,
};

const CORNER_LL_MASK: Partial<Record<string, string>> = {
  coll: 'coll',
  cmll: 'cmll',
  '2-look-cmll': 'cmll',
  'oh-cmll': 'cmll',
};

/** Only-corner masks whose grey side rim is not part of the recognition case. */
const CORNER_LL_MASK_NAMES = new Set(Object.values(CORNER_LL_MASK));

/** Shared mask for second-level umbrella cards in the library and trainer. */
export const LEVEL2_PICKER_MASK: Record<string, string> = {
  zbll: 'coll', '1lll': 'coll', ollcp: 'coll',
};

export interface CubeThumbParams {
  view: 'iso' | 'plan' | 'oll' | 'pll' | 'f2l' | 'pll-iso';
  mask?: string;
  scheme?: string;
  hideGreySides?: boolean;
  puzzleSize: number;
}

function pickView(
  puzzle: AlgPuzzle,
  set: string,
  sticker: AlgSticker,
): 'f2l' | 'oll' | 'pll' | 'pll-iso' {
  if (puzzle === '3x3' && sticker.kind === 'f2l') return 'f2l';
  if (set === 'oll' || set === '2-look-oll' || set === 'oll-parity') return 'oll';
  return 'pll';
}

/** Single source for every NxN thumbnail view, mask, rim rule, and order. */
export function cubeThumbParams(
  puzzle: AlgPuzzle,
  set: string,
  sticker: AlgSticker,
  maskOverride?: string,
): CubeThumbParams {
  const puzzleSize = PUZZLE_SIZE[puzzle];
  if (puzzle === '2x2') return { view: 'plan', puzzleSize };
  if (maskOverride) {
    const hideGreySides = CORNER_LL_MASK_NAMES.has(maskOverride) || undefined;
    return { view: 'pll', mask: maskOverride, hideGreySides, puzzleSize };
  }
  if (sticker.kind === 'face' && sticker.mask) {
    const hideGreySides = CORNER_LL_MASK_NAMES.has(sticker.mask) || set === '2-look-oll' || undefined;
    return {
      view: pickView(puzzle, set, sticker),
      mask: sticker.mask,
      scheme: sticker.scheme,
      hideGreySides,
      puzzleSize,
    };
  }
  if (puzzle === '3x3' && set === 'lsll') return { view: 'iso', puzzleSize };
  if (puzzle === '3x3' && set === 'zbls') return { view: 'iso', mask: 'vh', puzzleSize };
  const cornerMask = puzzle === '3x3' ? CORNER_LL_MASK[set] : undefined;
  if (cornerMask) return { view: 'pll', mask: cornerMask, hideGreySides: true, puzzleSize };
  const view = pickView(puzzle, set, sticker);
  return { view, hideGreySides: view === 'oll', puzzleSize };
}

type AlgDriver = { alg: string; case?: never } | { case: string; alg?: never };

export type CaseThumbPlan =
  | { renderer: 'inline-svg'; svg: string; alt: string }
  | { renderer: 'engine'; puzzle: 'pyraminx'; driver: AlgDriver }
  | { renderer: 'sr'; kind: 'megaminx-top'; driver: AlgDriver }
  | {
      renderer: 'visualcube';
      algorithm: string;
      setup?: string;
      params: CubeThumbParams;
    };

export interface CaseThumbPlanInput {
  puzzle: AlgPuzzle;
  set: string;
  sticker: AlgSticker;
  alg: string;
  setup?: string;
  mask?: string;
  sq1BlackTop?: boolean;
}

function driverFor(setup: string | undefined, alg: string): AlgDriver {
  return setup?.trim() ? { alg: setup } : { case: alg };
}

/** Build the one renderer/view plan shared by the page and its PDF. */
export function caseThumbPlan({
  puzzle,
  set,
  sticker,
  alg,
  setup,
  mask,
  sq1BlackTop = true,
}: CaseThumbPlanInput): CaseThumbPlan {
  if (puzzle === 'sq1') {
    const normalizedSet = set.toLowerCase();
    const isCubeshape = normalizedSet === 'cs' || normalizedSet === 'csp';
    // Cube-shape is defined by the solving formula itself. Some imported CS
    // setups are truncated when the formula starts with a free layer turn, so
    // deriving the case from the first formula keeps its name, alg and picture
    // on one source of truth. Other SQ1 stages still need their curated setup.
    const forward = isCubeshape && alg.trim()
      ? invertSq1Alg(alg)
      : setup?.trim() ? setup : invertSq1Alg(alg);
    const hidden = sq1StageHiddenStickerIds(set);
    const renderOptions = {
      ...(hidden ? { mask: { ids: hidden, color: 'transparent' } } : {}),
      compactFaces: !isCubeshape,
    };
    const showMiddle = !['cs', 'csp', 'parity'].includes(normalizedSet) && !hidden;
    const colors = normalizedSet === 'cs'
      ? Object.fromEntries(
          Object.keys(DEFAULT_SQ1_COLORS).map(face => [face, 'var(--muted-foreground)']),
        )
      : sq1BlackTop
        ? { ...DEFAULT_SQ1_COLORS, U: '#000000' }
        : DEFAULT_SQ1_COLORS;
    try {
      return {
        renderer: 'inline-svg',
        svg: renderSq1ScrambleSvg(forward, colors, renderOptions, showMiddle),
        alt: 'Square-1 case',
      };
    } catch {
      return {
        renderer: 'inline-svg',
        svg: renderSq1ScrambleSvg('', colors, renderOptions, showMiddle),
        alt: 'Square-1 case',
      };
    }
  }

  if (puzzle === 'pyraminx') {
    return { renderer: 'engine', puzzle: 'pyraminx', driver: driverFor(setup, alg) };
  }

  if (puzzle === 'skewb') {
    const driver = driverFor(setup ? toWcaSkewb(setup, 'sarah') : setup, toWcaSkewb(alg, 'sarah'));
    const scramble = driver.case !== undefined ? invertSkewbAlg(driver.case) : (driver.alg ?? '');
    try {
      return {
        renderer: 'inline-svg',
        svg: renderSkewbPyramidSvgParametric(scramble),
        alt: 'Skewb case',
      };
    } catch {
      return { renderer: 'inline-svg', svg: '', alt: 'Skewb case' };
    }
  }

  if (puzzle === 'megaminx') {
    return { renderer: 'sr', kind: 'megaminx-top', driver: driverFor(setup, alg) };
  }

  return {
    renderer: 'visualcube',
    algorithm: alg,
    setup,
    params: cubeThumbParams(puzzle, set, sticker, mask),
  };
}
