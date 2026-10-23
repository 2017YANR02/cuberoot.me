/** Thanh Vinh Nguyen's complete Skewb Ultimate distance table, published by Jaap
 * with results supplied by Thanh and Claude Crépeau:
 * https://www.jaapsch.net/puzzles/ultimate.htm
 * Every bin cross-checked against https://oeis.org/A079758/b079758.txt .
 * The source page's A079874 link is an unrelated Lights Out sequence; A079758 is correct.
 * Four fixed corner axes, either 120-degree turn costs one. All corner and face-piece
 * orientations remain visible: 6! × 4! × 3^6 × 2^3 = 100,776,960 states.
 * The corner tetrad fixes the reference frame; do not divide again by 24 rotations.
 * This is not the ordinary Skewb state space. No state/solution records are included. */

export const SKEWB_ULTIMATE_EXACT_HISTOGRAM = [
  1, 8, 48, 288, 1_728, 10_248, 59_976, 346_740, 1_958_850,
  10_297_604, 39_466_215, 46_217_578, 2_417_060, 615, 1,
] as const;
