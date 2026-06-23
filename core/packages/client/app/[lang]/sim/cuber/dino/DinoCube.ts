/**
 * DinoCube — three.js Group rendering a Dino Cube (corner-turning, 12 edge pieces).
 *
 * Each of the 12 edge pieces is a pivot at the origin; its quaternion is the truth
 * for "where this piece is now". A twist about corner c rotates the 3 pivots of
 * that corner by ±120° about the corner's body diagonal (through the origin) — so
 * position stays at the origin and only the quaternion changes (pure SO(3), no
 * decompose ambiguity). A separate discrete permutation (`perm[slot]=pieceId`)
 * tracks identity for `complete` + history.
 *
 * Mirrors the Sq1Cube contract (beginMove / finishMove / applyMoveInstant /
 * applyMovesInstant / reset / complete / dispose) so the shared PlayerControls +
 * twister wiring drives it the same way.
 */
import * as THREE from 'three';
import {
  buildPieceMesh, buildCore, cornerAxis,
} from './dinoGeometry';
import {
  type DinoMove, CORNER_AXIS, CORNER_CYCLE,
  solvedDino, applyDinoMove, isSolved, dinoMoveToString,
} from './dinoState';
import DinoTwister from './DinoTwister';

export interface PieceEntry {
  /** Stable piece id (= its solved slot). */
  pieceId: number;
  pivot: THREE.Object3D;
  group: THREE.Group;
}

/** One piece's animation plan for a single move (axis-angle, like Sq1). */
export interface PieceAnim {
  pivot: THREE.Object3D;
  startQuat: THREE.Quaternion;
  endQuat: THREE.Quaternion;
  axis: THREE.Vector3;
  angle: number;
}

export class DinoHistory {
  moves: string[] = [];
  redoStack: string[] = [];
  init = '';
  get length(): number { return this.moves.length; }
  clear(): void { this.moves.length = 0; this.redoStack.length = 0; }
  record(move: string): void { this.moves.push(move); this.redoStack.length = 0; }
}

/** Precomputed unit axis (THREE.Vector3) per corner. */
const AXES: THREE.Vector3[] = CORNER_AXIS.map(([x, y, z]) => cornerAxis(x, y, z));

export default class DinoCube extends THREE.Group {
  pieces: PieceEntry[] = [];
  /** perm[slot] = pieceId currently in that slot. */
  perm: number[] = solvedDino();
  callbacks: (() => void)[] = [];
  dirty = true;
  readonly puzzleType = 'dino' as const;
  order = 0;
  history = new DinoHistory();
  twister: DinoTwister;

  constructor() {
    super();
    this.add(buildCore());
    for (let slot = 0; slot < 12; slot++) {
      const { pivot, group } = buildPieceMesh(slot);
      this.add(pivot);
      this.pieces.push({ pieceId: slot, pivot, group });
    }
    this.applyStateInstant(solvedDino());
    this.twister = new DinoTwister(this);
  }

  /** pieceId → its PieceEntry (pieces never change array index). */
  private pieceById(id: number): PieceEntry {
    return this.pieces[id];
  }

  /**
   * Snap every piece pivot to the orientation implied by the discrete permutation.
   * We can't read an absolute orientation from a slot alone (a piece could be in
   * its home slot but rotated by a full move chain) — but for a *canonical* state
   * snapshot (reset / scramble setup) the only thing that matters is that the
   * visible stickers land in the right slots. Since a Dino edge has no flip DOF,
   * the piece whose id sits in slot s must show home-slot-s's coloring; we realize
   * that by computing the rotation that carries piece `id`'s home pose to slot `s`.
   *
   * The home pose of every piece is identity. The rotation slot(id)→slot(s) is the
   * product of corner rotations along any path, but the simplest canonical choice:
   * for each slot we precompute the orientation as identity and instead drive state
   * purely through applyMoveInstant from solved. So applyStateInstant only handles
   * the solved state (identity for all); non-solved states are reached by replaying
   * moves (see applyMovesInstant). This keeps orientations exact.
   */
  applyStateInstant(perm: number[]): void {
    this.perm = perm.slice();
    for (const p of this.pieces) {
      p.pivot.quaternion.identity();
      p.pivot.position.set(0, 0, 0);
    }
    this.dirty = true;
  }

  reset(): void {
    this.applyStateInstant(solvedDino());
  }

  /**
   * Animation plan for a move: the 3 pivots whose pieceId currently sits in the
   * corner's 3 slots rotate by ±120° about the corner axis.
   */
  beginMove(move: DinoMove): PieceAnim[] {
    const axis = AXES[move.corner];
    const angle = move.dir * (2 * Math.PI / 3);
    const delta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    const slots = CORNER_CYCLE[move.corner];
    const anims: PieceAnim[] = [];
    for (const slot of slots) {
      const pieceId = this.perm[slot];
      const entry = this.pieceById(pieceId);
      anims.push(this._makeAnim(entry.pivot, delta, axis, angle));
    }
    return anims;
  }

  /** Snap pivots to end pose, update discrete state, record history. */
  finishMove(anims: PieceAnim[], move: DinoMove): void {
    for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
    this.perm = applyDinoMove(this.perm, move);
    this.history.record(dinoMoveToString(move));
    this.dirty = true;
    for (const cb of this.callbacks) cb();
  }

  applyMoveInstant(move: DinoMove): void {
    const anims = this.beginMove(move);
    this.finishMove(anims, move);
  }

  applyMovesInstant(moves: DinoMove[]): void {
    this.applyStateInstant(solvedDino());
    for (const move of moves) this.applyMoveInstant(move);
  }

  get complete(): boolean {
    return isSolved(this.perm);
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
    this.pieces.length = 0;
    this.callbacks.length = 0;
  }

  private _makeAnim(
    pivot: THREE.Object3D, delta: THREE.Quaternion,
    axis: THREE.Vector3, angle: number,
  ): PieceAnim {
    const startQuat = pivot.quaternion.clone();
    const endQuat = delta.clone().multiply(startQuat);
    return { pivot, startQuat, endQuat, axis, angle };
  }
}
