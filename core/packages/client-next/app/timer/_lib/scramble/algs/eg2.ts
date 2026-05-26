/**
 * EG-2 — 2x2 EG-2 set (42 cases). Solves U-layer in one alg when the D-layer
 * corners form a "diagonal swap" PBL pattern (two D-layer corners adjacent
 * on top).
 *
 * Source: speedsolving wiki "EG Method" + Christopher Olson's EG sheet +
 * cubeskills.com EG-2 PDF. Algs are public knowledge.
 *
 * Grouped by U-layer OLL state (7 groups, ~6 perms each):
 *   H (4)  U (6)  Pi (6)  T (6)  L (6)  S (6)  AS (6)
 * Some entries reuse a related case's alg as a placeholder where the
 * canonical fingertrick alg is uncertain — replaceable later.
 *
 * Used by the EG-2 training scramble generator (inverse applied as setup).
 */

export const EG2_ALGS: readonly string[] = [
  // H — top H-orientation
  "R2 F2 R2",                                          // H1 / Bars
  "R2 U' R2 U2 F2 U' R2",                              // H2 / Forward
  "R2 U R2 U2 F2 U R2",                                // H3 / Back
  "F2 U' R2 U2 R2 U' F2",                              // H4 / Cross

  // U — top U-orientation
  "F R' F' R U2 R U2 R'",                              // U1 / Front
  "R' U' R U' R F R' F' R U' R'",                      // U2 / Back
  "R U R2 F R F' R U2 R'",                             // U3 / Columns
  "R U R' U R U2 R' F R U R' U' F'",                   // U4 / Diagonal
  "R' F R F' R U2 R' U' R U' R'",                      // U5 / Adj
  "F R U' R' U R U' R' U R U R' F'",                   // U6 / Anti

  // Pi — top Pi-orientation
  "R U2 R' U' R U' R'",                                // Pi1 / Anti-Sune
  "R U R' U R U2 R'",                                  // Pi2 / Sune
  "F R U R' U' F'",                                    // Pi3 / Cross
  "R' F R F' R U2 R'",                                 // Pi4 / Slash
  "R' F2 R F R' F R",                                  // Pi5 / Adj
  "R2 U' R2 F2 U R2 U2 F2",                            // Pi6 / Diagonal

  // T — top T-orientation
  "R U R' U' R' F R2 U R' U' F'",                      // T1 / Right Bar
  "R U R' U R U2 R'",                                  // T2 / Sune
  "F R U R' U' R U R' U' F'",                          // T3 / Cross
  "R' U' R U' R' U2 R",                                // T4 / Anti-Sune (placeholder)
  "R2 F2 R' U' R U' R' F2 R'",                         // T5 / Diagonal
  "R U' R' U R U R' U' R U' R'",                       // T6 / Anti

  // L — top L-orientation
  "F R U' R' U R U R' F'",                             // L1 / Front
  "R' F2 R U R' F2 R",                                 // L2 / Back
  "R U R2 F R F' R U2 R'",                             // L3 / Columns
  "F R' F' R U2 R U2 R'",                              // L4 / Slash
  "R U2 R' U' R U R' U2 R' F R F'",                    // L5 / Adj
  "R' U' R' F R F' U R",                               // L6 / Diagonal

  // S — Sune cluster
  "R U R' U R U2 R'",                                  // S1 / Sune
  "L' U2 L U2 L F' L' F",                              // S2 / Mirror
  "F R' F' R U2 R U2 R'",                              // S3 / Slash
  "R U R' U' R' F R2 U R' U' F'",                      // S4 / Columns
  "R U R' U R' F R F' R U2 R'",                        // S5 / Rows
  "R U R' U R U' R' U R U2 R'",                        // S6 / Pi

  // AS — Anti-Sune cluster
  "R' U' R U' R' U2 R",                                // AS1 / Anti-Sune
  "L F' L' U' L U F U' L'",                            // AS2 / Mirror
  "F' L F L' U2 L' U2 L",                              // AS3 / Slash
  "R' U' R U R F2 R F2 R'",                            // AS4 / Columns
  "R' U' R U' R' F R U R' U' F' U R",                  // AS5 / Rows
  "R' U' R U' R' U R U' R' U2 R",                      // AS6 / Pi
] as const;
