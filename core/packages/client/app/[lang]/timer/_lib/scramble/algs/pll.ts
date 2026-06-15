/**
 * 21 PLL algorithms (noAuf form), extracted from @cuberoot/shared/data/pll.json.
 * Used by the PLL training scramble generator (inverse applied as setup).
 */

export const PLL_ALGS: readonly string[] = [
  "R B' R F2 R' B R F2 R2",
  "R2 F2 R' B' R F2 R' B R'",
  "R L F L' B L F' R' L' F R B' R' F'",
  "R F2 R' B R B2 D2 F L F' D2 F2 B R'",
  "L2 B2 U L2 D' L2 D F2 U' F2 B2 L2",
  "L2 F2 B2 U F2 U' F2 D F2 D' B2 L2",
  "R2 B2 U' R2 D R2 D' F2 U F2 B2 R2",
  "R2 F2 B2 U' F2 U F2 D' F2 D B2 R2",
  "R L U2 R2 U' D' F2 U D R L'",
  "F2 D F D' F L2 B' U B L2",
  "R2 B U B' R2 F D' F D F2",
  "R2 F R2 U2 F2 U2 F R2 F2 U2 F U2 R2 F2",
  "R U' R B' D2 F L' F' D2 B2 R' B' U R'",
  "R2 F2 L2 F2 U' F' U F' L2 B D' F2 B' R2",
  "R2 F2 B2 R2 U' L' U L' B2 R D' R' F2 L2",
  "R2 U R2 U' R2 F2 U' F2 D R2 D'",
  "F2 U R' L F2 R L' U F2",
  "R U' R U R U R U' R' U' R2",
  "R U D2 L' U L U2 F2 D R D' F2 D2 R'",
  "R2 U' F2 D' F2 U F D F' R2 B U' B'",
  "R L' U2 D2 R L' D R2 L2 U' F2 B2",
] as const;
