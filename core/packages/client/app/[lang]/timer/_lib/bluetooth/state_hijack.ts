/**
 * Pretending the cube is somewhere it isn't — the mechanism a smart-cube
 * trainer is built on.
 *
 * Drilling PLL means seeing case after case. Without help, each repetition
 * costs the user a setup: apply the case's scramble to a solved cube, THEN
 * execute. csTimer's answer (`bluetoothutil.js:663`) is to stop asking. It
 * records an offset such that the cube's current physical state — usually
 * solved, because they just finished the last repetition — is REPORTED as the
 * next case. From then on the timer sees the training frame, not the cube.
 *
 * Why it works: an offset is a relabelling, and relabelling commutes with
 * turning. If the offset makes state `c` read as `t`, then after any sequence
 * `A` the cube is at `c·A` and reads as `t·A` — so executing the algorithm that
 * solves case `t` drives the REPORTED state to solved, which is what stops the
 * timer. The physical cube ends up scrambled instead; nobody has to care.
 *
 * The price is that reported state and physical state have diverged, so the
 * hijack must be dropped whenever we go back to caring about the real cube: a
 * timed WCA solve, a scramble check, "I have reset my cube".
 *
 * A state dump from the cube is NOT one of those cases. The offset composes on
 * top of whatever the tracker believes, so a brand that reports its own state
 * (QiYi does, every frame) keeps healing the physical tracking underneath while
 * the training view follows along. Losing the connection IS one of those cases —
 * the cube can be turned while out of contact, and then the offset was measured
 * against a state that no longer exists.
 */

import type { CubeFaces } from '../cube/state';
import { toFaceletString } from '../cube/state';
import { faceletToCubie, cubieToFacelet, validateCubie, type CubieCube } from '@/lib/cube-facelet';
import { inverseCubie, multiply } from '../scramble/kociemba/cube';

/** An offset applied to everything the tracker reports. */
export type StateHijack = CubieCube;

function toFacelets(state: CubeFaces | string): string {
  return typeof state === 'string' ? state : toFaceletString(state);
}

/**
 * The offset that makes `current` read as `target`: `target · current⁻¹`.
 *
 * Returns null when there is nothing to do (the two states are equal) or when
 * either state is unreadable — the caller should then leave the view alone
 * rather than reporting nonsense.
 */
export function makeHijack(current: CubeFaces | string, target: CubeFaces | string): StateHijack | null {
  const cur = toFacelets(current);
  const tgt = toFacelets(target);
  if (cur === tgt) return null;
  let a: CubieCube;
  let b: CubieCube;
  try {
    a = faceletToCubie(cur);
    b = faceletToCubie(tgt);
  } catch {
    return null;
  }
  if (validateCubie(a) !== null || validateCubie(b) !== null) return null;
  return multiply(b, inverseCubie(a));
}

/**
 * What the cube reports through `hijack`. Unchanged when there is no hijack, or
 * when the state cannot be read as a cube — a malformed frame must not take out
 * the whole view.
 */
export function applyHijack(hijack: StateHijack | null, facelets: string): string {
  if (!hijack) return facelets;
  try {
    return cubieToFacelet(multiply(hijack, faceletToCubie(facelets)));
  } catch {
    return facelets;
  }
}
