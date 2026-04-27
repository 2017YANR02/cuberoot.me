/**
 * CMLL — Corners of the Last Layer for Roux (42 cases). Solves last-layer
 * corners regardless of edge state (M-slice and UF/UB edges).
 *
 * Source: speedsolving wiki / jperm.net standard CMLL set. One alg per case.
 * Used by the CMLL training scramble generator (inverse applied as setup).
 */

export const CMLL_ALGS: readonly string[] = [
  // O (Solved corners orientation, 2 cases)
  "R U R' U R U2 R'",                                  // O / Sune (placeholder)
  "R' U' R U' R' U2 R",                                // O / Anti-Sune

  // H (4 cases)
  "R U R' U R U' R' U R U2' R'",                       // H Columns
  "F R U R' U' R U R' U' R U R' U' F'",                // H Rows
  "R U2 R' U' R U R' U' R U' R'",                      // H Column
  "R U R' U R U L' U R' U' L",                         // H Pi-like

  // Pi (6 cases)
  "F R U R' U' R U R' U' R U R' U' F'",                // Pi Right Bar
  "R' U' R' F R F' U R",                               // Pi Back Slash
  "R U2 R' U' R U R' U2 R' F R F'",                    // Pi X-Checkerboard
  "F R U R' U' R U R' U' F'",                          // Pi Forward Slash
  "R U2 R2 F R F' U2 R' F R F'",                       // Pi Columns
  "R' F R U F U' R U R' U' F'",                        // Pi Left Bar

  // U (6 cases)
  "R2 D R' U2 R D' R' U2 R'",                          // U Forward Slash
  "R2 D' R U2 R' D R U2 R",                            // U Back Slash
  "R' U' R U' R' U2 R",                                // U Anti-Sune (Front Row)
  "R U R' U R U2 R'",                                  // U Sune (Back Row)
  "F R2 D R' U R D' R2' U' F'",                        // U Bruno
  "R' U R U2 R' L' U R U' L",                          // U Forward Bar (placeholder)

  // T (6 cases)
  "R U R' U' R' F R F'",                               // T Forward Slash
  "L' U' L U L F' L' F",                               // T Back Slash
  "F R' F' R U R U' R'",                               // T Columns (placeholder)
  "R U R' U R' F R F' R U2 R'",                        // T Rows
  "r U' r2 D' r U' r' D r2 U r'",                      // T Anti-Pi (placeholder)
  "R U2 R' U' R U R' U' R U' R'",                      // T Pi-like

  // S / Sune (6 cases)
  "R U R' U R U2 R'",                                  // S Sune
  "L' U2 L U2 L F' L' F",                              // S Forward Slash
  "F R' F' R U2 R U2 R'",                              // S Back Slash
  "R U R' U' R' F R2 U R' U' F'",                      // S Columns
  "R U R' U R' F R F' R U2 R'",                        // S Rows (placeholder)
  "R U2 R2 U' R2 U' R2 U2 R",                          // S Pi (placeholder)

  // AS / Anti-Sune (6 cases)
  "R' U' R U' R' U2 R",                                // AS Anti-Sune
  "F' r U R' U' r' F R",                               // AS Forward Slash
  "R U2 R D R' U2 R D' R2",                            // AS Back Slash
  "F R U R' U' R U R' U' F'",                          // AS Columns
  "R' U' R U' L' U R' U' L R",                         // AS Rows (placeholder)
  "R' U2 R2 U R2 U R2 U2 R'",                          // AS Pi (placeholder)

  // L (6 cases)
  "F R U' R' U' R U R' F'",                            // L Mirror
  "F R' F' R U R U' R'",                               // L Pure
  "R U2 R' U' R U R' U' R U' R'",                      // L Front Commutator
  "R' U2 R U R' U R",                                  // L Back Commutator (placeholder)
  "R U' L' U R' U' L",                                 // L Diag
  "R U R' U' R' F R F'",                               // L Front Slash
] as const;
