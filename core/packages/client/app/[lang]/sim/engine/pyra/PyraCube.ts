/**
 * PyraCube — three.js Group rendering a Pyraminx (vertex-turning tetrahedron).
 *
 * 14 pivots at the origin (4 tips + 4 corners + 6 edges); a turn left-multiplies
 * R(vertexAxis, ±120°) into the affected pivots' quaternions (position fixed at the
 * origin). Which pieces a move carries is always read LIVE from the geometry (rotate
 * each piece's home centroid by its pivot, test V_k·c > A/3): a corner-layer turn takes
 * everything currently in the vertex's layer (corner + tip + 3 edges), a face turn takes
 * the complementary far slab (3 corners + 3 tips + 3 edges — face turns permute corners
 * and tips between vertices, so no piece is index-bound to a vertex), a tip turn takes
 * the tip currently at the vertex. No discrete permutation state — `complete` is "every
 * pivot is back at identity", which is exact because each piece's geometry is baked in
 * home coords and turns are pure SO(3).
 *
 * Whole-puzzle rotations (y / Lv / Rv / Bv) are re-holds: they ride the group's OWN
 * quaternion (pieces untouched → `complete` is rotation-immune) and advance a
 * letter→physical remap so subsequent letters stay world-fixed, WCA-style — the same
 * shared table the PG bridge folds rotations with.
 */
import * as THREE from 'three';
import MoveHistory from '../MoveHistory';
import { makeAnim, type PieceAnim } from '../pieceAnim';
import type { TweenCube } from '../TweenTwister';
import {
  buildPyraPiece, buildCore, VDIR, EDGE_PAIRS, PYRA_A, APEX_UP_QUAT, vertexAxis,
} from './pyraGeometry';
import { type PyraMove, pyraMoveToString, rotateLetterMap } from './pyraState';
import PyraTwister from './PyraTwister';

interface PyraPiece {
  pivot: THREE.Object3D;
  group: THREE.Group;
  /** Home-pose centroid (local), for live layer detection (edges). */
  center: THREE.Vector3;
}

const LAYER_T = PYRA_A / 3; // V_k·center > this ⇒ in vertex k's turning layer

export default class PyraCube extends THREE.Group implements TweenCube<PyraMove> {
  callbacks: (() => void)[] = [];
  dirty = true;
  order = 0;
  history = new MoveHistory();
  readonly puzzleType = 'pyraminx' as const;
  twister: PyraTwister;

  tips: PyraPiece[] = [];
  corners: PyraPiece[] = [];
  edges: PyraPiece[] = [];

  /** Unnormalized vertex directions (for the V_k·c layer test). */
  private readonly vdir = VDIR.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  /** Unit twist axes per vertex. */
  private readonly axes = [0, 1, 2, 3].map((k) => vertexAxis(k));
  /** Letter → physical vertex under the accumulated whole-puzzle rotations. Rotations
   *  re-hold the puzzle (WCA semantics): after `y`, a typed `L` turns whatever vertex
   *  now sits at the L position. Identity until a 'rot' move bakes in. */
  private l2p = [0, 1, 2, 3];

  constructor() {
    super();
    this.quaternion.copy(APEX_UP_QUAT); // sit on a vertex like the cubing.js render
    this.add(buildCore());
    for (let k = 0; k < 4; k++) {
      const tip = buildPyraPiece('tip', k);
      tip.pivot.userData.pyraKind = 'tip'; tip.pivot.userData.pyraVertex = k;
      this.add(tip.pivot); this.tips.push(tip);
      const cor = buildPyraPiece('corner', k);
      cor.pivot.userData.pyraKind = 'corner'; cor.pivot.userData.pyraVertex = k;
      this.add(cor.pivot); this.corners.push(cor);
    }
    for (let i = 0; i < EDGE_PAIRS.length; i++) {
      const [a, b] = EDGE_PAIRS[i];
      const e = buildPyraPiece('edge', a, b);
      e.pivot.userData.pyraKind = 'edge'; e.pivot.userData.pyraEdge = i;
      this.add(e.pivot); this.edges.push(e);
    }
    this.twister = new PyraTwister(this);
  }

  /** Is piece `p` currently in vertex k's turning layer? (Rotate its home centroid by
   *  its pivot, test V_k·c > A/3 — exact, since every reachable pose is a tetra-group
   *  rotation mapping cells onto cells.) */
  private inLayer(p: PyraPiece, k: number): boolean {
    const c = p.center.clone().applyQuaternion(p.pivot.quaternion);
    return this.vdir[k].dot(c) > LAYER_T;
  }

  /** Per-vertex layer membership of one piece, read live — for drag candidate
   *  resolution (tips/corners touch 1 vertex, edges 2). */
  layersOf(kind: 'tip' | 'corner' | 'edge', i: number): boolean[] {
    const p = (kind === 'tip' ? this.tips : kind === 'corner' ? this.corners : this.edges)[i];
    return this.vdir.map((_, k) => this.inLayer(p, k));
  }

  /** Debug: hide vertex 0's whole turning layer (its corner + tip + the 3 edges
   *  currently around it) so the core + neighbors' inner faces show, like lifting one
   *  corner tripod off a real pyraminx. OFF restores everything. */
  setCarve(on: boolean): void {
    if (on) {
      for (const p of this.allPieces) if (this.inLayer(p, 0)) p.pivot.visible = false;
    } else {
      for (const p of this.allPieces) p.pivot.visible = true;
    }
    this.dirty = true;
  }

  private get allPieces(): PyraPiece[] {
    return [...this.tips, ...this.corners, ...this.edges];
  }

  /** Pivots a move rotates, all selected live: tip → the tip currently AT the vertex
   *  (face turns migrate tips); corner layer → everything in the vertex's layer (corner
   *  + tip + 3 edges); face → the complementary far slab (3 corners + 3 tips + 3 edges). */
  private pivotsForMove(move: PyraMove): THREE.Object3D[] {
    const k = move.vertex;
    if (move.part === 'tip') {
      const tip = this.tips.find((t) => this.inLayer(t, k));
      return tip ? [tip.pivot] : [];
    }
    const inside = move.part === 'corner';
    return this.allPieces.filter((p) => this.inLayer(p, k) === inside).map((p) => p.pivot);
  }

  /** Letter-space → physical-space move under the current re-hold (identity at home). */
  private remap(move: PyraMove): PyraMove {
    const phys = this.l2p[move.vertex];
    return phys === move.vertex ? move : { ...move, vertex: phys };
  }

  /** The world-fixed letter currently sitting at physical vertex `phys` — what a drag
   *  on that vertex should record so replay (which re-derives the remap) matches. */
  letterFor(phys: number): number {
    return this.l2p.indexOf(phys);
  }

  /** Fold a rotation into the group's own quaternion (a re-hold: pieces untouched, so
   *  `complete` is rotation-immune) and advance the letter remap in lockstep. */
  private bakeRotation(phys: PyraMove): void {
    const angle = phys.dir * (2 * Math.PI) / 3;
    this.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(this.axes[phys.vertex], angle));
    this.l2p = rotateLetterMap(this.l2p, phys.vertex, phys.dir);
  }

  beginMove(move: PyraMove): PieceAnim[] {
    const phys = this.remap(move);
    const axis = this.axes[phys.vertex];
    const angle = phys.dir * (2 * Math.PI) / 3;
    const delta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    // A rotation animates as every pivot spinning about the local axis — identical in
    // world space to rotating the group — then finishMove swaps it for the real bake.
    const pivots = phys.part === 'rot'
      ? this.allPieces.map((p) => p.pivot)
      : this.pivotsForMove(phys);
    return pivots.map((pivot) => makeAnim(pivot, delta, axis, angle));
  }

  finishMove(anims: PieceAnim[], move: PyraMove): void {
    const phys = this.remap(move);
    if (phys.part === 'rot') {
      for (const a of anims) a.pivot.quaternion.copy(a.startQuat); // undo the spin…
      this.bakeRotation(phys); // …the re-hold rides the group quaternion instead
    } else {
      for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
    }
    this.history.record(pyraMoveToString(move)); // the typed LETTER, not the physical
    this.dirty = true;
    for (const cb of this.callbacks) cb();
  }

  applyMoveInstant(move: PyraMove): void {
    const anims = this.beginMove(move);
    this.finishMove(anims, move);
  }

  applyMoveSilent(move: PyraMove): void {
    const phys = this.remap(move);
    if (phys.part === 'rot') { this.bakeRotation(phys); this.dirty = true; return; }
    for (const a of this.beginMove(move)) a.pivot.quaternion.copy(a.endQuat);
    this.dirty = true;
  }

  applyMovesInstant(moves: PyraMove[]): void {
    this.reset();
    for (const m of moves) this.applyMoveInstant(m);
  }

  reset(): void {
    for (const p of this.allPieces) {
      p.pivot.quaternion.identity();
      p.pivot.position.set(0, 0, 0);
    }
    this.quaternion.copy(APEX_UP_QUAT); // drop any baked re-holds back to the home pose
    this.l2p = [0, 1, 2, 3];
    this.dirty = true;
  }

  get complete(): boolean {
    const IDENT = new THREE.Quaternion();
    return this.allPieces.every((p) => p.pivot.quaternion.angleTo(IDENT) < 0.05);
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
    this.tips.length = 0; this.corners.length = 0; this.edges.length = 0;
  }
}
