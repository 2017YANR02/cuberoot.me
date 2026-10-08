import { CORNER_FACELET } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { orientCubeFacelets } from './cube-orientation';
import { stepSolvedInFrame, type CubeStep } from './reconstruct/steps';
import type { EventId } from './types';
import { isCnEligible, timerColorNeutralOrientations, type CnMode } from './color-neutral';

/** Freeze valid goal frames from the starting training state, before any turns. */
export function timerSmartCubeTrainingFrames(event: EventId, target: string | null, orientation: string, mode: CnMode): readonly string[] {
  if (!target || mode === 'none' || !isCnEligible(event)) return [orientation];
  const prerequisite = event === 'f2l' || event === 'zbls' ? 'cross'
    : event === 'cmll' ? 'sb' : event === 'cross' ? null : 'f2l';
  const candidates = timerColorNeutralOrientations(mode)
    .map(rotation => `${orientation} ${rotation}`.trim());
  const matching = candidates.filter(frame => !prerequisite || stepSolvedInFrame(prerequisite, orientCubeFacelets(target, frame)));
  // Some legacy case algorithms do not preserve the advertised prerequisite.
  // They must still be able to finish; never give the controller an empty set.
  return matching.length ? matching : candidates;
}

/** Partial finish lines only; PLL/LL/ZBLL still require a fully solved cube, including AUF. */
export function timerSmartCubeTrainingStep(event: EventId): CubeStep | 'eocp' | null {
  switch (event) {
    case 'cross': return 'cross';
    case 'f2l': return 'f2l';
    case 'oll': return 'oll';
    // cpll requires oriented/permuted corners and oriented edges, with a free U alignment.
    case 'coll': case 'ollcp': return 'cpll';
    case 'cll': return 'cll';
    case 'zbls': return 'eoll';
    case 'eocp': return 'eocp';
    // Roux corners may be U-misaligned; both blocks must remain intact, LSE is unconstrained.
    case 'cmll': return 'cmll';
    default: return null;
  }
}

/** Device facelets stay untouched. Orientation is the same display-to-device grip as guidance. */
export function timerSmartCubeTrainingComplete(event: EventId, facelets: string, orientation: string): boolean {
  const step = timerSmartCubeTrainingStep(event);
  if (step === null || facelets.length !== 54) return false;
  const oriented = orientCubeFacelets(facelets, orientation);
  if (step !== 'eocp') return stepSolvedInFrame(step, oriented);
  if (!stepSolvedInFrame('eoll', oriented)) return false;
  // EOCP fixes corner permutation modulo AUF, but corner twists remain free.
  const corners = CORNER_FACELET.slice(0, 4);
  const sides = [13, 22, 40, 49];
  const expected = sides.map((side, i) => [oriented[4], oriented[side], oriented[sides[(i + 1) % 4]]].sort().join(''));
  const actual = corners.map(indices => indices.map(index => oriented[index]).sort().join(''));
  return [0, 1, 2, 3].some(auf => actual.every((colors, i) => colors === expected[(i + auf) % 4]));
}
