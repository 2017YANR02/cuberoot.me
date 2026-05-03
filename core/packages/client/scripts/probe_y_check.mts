/**
 * Sanity check: after y', is "FR slot" in user's perception cubing.js's slot 4 (DF)?
 * If user does y' then their "F-face" should be cubing.js's L-face (originally).
 */
import { cube3x3x3 } from 'cubing/puzzles';
const kp = await cube3x3x3.kpuzzle();
const solved = kp.defaultPattern();
const after = solved.applyAlg("y'");
console.log("after y' centers:", after.patternData.CENTERS.pieces);
// Original [0,1,2,3,4,5] = U,R,F,L,B,D colors at slots U,R,F,L,B,D.
// After y' (rotation around U-axis CCW from above): which face holds which color?
// If y' = "front face goes to right" (one common convention), then:
//   - what was on F is now on R → R-slot has F-color (=2)
//   - what was on R is now on B → B-slot has R-color (=1)
//   - etc.
//
// cubing.js result will tell us the convention.

// If the user's perception is "y' rotates the cube CW from top" (mirror of above),
// then F-color goes to L, etc.
// Original: y' result above shows centers [0, 4, 1, 2, 3, 5]
//   - U:0 D:5 unchanged ✓
//   - R-slot has color 4 (was B's color)
//   - F-slot has color 1 (was R's color)
//   - L-slot has color 2 (was F's color)
//   - B-slot has color 3 (was L's color)
// So y' moves: B→R, R→F, F→L, L→B (i.e., CW when viewed from above)
// Equivalently: pieces shift CCW. From above's POV, y' rotates the cube CCW.
// So user's "front face" after y' = original L face.
// User's perceived FR-slot = original FL-slot = cubing.js slot 9 (FL edge).
console.log("\nso when user types 'F R U' after y', they're operating in this frame:");
console.log("  user-F = cubing.js-L, user-R = cubing.js-F, user-B = cubing.js-R, user-L = cubing.js-B");

// Verify: what does y' R do to solved?
const yR = solved.applyAlg("y' R");
console.log("\ny' R: edge piece at cubing.js slot 8 (FR cubie):", yR.patternData.EDGES.pieces[8], "ori", yR.patternData.EDGES.orientation[8]);
console.log("y' R: corners:", yR.patternData.CORNERS.pieces);
