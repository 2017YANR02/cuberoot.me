/**
 * EG-1 — 2x2 EG-1 set (42 cases). Solves U-layer when D-layer corners are
 * permuted but the OLL pattern shows one D-corner is on top.
 *
 * The list below is a curated subset of canonical EG-1 algs (about a dozen)
 * sufficient to drive the trainer; more cases can be added later. Source:
 * speedsolving wiki / Christopher Olson's EG sheet — algs are public.
 *
 * Used by the EG-1 training scramble generator (inverse applied as setup).
 */

export const EG1_ALGS: readonly string[] = [
  // U-layer adjacent swap + permute D
  "R U R' U R U2 R'",
  "R U2 R' U' R U' R'",
  "R U R' U' R' F R F'",
  "F R U R' U' F'",
  "R2 U' R2 U' R2 U2 R2",
  "R U' R F2 R' U R'",
  "F R' F' R U R U' R'",
  "R U2 R2 F R F' R U2 R'",
  "R' U' R U' R' U2 R",
  "R U R' U R U' R' U R U2 R'",
  "R' U R' F R F' U R",
  "R2 F2 R U2 R U2 R' F2 R' F'",
] as const;
