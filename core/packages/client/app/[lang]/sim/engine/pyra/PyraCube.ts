/**
 * PyraCube — three.js Group rendering a Pyraminx (vertex-turning tetrahedron).
 *
 * 14 pivots at the origin (4 tips + 4 corners + 6 edges); a turn left-multiplies
 * R(vertexAxis, ±120°) into the affected pivots' quaternions (position fixed at the
 * origin). Tips and corners are permanently bound to their vertex; a big turn also
 * carries the 3 edges currently in that vertex's layer, found live from the geometry
 * (rotate each edge's home centroid by its pivot, test V_k·c > A/3). No discrete
 * permutation state — `complete` is "every pivot is back at identity", which is exact
 * because each piece's geometry is baked in home coords and turns are pure SO(3).
 */
import * as THREE from 'three';
import MoveHistory from '../MoveHistory';
import { makeAnim, type PieceAnim } from '../pieceAnim';
import type { TweenCube } from '../TweenTwister';
import {
  buildPyraPiece, buildCore, VDIR, EDGE_PAIRS, PYRA_A, APEX_UP_QUAT, vertexAxis,
} from './pyraGeometry';
import { type PyraMove, pyraMoveToString } from './pyraState';
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

  /** The 2 vertices edge `i` currently touches (its layer membership) — for drag
   *  candidate resolution. Read live from the rotated centroid. */
  edgeVertices(i: number): number[] {
    const c = this.edges[i].center.clone().applyQuaternion(this.edges[i].pivot.quaternion);
    return [0, 1, 2, 3].filter((k) => this.vdir[k].dot(c) > LAYER_T);
  }

  /** Debug: hide vertex 0's whole turning layer (its corner + tip + the 3 edges
   *  currently around it) so the core + neighbors' inner faces show, like lifting one
   *  corner tripod off a real pyraminx. OFF restores everything. */
  setCarve(on: boolean): void {
    if (on) {
      this.corners[0].pivot.visible = false;
      this.tips[0].pivot.visible = false;
      const n = this.vdir[0];
      for (const e of this.edges) {
        const c = e.center.clone().applyQuaternion(e.pivot.quaternion);
        if (n.dot(c) > LAYER_T) e.pivot.visible = false;
      }
    } else {
      for (const p of this.allPieces) p.pivot.visible = true;
    }
    this.dirty = true;
  }

  private get allPieces(): PyraPiece[] {
    return [...this.tips, ...this.corners, ...this.edges];
  }

  /** Pivots a move rotates: tip-only → the tip; big → corner + tip + the 3 edges
   *  currently in the vertex's layer (read live from each edge's rotated centroid). */
  private pivotsForMove(move: PyraMove): THREE.Object3D[] {
    const k = move.vertex;
    if (move.tip) return [this.tips[k].pivot];
    const out = [this.corners[k].pivot, this.tips[k].pivot];
    const n = this.vdir[k];
    for (const e of this.edges) {
      const c = e.center.clone().applyQuaternion(e.pivot.quaternion);
      if (n.dot(c) > LAYER_T) out.push(e.pivot);
    }
    return out;
  }

  beginMove(move: PyraMove): PieceAnim[] {
    const axis = this.axes[move.vertex];
    const angle = move.dir * (2 * Math.PI) / 3;
    const delta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    return this.pivotsForMove(move).map((pivot) => makeAnim(pivot, delta, axis, angle));
  }

  finishMove(anims: PieceAnim[], move: PyraMove): void {
    for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
    this.history.record(pyraMoveToString(move));
    this.dirty = true;
    for (const cb of this.callbacks) cb();
  }

  applyMoveInstant(move: PyraMove): void {
    const anims = this.beginMove(move);
    this.finishMove(anims, move);
  }

  applyMoveSilent(move: PyraMove): void {
    const anims = this.beginMove(move);
    for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
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
