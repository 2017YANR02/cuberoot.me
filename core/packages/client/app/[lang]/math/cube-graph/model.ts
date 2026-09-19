import { AllFaces, CubeData, parseAlgorithm } from '@cuberoot/visualcube';
import { tokenizeMoves } from '@cuberoot/shared/alg-notation';

/** Keep input within the move set shared by the sticker and 3D renderers. */
export function parseGraphMoves(text: string): string[] | null {
  if (text.length > 10000) return null;
  const { moves, junk } = tokenizeMoves(text.replace(/[’′]/g, "'"));
  if (junk.length || moves.length > 500 || moves.some(move => move.layer
    || !['U', 'R', 'F', 'D', 'L', 'B', 'M', 'E', 'S', 'x', 'y', 'z', 'u', 'r', 'f', 'd', 'l', 'b', 'Uw', 'Rw', 'Fw', 'Dw', 'Lw', 'Bw'].includes(move.family)
    || ![1, 2].includes(Math.abs(move.amount)))) return null;
  return moves.map(move => move.raw);
}

/** Forward cycles: a sticker in cycle[i] moves to cycle[i + 1]. */
export function turnCycles(face: string): number[][] {
  const destinations = new Array<number>(54);
  stickerPermutation([face]).forEach((id, slot) => { destinations[id] = slot; });
  const seen = new Set<number>();
  const cycles: number[][] = [];
  destinations.forEach((to, from) => {
    if (to === from || seen.has(from)) return;
    const cycle: number[] = [];
    let slot = from;
    do { seen.add(slot); cycle.push(slot); slot = destinations[slot]; } while (slot !== from);
    cycles.push(cycle);
  });
  return cycles;
}

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
export function graphPosition(from: number, to: number, progress: number, origin: Point = GRAPH_SLOTS[from]): Point {
  const a = origin, b = GRAPH_SLOTS[to];
  if (progress <= 0) return { x: a.x, y: a.y };
  if (progress >= 1) return { x: b.x, y: b.y };
  // An interrupted turn may still be between slots. Only follow a circle when
  // the displayed point actually lies on it; otherwise connect from that point.
  const ringId = GRAPH_SLOTS[from].rings.find(id => b.rings.includes(id)
    && Math.abs(Math.hypot(a.x - RINGS[id].x, a.y - RINGS[id].y) - RINGS[id].r) < 1e-7);
  if (ringId === undefined) return { x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress };
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
  // Stable SVG serialization across server and browser Math implementations.
  const p = (r: number, angle: number) => `${(220 + r * Math.cos(angle)).toFixed(3)},${(220 + r * Math.sin(angle)).toFixed(3)}`;
  return `M ${p(inner, a)} L ${p(outer, a)} A ${outer},${outer} 0 0 1 ${p(outer, b)} L ${p(inner, b)} A ${inner},${inner} 0 0 0 ${p(inner, a)} Z`;
}
