/** Named cubing.js loaders used by the simulator and its world-less controls.
 * Keep the loader identity: Kilominx's loader also masks non-corner orbits, so
 * replacing it with its raw PuzzleGeometry description changes the puzzle.
 */
export const TWISTY_PUZZLES = ['pyraminx', 'skewb', 'megaminx', 'fto', 'kilominx'] as const;

export type TwistyPuzzle = typeof TWISTY_PUZZLES[number];

export function isTwistyPuzzle(puzzle: unknown): puzzle is TwistyPuzzle {
  return TWISTY_PUZZLES.some((kind) => kind === puzzle);
}
