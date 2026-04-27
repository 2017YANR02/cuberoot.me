/**
 * CMLL — Corners of the Last Layer for Roux (42 cases). Solves LL corners
 * regardless of M-slice and UL/UR edges (Roux step 4b).
 *
 * Source: speedsolving wiki "CMLL" + kpcubed CMLL list. One alg per case.
 * 7 OCLL groups: O (2) H (4) Pi (6) U (6) T (6) L (6) S (6) AS (6) = 42.
 *
 * Used by the CMLL training scramble generator (inverse applied as setup).
 */

export const CMLL_ALGS: readonly string[] = [
  // O (2 cases) — corners already oriented
  "R U' R' U R U2 R' U' R U R' U' R U' R'",            // O Diagonal Swap (Y-perm)
  "F R U' R' U' R U R' F' R U R' U' R' F R F'",        // O Adjacent Swap (T-perm style)

  // H (4 cases)
  "R U R' U R U' R' U R U2 R'",                        // H Columns
  "F R U R' U' R U R' U' R U R' U' F'",                // H Rows
  "R U2 R' U' R U R' U' R U' R'",                      // H Column
  "R U R' U L' U R U' R' L",                           // H Pi

  // Pi (6 cases)
  "F R U R' U' R U R' U' R U R' U' F'",                // Pi Right Bar (Bars)
  "R' U' R' F R F' R U' R' U2 R",                      // Pi Back Slash
  "R U2 R' U' R U R' U2 R' F R F'",                    // Pi X-Checkerboard
  "F R U R' U' R U' R' U' R U R' F'",                  // Pi Left Bar
  "R U2 R2 F R F' R U2 R'",                            // Pi Columns
  "r U' r2 D' r U r' D r2 U r'",                       // Pi Y-Checkerboard

  // U (6 cases)
  "R2 D R' U2 R D' R' U2 R'",                          // U Forward Slash
  "R2 D' R U2 R' D R U2 R",                            // U Back Slash
  "R' U' R U' R' U2 R",                                // U Anti-Sune (Front Row)
  "R U R' U R U2 R'",                                  // U Sune (Back Row)
  "F R2 D R' U R D' R2 U' F'",                         // U Bruno
  "r U' r2 D' r U' r' D r2 U r'",                      // U Pi-like

  // T (6 cases)
  "R U R' U' R' F R F'",                               // T Forward Slash
  "L' U' L U L F' L' F",                               // T Back Slash
  "F R' F' R U R U' R'",                               // T Columns
  "R U R' U R' F R F' R U2 R'",                        // T Rows
  "r' U r U2 r' L' U R' U' M",                         // T Anti-Pi
  "R U2 R' U' R U R' U' R U' R'",                      // T Pi-like

  // L (6 cases)
  "F R U' R' U' R U R' F'",                            // L Mirror (Front Commutator)
  "F R' F' R U R U' R'",                               // L Pure
  "R U2 R' U' R U R' U' R U' R'",                      // L Front Commutator
  "R' U2 R U R' U R",                                  // L Back Commutator
  "R U2 R D R' U2 R D' R2",                            // L Diag
  "R U R' U' R' F R F'",                               // L Front Slash

  // S (6 cases) — Sune cluster
  "R U R' U R U2 R'",                                  // S Sune
  "L' U2 L U2 L F' L' F",                              // S Forward Slash
  "F R' F' R U2 R U2 R'",                              // S Back Slash
  "R U R' U' R' F R2 U R' U' F'",                      // S Columns
  "R U R' U R' F R F' R U2 R'",                        // S Rows
  "R U R' U R U' R' U R U2 R'",                        // S Pi

  // AS (6 cases) — Anti-Sune cluster
  "R' U' R U' R' U2 R",                                // AS Anti-Sune
  "F' r U R' U' r' F R",                               // AS Forward Slash
  "R U2 R D R' U2 R D' R2",                            // AS Back Slash
  "F R U R' U' R U R' U' F'",                          // AS Columns
  "R U2 R2 F R F' U2 R' F R F'",                       // AS Rows
  "R' U' R U' R' U R U R' U R U2 R'",                  // AS Pi
] as const;
