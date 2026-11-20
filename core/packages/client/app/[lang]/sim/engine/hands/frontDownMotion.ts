import { DOWN_INDEX_FOLLOW, DOWN_MIDDLE_FOLLOW } from './frontDownFollow';

// Author-space channels: curl1/2/3, splay, extra twist, meta curl/splay/twist.
// Palm and non-participating fingers are never changed by this choreography.
const smooth = (value: number): number => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
const blend = (a: readonly number[], b: readonly number[], t: number): number[] =>
  a.map((value, i) => value + (b[i] - value) * t);

function follow(rows: readonly (readonly number[])[], degrees: number): number[] {
  const angle = Math.max(0, Math.min(90, degrees));
  let low = 0, high = rows.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (rows[middle][0] <= angle) low = middle;
    else high = middle;
  }
  return blend(rows[low].slice(1), rows[high].slice(1),
    (angle - rows[low][0]) / (rows[high][0] - rows[low][0]));
}

export function frontDownPose(
  finger: 'index' | 'middle', degrees: number, double: boolean,
  returning: number, home: readonly number[],
): number[] {
  let pose: number[];
  if (finger === 'index') {
    pose = follow(DOWN_INDEX_FOLLOW, degrees);
    if (double && degrees > 90) {
      const end = DOWN_INDEX_FOLLOW.at(-1)!.slice(1);
      const parked = [...end];
      // Clear the middle finger at the knuckles as well as at the fingertip.
      parked[3] += .08;
      parked[5] = -.2;
      parked[6] = .32;
      parked[7] = 0;
      pose = blend(end, parked, smooth((degrees - 90) / 28));
    }
  } else if (degrees < 90) {
    // Delay the approach until the index has cleared the middle finger's route.
    const t = Math.max(0, (degrees - 70) / 20);
    pose = blend(home, DOWN_MIDDLE_FOLLOW[0].slice(1), smooth(t));
    pose[5] -= .2 * Math.sin(Math.PI * t) ** 2;
  } else {
    pose = follow(DOWN_MIDDLE_FOLLOW, degrees - 90);
  }
  if (returning <= 0) return pose;

  // Middle returns first; index waits outside its swept volume, then returns.
  const t = double
    ? finger === 'middle' ? Math.min(1, returning / .65) : Math.max(0, (returning - .65) / .35)
    : returning;
  const result = blend(pose, home, smooth((t - .15) / .65));
  const clearance = smooth(t / .15) * (1 - smooth((t - .8) / .2));
  result[3] += (finger === 'middle' ? .14 : .16) * clearance;
  if (finger === 'index') result[6] += .14 * clearance;
  // Clear the parked index before returning across it, without parking it farther away.
  if (finger === 'middle') result[0] -= .6 * smooth(t / .35) * (1 - smooth((t - .6) / .4));
  result[0] -= .1 * Math.sin(Math.PI * Math.max(0, Math.min(1, (t - .8) / .2)));
  return result;
}
