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
 * Wide/slice turns and rotations are mapped into the cube's fixed center
 * frame by the shared notation adapter. Unsupported notation returns null.
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
