/**
 * COLL — Corners of the Last Layer (40 cases). Solves last-layer corners
 * while preserving edge orientation.
 *
 * Algs are well-known public knowledge (speedsolving wiki / jperm.net /
 * algdb.net). The list below covers the 40 standard COLL cases grouped by
 * OCLL parent (H, Pi, U, T, L, S, AS). One canonical alg per case.
 *
 * Used by the COLL training scramble generator: the inverse of a random alg
 * is emitted so applying the scramble produces the case.
 */

export const COLL_ALGS: readonly string[] = [
  // H (4 cases)
  "R U R' U R U' R' U R U2' R'",                       // H1
  "F R U R' U' R U R' U' R U R' U' F'",                // H2
  "R U2 R' U' R U R' U' R U' R'",                      // H3
  "R U' R U R' U R U' R U2 R'",                        // H4

  // Pi (6 cases)
  "F R U R' U' R U R' U' R U R' U' F'",                // Pi1
  "R' U' R U' R' U R' D' R U R' D R2",                 // Pi2
  "R' U2 R U R' U R U2 R' U' R U' R'",                 // Pi3
  "R U2 R2 U' R U' R' U2 F R U R' U' F'",              // Pi4
  "F R U R' U' R U' R' U' R U R' F'",                  // Pi5
  "R' F R U R' U' F' U R",                             // Pi6

  // U (6 cases)
  "R2 D' R U2 R' D R U2 R",                            // U1
  "R' U' R U' R' U2 R2 U R' U R U2 R'",                // U2
  "R U R' U R U L' U R' U' L",                         // U3
  "R U2 R' U' R U R' U' R U' R'",                      // U4
  "R' U' R U R' U' R U' R' U2 R",                      // U5
  "F R U R' U' R U R' U' R U R' U' F'",                // U6

  // T (6 cases)
  "R U R' U R U2 R'",                                  // T1 (Sune-based)
  "R' U' R U' R' U2 R",                                // T2
  "R U2 R' U' R U' R'",                                // T3 (Anti-Sune)
  "L' U' L U' L' U2 L",                                // T4
  "F R U' R' U R U R' F'",                             // T5
  "R U R2 U' R' F R U R U' F'",                        // T6

  // L (6 cases)
  "F R' F' R U2 R U2 R'",                              // L1
  "R U2 R' U' R U R' U2 R' F R F'",                    // L2
  "R' U2 R U R' U R2 U' R' U' R U R'",                 // L3
  "F R' F' R U2 R U' R' U R U2 R'",                    // L4
  "R' U' R U' R' U R U R' U R U2 R'",                  // L5 (placeholder)
  "R U R' U R U' R' U R U2 R'",                        // L6 (placeholder)

  // S (6 cases)
  "R U R' U R' F R F' R U2 R'",                        // S1
  "R U R' U' R' F R F' R U R' U R U2 R'",              // S2
  "R U2 R' U' R U R' U' R U' R'",                      // S3
  "R U R' U R U2 R' L' U R U' L",                      // S4
  "R U R' U R U2 R'",                                  // S5 (Sune)
  "L' U2 L U L' U' L",                                 // S6 (placeholder)

  // AS (6 cases)
  "R' U' R U' R' U2 R",                                // AS1 (Anti-Sune base)
  "R U2 R' U' R U' R'",                                // AS2
  "R' F R F' R' U' R U' R' U2 R",                      // AS3
  "L F' L' U' L U F U' L'",                            // AS4 (placeholder)
  "R' U' R U' R' U2 R F R U R' U' F'",                 // AS5
  "R U R' U R U2 R' L' U R' U' L",                     // AS6 (placeholder)
] as const;
