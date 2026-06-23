/**
 * IvyCube — three.js Group rendering an Ivy cube (枫叶魔方) for /sim.
 *
 * Modeled on Sq1Cube: a non-NxN puzzle in the local cuber engine (not cubing.js).
 * 10 piece pivots, all children of `this`, each at the origin — its quaternion is
 * the truth for where the piece is now:
 *   - 4 CORNER pivots (turning corners, axes R L D B = 0..3 per lib/ivy-solver),
 *     each holding its 3 petal meshes (one per adjacent face);
 *   - 6 CENTER pivots, each holding one "eye" lens mesh.
 * Each visible region is a black 3D BODY shaped like a SPHERICAL SHELL — its outer
 * cap is the flat region on the cube face, its side walls run radially inward to a
 * smooth ball core (radius CORE_R) — with a thin colored STICKER raised on top
 * (inset toward its own centroid, so the body shows as black grooves). A corner
 * turn rotates a solid cap (corner body + its petals + the 3 adjacent center
 * bodies); the opening it leaves reveals the smooth ball core + the shells' curved
 * walls, like a real Ivy — not a flat slab or the sharp box "fan" this replaced.
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
import Cubelet from '../cubelet';
import { COLORS } from '../define';
import { MOVE_CENTERS } from '@/lib/ivy-solver';
import { facePathsGrooved, type Corner } from './ivyFacePaths';
import IvyTwister from './IvyTwister';
import { DEBUG_ARC_STROKE_MAT } from '../debugColors';

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
const CORE_R = HALF * 0.7;         // ball-core radius; piece bodies are spherical shells down to it
const GROOVE = 0.03;               // radial width of the lens↔petal groove (true-arc concentric gap)
const LIFT = E * 0.004;
const TWO_PI_3 = (2 * Math.PI) / 3;

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

    // Smooth black ball core (like a real Ivy's spherical core). Each piece body
    // is a spherical SHELL carved down to this radius, so a corner turn reveals a
    // smooth curved surface — not a flat slab or a sharp box fan. Sits a hair
    // inside the shells' inner rims so it backs the grooves between them.
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(CORE_R * 0.985, 48, 32),
      this.bodyMat,
    );
    core.userData.simRole = 'core'; // structure-coloring debug overlay (debugColors.ts)
    this.add(core);

    this._buildFaces();
    this.twister = new IvyTwister(this);
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
      // Body sits flush at the true surface (no LIFT) so its rim recesses below
      // the raised colored sticker → clean grooves, no z-fight.
      const bodyMatrix = new THREE.Matrix4().makeBasis(Ux, Uy, geoNormal).setPosition(O);
      const flip = geoNormal.dot(outward) < 0;

      // Spherical-shell body, built from the region outline points (outlinePoints):
      // outer cap = the region on the cube face; side walls run radially in to the
      // ball core (CORE_R), open at the core end so the smooth core shows through —
      // a turn opens a curved surface, not flat slabs. The SAME points also back the
      // colored sticker, so the body never extends past its own color: a turn can
      // only lead with color, never a bare body rim that would slice a neighbor's
      // arc (the user-reported "圆弧被截断"; skill pitfall #12+#13). The lens↔petal
      // groove is the true-arc concentric gap baked into facePathsGrooved.
      const buildShell = (pts: THREE.Vector2[]): THREE.BufferGeometry => {
        const N = pts.length;
        const outer = pts.map((p) => new THREE.Vector3(p.x, p.y, 0).applyMatrix4(bodyMatrix));
        const inner = outer.map((p) => p.clone().setLength(CORE_R));
        const tris = THREE.ShapeUtils.triangulateShape(pts, []);
        const verts: number[] = [];
        const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): void => {
          verts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
        };
        for (const [i, j, k] of tris) tri(outer[i], outer[j], outer[k]); // outer cap
        for (let i = 0; i < N; i++) {                                    // radial side walls
          const j = (i + 1) % N;
          tri(outer[i], outer[j], inner[j]);
          tri(outer[i], inner[j], inner[i]);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.computeVertexNormals();
        return geo;
      };

      // which two locals are turning corners + their axis
      const turning: { name: Corner; axis: number }[] = [];
      FACE_QUADS[f].forEach((c, i) => {
        const ax = CORNER_AXIS.get(c.join(','));
        if (ax !== undefined) turning.push({ name: LOCAL_NAME[i], axis: ax });
      });
      const fp = facePathsGrooved([turning[0].name, turning[1].name], GROOVE);
      const color = COLORS[FACE_LETTER[f]];

      const place = (d: string, parent: THREE.Object3D, cornerAxis?: number, centerPiece?: number): void => {
        // (1) Black BODY — a spherical shell down to the ball core, so a corner
        // turn opens a smooth curved surface (real Ivy look), not flat slabs.
        // Tagged 'body' for the structure-coloring debug overlay (debugColors.ts).
        const capPts = outlinePoints(d);
        const bodyMesh = new THREE.Mesh(buildShell(capPts), this.bodyMat);
        bodyMesh.userData.simRole = 'body';
        parent.add(bodyMesh);

        // (2) Colored STICKER — thin, raised above the body, flat on the face.
        // Uses the SAME outline points as the body, so the sticker exactly caps the
        // body (no bare rim, no cyan tips) and a turn never leads with bare body that
        // would cut a neighbor's arc. Every curved edge is a TRUE circular arc
        // (facePathsGrooved): petals are the real radius-1 arcs reaching the cube
        // corners, the lens is concentric radius-(1-GROOVE) arcs, so the visible
        // lens↔petal groove is an even-width gap bounded by true circles — not a
        // scaled/elliptical approximation, and no corner spikes ("触角").
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

        // (3) Debug ARC STROKE — a bright outline tracing this region's visible
        // edge (the inset sticker outline), sitting just above the sticker, hidden
        // by default. applyDebugArcStroke toggles it: freeze a turn half-way and
        // every colored arc should stay a continuous closed loop — a break means a
        // body is wrongly covering the arc there (the bug this guards against).
        const loop = capPts.map((p) => new THREE.Vector3(p.x, p.y, 0).applyMatrix4(bodyMatrix));
        const stroke = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loop, true, 'catmullrom', 0), Math.max(32, loop.length * 2), E * 0.012, 6, true),
          DEBUG_ARC_STROKE_MAT,
        );
        stroke.position.copy(outward).multiplyScalar(LIFT + DEPTH + E * 0.01);
        stroke.userData.simRole = 'arcstroke';
        stroke.visible = false;
        parent.add(stroke);
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
   *  angle matches geomSign — callers needn't know baseSign. */
  pickMove(axis: number, geomSign: number): IvyMove {
    const times = geomSign * this.baseSign[axis] > 0 ? 1 : 2;
    return { axis, times, name: AXIS_LETTER[axis] + (times === 1 ? "'" : '') };
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
