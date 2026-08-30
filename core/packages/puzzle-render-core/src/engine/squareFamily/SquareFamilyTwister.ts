import TweenTwister from '../TweenTwister';
import type { PieceAnim } from '../pieceAnim';
import type SquareFamilyCube from './SquareFamilyCube';
import {
  parseSquareFamilyMoves,
  tryParseSquareFamilyMoves,
  type SquareFamilyMove,
} from './squareFamilyState';

export default class SquareFamilyTwister extends TweenTwister<SquareFamilyMove> {
  declare cube: SquareFamilyCube;
  private nextSliceDir?: 1 | -1;

  constructor(cube: SquareFamilyCube) {
    super(cube);
  }

  protected parse(scramble: string): SquareFamilyMove[] {
    return parseSquareFamilyMoves(scramble, this.cube.spec);
  }

  /** Invalid live input is a no-op: never replace the last legal cube state. */
  setup(scramble: string): void {
    if (tryParseSquareFamilyMoves(scramble, this.cube.spec) === null) return;
    super.setup(scramble);
  }

  /** Do not enqueue a valid prefix when the full formula is malformed. */
  push(scramble: string): void {
    if (tryParseSquareFamilyMoves(scramble, this.cube.spec) === null) return;
    super.push(scramble);
  }

  protected beginAnims(move: SquareFamilyMove): PieceAnim[] {
    let direction: 1 | -1 = 1;
    if (this.nextSliceDir !== undefined) direction = this.nextSliceDir;
    else if (move.kind === 'slice') direction = this.cube.state.sliceSolved ? -1 : 1;
    this.nextSliceDir = undefined;
    return this.cube.beginMove(move, direction);
  }

  twist(move: SquareFamilyMove, fast: boolean, force: boolean, sliceDir?: 1 | -1): boolean {
    this.nextSliceDir = sliceDir;
    const started = super.twist(move, fast, force);
    this.nextSliceDir = undefined;
    return started;
  }
}
