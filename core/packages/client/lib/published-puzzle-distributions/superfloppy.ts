/** Jaap Scherphuis's imitation Super Floppy QTM distribution:
 * https://www.jaapsch.net/puzzles/floppy2.htm (second joint table).
 * This mechanism allows an isolated edge with no adjacent corners to turn.
 * All colours and fixed-frame positions are retained: 12P4 × 4^4 = 3,041,280 states.
 * Quarter turns cost one, half turns two. The official blocked-edge mechanism
 * in the first table is different and is not imported here.
 * Every joint-table row sum checked; HTM columns match the existing sfl report.
 * No state/solution records included. */

export const SUPERFLOPPY_QTM_EXACT_HISTOGRAM = [
  1, 8, 44, 200, 778, 2_672, 9_128, 29_648, 85_267, 218_512, 472_152,
  778_936, 845_241, 485_032, 107_964, 5_632, 65,
] as const;
