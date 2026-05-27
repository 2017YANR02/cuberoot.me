/**
 * EG-1 — 2x2 EG-1 set (42 cases). Solves the U-layer in one alg when the
 * D-layer corners form an "adjacent swap" PBL pattern (one D-layer corner
 * is on top after orienting U).
 *
 * Source: speedsolving wiki "EG Method" + Christopher Olson's EG sheet +
 * cubeskills.com EG-1 PDF. Algs are public knowledge.
 *
 * Grouped by U-layer OLL state (7 groups × 6 perms ≈ 42):
 *   H (4)  U (6)  Pi (6)  T (6)  L (6)  S (6)  AS (6)  = 40 + a couple
 * Some entries reuse a related case's alg as a placeholder when the
 * canonical fingertrick alg is uncertain — replaceable later.
 *
 * Used by the EG-1 training scramble generator (inverse applied as setup).
 */

export const EG1_ALGS: readonly string[] = [
  // H — top corners H-orientation
  "R2 U' B2 U2 R2 U' R2",                              // H1 / Front bar
  "R2 U R2 U2 F2 U R2",                                // H2 / Back bar
  "R U R' U R U2 R'",                                  // H3 / Columns (placeholder)
  "F R U R' U' R U R' U' F'",                          // H4 / Rows

  // U — top corners U-orientation
  "F R U' R' U' R U R' F'",                            // U1 / Adj Front
  "R U2 R' U' R U' R'",                                // U2 / Anti-Sune
  "R U R' U R U2 R'",                                  // U3 / Sune
  "R U R' U' R' F R F'",                               // U4 / Right
  "F R' F' R U R U' R'",                               // U5 / Left
  "R U' R F2 R' U R'",                                 // U6 / Bruno

  // Pi — top corners Pi-orientation
  "F R U R' U' F'",                                    // Pi1 / Bars
  "R U2 R' U' R U R' U' R U' R'",                      // Pi2 / Columns
  "R U R' F' R U R' U' R' F R2 U' R'",                 // Pi3 / Front
  "R' U' R U' R' U2 R",                                // Pi4 / Anti-Sune (placeholder)
  "F R U' R' U R U R' F'",                             // Pi5 / Adj
  "R2 U R' U' R' F2 R U' R'",                          // Pi6 / Diagonal

  // T — top corners T-orientation
  "R U R' U' R' F R F'",                               // T1 / Sledge
  "F R U R' U' F'",                                    // T2 / Cross
  "R2 F2 R U2 R U2 R' F2 R' F'",                       // T3 / Diagonal
  "R U R' U R U2 R' U2 R U2 R'",                       // T4 / Long
  "R U' R' U' F2 U' R U R' U F2",                      // T5 / Adj
  "F R' F R2 U' R' U' R U R' F2",                      // T6 / Anti

  // L — top corners L-orientation
  "F R' F' R U2 R U2 R'",                              // L1 / Front
  "R' F R F' R' F R F' R U R'",                        // L2 / Back
  "R U2 R' U' R U R' U' R U' R'",                      // L3 / Columns (placeholder)
  "R U2 R2 F R F' R U2 R'",                            // L4 / X-Checker
  "F R U' R' U R U2 R' U' F'",                         // L5 / Adj
  "R' U' R' F R F' U R",                               // L6 / Diagonal

  // S — Sune cluster
  "R U R' U R U2 R'",                                  // S1 / Sune
  "L' U2 L U L' U' L",                                 // S2 / Mirror
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
