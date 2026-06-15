// Worked FMC example for /regulation/fewest-moves.
// The solution genuinely solves the scramble (a real min2phase solve, not the
// scramble's inverse). Locked by tests/reg-fewest-moves-example.test.ts so the
// example can never silently drift back to an unsolvable pair.
export const FM_SCRAMBLE = "R' U' F D2 L2 F2 U R2 U R2 D' F2 R2 D F2 B L U2 R F' R' U' F";
export const FM_SOLUTION = "B' R' D F' D B U' D' F L U2 F2 B2 U2 B2 L2 U2 D' L2 U B2";
export const FM_COUNT = 21; // OBTM (outer turns; rotations would not count — there are none)
