import { SLICE_INDEX_CONTACT } from './sliceIndexFollow';

export const SLICE_PRESS_END_DEGREES = 45;
const smooth = (value: number): number => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
const blend = (a: readonly number[], b: readonly number[], t: number): number[] =>
  a.map((value, i) => value + (b[i] - value) * t);

function contactPose(degrees: number): number[] {
  const angle = Math.max(0, Math.min(SLICE_PRESS_END_DEGREES, degrees));
  const rows = SLICE_INDEX_CONTACT;
  let low = 0, high = rows.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (rows[mid][0] <= angle) low = mid; else high = mid;
  }
  return blend(rows[low].slice(1), rows[high].slice(1),
    (angle - rows[low][0]) / (rows[high][0] - rows[low][0]));
}

interface Preparation {
  c1: number; c2: number; c3: number; lift: number;
  liftIn: number; sweepStart: number; backOff: number; transitLift: number;
}

/** Absolute author-space poses, mirrored by the rig. Palm and other fingers stay fixed. */
export function sliceIndexPose(
  degrees: number, returning: number, reach: number,
  home: readonly number[], preparation: Preparation,
): number[] {
  const turnRelease = Math.max(0, Math.min(1, (degrees - SLICE_PRESS_END_DEGREES) / 45));
  // Also release safely after a cancelled drag, whose final angle can be near zero.
  const release = turnRelease + (1 - turnRelease) * Math.max(0, Math.min(1, returning));
  const start = SLICE_INDEX_CONTACT[0].slice(1);
  const pose = blend(contactPose(degrees), start, smooth((release - .1) / .9));
  // Lift before unwinding the MCP. Unwinding while still touching cuts the corner.
  pose[3] += .35 * smooth(release / .25);
  // A small extension takes the nail clear of the stationary front layer while
  // the pad lifts. It fades before the finger reaches its return waypoint.
  pose[0] -= .06 * smooth(release / .1) * (1 - smooth((release - .2) / .2));

  const t = Math.max(0, Math.min(1, reach)), gate = smooth(t);
  const sweep = smooth((t - preparation.sweepStart) / (1 - preparation.sweepStart));
  const base = [preparation.c1, preparation.c2, preparation.c3, preparation.lift, 0, 0, 0, 0];
  const result = home.map((value, i) => value + (pose[i] - value - base[i]) * gate);
  result[0] += preparation.c1 * sweep
    - preparation.backOff * Math.sin(Math.PI * Math.min(1, t / .35));
  result[1] += preparation.c2 * sweep;
  result[2] += preparation.c3 * sweep;
  result[3] += preparation.lift * smooth(t / preparation.liftIn)
    + preparation.transitLift * Math.sin(Math.PI * t) ** 2;
  return result;
}
