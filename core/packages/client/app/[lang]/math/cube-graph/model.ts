import { AllFaces, CubeData, parseAlgorithm } from '@cuberoot/visualcube';

export type Point = { x: number; y: number };
export const RINGS = [
  { x: 145, y: 258 }, { x: 220, y: 128 }, { x: 295, y: 258 },
].flatMap((center, axis) => [112, 136, 160].map((r, layer) => ({ ...center, r, axis, layer })));

// URFDLB row-major face coordinates, identical to the shared facelet convention.
function coordinates(face: number, row: number, col: number): number[] {
  return [
    [col - 1, 1, row - 1], [1, 1 - row, 1 - col],
    [col - 1, 1 - row, 1], [col - 1, -1, 1 - row],
    [-1, 1 - row, col - 1], [1 - col, 1 - row, -1],
  ][face];
}

export const GRAPH_SLOTS = Array.from({ length: 54 }, (_, index) => {
  const face = Math.floor(index / 9);
  const row = Math.floor(index % 9 / 3), col = index % 3;
  const normal = [1, 0, 2, 1, 0, 2][face];
  const xyz = coordinates(face, row, col);
  const axes = [0, 1, 2].filter(axis => axis !== normal);
  const rings = axes.map(axis => axis * 3 + xyz[axis] + 1);
  const a = RINGS[rings[0]], b = RINGS[rings[1]];
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  const along = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
  const height = Math.sqrt(a.r * a.r - along * along);
  const middle = { x: a.x + dx * along / d, y: a.y + dy * along / d };
  const points = [-1, 1].map(sign => ({ x: middle.x - sign * dy * height / d, y: middle.y + sign * dx * height / d }));
  const third = RINGS[normal * 3 + 1];
  points.sort((p, q) => Math.hypot(p.x - third.x, p.y - third.y) - Math.hypot(q.x - third.x, q.y - third.y));
  return { ...points[face < 3 ? 0 : 1], rings, face, row, col };
});

/** Slot -> original sticker identity; colors alone lose same-color motion. */
export function stickerPermutation(moves: readonly string[]): number[] {
  const initial = Object.fromEntries(AllFaces.map((face, i) => [face, Array.from({ length: 9 }, (_, k) => i * 9 + k)]));
  const cube = new CubeData(3, initial);
  for (const move of parseAlgorithm(moves.join(' '))) cube.turn(move);
  return AllFaces.flatMap(face => cube.faces[face] as number[]);
}

/** Adjacent-face stickers follow their common layer circle; face stickers cross rings. */
export function graphPosition(from: number, to: number, progress: number): Point {
  const a = GRAPH_SLOTS[from], b = GRAPH_SLOTS[to];
  const ringId = a.rings.find(ring => b.rings.includes(ring));
  if (ringId === undefined || from === to) return { x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress };
  const ring = RINGS[ringId];
  const start = Math.atan2(a.y - ring.y, a.x - ring.x);
  let delta = Math.atan2(b.y - ring.y, b.x - ring.x) - start;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  return { x: ring.x + ring.r * Math.cos(start + delta * progress), y: ring.y + ring.r * Math.sin(start + delta * progress) };
}

/** A bijective face/row/column drawing, not an additional cube model. */
export function sectorPath(face: number, row: number, col: number): string {
  const a = -Math.PI / 2 + face * Math.PI / 3 + col * Math.PI / 9 + 0.016;
  const b = a + Math.PI / 9 - 0.032;
  const inner = 38 + row * 43, outer = inner + 40;
  const p = (r: number, angle: number) => `${220 + r * Math.cos(angle)},${220 + r * Math.sin(angle)}`;
  return `M ${p(inner, a)} L ${p(outer, a)} A ${outer},${outer} 0 0 1 ${p(outer, b)} L ${p(inner, b)} A ${inner},${inner} 0 0 0 ${p(inner, a)} Z`;
}
