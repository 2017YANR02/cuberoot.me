import { orientCubeFacelets } from './cube-orientation';
import { stepSolvedInFrame, type CubeStep } from './reconstruct/steps';
import type { EventId } from './types';

/** Partial finish lines only; PLL/LL/ZBLL still require a fully solved cube, including AUF. */
export function timerSmartCubeTrainingStep(event: EventId): CubeStep | null {
  switch (event) {
    case 'cross': return 'cross';
    case 'f2l': return 'f2l';
    case 'oll': return 'oll';
    // cpll requires oriented/permuted corners and oriented edges, with a free U alignment.
    case 'coll': return 'cpll';
    // Roux corners may be U-misaligned; both blocks must remain intact, LSE is unconstrained.
    case 'cmll': return 'cmll';
    default: return null;
  }
}

/** Device facelets stay untouched. Orientation is the same display-to-device grip as guidance. */
export function timerSmartCubeTrainingComplete(event: EventId, facelets: string, orientation: string): boolean {
  const step = timerSmartCubeTrainingStep(event);
  return step !== null && facelets.length === 54
    && stepSolvedInFrame(step, orientCubeFacelets(facelets, orientation));
}
