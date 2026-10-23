/** Jaap Scherphuis's complete standard Gear Cube single-turn distribution:
 * https://www.jaapsch.net/puzzles/gearcube.htm (first joint table only).
 * No edge-base stickers; one reference corner fixed; 4! × (4 × 3)^3 = 41,472 states.
 * The six directed elementary U/R/F turns cost one (outer face 180 degrees,
 * middle slice 90 degrees). This is the table's "Single turns" metric, not 333 QTM.
 * Each axis has order 12, so k repeated elementary turns cost min(k, 12-k).
 * All row sums checked; multiple-turn column sums match the project's existing
 * Gear report. No state/solution records included. */

export const GEAR_SINGLE_EXACT_HISTOGRAM = [
  1, 6, 30, 138, 606, 2_100, 6_041, 13_452, 13_278, 4_992, 774, 48, 6,
] as const;
