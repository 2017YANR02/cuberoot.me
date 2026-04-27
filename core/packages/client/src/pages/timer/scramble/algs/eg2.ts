/**
 * EG-2 — 2x2 EG-2 set (42 cases). Solves U-layer when D-layer corners are
 * permuted but the OLL pattern shows two D-corners adjacent on top.
 *
 * The list below is a curated subset of canonical EG-2 algs sufficient to
 * drive the trainer; more cases can be added later. Source: speedsolving
 * wiki / Christopher Olson's EG sheet — algs are public.
 *
 * Used by the EG-2 training scramble generator (inverse applied as setup).
 */

export const EG2_ALGS: readonly string[] = [
  "R2 U' B2 U2 R2 U' R2",
  "F R' F' R U2 R U2 R'",
  "R' F R F' R U2 R'",
  "R U R' U' R' F R2 U R' U' F'",
  "R U2 R' U' R U' R'",
  "R U R' U R U2 R'",
  "F R U R' U' F'",
  "R' U' R U' R' U2 R",
  "R2 F2 R' U' R U' R' F2 R'",
  "F R U' R' U R U R' F'",
  "R' F2 R U R' F2 R",
  "R U R2 F R F' R U2 R'",
] as const;
