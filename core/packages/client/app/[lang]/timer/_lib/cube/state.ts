/**
 * NxN cube state model.
 *
 * Faces are stored as flat arrays of length N*N indexed in row-major order
 * (`row * N + col`). The orientation convention for each face's local rows
 * and cols matches the standard "T" net layout:
 *
 *           +-----+
 *           |  U  |
 *  +-----+--+-----+-----+-----+
 *  |  L  |  F  |  R  |  B  |
 *  +-----+-----+-----+-----+
 *           |  D  |
 *           +-----+
 *
 *  - U: row 0 = back side, col 0 = left side. (As if you flipped the U face
 *       up onto the back of the cube.)
 *  - D: row 0 = front side, col 0 = left side.
 *  - F R B L: row 0 = top (touching U), col 0 = "left when looking at face".
 *
 *  This matches what the renderer draws.
 */

import type { Face, ParsedMove } from './moves';
import { parseScramble } from './moves';

export type FaceArr = Face[];

export interface CubeFaces {
  U: FaceArr;
  D: FaceArr;
  F: FaceArr;
  B: FaceArr;
  L: FaceArr;
  R: FaceArr;
}

/** Create a solved NxN cube. */
export function solved(n: number): CubeFaces {
  const fill = (c: Face): FaceArr => Array.from({ length: n * n }, () => c);
  return {
    U: fill('U'),
    D: fill('D'),
    F: fill('F'),
    B: fill('B'),
    L: fill('L'),
    R: fill('R'),
  };
}

function cloneFaces(f: CubeFaces): CubeFaces {
  return {
    U: f.U.slice(), D: f.D.slice(), F: f.F.slice(),
    B: f.B.slice(), L: f.L.slice(), R: f.R.slice(),
  };
}

/** Rotate a face's NxN grid in place. dir: 1=cw, -1=ccw, 2=180. */
function rotateFace(face: FaceArr, n: number, dir: 1 | -1 | 2): void {
  const out = new Array<Face>(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = face[r * n + c];
      let nr: number, nc: number;
      if (dir === 1) {       // cw: (r,c) -> (c, n-1-r)
        nr = c; nc = n - 1 - r;
      } else if (dir === -1) { // ccw: (r,c) -> (n-1-c, r)
        nr = n - 1 - c; nc = r;
      } else {               // 180
        nr = n - 1 - r; nc = n - 1 - c;
      }
      out[nr * n + nc] = v;
    }
  }
  for (let i = 0; i < n * n; i++) face[i] = out[i];
}

/**
 * A "strip" is N stickers from one face, forming a row or column. We use
 * a getter/setter pair so we can cycle four strips between four faces.
 *
 * Layer index `k` is 0 for the outermost layer (touching the turning face)
 * and increases moving inward. For wide moves we cycle multiple layers.
 */
type StripGetter = (n: number, k: number) => number[]; // returns indices into the face

// Helpers to build index arrays for rows/cols.
function row(n: number, r: number): number[] {
  const out: number[] = [];
  for (let c = 0; c < n; c++) out.push(r * n + c);
  return out;
}
function rowReversed(n: number, r: number): number[] {
  return row(n, r).slice().reverse();
}
function col(n: number, c: number): number[] {
  const out: number[] = [];
  for (let r = 0; r < n; r++) out.push(r * n + c);
  return out;
}
function colReversed(n: number, c: number): number[] {
  return col(n, c).slice().reverse();
}

/**
 * For each "axis face", a description of:
 *  - which 4 neighbour faces' strips form a cycle (in CW order — the
 *    face rotates CW so each strip moves to the next),
 *  - which strip index/orientation on each face is affected at depth k.
 *
 * Convention: cycle[0] -> cycle[1] -> cycle[2] -> cycle[3] -> cycle[0].
 * Stickers from cycle[0]'s strip move to cycle[1]'s strip, etc.
 *
 * Strip is given as a function from layer-depth k to an index list of
 * length N within that face's flat array. Index lists are oriented so
 * that position 0 corresponds to a fixed reference along the strip. The
 * relative orientation of any two adjacent strips must agree — we tested
 * this below with the unit tests in state_test_data.ts.
 */
interface CycleDef {
  faces: [Face, Face, Face, Face];
  strips: [StripGetter, StripGetter, StripGetter, StripGetter];
}

/* -------------- U turn --------------
 * U rotates CW (viewed from above). Adjacent rows are the top rows of
 * F, R, B, L (the row touching U on each lateral face).
 *
 * CW (from above): looking down, ground compass N=Back, E=Right, S=Front, W=Left.
 *   N→E: B-top → R-top
 *   E→S: R-top → F-top
 *   S→W: F-top → L-top
 *   W→N: L-top → B-top
 * So cycle order (stickers go forward): B → R → F → L → B.
 *
 * Convention for each strip at depth k:
 *   For F R B L the "top row" at outer depth is row 0; deeper layers are
 *   row k. We use the natural left-to-right ordering of that row (col 0
 *   is the face's local-left).
 *
 * Orientation check: at the U-FR corner (k=0, position n-1 of F's top row
 * = position 0 of R's top row). Need F-top-rightmost and R-top-leftmost to
 * line up at the same physical corner. F's top-row col n-1 is the
 * upper-right corner of F, which is adjacent to R's upper-LEFT corner =
 * R's top-row col 0. Good — they map at array-index n-1 and 0
 * respectively. To make a strip-getter that returns indices in a
 * consistent rotational order, we want all four strips ordered such that
 * walking the strip in the same direction follows the CW direction
 * around the U axis.
 *
 * Walking CW around the U axis (viewed from above) at the U layer:
 *   Start at F-top-left, go right along F-top, then enter R-top-left, go
 *   right along R-top, then enter B-top-left, go right along B-top, then
 *   enter L-top-left, go right along L-top, return to F-top-left.
 *
 *   F-top-left = (row 0, col 0)
 *   R-top-left = (row 0, col 0)        [R's local-left is the side touching F]
 *   B-top-left = (row 0, col 0)        [B's local-left is the side touching R]
 *   L-top-left = (row 0, col 0)        [L's local-left is the side touching B]
 *
 * So the strips, walked left-to-right in their own local frame, line up
 * end-to-end around the U axis in CW (when viewed from above) direction:
 *   F-top → R-top → B-top → L-top → F-top.
 *
 * Wait — when viewed from ABOVE the U face, the rotation is CW. But the
 * ABOVE-CW direction corresponds to walking F→L→B→R when looking from
 * the inside of the cube. Let me just state the rule directly:
 *
 *   A U turn (which moves stickers on U's face CW when looking down) on
 *   the side stickers cycles them as:  L ← F, F ← R, R ← B, B ← L.
 *
 *   I.e. L's top row gets the OLD F's top row.  This is the standard
 *   Rubik's notation result — verified against any speedcubing reference.
 *
 * So if we list cycle [a,b,c,d] meaning a→b→c→d→a (a's strip moves to b),
 * U-cw is cycle [F, L, B, R] (F→L, L→B, B→R, R→F).
 *
 * Using left-to-right order of each top-row, the strips line up
 * consistently because as we noted all four "local-left" corners are at
 * (row 0, col 0). Specifically: F-top reading L-to-R goes from (FUL) to
 * (FUR). Moving F's strip onto L means F-top-position-i goes to L-top-
 * position-? — we need to know which physical position L's top-row
 * position-0 corresponds to. L-top-position-0 is L's local-(0,0) which is
 * the BUL corner (back-up-left). And after a U turn, BUL gets stickers
 * from FUL? No: U turn moves FUL → BUL? Let's check: U cw rotates the
 * top layer CW (from above). FUL (front-up-left) goes to... CW from
 * above: front goes to LEFT direction, so FUL → LUL? Hmm wait, FUL is
 * a corner cubie. Under U cw, FUL → LUL? No, it goes to LU-back? Let me
 * just do this carefully on a real cube layout.
 *
 * Looking DOWN at U with F at the bottom (south), B at top (north):
 *   FUL is the south-west corner of U.
 *   CW rotation of U sends south-west → north-west → north-east →
 *   south-east → south-west.
 *   So FUL → LUB (north-west corner = BUL = LUB).
 *
 * So FUL → BUL. Therefore the sticker that was on F at FUL moves to L
 * at... the side of cubie BUL that touches L is... BUL has stickers on
 * B, U, L. So the F-sticker of FUL ends up on L's "back-top" corner, i.e.
 * the corner of L touching B and U. In our L-face indexing convention
 * (row 0 = top, col 0 = side touching B), that's (row 0, col 0) = the
 * BUL corner.
 *
 * Where was F's sticker? At FUL = F's top-row left = (row 0, col 0) = F[0].
 * It moves to L[0]. So with both strips read in "(row 0, col 0..n-1)"
 * order, position 0 of F-top maps to position 0 of L-top under U-cw.
 * That confirms: cycle = [F, L, B, R], all strips = top row read L→R,
 * positions align directly.
 */
const TURN_TABLES: Record<Face, CycleDef> = {
  U: {
    faces: ['F', 'L', 'B', 'R'],
    strips: [
      (n, k) => row(n, k),
      (n, k) => row(n, k),
      (n, k) => row(n, k),
      (n, k) => row(n, k),
    ],
  },
  /* -------------- D turn --------------
   * D-cw viewed from BELOW. By similar derivation: D's adjacent strips are
   * the bottom rows of F, R, B, L. The cycle (CW from below) goes the
   * other way around the cube than U-cw:
   *   FDL → RDL? Let's just use the rule: D-cw cycles F→R, R→B, B→L, L→F.
   * (Because viewed from above, D rotation is CCW, opposite of U.)
   *
   * Bottom row index = n-1. Read L→R as col 0..n-1 of row n-1.
   * Sticker at F[bottom-row, col=0] = FDL, which under D-cw goes to RDL =
   * R[bottom-row, col=0]. So strips align directly: F-pos-0 → R-pos-0.
   * cycle = [F, R, B, L].
   */
  D: {
    faces: ['F', 'R', 'B', 'L'],
    strips: [
      (n, k) => row(n, n - 1 - k),
      (n, k) => row(n, n - 1 - k),
      (n, k) => row(n, n - 1 - k),
      (n, k) => row(n, n - 1 - k),
    ],
  },
  /* -------------- R turn --------------
   * R-cw viewed from the right side. Adjacent strips: right column of F,
   * U, B, D.
   *
   * Reasoning: R-cw rotates the right slice. FUR cubie goes to UBR (top
   * back right). FUR's F-sticker (at F's top-right corner) moves to U at
   * top's back-right corner.
   *
   * cycle (sticker-flow, F→U→B→D→F):
   *   F-right-col → U-right-col → B-left-col → D-right-col → F-right-col
   *
   * Orientation note: B face's "right column" in our layout — recall B's
   * col 0 = side touching R (since L F R B and looking at B from the back,
   * its local-left touches L... wait, see below — convention has B's
   * col 0 toward L).
   *
   * Restating carefully. Net: |L|F|R|B|. So in the net B is to the right
   * of R; B's col 0 (its local-left) is the edge touching R. Therefore
   * the column of B touching R is col 0, NOT n-1.
   *
   * So R-turn touches: F col n-1, U col n-1, B col 0, D col n-1.
   *
   * Direction reversal: F's right column read top-to-bottom corresponds
   * to FUR→FDR. After R-cw, F's column moves to U's right column. U's
   * right column read in what direction? U row 0 = back, row n-1 = front.
   * U's right col = col n-1 = the column of U touching R. U[row 0, col
   * n-1] = back-up-right = BUR; U[row n-1, col n-1] = front-up-right = FUR.
   * So U-right-col read top-to-bottom = BUR→FUR (back to front).
   *
   * Under R-cw, F's stickers in the right column FROM top TO bottom
   * (FUR→FDR) go to U's right column FROM where to where? FUR's F
   * sticker goes to U at... R-cw moves cubies F→U→B→D. FUR (cubie) goes
   * to BUR. The F-sticker on FUR ends up where on BUR? BUR has stickers
   * on B, U, R. The original F-face direction has now rotated 90° to
   * point in the U direction. So FUR's F-sticker becomes BUR's U-sticker.
   * BUR's U position = U[row 0, col n-1].
   *
   * So F[row 0, col n-1] (top of F's right col) → U[row 0, col n-1] (back
   * of U's right col).
   *
   * If we read F's right col top-to-bottom = [FUR, ..., FDR] = positions
   * mapping to U-right-col-back-to-front = [BUR, ..., FUR]. So position
   * 0 of F-strip (top) maps to position 0 of U-strip (back).
   *
   * Define U's strip = U-right-col read TOP-TO-BOTTOM in U's array which
   * is back-to-front. F's strip = F-right-col read top-to-bottom. Both
   * have position-0 at the "back/up" end and position-(n-1) at the
   * "front/down" end. So they align directly: same direction of reading
   * gives same correspondence under R-cw.
   *
   * For B: BUR's U-sticker (which used to be F's right-col top sticker)
   * goes next to... R-cw moves U→B. UBR cubie goes to DBR. The U-sticker
   * on BUR rotates to a B-direction sticker on DBR. DBR's B position =
   * B[row n-1, col 0] (since B's row 0=top, col 0 touches R).
   *
   * Wait I need to track this strip-by-strip. The whole strip on F
   * (top→bottom) is [FUR,...,FDR]. After R-cw it's at U-right-col read
   * back→front = U[row 0..n-1, col n-1]. So at this point the strip on U
   * is positionally [BUR-spot, ..., FUR-spot] holding stickers
   * [F's-FUR-sticker, ..., F's-FDR-sticker].
   *
   * Next R-cw application: that strip moves from U to B. Specifically
   * from U-right-col (back→front) to B-left-col (?→?). Read direction on
   * B: BUR cubie's U-sticker → DBR cubie's B-sticker. BUR is at U[row 0,
   * col n-1] = position 0 of U-strip. DBR is at B[row n-1, col 0] =
   * position n-1 of B-strip if we read B's left col top→bottom, OR
   * position 0 if we read it bottom→top.
   *
   * To keep position 0 mapping to position 0, define B's strip as
   * B-LEFT-col read BOTTOM-TO-TOP, i.e. row (n-1)..0 at col 0.
   *
   * Continuing: from B back to D. DBR cubie's B-sticker → DFR cubie's
   * D-sticker. DBR is at B[row n-1, col 0] = position 0 of B-strip
   * (bottom-to-top), so it maps to position 0 of D-strip. DFR's D
   * position = D[row 0, col n-1] (D row 0 = front, col n-1 = right).
   *
   * To make D-strip's position 0 = D[row 0, col n-1], read D-right-col
   * TOP-TO-BOTTOM: D[row 0, col n-1], D[row 1, col n-1], ..., D[row n-1,
   * col n-1] = DFR, ..., DBR.
   *
   * Final: from D back to F. DBR cubie's D-sticker → FDR cubie's F-sticker.
   * D-strip position n-1 (DBR) → F-strip position n-1 (FDR). Good.
   *
   * Summary R-cw:
   *   cycle: [F, U, B, D]
   *   F-strip at depth k: column (n-1-k), top-to-bottom.
   *   U-strip at depth k: column (n-1-k), top-to-bottom (which is back-to-front).
   *   B-strip at depth k: column k, BOTTOM-to-top.
   *   D-strip at depth k: column (n-1-k), top-to-bottom (which is front-to-back).
   */
  R: {
    faces: ['F', 'U', 'B', 'D'],
    strips: [
      (n, k) => col(n, n - 1 - k),                  // F top→bottom
      (n, k) => col(n, n - 1 - k),                  // U top→bottom (back→front)
      (n, k) => colReversed(n, k),                  // B bottom→top
      (n, k) => col(n, n - 1 - k),                  // D top→bottom (front→back)
    ],
  },
  /* -------------- L turn --------------
   * Mirror of R. By analogous derivation (just the mirror image):
   *   cycle: [F, D, B, U]
   *   F-strip at depth k: col k, top-to-bottom.
   *   D-strip at depth k: col k, bottom-to-top.
   *   B-strip at depth k: col (n-1-k), bottom-to-top.
   *   U-strip at depth k: col k, top-to-bottom.
   *
   * Verification at the FUL cubie: L-cw moves FUL → BUL. F's left-col-top
   * = F[0,0] = FUL's F-sticker. After L-cw goes to U at BUL = U[0,0].
   * F-strip pos 0 = F[0,0]; second face is D, then B, then U. So we'd
   * map F→D first: FUL's F-sticker should go to D? L-cw cycles F→D→B→U?
   *
   * Actually I realize I should double-check L's cycle direction. L is on
   * the left, viewed from the LEFT side. L-cw seen from the left:
   * compass viewed from the left: U=top, F=right (front is to the right
   * when looking at L from outside the cube), D=bottom, B=left. CW going
   * from north: U→F→D→B→U. So cubies cycle U→F→D→B. In sticker terms,
   * L-cw moves stickers F-left-col → U-left-col? No, sticker-flow follows
   * cubie-flow: a sticker on U at the L-strip moves to F at the L-strip.
   *
   * Wait I had R as [F, U, B, D] — sticker-flow F→U→B→D. By symmetry L is
   * [F, D, B, U] — sticker-flow F→D→B→U.
   *
   * Sanity at FUL: F-left-col-top = F[0,0]. Under L-cw (sticker-flow F→D),
   * F's left col goes to D's left col. The F-sticker at FUL goes to D at
   * what corner? L-cw on FUL: F→D direction means cubie FUL → DFL. The
   * F-direction face on FUL becomes D-direction face on DFL? L-cw
   * rotates around L axis: U-direction at L-side becomes F-direction at
   * L-side, F-direction becomes D, D becomes B, B becomes U. So FUL's
   * F-sticker becomes DFL's D-sticker. DFL is D[row 0, col 0]. That's
   * position 0 of D-strip if D-strip = col 0 top→bottom. Which is row 0,
   * col 0 = DFL. Good — F-strip pos 0 → D-strip pos 0.
   *
   * Continuing: D-strip pos 0 → B-strip pos 0. DFL's D-sticker → DBL's
   * B-sticker. But L-cw moves D→B in the strip-flow, meaning a sticker
   * at the D-left-col goes to the B-left-col... DFL cubie under L-cw
   * goes to D? Wait we said L-cw cubie cycle was U→F→D→B, so DFL → BDL =
   * DBL. The D-direction sticker on DFL becomes B-direction sticker on
   * DBL. DBL's B position = B[row n-1, ?]. B's col convention: col 0
   * touches R, col n-1 touches L. So DBL is B[row n-1, col n-1].
   *
   * D-strip pos 0 was at D[0,0]=DFL. After L-cw it's at B[n-1, n-1].
   * For B-strip to put pos 0 there, define B-strip at depth k = col
   * (n-1-k), bottom-to-top → that is rows (n-1)..0 at col n-1, so pos 0 =
   * B[n-1, n-1]. Good.
   *
   * Continuing: B-strip pos 0 → U-strip pos 0. DBL's B-sticker → BUL's
   * U-sticker. (Cubie DBL → BUL under L-cw.) BUL's U position = U[0, 0]
   * (since U row 0 = back, col 0 = left → back-left = BUL). For U-strip
   * pos 0 to be U[0,0], define U-strip at depth k = col k, top-to-bottom.
   * Pos 0 = U[0, 0]. Good.
   *
   * Cycle closing: U-strip pos 0 → F-strip pos 0. BUL's U-sticker → FUL's
   * F-sticker (cubie BUL → FUL under L-cw cubie cycle U→F? we said
   * U→F→D→B for L-cw, yes). FUL's F = F[0,0] = F-strip pos 0. Good.
   */
  L: {
    faces: ['F', 'D', 'B', 'U'],
    strips: [
      (n, k) => col(n, k),                         // F top→bottom
      (n, k) => col(n, k),                         // D top→bottom
      (n, k) => colReversed(n, n - 1 - k),         // B bottom→top
      (n, k) => col(n, k),                         // U top→bottom
    ],
  },
  /* -------------- F turn --------------
   * F-cw viewed from front. Adjacent strips: bottom row of U, left col of
   * R, top row of D, right col of L.
   *
   * Cubie cycle under F-cw: U→R→D→L (UFR → RDF → DFL → LUF → UFR).
   * Sticker-flow follows cubie-flow.
   *
   * Carefully: the strip on U is its bottom row (the row touching F).
   * U's row n-1 is the front row; col 0 = left. U[n-1, 0] = UFL,
   * U[n-1, n-1] = UFR. Read left-to-right.
   *
   * UFL cubie → LUF? No, F-cw: UFL → ULB? Wait, F-cw cubie cycle U→R→D→L:
   *   UFL is on U-strip (since it touches F). It goes from U to R. UFL →
   *   ?. F-cw rotates the front layer. Looking at F from the front, CW.
   *   UFL is at top-left of front face. CW rotation of front face:
   *   top-left → top-right → bottom-right → bottom-left → top-left.
   *   So UFL → UFR (cubie position-wise on the F-layer)... wait that's
   *   only the F-face stickers. The cubie UFL itself rotates around F:
   *   UFL → UFR? No. Looking at F from front, the four corners of F-layer
   *   are UFL, UFR, DFR, DFL (in CW order). F-cw cycles UFL → UFR →
   *   DFR → DFL → UFL. So cubie UFL goes to where UFR was.
   *
   * Hmm so F-cw cubie cycle on the F-LAYER corners is UFL→UFR→DFR→DFL.
   * That's what we expect.
   *
   * Sticker-wise on the SIDE faces: UFL's U-sticker (at U[n-1, 0]) goes
   * to UFR's R-sticker (at R[0, 0]). So U-strip pos 0 → R-strip pos 0
   * if we define them correspondingly.
   *
   * U-strip = bottom row of U = U[n-1, 0..n-1], read L→R. Pos 0 = U[n-1, 0]
   * = UFL.
   * R-strip = left col of R (the side touching F) = col 0. R's row 0 =
   * top, col 0 = left = side touching F. Read top→bottom: R[0..n-1, 0].
   * Pos 0 = R[0, 0] = UFR. Good — U[n-1,0] → R[0,0] under F-cw.
   *
   * Continuing: R[0,0]=UFR's R-sticker → D[0, n-1]=DFR's D-sticker (cubie
   * UFR → DFR). D[0, n-1] is row 0 (front), col n-1 (right). D-strip =
   * D's top row = D[0, 0..n-1]. To make pos 0 of D-strip be D[0, n-1] we
   * read D's top row RIGHT-TO-LEFT.
   *
   * Then D[0, n-1] → L[n-1, n-1]: DFR's D → DFL's L? No wait — F-cw cubie
   * UFR → DFR. So R-strip pos 0 (R[0,0]=UFR) moves to D-strip pos 0
   * (D[0, n-1]=DFR). Then D[0, n-1]=DFR cubie goes to DFL under next
   * F-cw application. DFR's D-sticker → DFL's L-sticker. L[?] for DFL.
   * L's col convention: col 0 = side touching B, col n-1 = side touching
   * F. So DFL's L-position = L[row n-1, col n-1]. To make L-strip pos 0
   * be L[n-1, n-1], read L's right col bottom-to-top: L[n-1..0, n-1].
   *
   * Then L[n-1, n-1] = DFL → U[n-1, 0] = UFL? cubie DFL → UFL? F-cw
   * applied 3 times to UFL gives DFL... let me re-verify. F-cw cubie
   * cycle: UFL → UFR → DFR → DFL → UFL. So 3rd application of F-cw to
   * UFL yields DFL, and 4th yields UFL again. So DFL → UFL. ✓ DFL's
   * L-sticker → UFL's U-sticker → U[n-1, 0] = pos 0. ✓
   */
  F: {
    faces: ['U', 'R', 'D', 'L'],
    strips: [
      (n, k) => row(n, n - 1 - k),                 // U row (n-1-k) L→R
      (n, k) => col(n, k),                         // R col k T→B
      (n, k) => rowReversed(n, k),                 // D row k R→L
      (n, k) => colReversed(n, n - 1 - k),         // L col (n-1-k) B→T
    ],
  },
  /* -------------- B turn --------------
   * B-cw viewed from behind. Cubie cycle: U→L→D→R.
   * U-strip = U's BACK row (row 0). U[0, 0..n-1] read L→R. Pos 0 = U[0,0] = UBL.
   * Cubie UBL → ?. B-cw rotates back layer CW (viewed from back). Back face
   * corners CW order viewed from BEHIND: UBR (top-left from behind),
   * UBL (top-right from behind), DBL (bottom-right), DBR (bottom-left).
   * Wait I need to be careful. From behind, F is far, B is close. Top is
   * top. When looking at B face from behind, what's left? Looking from
   * behind, your left is the cube's right (R). So from behind:
   *    top-left of B view = UBR
   *    top-right of B view = UBL
   *    bottom-right of B view = DBL
   *    bottom-left of B view = DBR
   * B-cw (from behind) corner cycle: UBR → UBL → DBL → DBR → UBR.
   *
   * So UBL cubie → DBL cubie. UBL's U-sticker → DBL's L-sticker.
   * UBL = U[0, 0]. DBL = L[?]. DBL's L-position = L[row n-1, col 0]
   * (L's col 0 = side touching B, row n-1 = bottom).
   * For L-strip pos 0 = L[n-1, 0], read L's left col bottom-to-top:
   * L[n-1..0, 0].
   *
   * Then DBL's L → DBR's D? cubie DBL → DBR. DBR's D = D[row n-1, col n-1].
   * For D-strip pos 0 = D[n-1, n-1], read D's bottom row R→L.
   *
   * Then DBR's D → UBR's R? cubie DBR → UBR. UBR's R = R[row 0, col n-1].
   * For R-strip pos 0 = R[0, n-1], read R's right col top-to-bottom:
   * R[0..n-1, n-1].
   *
   * Closure: UBR's R → UBL's U? cubie UBR → UBL → cycle complete. UBL's U
   * = U[0,0] = pos 0. ✓
   */
  B: {
    faces: ['U', 'L', 'D', 'R'],
    strips: [
      (n, k) => row(n, k),                         // U row k L→R
      (n, k) => colReversed(n, k),                 // L col k B→T
      (n, k) => rowReversed(n, n - 1 - k),         // D row (n-1-k) R→L
      (n, k) => col(n, n - 1 - k),                 // R col (n-1-k) T→B
    ],
  },
};

/** Apply one parsed move to a face state in place. */
function applyOne(faces: CubeFaces, n: number, mv: ParsedMove): void {
  const { face, amount, isRotation } = mv;
  let layers = mv.layers;
  if (isRotation) layers = n;

  // Reduce ccw to 3 cw rotations modeling, but we'll rotate face-grid by exact dir.
  // Determine grid rotation for the *touched* face only at depth 0.
  // For wide moves, the front face rotates once (the layers below are interior
  // and don't have stickers on this face). For rotations (layers === n), we
  // also need to rotate the OPPOSITE face by the inverse direction.

  const repeats = amount === 2 || amount === -2 ? 2 : 1;
  const dir: 1 | -1 = amount === 1 || amount === -2 ? 1 : amount === -1 ? -1 : 1;
  // Note: for amount=2 we rotate twice with dir=1; for amount=-2 twice with dir=1
  // (180 is same either way). For amount=-1 once with dir=-1.

  for (let rep = 0; rep < repeats; rep++) {
    // 1) Rotate the front (axis) face's grid.
    if (layers >= 1) {
      rotateFace(faces[face], n, dir);
    }
    // 2) For full cube rotations, also rotate the opposite face by inverse dir.
    if (layers === n) {
      rotateFace(faces[oppositeFace(face)], n, dir === 1 ? -1 : 1);
    }
    // 3) Cycle the side-face strips for each layer in [0, layers-1].
    const def = TURN_TABLES[face];
    for (let k = 0; k < layers; k++) {
      // Skip the opposite face's outer layer when k === n-1: that strip
      // would conflict with face 'oppositeFace(face)' which we already
      // rotated explicitly. But for cube rotations we're cycling all
      // layers — and the outer "back" layer's strips ARE the surface
      // stickers of the side faces near the opposite face, which are
      // distinct from the opposite face itself. So cycle them too.
      cycleFour(faces, n, def, k, dir);
    }
  }
}

function cycleFour(
  faces: CubeFaces,
  n: number,
  def: CycleDef,
  k: number,
  dir: 1 | -1,
): void {
  const idx0 = def.strips[0](n, k);
  const idx1 = def.strips[1](n, k);
  const idx2 = def.strips[2](n, k);
  const idx3 = def.strips[3](n, k);
  const f0 = faces[def.faces[0]];
  const f1 = faces[def.faces[1]];
  const f2 = faces[def.faces[2]];
  const f3 = faces[def.faces[3]];

  // Save current strips.
  const s0 = idx0.map(i => f0[i]);
  const s1 = idx1.map(i => f1[i]);
  const s2 = idx2.map(i => f2[i]);
  const s3 = idx3.map(i => f3[i]);

  if (dir === 1) {
    // CW: 0 → 1 → 2 → 3 → 0.
    for (let i = 0; i < n; i++) f1[idx1[i]] = s0[i];
    for (let i = 0; i < n; i++) f2[idx2[i]] = s1[i];
    for (let i = 0; i < n; i++) f3[idx3[i]] = s2[i];
    for (let i = 0; i < n; i++) f0[idx0[i]] = s3[i];
  } else {
    // CCW: 0 → 3 → 2 → 1 → 0.
    for (let i = 0; i < n; i++) f3[idx3[i]] = s0[i];
    for (let i = 0; i < n; i++) f2[idx2[i]] = s3[i];
    for (let i = 0; i < n; i++) f1[idx1[i]] = s2[i];
    for (let i = 0; i < n; i++) f0[idx0[i]] = s1[i];
  }
}

function oppositeFace(f: Face): Face {
  switch (f) {
    case 'U': return 'D';
    case 'D': return 'U';
    case 'F': return 'B';
    case 'B': return 'F';
    case 'L': return 'R';
    case 'R': return 'L';
  }
}

/** Apply a sequence of parsed moves. */
export function applyMoves(faces: CubeFaces, n: number, moves: ParsedMove[]): CubeFaces {
  const out = cloneFaces(faces);
  for (const mv of moves) applyOne(out, n, mv);
  return out;
}

/** Apply a scramble string to a fresh solved NxN cube. */
export function applyScramble(n: number, scramble: string): CubeFaces {
  return applyMoves(solved(n), n, parseScramble(scramble));
}

/** Compare two states for equality (used in tests). */
export function facesEqual(a: CubeFaces, b: CubeFaces): boolean {
  for (const f of ['U', 'D', 'F', 'B', 'L', 'R'] as Face[]) {
    const aa = a[f]; const bb = b[f];
    if (aa.length !== bb.length) return false;
    for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
  }
  return true;
}
