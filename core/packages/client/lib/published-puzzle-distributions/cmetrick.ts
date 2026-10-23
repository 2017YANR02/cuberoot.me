/** Complete Cmetrick distributions published at https://www.jaapsch.net/puzzles/cmetrick.htm .
 * CM3 QTM computed by Stefan Pochmann; CM2 HTM/QTM by Jaap Scherphuis.
 * The target accepts all 24 common ball orientations. Counts quotient by uniform
 * colour relabelling, NOT by rotating the physical frame. In matrix coordinates,
 * O_i -> O_i C commutes with the affected rows'/columns' left action G O_i.
 * This free action gives fibres of size 24 and preserves distance to the 24 targets.
 * CM2 has 24^3/2 = 6,912 classes; CM3 has 24^8/2^4 = 6,879,707,136 classes.
 * QTM: a row/column ±90-degree roll costs one; HTM also admits 180 degrees at cost one.
 * The CM2 joint table was checked by both row and column sums. These are not
 * the existing single fixed-colour target distributions. No state witnesses included. */

export const CM2_NEUTRAL_HTM_HISTOGRAM = [
  1, 6, 29, 140, 516, 1_311, 2_369, 1_772, 768,
] as const;

export const CM2_NEUTRAL_QTM_HISTOGRAM = [
  1, 4, 18, 84, 317, 912, 1_963, 2_252, 1_157, 204,
] as const;

export const CM3_NEUTRAL_QTM_HISTOGRAM = [
  1, 12, 90, 720, 5_457, 38_232, 255_447, 1_630_488, 9_719_949,
  52_814_538, 252_618_820, 979_389_786, 2_533_329_804, 2_661_460_602,
  387_681_754, 761_436,
] as const;
