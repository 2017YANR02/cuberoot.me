/** Web face-array adapter for the shared smart-cube hint engine. */

import {
  hintSmartCubeScramble,
  parseHintableSmartCubeScramble,
  type SmartCubeScrambleHint,
} from '@cuberoot/shared/smart-cube/scramble-hint';

import { toFaceletString, type CubeFaces } from '../cube/state';

export type ScrambleHint = SmartCubeScrambleHint;

/**
 * Split a scramble into hintable face turns.
 *
 * Returns null if it contains anything a smart cube cannot report — wide
 * moves, slices, whole-cube rotations. Those appear in big-cube and FMC
 * scrambles, never in a WCA 3x3 scramble, and hinting on a move the cube
 * cannot see would strand the user on a step they can never complete.
 */
export const parseHintableScramble = parseHintableSmartCubeScramble;

/**
 * Where in `scramble` the cube currently is.
 *
 * `from` is the state the sequence starts from, defaulting to solved — which is
 * right for a scramble. A correction path (see `scramble_fixup.ts`) starts from
 * wherever the cube was when it was generated, and csTimer passes that same
 * thing as `checkInSeq`'s `gen` argument (`bluetoothutil.js:29`).
 *
 * Returns null when the state is not on the sequence's path, which is the
 * signal that the user turned something it never asked for.
 */
export function hintScramble(
  scramble: string,
  faces: CubeFaces,
  from?: CubeFaces,
): ScrambleHint | null {
  return hintSmartCubeScramble(
    scramble,
    toFaceletString(faces),
    from ? toFaceletString(from) : undefined,
  );
}
