/**
 * String-move history shared by the non-NxN cuber engines (Ivy / Dino / Redi /
 * SQ1). `moves` is the user's recorded turn list, `init` the scramble it started
 * from, `redoStack` the undone tail. Undo/redo replay `init + moves` silently.
 *
 * Distinct from the NxN `history.ts` (TwistAction-based, with same-face turn
 * merging + an `exp` string) — these puzzles keep raw per-move strings.
 */
export default class MoveHistory {
  moves: string[] = [];
  redoStack: string[] = [];
  init = '';
  get length(): number { return this.moves.length; }
  clear(): void { this.moves.length = 0; this.redoStack.length = 0; }
  record(move: string): void { this.moves.push(move); this.redoStack.length = 0; }
}
