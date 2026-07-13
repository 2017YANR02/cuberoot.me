/**
 * Pure render layer for ImageSpec. Returns SVG strings; returns null for the
 * specs whose renderer needs the DOM (sr-puzzlegen iso/top via <PuzzleSVG>,
 * the 3x3 InteractiveCubeNet paint editor, scramble-display's skewb net).
 * The host component owns those three branches.
 */

import {
  renderCubeSVG,
  Axis,
  type Masking,
  type ICubeOptions,
} from '@cuberoot/visualcube';
import type { PuzzleKind } from '@/components/PuzzleSVG';
import { invertAlg } from '@/lib/cube3';
import {
  renderSq1ScrambleSvg,
  DEFAULT_SQ1_COLORS,
  invertSq1Alg,
} from '@/app/[lang]/scramble/gen/_svg/sq1_svg';
import {
  renderMegaScrambleSvg,
  DEFAULT_MEGA_COLORS,
} from '@/app/[lang]/scramble/gen/_svg/mega_svg';
import {
  renderPyraScrambleSvg,
  PYRA_DEFAULT_COLORS,
} from '@/app/[lang]/scramble/gen/_svg/pyraminx_svg';
import {
  renderSkewbScrambleSvg,
  SKEWB_DEFAULT_COLORS,
} from '@/app/[lang]/scramble/gen/_svg/skewb_svg';
import { renderUnfoldedSvg } from '@/app/[lang]/scramble/gen/_svg/cube_unfolded_svg';
import { DEFAULTS, FACE_DEFAULTS, rotationsMatchDefault } from './defaults';
import type { ImageSpec, PuzzleType, PuzzleVariant } from './types';

/** sr-puzzlegen kind for a non-cube iso/top spec; null when a different renderer owns it. */
export function srKindOf(type: PuzzleType, variant: PuzzleVariant): PuzzleKind | null {
  if (type === 'cube') return null;
  if (variant === 'net' || variant === 'wca') return null;
  if (type === 'sq1') return 'sq1';
  if (type === 'megaminx') return variant === 'top' ? 'megaminx-top' : 'megaminx';
  if (type === 'pyraminx') return 'pyraminx';
  if (type === 'skewb') return variant === 'top' ? 'skewb-top' : 'skewb';
  return null;
}

export function specToCubeOptions(s: ImageSpec): ICubeOptions {
  const opts: ICubeOptions = {
    cubeSize: s.cubeSize,
    width: s.imageSize,
    height: s.imageSize,
  };
  if (s.algorithm) {
    if (s.algType === 'alg') opts.algorithm = s.algorithm;
    else opts.case = s.algorithm;
  }
  if (s.arrows) opts.arrows = s.arrows;
  if (s.defaultArrowColor) opts.defaultArrowColor = s.defaultArrowColor;

  if (s.cubeView === 'plan') opts.view = 'plan';
  // `trans` is a pseudo-preset, not a renderer view: it silently swaps the shell
  // to silver/50% (only when the user has not touched them) and turns masked
  // stickers transparent.
  if (s.cubeView === 'trans') {
    if (s.cubeColor === DEFAULTS.cubeColor) opts.cubeColor = 'silver';
    if (s.cubeOpacity === DEFAULTS.cubeOpacity) opts.cubeOpacity = 50;
    opts.maskColor = 'transparent';
  }

  if (s.stageMask) opts.mask = s.stageMask as Masking;
  if (s.maskAlg) opts.maskAlg = s.maskAlg;

  const schDiff =
    s.faceU !== FACE_DEFAULTS.U || s.faceR !== FACE_DEFAULTS.R ||
    s.faceF !== FACE_DEFAULTS.F || s.faceD !== FACE_DEFAULTS.D ||
    s.faceL !== FACE_DEFAULTS.L || s.faceB !== FACE_DEFAULTS.B;
  if (schDiff) {
    opts.colorScheme = {
      0: s.faceU, 1: s.faceR, 2: s.faceF, 3: s.faceD, 4: s.faceL, 5: s.faceB,
    };
  }

  const axisEnum = (a: string): Axis => (a === 'x' ? Axis.X : a === 'y' ? Axis.Y : Axis.Z);
  if (!rotationsMatchDefault(s)) {
    opts.viewportRotations = [
      [axisEnum(s.rotateAxis1), s.rotateAngle1],
      [axisEnum(s.rotateAxis2), s.rotateAngle2],
    ];
  }

  if (s.backgroundColor) opts.backgroundColor = s.backgroundColor;
  if (s.cubeColor !== DEFAULTS.cubeColor && opts.cubeColor === undefined) opts.cubeColor = s.cubeColor;
  if (s.cubeOpacity !== DEFAULTS.cubeOpacity && opts.cubeOpacity === undefined) opts.cubeOpacity = s.cubeOpacity;
  if (s.stickerOpacity !== DEFAULTS.stickerOpacity) opts.stickerOpacity = s.stickerOpacity;
  if (s.dist !== DEFAULTS.dist) opts.dist = s.dist;

  return opts;
}

/** The three spec shapes whose renderer is DOM-bound and lives in the host component. */
export type DomRenderKind = 'net-paint-3x3' | 'sr-puzzlegen' | 'skewb-net-display';

export function domRenderKindOf(s: ImageSpec): DomRenderKind | null {
  if (s.puzzleType === 'cube') {
    return s.cubeView === 'net' && s.cubeSize === 3 ? 'net-paint-3x3' : null;
  }
  if (s.puzzleType === 'skewb' && s.puzzleVariant === 'net') return 'skewb-net-display';
  if (s.puzzleVariant === 'net' || s.puzzleVariant === 'wca') return null;
  return 'sr-puzzlegen';
}

/**
 * SVG string for every spec a pure renderer can serve; null when the spec needs
 * a DOM-bound renderer (see domRenderKindOf).
 * Throws whatever the underlying renderer throws — the caller decides how to
 * surface a bad alg.
 */
export function renderSpecSvg(s: ImageSpec): string | null {
  const isCubeNet = s.puzzleType === 'cube' && s.cubeView === 'net';
  const isCubeWca = s.puzzleType === 'cube' && s.cubeView === 'wca';
  const isOtherUnfolded = s.puzzleType !== 'cube'
    && (s.puzzleVariant === 'net' || s.puzzleVariant === 'wca');

  if (isCubeNet && s.cubeSize === 3) return null; // InteractiveCubeNet paint editor

  if (isCubeNet || isCubeWca || isOtherUnfolded) {
    if (s.puzzleType === 'cube') {
      const raw = s.algorithm ?? '';
      const forward = s.algType === 'case' ? invertAlg(raw) : raw;
      const N = Math.max(1, Math.min(50, s.cubeSize));
      // KNOWN: cube `view=net` and `view=wca` both land on renderUnfoldedSvg, so
      // for N !== 3 net and wca produce the identical image (only 3x3 net differs,
      // because it is the paint editor). Preserved from the original page.
      return renderUnfoldedSvg(N, forward);
    }
    if (s.puzzleType === 'skewb' && s.puzzleVariant === 'net') {
      return null; // cubing.js <scramble-display>, custom element
    }
    const raw = s.algorithm ?? '';
    const forward = s.algType === 'case'
      ? (s.puzzleType === 'sq1' ? invertSq1Alg(raw) : invertAlg(raw))
      : raw;
    return s.puzzleType === 'sq1'
      ? renderSq1ScrambleSvg(forward, DEFAULT_SQ1_COLORS)
      : s.puzzleType === 'megaminx'
      ? renderMegaScrambleSvg(forward, DEFAULT_MEGA_COLORS)
      : s.puzzleType === 'pyraminx'
      ? renderPyraScrambleSvg(forward, PYRA_DEFAULT_COLORS)
      : renderSkewbScrambleSvg(forward, SKEWB_DEFAULT_COLORS);
  }

  if (s.puzzleType === 'cube') return renderCubeSVG(specToCubeOptions(s));

  return null; // non-cube iso/top → sr-puzzlegen <PuzzleSVG>
}
