import { CORNER_FACELET } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { orientCubeFacelets } from './cube-orientation';
import { stepSolvedInFrame, type CubeStep } from './reconstruct/steps';
import type { EventId } from './types';
import { isCnEligible, timerColorNeutralOrientations, type CnMode } from './color-neutral';

/**
 * Set slug → the step whose completion ends the repetition.
 *
 * Shared by the formula trainer and the timer's partial-finish events.
 * These are 3x3 rules; callers retain their own puzzle and event eligibility.
 * This table does not choose the grip, AUF handling or when to arm the timer.
 *
 * Deliberately absent, because there is no honest answer:
 *   - `2-look-cmll` — its orient and permute subgroups have different finish lines.
 *   - `eo4a`, `lse-eolr` — Roux edge orientation. Finishing it leaves the M-slice centres
 *               free, so "oriented" is not a statement about which colour a
 *               facelet shows, and a mask cannot say it.
 *   - `anti-pll`, `fruf` — upstream sets whose finishing state we have not
 *               established. Guessing `solved` would silently never stop.
 */
export const ALG_SET_TRAINING_STEPS: Readonly<Record<string, CubeStep>> = {
  // Cross → F2L
  'f2l': 'f2l',
  'adv-f2l': 'f2l',
  'sbls': 'sb',            // Roux second block's last slot
  // Last slot + something about the last layer
  'zbls': 'eoll',          // …+ edge orientation
  'wv': 'oll',             // …+ corner orientation (edges already oriented)
  'sv': 'oll',             // …same, other approach angle
  'vls': 'oll',            // …+ full OLL
  // …+ corner orientation with the edges left alone, so the finish is `ocll`
  // and not `oll`. Harmless if a case turns out to have had its edges oriented
  // all along: reaching `oll` reaches `ocll` in the same instant.
  'cls': 'ocll',
  // Last layer
  'oll': 'oll',
  'coll': 'cpll',          // corners oriented/permuted, edges oriented, free U alignment
  'ollcp': 'cpll',         // OLL + corner permutation
  'cmll': 'cmll',          // both blocks intact; corners modulo AUF; LSE unconstrained
  'oh-cmll': 'cmll',
  'pll': 'solved',
  'ell': 'solved',         // edges of the last layer; corners already done
  'zbll': 'solved',
  '1lll': 'solved',
};

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
    // These formula sets share their finish line with the library trainer.
    // Keep this explicit subset: timer full-solve events use a separate path.
    case 'f2l': case 'oll': case 'coll': case 'ollcp': case 'zbls': case 'cmll':
      return ALG_SET_TRAINING_STEPS[event];
    case 'cll': return 'cll';
    case 'eocp': return 'eocp';
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
