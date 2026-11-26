import { AllFaces, CubeData, parseAlgorithm } from '@cuberoot/visualcube';

export const faces = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
type Face = (typeof faces)[number];
type Turn = { face: Face; layer: number; suffix: string };
const opposite: Record<Face, Face> = { U: 'D', D: 'U', F: 'B', B: 'F', L: 'R', R: 'L' };
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export function parseTurns(text: string, n: number): Turn[] | null {
  const turns: Turn[] = [];
  for (const token of text.replaceAll('′', "'").replaceAll('’', "'").trim().split(/\s+/).filter(Boolean)) {
    const match = /^([1-9]\d*)?([URFDLB])(2|')?$/.exec(token);
    if (!match) return null;
    const layer = Number(match[1] ?? 1);
    if (layer > n) return null;
    turns.push({ face: match[2] as Face, layer, suffix: match[3] ?? '' });
  }
  return turns;
}

export function notation(turns: Turn[]) {
  return turns.map(({ face, layer, suffix }) => (layer === 1 ? '' : layer) + face + suffix).join(' ');
}

function colours(n: number, turns: Turn[]): number[][] {
  const cube = new CubeData(n, Object.fromEntries(AllFaces.map(f => [f, Array(n * n).fill(f)])));
  // Use the nearer face for the sticker engine, including an outer turn named from the far side.
  const near = turns.map(move => {
    const other = n + 1 - move.layer;
    if (other >= move.layer) return move;
    return { face: opposite[move.face], layer: other, suffix: move.suffix === '2' ? '2' : move.suffix ? '' : "'" };
  });
  for (const turn of parseAlgorithm(notation(near))) cube.turn(turn);
  return AllFaces.map(f => cube.faces[f]);
}

// Swapping a depth exchanges its two mirror layers on all axes. The index map
// commutes with reversal, so the same row/column test works on every oriented face.
function twins(n: number, grid: number[][], a: number, b: number) {
  const swap = range(n);
  for (const [i, j] of [[a, b], [n - 1 - a, n - 1 - b]]) [swap[i], swap[j]] = [j, i];
  return grid.every(face => face.every((colour, i) =>
    colour === face[swap[Math.floor(i / n)] * n + swap[i % n]]));
}

export function reduce(n: number, k: number, turns: Turn[]) {
  const original = colours(n, turns);
  const depths = range(Math.floor((n - 2) / 2)).map(i => i + 1);
  let group: number[] = [];
  let largest = 0;
  let kept = range(n);
  if (depths.length > 2 * k + 2) {
    const seen = new Set<number>();
    for (const a of depths) {
      if (seen.has(a)) continue;
      const members = depths.filter(b => a === b || twins(n, original, a, b));
      members.forEach(b => seen.add(b));
      largest = Math.max(largest, members.length);
      if (depths.length - members.length <= k) {
        group = members;
        break;
      }
    }
    if (!group.length) return { original, depths, largest, small: null };
    const removed = new Set(group.slice(k + 2));
    kept = kept.filter(i => !removed.has(Math.min(i, n - 1 - i)));
  }
  const projected = turns.flatMap(turn => {
    // kept is mirror-symmetric, so the rank is also valid counting from the named face.
    const layer = kept.indexOf(turn.layer - 1) + 1;
    return layer ? [{ ...turn, layer }] : [];
  });
  const restricted = original.map(face => kept.flatMap(row => kept.map(col => face[row * n + col])));
  const replay = colours(kept.length, projected);
  let matched = 0;
  restricted.forEach((face, f) => face.forEach((colour, i) => { if (colour === replay[f][i]) matched++; }));
  return { original, depths, largest, small: { kept, group, restricted, projected, matched } };
}
