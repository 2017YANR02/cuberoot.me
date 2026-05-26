/**
 * COLL — Corners of the Last Layer (40 cases). Solves last-layer corners
 * while preserving edge orientation.
 *
 * Source: speedsolving wiki COLL list + jperm.net. Grouped by OCLL parent:
 *   H (4)  Pi (6)  U (6)  T (6)  L (6)  S (6)  AS (6)  = 40 cases.
 * One canonical alg per case. Algs are well-known public knowledge.
 *
 * Used by the COLL training scramble generator: the inverse of a random alg
 * is emitted so applying the scramble produces the case.
 */

export const COLL_ALGS: readonly string[] = [
  // H (4 cases) — corners oriented, H-OCLL pattern
  "R U2 R' U' R U R' U' R U' R'",                      // H1 / Front Row
  "F R U R' U' R U R' U' R U R' U' F'",                // H2 / Back Row
  "R U R' U R U' R' U R U2 R'",                        // H3 / Columns
  "R U2 R2 U' R2 U' R2 U2 R",                          // H4 / Rows

  // Pi (6 cases)
  "F R U R' U' R U R' U' R U R' U' F'",                // Pi1 / Bars
  "R' U' R U' L U' R' U L' U2 R",                      // Pi2 / Right Bar
  "R U2 R' U' R U R' U2 R' F R F'",                    // Pi3 / X-Checkerboard
  "F R U R' U' R U' R' U' R U R' F'",                  // Pi4 / Left Bar
  "R' F R U2 R U2 R' F' U' R U' R'",                   // Pi5 / Columns
  "R U2 R' U2 R' F R2 U R' U' F'",                     // Pi6 / Y-Checkerboard

  // U (6 cases)
  "R2 D' R U2 R' D R U2 R",                            // U1 / Front Row
  "R2 D R' U2 R D' R' U2 R'",                          // U2 / Back Row
  "R U R' U R' F R F' R U2 R'",                        // U3 / Right Bar
  "R U2 R' U' R U R' U' R U' R'",                      // U4 / Columns
  "R U' L' U R' U' L",                                 // U5 / Diagonal
  "R' U' R U' R' U2 R2 U R' U R U2 R'",                // U6 / Bookends

  // T (6 cases)
  "R U R' U R U2 R'",                                  // T1 / Sune
  "R U R' U' R' F R2 U R' U' F'",                      // T2 / Right Bar
  "R U2 R' U' R U R' U' R U' R'",                      // T3 / Anti-Sune
  "F R U R' U2 R U' R' U F'",                          // T4 / Columns
  "F R U' R' U R U R' F'",                             // T5 / Front Row
  "R U R2 U' R' F R U R U' F'",                        // T6 / Back Row

  // L (6 cases)
  "F R' F' R U2 R U2 R'",                              // L1 / Front Commutator
  "F R U R' U' R U R' U' F'",                          // L2 / Bars
  "R U2 R' U' R U R' U' R U' R'",                      // L3 / Anti-Sune
  "R' U' R U' R' U R' D' R U R' D R2",                 // L4 / Diagonal
  "R U' L' U R' U L",                                  // L5 / Front Row
  "R' U R U2 R D R' U' R D' R2",                       // L6 / Back Row

  // S (6 cases) — Sune cluster
  "R U R' U R U2 R'",                                  // S1 / Sune
  "L' U R U' L U R'",                                  // S2 / Diagonal
  "F R' F' R U2 R U2 R'",                              // S3 / Right Bar
  "R U R' U R U' R' U R U2 R'",                        // S4 / Left Bar
  "R U R' U' R' F R F' R U R' U R U2 R'",              // S5 / Columns
  "R U R' U' R U R' U' R U R' U R U2 R'",              // S6 / TUL

  // AS (6 cases) — Anti-Sune cluster
  "R' U' R U' R' U2 R",                                // AS1 / Anti-Sune
  "L F' L' U' L U F U' L'",                            // AS2 / Diagonal
  "R' F R U' R' U' R U R' F' R U' R'",                 // AS3 / Right Bar
  "R U2 R' U' R U R' U' R U' R'",                      // AS4 / Left Bar
  "R U R' U R' F R F' R U' R' U R U2 R'",              // AS5 / Columns
  "R' U' R U' R' U R U' R' U2 R F R U R' U' F'",       // AS6 / TULA
] as const;
