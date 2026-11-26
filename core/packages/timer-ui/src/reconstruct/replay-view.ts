import { HOME_SCENE_ROT } from '@cuberoot/puzzle-render-core/engine/viewControls';
import { facePermFor, conjugateSequence, normalizeSolve } from '@cuberoot/shared/timer/reconstruct/orient';
import { compactCubeRotations } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import type { SolveMove } from '@cuberoot/shared/timer/types';

// This is the same cross-on-D frame that names the four slots in computeF2lSlots.
// Derive it from the entire recording, even when replaying only two moves.
export function recordingRotation(recording: {scramble: string; moves: SolveMove[]}) {
  return normalizeSolve(recording.scramble, recording.moves).rotation;
}

function inverseRotation(rotation: string) {
  return rotation.split(/\s+/).filter(Boolean).reverse().map(token =>
    token.endsWith('2') ? token : token.endsWith("'") ? token.slice(0, -1) : token + "'",
  ).join(' ');
}

// Use a white-bottom teaching palette for every cross colour.
export function reviewColorPrefix(rotation: string) {
  return rotation === 'z2' ? '' : ['z2', inverseRotation(rotation)].filter(Boolean).join(' ');
}

// Keep verified reconstructed gestures (including slices, wide moves and library
// substitutions) on their own clock. Compensate their changes of holding frame.
export function reconstructedReviewPoses(inspection: string, moves: readonly {m: string}[], cross: string) {
  let grip = compactCubeRotations(inspection);
  const correction = () => compactCubeRotations(inverseRotation(grip) + ' ' + cross);
  const poses = [correction()];
  for (const {m} of moves) {
    if (/^[URFDLB](?:2'?|'?)$/.test(m)) poses.push(poses[poses.length - 1]);
    else {
      grip = compactCubeRotations(grip + ' ' + m);
      poses.push(correction());
    }
  }
  return poses;
}

const quarter = Math.PI / 2;
export const reviewSlotYaw: Readonly<Record<string, string>> = {FR: '', FL: "y'", BR: 'y', BL: 'y2'};
const slotAngles: Readonly<Record<string, number>> = {'': 0, "y'": quarter, y: -quarter, y2: Math.PI};
const slotViews = Object.fromEntries(Object.entries(reviewSlotYaw).map(([slot, yaw]) =>
  [slot, {...HOME_SCENE_ROT, y: HOME_SCENE_ROT.y + slotAngles[yaw]}],
));
const lastLayerView = {...HOME_SCENE_ROT, x: Math.PI / 3};

export function reviewCamera(slot?: string, stage?: string) {
  return slot && slotViews[slot] || (/^(oll|pll|zbll|ll)$/i.test(stage ?? '') ? lastLayerView : HOME_SCENE_ROT);
}

/** Verified reference setups already start with the cross-down rotation.
 * A pause clip or a reference-less recording still uses physical encoder notation. */
export function reviewAlg(setup: string, alg: string, rotation?: string, raw = false) {
  if (raw && rotation !== undefined) {
    const perm = facePermFor(rotation);
    const start = conjugateSequence(setup, perm);
    const turns = conjugateSequence(alg, perm);
    if (start !== null && turns !== null) return {setup: 'z2 ' + start, alg: turns};
    return {setup, alg};
  }
  if (rotation !== undefined) return {setup: [reviewColorPrefix(rotation), setup].filter(Boolean).join(' '), alg};
  // Older cards without a recording: reference builders prepend exactly one cross-to-D token before the normalized scramble.
  return {setup: 'z2 ' + setup.replace(/^(?:z2|[xz]'?)(?:\s+|$)/, ''), alg};
}
