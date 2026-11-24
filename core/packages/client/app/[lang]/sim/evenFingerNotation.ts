import type { HandGripNames } from './engine/hands/handsRig';
import type { FingerAnnotation, FingerMark } from '@/lib/alg-finger-marks';

const frontTurns = ['F', "F'"];
export const evenFingerExamples: Record<2 | 4, Record<FingerMark, string[]>> = {
  2: { s: ['U2', "U2'"], em: frontTurns, u: ['U', "U'"] },
  4: { s: ['2U2', "2U2'"], em: frontTurns, u: ["2R2'", '2L2'] },
};

export function isEvenFrontQuarter(order: number, axis: string, layers: readonly number[], quarters: number) {
  return (order === 2 || order === 4) && axis === 'z' && layers.length === 1 && layers[0] === order - 1 && quarters === 1;
}

export function evenMarkedStroke(order: number, axis: string, layers: readonly number[], dir: number,
  quarters: number, annotation?: FingerAnnotation) {
  if (!annotation || layers.length !== 1 || (order !== 2 && order !== 4)) return;
  const { finger, contact } = annotation;
  if (finger && contact) return;
  if (finger === 'thumb' && isEvenFrontQuarter(order, axis, layers, quarters)) return 'frontThumb';
  if (axis === 'y' && layers[0] === (order === 2 ? 1 : 2)) {
    if (quarters === 2 && finger === 'middle') return 'upperRelay';
    if (order === 2 && quarters === 1 && contact === 'nail') return 'upperNail';
  }
  if (order === 4 && axis === 'x' && (layers[0] === 1 || layers[0] === 2)
    && dir < 0 && quarters === 2 && contact === 'nail') return 'innerNailRelay';
}

export function evenMarkFitsGrip(mark: ReturnType<typeof evenMarkedStroke>, order: number, dir: number, grips: HandGripNames) {
  if (!mark) return false;
  if (mark === 'frontThumb') return !!grips.L && !!grips.R;
  const active = dir > 0 ? grips.R : grips.L;
  const support = dir > 0 ? grips.L : grips.R;
  return support === 'home' && (active === 'home' || order === 2 && mark === 'upperRelay' && active === 'up');
}
