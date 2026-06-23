/**
 * IvyCube — three.js Group rendering an Ivy cube (枫叶魔方) for /sim.
 *
 * Modeled on Sq1Cube: a non-NxN puzzle in the local cuber engine (not cubing.js).
 * 10 piece pivots, all children of `this`, each at the origin — its quaternion is
 * the truth for where the piece is now:
 *   - 4 CORNER pivots (turning corners, axes R L D B = 0..3 per lib/ivy-solver),
 *     each holding its 3 petal meshes (one per adjacent face);
 *   - 6 CENTER pivots, each holding one "eye" lens mesh.
 * Each piece BODY is the EXACT Ivy solid, built by true CSG (_buildBodies): the Ivy cube
 * is a cube cut by 4 spheres of radius E (= edge) centered at the 4 alternating
 * (tetrahedral) vertices. A corner body = cube ∩ its sphere − the other 3 (a point
 * inside exactly 1 sphere); a center/leaf body = cube ∩ its face's two spheres − the
 * other 2 (inside exactly 2; with R = E its tips reach the cube corners). A thin colored
 * STICKER is raised + inset on top, so the body shows as the grooves of a real Ivy; there
 * is NO ball core (the ≥3-sphere region is purely interior, never reaching a face). A
 * corner turn rotates a solid set (corner body + its petals + the 3 adjacent center
 * bodies) 120° about the body diagonal through its vertex. Because every OTHER piece is
 * subtracted out of that vertex's sphere while the moving pieces are inside it, and the
 * sphere's mesh is oriented to be invariant under the 120° turn (see alignedSphereGeo),
 * the moving solid angle stays exactly inside the invariant sphere ⇒ it slides past the
 * stationary pieces with ZERO interpenetration, revealing their real curved inner
 * surfaces (a real Ivy — not a flat slab, box "fan", ball, or an approximation).
 *
 * A move = a 120° corner twist about a body diagonal. The 3 faces meeting at a
 * corner are cyclically permuted by that rotation, so ONE rigid rotation of
 * {corner pivot + its 3 petals} ∪ {the 3 center pivots currently on those faces}
 * realizes a real Ivy move. The rotation sign per axis is derived so the visual
 * 3-cycle matches lib/ivy-solver's MOVE_CENTERS (so solveIvy() solutions solve).
 *
 * Geometry source: skills/image-to-svg/cube_svg.py + app/.../gen/_svg/ivy_svg.ts.
 */
import * as THREE from 'three';
// eslint-disable-next-line import/no-unresolved
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { Brush, Evaluator, INTERSECTION, SUBTRACTION, type CSGOperation } from 'three-bvh-csg';
import Cubelet from '../cubelet';
import { COLORS } from '../define';
import { MOVE_CENTERS } from '@/lib/ivy-solver';
import { facePathsGrooved, type Corner } from './ivyFacePaths';
import IvyTwister from './IvyTwister';

export interface IvyMove { axis: number; times: number; name: string; }

export interface IvyAnim {
  pivot: THREE.Object3D;
  startQuat: THREE.Quaternion;
  endQuat: THREE.Quaternion;
  axis: THREE.Vector3;
  angle: number;
}

export class IvyHistory {
  moves: string[] = [];
  redoStack: string[] = [];
  init = '';
  get length(): number { return this.moves.length; }
  clear(): void { this.moves.length = 0; this.redoStack.length = 0; }
  record(move: string): void { this.moves.push(move); this.redoStack.length = 0; }
}

// Face order = lib/ivy-solver: U R F B L D = 0..5.
const FACE_LETTER = ['U', 'R', 'F', 'B', 'L', 'D'] as const;
const FACE_NORMAL: [number, number, number][] = [
  [0, 1, 0],  // U
  [1, 0, 0],  // R
  [0, 0, 1],  // F
  [0, 0, -1], // B
  [-1, 0, 0], // L
  [0, -1, 0], // D
];
// The 4 turning corners (tetrahedral) and their axis id (R L D B = 0..3).
const CORNER_POS: [number, number, number][] = [
  [1, 1, -1],   // axis 0 (R) = U,B,R
  [-1, 1, 1],   // axis 1 (L) = U,F,L
  [1, -1, 1],   // axis 2 (D) = R,D,F
  [-1, -1, -1], // axis 3 (B) = B,L,D
];
const CORNER_AXIS = new Map<string, number>(CORNER_POS.map((c, i) => [c.join(','), i]));
// Turning-corner axis letters (R L D B = 0..3), matches lib/ivy-solver notation.
const AXIS_LETTER = 'RLDB';
// faceCorners[face] = turning-corner axes that move that face's center. Each face
// appears in exactly 2 of the 4 MOVE_CENTERS cycles → 2 corners per face. Used by
// ivyDrag so grabbing a center lens turns one of its 2 corners (drag picks which).
const FACE_CORNERS: number[][] = [[], [], [], [], [], []];
MOVE_CENTERS.forEach((cyc, axis) => { for (const f of cyc) FACE_CORNERS[f].push(axis); });

// Per-face quad corners (x,y,z = ±1) as TL,TR,BL,BR seen from outside.
const FACE_QUADS: [number, number, number][][] = [
  [[-1, 1, -1], [1, 1, -1], [-1, 1, 1], [1, 1, 1]],   // U
  [[1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1]],   // R
  [[-1, 1, 1], [1, 1, 1], [-1, -1, 1], [1, -1, 1]],   // F
  [[1, 1, -1], [-1, 1, -1], [1, -1, -1], [-1, -1, -1]], // B
  [[-1, 1, -1], [-1, 1, 1], [-1, -1, -1], [-1, -1, 1]], // L
  [[-1, -1, 1], [1, -1, 1], [-1, -1, -1], [1, -1, -1]], // D
];
const LOCAL_NAME: Corner[] = ['a', 'b', 'c', 'd']; // TL TR BL BR

const E = Cubelet.SIZE * 3;        // cube edge
const HALF = E / 2;
const DEPTH = E * 0.03;            // colored sticker thickness (raised above body)
// The 4 turning-corner vertices (tetrahedral) = the centers of the 4 cutting spheres.
// The exact Ivy cube is the cube cut by 4 spheres of radius E (= edge) centered at
// these alternating vertices: a point inside exactly 1 sphere is a corner piece, inside
// exactly 2 is a center/leaf piece (radius E ⇒ each leaf's tips reach the cube corners,
// the canonical Ivy look). The piece bodies are built by true CSG from these spheres
// (_buildBodies), so an Ivy turn is a real solid angle. Researched + numerically
// verified (R = edge; surface = exactly 2 piece types, no visible core).
const TURN_VERTS = CORNER_POS.map((c) => new THREE.Vector3(c[0], c[1], c[2]).multiplyScalar(HALF));
const GROOVE = 0.03;               // radial width of the lens↔petal groove (true-arc concentric gap)
const LIFT = E * 0.004;
const TWO_PI_3 = (2 * Math.PI) / 3;

// CSG cutting-sphere tessellation. Each sphere is an icosphere ORIENTED so one of its
// 3-fold (face-center) axes points along its vertex's body diagonal. A 120° corner
// twist about that diagonal is then an exact symmetry of the icosphere's tessellation
// (verified vertex-set mismatch ~1e-7), so the turning sphere — the only surface
// separating the moving solid angle (inside it) from the stationary pieces (subtracted
// out of it) — is invariant under the turn ⇒ zero interpenetration, not just small.
const SPHERE_DETAIL = 5;
const _icoFace0 = new THREE.IcosahedronGeometry(1, 0).attributes.position;
const ICO_3FOLD = new THREE.Vector3()
  .add(new THREE.Vector3().fromBufferAttribute(_icoFace0, 0))
  .add(new THREE.Vector3().fromBufferAttribute(_icoFace0, 1))
  .add(new THREE.Vector3().fromBufferAttribute(_icoFace0, 2))
  .normalize();
function alignedSphereGeo(dirUnit: THREE.Vector3): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(E, SPHERE_DETAIL);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(ICO_3FOLD, dirUnit));
  return geo;
}

const svgLoader = new SVGLoader();
function shapesFromPath(d: string): THREE.Shape[] {
  const data = svgLoader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
  const shapes: THREE.Shape[] = [];
  for (const p of data.paths) for (const s of SVGLoader.createShapes(p)) shapes.push(s);
  return shapes;
}

// Extract a region's outline points from its path-d, dropping the duplicate
// closing vertex. The grooves are baked into the path radii (facePathsGrooved),
// so NO post-inset is applied — the points already trace the TRUE circular arcs.
function outlinePoints(d: string): THREE.Vector2[] {
  const pts = shapesFromPath(d)[0].extractPoints(24).shape as THREE.Vector2[];
  if (pts.length > 1) {
    const a = pts[0], b = pts[pts.length - 1];
    if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) pts.pop();
  }
  return pts;
}

export default class IvyCube extends THREE.Group {
  readonly puzzleType = 'ivy' as const;
  order = 0;
  dirty = true;
  callbacks: (() => void)[] = [];
  history = new IvyHistory();
  twister: IvyTwister;

  /** centerPivot[piece] — the pivot of center piece `piece` (home face = piece). */
  private centerPivot: THREE.Object3D[] = [];
  private cornerPivot: THREE.Object3D[] = [];
  /** pivotAtFace[face] = which center piece currently sits at `face`. */
  private pivotAtFace: number[] = [0, 1, 2, 3, 4, 5];
  private cornerTwist: number[] = [0, 0, 0, 0];
  private axisVec: THREE.Vector3[] = [];
  private baseSign: number[] = [];
  /** Shared black material for the core sphere + every piece body shell. */
  private bodyMat = new THREE.MeshLambertMaterial({ color: 0x161616, side: THREE.DoubleSide });

  constructor() {
    super();

    for (let m = 0; m < 4; m++) {
      this.axisVec[m] = new THREE.Vector3(...CORNER_POS[m]).normalize();
      const pivot = new THREE.Object3D();
      this.cornerPivot[m] = pivot;
      this.add(pivot);
    }
    for (let f = 0; f < 6; f++) {
      const pivot = new THREE.Object3D();
      this.centerPivot[f] = pivot;
      this.add(pivot);
    }
    // Sign per axis so R(axis, +120°) realizes MOVE_CENTERS' a→b cycle.
    for (let m = 0; m < 4; m++) {
      const [fa, fb] = MOVE_CENTERS[m];
      const q = new THREE.Quaternion().setFromAxisAngle(this.axisVec[m], TWO_PI_3);
      const v = new THREE.Vector3(...FACE_NORMAL[fa]).applyQuaternion(q);
      this.baseSign[m] = v.dot(new THREE.Vector3(...FACE_NORMAL[fb])) > 0.5 ? 1 : -1;
    }

    // Pieces = the exact Ivy CSG (no ball core): each body is the cube intersected with
    // its own cutting sphere(s) and subtracted by the others (_buildBodies). Turning /
    // carving reveals their real curved inner surfaces. Stickers + arc-strokes are then
    // laid on top per face (_buildFaces).
    this._buildBodies();
    this._buildFaces();
    this.twister = new IvyTwister(this);
  }

  /** Build the 4 corner + 6 center piece BODIES as exact CSG solids and parent each to
   *  its pivot. Each cutting sphere (radius E, centered at a turning vertex) is oriented
   *  so a 120° twist about that vertex's body diagonal is an exact symmetry of its mesh
   *  → the turning sphere is invariant under the turn, and since a corner piece is INSIDE
   *  its sphere while every other piece is SUBTRACTED out of it, the moving solid angle
   *  stays exactly inside the invariant sphere ⇒ zero interpenetration. The CSG-
   *  interpolated normals give flat-shaded cube faces + smooth sphere caps for free.
   *  Tagged 'body' for the structure-color debug overlay; share this.bodyMat. */
  private _buildBodies(): void {
    const ev = new Evaluator();
    ev.useGroups = false; // one body material → a single merged group per piece
    const cube = new Brush(new THREE.BoxGeometry(E, E, E));
    cube.updateMatrixWorld();
    const spheres = TURN_VERTS.map((v) => {
      const b = new Brush(alignedSphereGeo(v.clone().normalize()));
      b.position.copy(v);
      b.updateMatrixWorld();
      return b;
    });
    const csg = (a: Brush, b: Brush, op: CSGOperation): Brush => ev.evaluate(a, b, op);
    const attach = (brush: Brush, parent: THREE.Object3D): void => {
      const mesh = new THREE.Mesh(brush.geometry, this.bodyMat);
      mesh.userData.simRole = 'body';
      parent.add(mesh);
    };
    // Corner piece a: inside sphere a, carved out of the other 3 (inside exactly 1).
    for (let a = 0; a < 4; a++) {
      let r = csg(cube, spheres[a], INTERSECTION);
      for (let o = 0; o < 4; o++) if (o !== a) r = csg(r, spheres[o], SUBTRACTION);
      attach(r, this.cornerPivot[a]);
    }
    // Center piece f: inside both of face f's turning-corner spheres, carved out of the
    // other 2 (inside exactly 2 → the leaf, tips reaching the cube corners since R = E).
    for (let f = 0; f < 6; f++) {
      const [a, b] = FACE_CORNERS[f];
      let r = csg(cube, spheres[a], INTERSECTION);
      r = csg(r, spheres[b], INTERSECTION);
      for (let o = 0; o < 4; o++) if (o !== a && o !== b) r = csg(r, spheres[o], SUBTRACTION);
      attach(r, this.centerPivot[f]);
    }
  }

  private _buildFaces(): void {
    for (let f = 0; f < 6; f++) {
      const quad = FACE_QUADS[f].map((c) => new THREE.Vector3(c[0] * HALF, c[1] * HALF, c[2] * HALF));
      const [TL, TR, BL] = quad;
      const O = TL.clone();
      const Ux = TR.clone().sub(TL);
      const Uy = BL.clone().sub(TL);
      const geoNormal = new THREE.Vector3().crossVectors(Ux, Uy).normalize();
      const outward = new THREE.Vector3(...FACE_NORMAL[f]);
      const pos = O.clone().add(outward.clone().multiplyScalar(LIFT));
      const matrix = new THREE.Matrix4().makeBasis(Ux, Uy, geoNormal).setPosition(pos);
      // The black piece BODIES are NOT built from these outlines — they are true CSG
      // solids built once in _buildBodies (cube ∩/− the 4 cutting spheres), so a turn
      // opens a real solid angle. The outline here only backs the raised + inset colored
      // sticker that sits on top of the body (the grooved color of a real Ivy).
      const flip = geoNormal.dot(outward) < 0;

      // which two locals are turning corners + their axis
      const turning: { name: Corner; axis: number }[] = [];
      FACE_QUADS[f].forEach((c, i) => {
        const ax = CORNER_AXIS.get(c.join(','));
        if (ax !== undefined) turning.push({ name: LOCAL_NAME[i], axis: ax });
      });
      const fp = facePathsGrooved([turning[0].name, turning[1].name], GROOVE);
      const color = COLORS[FACE_LETTER[f]];

      const place = (d: string, parent: THREE.Object3D, cornerAxis?: number, centerPiece?: number): void => {
        const capPts = outlinePoints(d);

        // (1) Colored STICKER — thin, raised above the body, flat on the face. The CSG
        // body (built in _buildBodies) fills the whole piece region and tiles its
        // neighbors exactly along the shared cut sphere; this sticker is inset (grooved)
        // and raised, so the body shows as a thin groove around the color, like a real
        // Ivy. Every curved edge is a TRUE circular arc (facePathsGrooved): petals are
        // the real radius-1 arcs reaching the cube corners, the lens is concentric
        // radius-(1-GROOVE) arcs, so the visible lens↔petal groove is an even-width gap
        // bounded by true circles — not a scaled/elliptical approximation, no spikes.
        const g = new THREE.ExtrudeGeometry(new THREE.Shape(capPts.map((p) => p.clone())), { depth: DEPTH, bevelEnabled: false });
        if (flip) g.translate(0, 0, -DEPTH);
        g.applyMatrix4(matrix);
        const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color }));
        // Tag every tile so a raycast (ivyDrag) maps any hit back to a turn:
        // petals carry their turning-corner axis (that one corner always moves
        // them — petals are corner-parented); lenses carry their center-piece id
        // (home face) — centers permute, so the corners that move a center are
        // resolved live from its CURRENT face. Grabbing any tile turns; the drag
        // direction picks the corner.
        if (cornerAxis !== undefined) mesh.userData.ivyCornerAxis = cornerAxis;
        if (centerPiece !== undefined) mesh.userData.ivyCenterPiece = centerPiece;
        mesh.userData.simRole = 'sticker'; // left untouched by the debug overlay
        parent.add(mesh);
      };

      place(fp.petals[0], this.cornerPivot[turning[0].axis], turning[0].axis);
      place(fp.petals[1], this.cornerPivot[turning[1].axis], turning[1].axis);
      place(fp.lens, this.centerPivot[f], undefined, f);
    }
  }

  /** Local-frame rotation axis (unit body diagonal) of turning corner `axis`. */
  cornerAxisVec(axis: number): THREE.Vector3 {
    return this.axisVec[axis].clone();
  }

  /** Turning-corner axes that currently move center piece `piece` (its home-face
   *  id): centers permute, so resolve the piece's LIVE face, then its 2 corners. */
  cornersForCenterPiece(piece: number): number[] {
    const face = this.pivotAtFace.indexOf(piece);
    return face < 0 ? [] : FACE_CORNERS[face];
  }

  /** Pick the IvyMove for a drag on corner `axis` with geometric rotation sign
   *  `geomSign` (sign of the angle about cornerAxisVec, right-hand rule). The
   *  power (times 1 vs 2) is folded in here via baseSign so beginMove's signed
   *  angle matches geomSign — callers needn't know baseSign. Naming uses the /sim's
   *  STANDARD convention: a single 120° twist (times 1) = a bare letter "R", its
   *  inverse (times 2) = "R'", so a dragged single twist records as "R" (not "R'").
   *  This is intentionally the OPPOSITE of lib/ivy-solver's cstimer notation (where
   *  a bare letter = the base turn applied TWICE); the /sim is a self-contained
   *  world (own random scramble + drags, no solveIvy), so it reads naturally. Keep
   *  in sync with IvyTwister.parseIvyMoves. */
  pickMove(axis: number, geomSign: number): IvyMove {
    const times = geomSign * this.baseSign[axis] > 0 ? 1 : 2;
    return { axis, times, name: AXIS_LETTER[axis] + (times === 1 ? '' : "'") };
  }

  /** Build the per-piece animation plan for a move (no state change yet). */
  beginMove(move: IvyMove): IvyAnim[] {
    const [fa, fb, fd] = MOVE_CENTERS[move.axis];
    const angle = (move.times === 2 ? -1 : 1) * this.baseSign[move.axis] * TWO_PI_3;
    const axisV = this.axisVec[move.axis];
    const delta = new THREE.Quaternion().setFromAxisAngle(axisV, angle);
    const pivots = [
      this.cornerPivot[move.axis],
      this.centerPivot[this.pivotAtFace[fa]],
      this.centerPivot[this.pivotAtFace[fb]],
      this.centerPivot[this.pivotAtFace[fd]],
    ];
    return pivots.map((pivot) => {
      const startQuat = pivot.quaternion.clone();
      const endQuat = delta.clone().multiply(startQuat);
      return { pivot, startQuat, endQuat, axis: axisV, angle };
    });
  }

  /** Advance the discrete state (face permutation + corner twist) for a move. */
  private _commit(move: IvyMove): void {
    const [fa, fb, fd] = MOVE_CENTERS[move.axis];
    for (let t = 0; t < move.times; t++) {
      const oa = this.pivotAtFace[fa], ob = this.pivotAtFace[fb], od = this.pivotAtFace[fd];
      this.pivotAtFace[fb] = oa; this.pivotAtFace[fd] = ob; this.pivotAtFace[fa] = od;
    }
    this.cornerTwist[move.axis] = (this.cornerTwist[move.axis] + move.times) % 3;
  }

  /** Snap pivots to end pose, advance the discrete state, record history. */
  finishMove(anims: IvyAnim[], move: IvyMove): void {
    for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
    this._commit(move);
    this.history.record(move.name);
    this.dirty = true;
    for (const cb of this.callbacks) cb();
  }

  applyMoveInstant(move: IvyMove): void {
    this.finishMove(this.beginMove(move), move);
  }

  /** Snap a move into place without recording history (used by undo/redo replay). */
  applyMoveSilent(move: IvyMove): void {
    const anims = this.beginMove(move);
    for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
    this._commit(move);
    this.dirty = true;
  }

  applyMovesInstant(moves: IvyMove[]): void {
    this.reset();
    for (const m of moves) this.applyMoveInstant(m);
  }

  reset(): void {
    for (const p of this.cornerPivot) p.quaternion.identity();
    for (const p of this.centerPivot) p.quaternion.identity();
    this.pivotAtFace = [0, 1, 2, 3, 4, 5];
    this.cornerTwist = [0, 0, 0, 0];
    this.dirty = true;
    // Notify listeners (UI sync + lets SimPage drop a frozen debug-hold turn,
    // since reset re-poses all pivots). setup()/_replay() already fire these.
    for (const cb of this.callbacks) cb();
  }

  /** Debug: carve out (hide) EVERYTHING an R turn moves — the R corner piece (axis
   *  0: its 3 petals) PLUS the 3 centers that R cycles (the same pivot set
   *  `beginMove({axis:0})` rotates) — so the surrounding pieces' curved inner
   *  surfaces show through the opening, like lifting the whole R layer off
   *  a real Ivy. Hiding a pivot hides its whole subtree while each child keeps its
   *  own `.visible` (e.g. arc-stroke overlays). OFF restores ALL pivots (not just
   *  the ones it hid), so it's correct even if the state permuted while carved. */
  setCarveCorner(on: boolean): void {
    if (on) {
      this.cornerPivot[0].visible = false; // axis 0 = R (AXIS_LETTER 'RLDB')
      for (const f of MOVE_CENTERS[0]) this.centerPivot[this.pivotAtFace[f]].visible = false;
    } else {
      for (const p of this.cornerPivot) p.visible = true;
      for (const p of this.centerPivot) p.visible = true;
    }
    this.dirty = true;
  }

  get complete(): boolean {
    for (let f = 0; f < 6; f++) if (this.pivotAtFace[f] !== f) return false;
    for (let m = 0; m < 4; m++) if (this.cornerTwist[m] !== 0) return false;
    return true;
  }

  dispose(): void {
    this.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) for (const m of mat) m.dispose();
        else mat?.dispose();
      }
    });
    this.callbacks.length = 0;
  }
}
