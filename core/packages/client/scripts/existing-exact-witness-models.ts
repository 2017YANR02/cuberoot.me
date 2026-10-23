/** Independent short-sequence witness models; no tables or enumeration. */
import assert from "node:assert/strict";
const tokens = (algorithm: string): string[] => algorithm.trim().split(/\s+/).filter(Boolean);
// Adapted from ivy_solver.test.ts: direct center cycles and corner twists, no solver tables.
export function replayIvy(algorithm: string): unknown {
  const centers = [0, 1, 2, 3, 4, 5], corners = [0, 0, 0, 0];
  const cycles = [[0, 3, 1], [0, 2, 4], [1, 5, 2], [3, 4, 5]];
  for (const token of tokens(algorithm)) {
    assert(/^[RLDB]'?$/.test(token));
    const axis = 'RLDB'.indexOf(token[0]), turns = token.endsWith("'") ? 1 : 2;
    const [a, b, c] = cycles[axis];
    for (let turn = 0; turn < turns; turn++) {
      [centers[a], centers[b], centers[c]] = [centers[c], centers[a], centers[b]];
      corners[axis] = (corners[axis] + 1) % 3;
    }
  }
  return { centers, corners };
}
// Adapted from cuboid223_solver.test.ts: direct piece cycles, no rank or move tables.
export function replay223(algorithm: string): unknown {
  const corners = [0, 1, 2, 3, 4, 5, 6, 7], mids = [0, 1, 2];
  const cycle = (array: number[], indices: number[]) => {
    const old = indices.map(index => array[index]);
    indices.forEach((index, i) => { array[index] = old[(i + old.length - 1) % old.length]; });
  };
  for (const token of tokens(algorithm)) {
    assert(/^(?:[UD](?:2|')?|[RF]2)$/.test(token));
    const turns = token[0] === 'R' || token[0] === 'F' ? 1 : token.endsWith('2') ? 2 : token.endsWith("'") ? 3 : 1;
    for (let turn = 0; turn < turns; turn++) {
      if (token[0] === 'U') cycle(corners, [0, 1, 2, 3]);
      else if (token[0] === 'D') cycle(corners, [4, 5, 6, 7]);
      else if (token[0] === 'R') { cycle(corners, [2, 5]); cycle(corners, [3, 6]); cycle(mids, [0, 1]); }
      else { cycle(corners, [0, 5]); cycle(corners, [3, 4]); cycle(mids, [0, 2]); }
    }
  }
  return { corners, mids };
}
// Adapted from superfloppy_solver.test.ts: actual 3D positions, no production CORNER_PERM.
export function replaySuperFloppy(algorithm: string): unknown {
  type Point = [number, number, number];
  const slots: Point[] = [[1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0], [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1], [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1]];
  const pieces: Point[] = slots.slice(0, 4).map(point => [...point]);
  const edges = [0, 0, 0, 0];
  for (const token of tokens(algorithm)) {
    assert(/^[RLUD](?:2|')?$/.test(token));
    const face = 'RLUD'.indexOf(token[0]), axis = face < 2 ? 0 : 1;
    const side = face % 2 === 0 ? 1 : -1, power = token.endsWith('2') ? 2 : token.endsWith("'") ? 3 : 1;
    for (let turn = 0; turn < power; turn++) {
      for (let i = 0; i < pieces.length; i++) {
        if (pieces[i][axis] !== side) continue;
        for (let step = 0; step < (side === 1 ? 1 : 3); step++) {
          const [x, y, z] = pieces[i];
          pieces[i] = axis === 0 ? [x, -z, y] : [z, y, -x];
        }
      }
      edges[face] = (edges[face] + 1) % 4;
    }
  }
  const corners = new Array<number>(12).fill(-1);
  pieces.forEach((point, piece) => {
    const index = slots.findIndex(slot => slot.every((value, axis) => value === point[axis]));
    assert(index >= 0 && corners[index] === -1); corners[index] = piece;
  });
  return { corners, edges };
}
