/**
 * CornerTurnCube — shared base for the body-diagonal corner-turning puzzles
 * (Dino, Redi). Both rotate a set of piece pivots by ±120° about a corner's outward
 * body diagonal: position stays at the origin, only the quaternion changes (pure
 * SO(3), no decompose ambiguity), with a separate discrete state tracking identity
 * for `complete` + history. The animation/state machinery (beginMove / finishMove /
 * applyMove{Instant,Silent} / applyMovesInstant / dispose) is identical between them
 * and lives here; subclasses only supply the geometry, the discrete state, and three
 * small hooks: which pivots a move rotates, how the discrete state advances, and the
 * move's canonical token.
 *
 * Conforms to TweenCube<TMove> so the shared TweenTwister drives it.
 */
import * as THREE from 'three';
import MoveHistory from './MoveHistory';
import { makeAnim, type PieceAnim } from './pieceAnim';
import type { TweenCube } from './TweenTwister';

const TWIST_ANGLE = (2 * Math.PI) / 3;

/** Move shape both corner-turners use (DinoMove / RediMove are structurally this). */
export interface CornerMoveShape {
  corner: number;
  dir: 1 | -1;
}

export default abstract class CornerTurnCube<TMove extends CornerMoveShape>
  extends THREE.Group
  implements TweenCube<TMove>
{
  callbacks: (() => void)[] = [];
  dirty = true;
  order = 0;
  history = new MoveHistory();

  /** Unit twist axis per corner, built once from the subclass's CORNER_AXIS table
   *  (corner index → outward body diagonal). */
  protected readonly axes: THREE.Vector3[];

  protected constructor(cornerAxis: ReadonlyArray<readonly [number, number, number]>) {
    super();
    this.axes = cornerAxis.map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
  }

  /** The pivots a move rotates: the edge pivots currently in the corner's cycle
   *  (plus, for Redi, the corner's own pivot). Read off the LIVE discrete state. */
  protected abstract pivotsForMove(move: TMove): THREE.Object3D[];
  /** Advance the discrete state (Dino: edge perm; Redi: edge perm + corner orients)
   *  by one move, mutating in place. */
  protected abstract advanceState(move: TMove): void;
  /** Canonical token for the history record. */
  protected abstract moveToString(move: TMove): string;
  /** Snap the discrete state + every pivot back to solved. */
  abstract reset(): void;
  abstract get complete(): boolean;

  /** Animation plan: the move's pivots rotate by ±120° about the corner axis. */
  beginMove(move: TMove): PieceAnim[] {
    const axis = this.axes[move.corner];
    const angle = move.dir * TWIST_ANGLE;
    const delta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    return this.pivotsForMove(move).map((pivot) => makeAnim(pivot, delta, axis, angle));
  }

  /** Snap pivots to end pose, advance discrete state, record history. */
  finishMove(anims: PieceAnim[], move: TMove): void {
    for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
    this.advanceState(move);
    this.history.record(this.moveToString(move));
    this.dirty = true;
    for (const cb of this.callbacks) cb();
  }

  applyMoveInstant(move: TMove): void {
    const anims = this.beginMove(move);
    this.finishMove(anims, move);
  }

  applyMovesInstant(moves: TMove[]): void {
    this.reset();
    for (const move of moves) this.applyMoveInstant(move);
  }

  /** Snap a move into place without recording history (undo/redo replay). */
  applyMoveSilent(move: TMove): void {
    const anims = this.beginMove(move);
    for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
    this.advanceState(move);
    this.dirty = true;
  }

  /** Dispose all mesh geometry/materials + drop callbacks. Subclasses override to
   *  also clear their piece arrays (call super.dispose() first). */
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
