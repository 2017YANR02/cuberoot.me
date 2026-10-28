export type Vector = readonly [number, number, number];
export interface GeometricMove { token: string; corner: number; angle: number }
export interface StickerState { centers: number[]; cornerColors: Array<Array<number | null>> }

// Independent geometric oracle: no imported axes, face cycles, or move tables.
// Face f is opposite vertex f, so its outward normal is -vertex[f]. A bare
// move is clockwise when looking inward along that corner's outward axis.
export const VERTICES: readonly Vector[] = [
  [1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1],
];
export const NORMALS: Vector[] = VERTICES.map(([x, y, z]) => [-x, -y, -z]);
export const MOVES: GeometricMove[] = ['U', 'L', 'R', 'B'].flatMap((name, corner) => [
  { token: name, corner, angle: -2 * Math.PI / 3 },
  { token: `${name}'`, corner, angle: 2 * Math.PI / 3 },
]);

export function rodrigues(vector: Vector, axis: Vector, angle: number): Vector {
  const norm = Math.hypot(...axis);
  const [x, y, z] = axis.map(value => value / norm);
  const [vx, vy, vz] = vector;
  const dot = x * vx + y * vy + z * vz;
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  return [
    vx * cosine + (y * vz - z * vy) * sine + x * dot * (1 - cosine),
    vy * cosine + (z * vx - x * vz) * sine + y * dot * (1 - cosine),
    vz * cosine + (x * vy - y * vx) * sine + z * dot * (1 - cosine),
  ];
}

export function rotatedFace(face: number, move: GeometricMove): number {
  const normal = rodrigues(NORMALS[face], VERTICES[move.corner], move.angle);
  const destination = NORMALS.findIndex(candidate =>
    candidate.every((component, index) => Math.abs(component - normal[index]) < 1e-9));
  if (destination === -1) throw new Error('Geometric rotation did not land on a tetrahedron face');
  return destination;
}

export function referenceSolved(): StickerState {
  return {
    centers: [0, 1, 2, 3],
    cornerColors: VERTICES.map((_, corner) => VERTICES.map((_, face) => face === corner ? null : face)),
  };
}

export function referenceMove(state: StickerState, move: GeometricMove): StickerState {
  if (!Number.isInteger(move.corner) || move.corner < 0 || move.corner >= 4) throw new Error('Invalid corner index');
  const next = { centers: state.centers.slice(), cornerColors: state.cornerColors.map(colors => colors.slice()) };
  for (let face = 0; face < 4; face++) {
    const destination = rotatedFace(face, move);
    next.centers[destination] = state.centers[face];
    if (face !== move.corner) next.cornerColors[move.corner][destination] = state.cornerColors[move.corner][face];
  }
  return next;
}

export function referenceTokens(text: string): GeometricMove[] {
  return text.trim().split(/\s+/).filter(Boolean).map(token => {
    const move = MOVES.find(candidate => candidate.token === token);
    if (!move) throw new Error(`Invalid reference move: ${token}`);
    return move;
  });
}

export function referenceApply(text: string): StickerState {
  return referenceTokens(text).reduce(referenceMove, referenceSolved());
}

export function referenceTwists(state: StickerState): number[] {
  return state.cornerColors.map((colors, corner) => {
    // Recover orientation from a coloured sticker's geometric destination,
    // rather than repeating the implementation's modular twist arithmetic.
    const homeFace = (corner + 1) % 4;
    const destinations = [homeFace, rotatedFace(homeFace, MOVES[corner * 2]), rotatedFace(homeFace, MOVES[corner * 2 + 1])];
    const twist = destinations.indexOf(colors.indexOf(homeFace));
    if (twist === -1) throw new Error('Invalid geometric corner orientation');
    return twist;
  });
}
