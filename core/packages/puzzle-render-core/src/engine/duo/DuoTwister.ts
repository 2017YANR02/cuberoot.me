import { parseDuoMoves, type DuoMove } from '@cuberoot/puzzle-solvers/pyraminx-duo';
import TweenTwister from '../TweenTwister';
import type DuoCube from './DuoCube';

export default class DuoTwister extends TweenTwister<DuoMove> {
  constructor(cube: DuoCube) { super(cube); }
  protected parse(text: string): DuoMove[] { return parseDuoMoves(text); }

  override setup(text: string): void {
    // Validate before finishing a tween or resetting the displayed position.
    // Malformed pasted input must not partly apply or erase the current puzzle.
    parseDuoMoves(text);
    super.setup(text);
  }

  // A tween records its turn on completion. Settle it before the base class
  // chooses which history entry to undo, otherwise the newest turn is missed.
  override undo(): void { this.finish(); super.undo(); }
  override redo(): void { this.finish(); super.redo(); }
}
