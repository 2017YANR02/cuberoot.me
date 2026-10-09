import TweenTwister from '../TweenTwister';
import type GhostCube from './GhostCube';
import type { GhostPose } from './ghostState';
import { applyGhostMove, ghostSelection, parseGhostMoves, solvedGhostPose, type GhostMove } from './ghostState';

export default class GhostTwister extends TweenTwister<GhostMove> {
  declare cube: GhostCube;
  private activeEnd: GhostPose = [];
  protected parse(text: string): GhostMove[] { return parseGhostMoves(text); }
  protected override beginAnims(move: GhostMove) {
    const pose = this.cube.pose.map(q => q.clone());
    applyGhostMove(pose, move);
    this.activeEnd = pose;
    return super.beginAnims(move);
  }
  private queuedEnd() {
    const pose = (this.activeTween ? this.activeEnd : this.cube.pose).map(q => q.clone());
    for (const move of this.queue) applyGhostMove(pose, move);
    return pose;
  }
  /** Validate before touching the scene: malformed/blocked setup is transactional. */
  override setup(text: string): void {
    const pose = solvedGhostPose();
    for (const move of this.parse(text)) applyGhostMove(pose, move);
    super.setup(text);
  }
  override push(text: string): void {
    const moves = this.parse(text);
    const pose = this.queuedEnd();
    for (const move of moves) applyGhostMove(pose, move);
    super.push(text);
  }
  override twist(move: GhostMove, fast: boolean, force: boolean): boolean {
    if (!force && this.busy) return false;
    if (!ghostSelection(force ? this.queuedEnd() : this.cube.pose, move)) return false;
    if (force) this.finish();
    return super.twist(move, fast, false);
  }
  override undo(): void { this.finish(); super.undo(); }
  override redo(): void { this.finish(); super.redo(); }
}
