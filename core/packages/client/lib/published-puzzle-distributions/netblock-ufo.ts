/** Jaap Scherphuis's complete Netblock UFO joint table:
 * https://www.jaapsch.net/puzzles/ufo.htm
 * Count whole-rotation and uniform-colour-relabeling equivalence classes.
 * Burnside's lemma gives 33,362,904 classes; stabilizers make orbit sizes
 * unequal, so these histograms are not the distribution over fixed-colour
 * physical states and cannot be converted by one constant multiplier.
 * FTM follows the source's face-turn metric; QTM charges half turns twice.
 * Both marginals checked against every joint-table row and column.
 * No state/solution records or simulator adapter included. */

export const NETBLOCK_UFO_FTM_EXACT_HISTOGRAM = [
  1, 2, 6, 66, 415, 2_796, 18_760, 110_757, 539_479, 2_149_686,
  6_253_026, 10_942_017, 9_400_081, 3_518_728, 420_746, 6_338,
] as const;

export const NETBLOCK_UFO_QTM_EXACT_HISTOGRAM = [
  1, 2, 4, 36, 188, 1_056, 5_823, 29_682, 141_404, 602_260, 2_203_822,
  6_259_056, 11_540_867, 10_005_922, 2_496_551, 76_068, 162,
] as const;
