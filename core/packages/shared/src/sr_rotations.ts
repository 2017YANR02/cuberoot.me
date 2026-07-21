/**
 * View-rotation parsing shared by both renderers of the exotic-puzzle image
 * panel: the client (puzzle-image codec + PuzzleImage) and the server
 * (sr_render). One source so the `r=` grammar and the sq1/pyraminx y→z rule
 * can't drift between the two.
 */

/** Parse the `r=y30x-30` view-rotation URL param into ordered {axis, angle}
 *  pairs. Only x/y axes are encodable (z is implicit / promoted per puzzle). */
export function parseViewRotations(r: string | undefined): { axis: string; angle: number }[] {
  if (!r) return [];
  return [...r.matchAll(/([xy])(-?\d{1,3})/g)].map((m) => ({
    axis: m[1],
    angle: parseInt(m[2], 10),
  }));
}

/** sr-puzzlegen axis naming: sq1 and pyraminx spin about z where the editor
 *  says y (bird's-eye top layer / apex-up kite). Mapping y→z lets the explicit
 *  rotation reproduce sr's default view and track continuously off it; every
 *  other puzzle keeps y as the vertical axis. */
export function srPromoteAxis(puzzle: string, axis: string): string {
  return (puzzle === 'sq1' || puzzle === 'pyraminx') && axis === 'y' ? 'z' : axis;
}
