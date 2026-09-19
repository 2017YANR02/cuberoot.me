import { AllFaces, CubeData, parseAlgorithm } from '@cuberoot/visualcube';
import { tokenizeMoves, type ParsedMove } from '@cuberoot/shared/alg-notation';
import { NXN_ORDER_MIN } from '@/lib/nxn-order';

export const GRAPH_ORDER_MAX = 7;
const validOrder = (n: number) => Number.isInteger(n) && n >= NXN_ORDER_MIN && n <= GRAPH_ORDER_MAX;

/** Validate before either renderer receives a move; never silently clamp layers. */
export function parseGraphMoves(text: string, order = 3): string[] | null {
  if (!validOrder(order) || text.length > 10000) return null;
  const { moves, junk } = tokenizeMoves(text.replace(/[’′]/g, "'"));
  if (junk.length || moves.length > 500 || moves.some(move => {
    if (![1, 2].includes(Math.abs(move.amount))) return true;
    if (/^[xyz]$/.test(move.family)) return !!move.layer;
    if (/^[MESmes]$/.test(move.family)) return !!move.layer || order < 3 || (/^[MES]$/.test(move.family) && order % 2 === 0);
    if (!/^(?:[URFDLB]w?|[urfdlb])$/.test(move.family)) return true;
    const wide = move.family.length === 2 || move.family === move.family.toLowerCase();
    const bounds = move.layer?.split('-').map(Number) ?? [wide ? 2 : 1];
    return bounds.some(n => !Number.isInteger(n) || n < 1 || n > order)
      || (bounds.length === 2 && bounds[0] > bounds[1]);
  })) return null;
  return moves.map(move => move.raw);
}

const suffix = (amount: number) => Math.abs(amount) === 2 ? '2' : amount < 0 ? "'" : '';

/** Adapt layer notation to VisualCube's outer blocks, preserving both end faces. */
function visualMoves(move: ParsedMove, order: number): string[] {
  const { family, amount } = move;
  if (/^[xyz]$/.test(family)) return [family + suffix(amount)];
  let face = family[0].toUpperCase();
  let low = 1, high = 1;
  if (/^[MESmes]$/.test(family)) {
    face = ({ M: 'L', E: 'D', S: 'F' } as Record<string, string>)[face];
    low = family === family.toUpperCase() ? (order + 1) / 2 : 2;
    high = family === family.toUpperCase() ? low : order - 1;
  } else {
    const bounds = move.layer?.split('-').map(Number);
    const wide = family.length === 2 || family === family.toLowerCase();
    if (bounds?.length === 2) [low, high] = bounds;
    else if (bounds) { high = bounds[0]; low = wide ? 1 : high; }
    else high = wide ? 2 : 1;
  }
  const block = (depth: number, turn: number) => {
    if (depth === order) {
      const axis = ({ R: 'x', L: 'x', U: 'y', D: 'y', F: 'z', B: 'z' } as Record<string, string>)[face];
      return axis + suffix('LDB'.includes(face) ? -turn : turn);
    }
    return (depth === 1 ? face : `${depth}${face}w`) + suffix(turn);
  };
  return low === 1 ? [block(high, amount)] : [block(high, amount), block(low - 1, -amount)];
}

/** Slot -> original sticker identity; colors alone lose same-color motion. */
export function stickerPermutation(moves: readonly string[], order = 3, initial?: readonly number[]): number[] {
  if (!validOrder(order)) throw new RangeError('Invalid cube order');
  const faceSize = order * order;
  const faces = Object.fromEntries(AllFaces.map((face, i) => [face,
    initial ? initial.slice(i * faceSize, (i + 1) * faceSize) : Array.from({ length: faceSize }, (_, k) => i * faceSize + k)]));
  const cube = new CubeData(order, faces);
  for (const move of tokenizeMoves(moves.join(' ')).moves) {
    for (const turn of parseAlgorithm(visualMoves(move, order).join(' '))) cube.turn(turn);
  }
  return AllFaces.flatMap(face => cube.faces[face] as number[]);
}

/** Forward cycles: a sticker in cycle[i] moves to cycle[i + 1]. */
export function turnCycles(face: string, order = 3): number[][] {
  const destinations = new Array<number>(6 * order * order);
  stickerPermutation([face], order).forEach((id, slot) => { destinations[id] = slot; });
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
export type GraphLayout = ReturnType<typeof createGraphLayout>;

/** Three families of N circles, with shared coordinates for all sticker views. */
export function createGraphLayout(order: number) {
  if (!validOrder(order)) throw new RangeError('Invalid cube order');
  // Inner U/F/R match the default 3D view: white above, green left, red right.
  const rings = [{ x: 295, y: 258 }, { x: 220, y: 128 }, { x: 145, y: 258 }]
    .flatMap((center, axis) => Array.from({ length: order }, (_, layer) => ({
      ...center, r: order === 1 ? 136 : 112 + 48 * layer / (order - 1), axis, layer,
    })));
  const positions = new Float64Array(12 * order * order);
  const ringIds = new Uint16Array(positions.length);
  const end = order - 1;
  for (let face = 0; face < 6; face++) for (let row = 0; row < order; row++) for (let col = 0; col < order; col++) {
    const slot = face * order * order + row * order + col;
    const xyz = [[col, end, row], [end, end - row, end - col], [col, end - row, end],
      [col, 0, end - row], [0, end - row, col], [end - col, end - row, 0]][face];
    const normal = [1, 0, 2, 1, 0, 2][face];
    const axes = [0, 1, 2].filter(axis => axis !== normal);
    const first = axes[0] * order + xyz[axes[0]], second = axes[1] * order + xyz[axes[1]];
    const a = rings[first], b = rings[second], third = rings[normal * order];
    const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
    const along = (a.r * a.r - b.r * b.r + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(0, a.r * a.r - along * along));
    const mx = a.x + dx * along / distance, my = a.y + dy * along / distance;
    const ox = -dy * height / distance, oy = dx * height / distance;
    const plusIsInner = (mx + ox - third.x) ** 2 + (my + oy - third.y) ** 2
      < (mx - ox - third.x) ** 2 + (my - oy - third.y) ** 2;
    const sign = plusIsInner === (face < 3) ? 1 : -1;
    positions[slot * 2] = mx + sign * ox; positions[slot * 2 + 1] = my + sign * oy;
    ringIds[slot * 2] = first; ringIds[slot * 2 + 1] = second;
  }
  return { order, rings, positions, ringIds };
}

export const DEFAULT_GRAPH = createGraphLayout(3);
export const RINGS = DEFAULT_GRAPH.rings;
export function graphPoint(layout: GraphLayout, slot: number): Point {
  return { x: layout.positions[slot * 2], y: layout.positions[slot * 2 + 1] };
}
export const GRAPH_SLOTS = Array.from({ length: 54 }, (_, id) => ({
  ...graphPoint(DEFAULT_GRAPH, id), rings: Array.from(DEFAULT_GRAPH.ringIds.slice(id * 2, id * 2 + 2)),
  face: Math.floor(id / 9), row: Math.floor(id % 9 / 3), col: id % 3,
}));

/** Follow a common layer circle; interrupted moves start at the displayed point. */
export function graphPosition(from: number, to: number, progress: number, origin?: Point, layout = DEFAULT_GRAPH): Point {
  const a = origin ?? graphPoint(layout, from), b = graphPoint(layout, to);
  if (progress <= 0) return a;
  if (progress >= 1 || from === to && a.x === b.x && a.y === b.y) return b;
  const id = [layout.ringIds[from * 2], layout.ringIds[from * 2 + 1]].find(ringId => {
    const ring = layout.rings[ringId];
    return (ringId === layout.ringIds[to * 2] || ringId === layout.ringIds[to * 2 + 1])
      && Math.abs(Math.hypot(a.x - ring.x, a.y - ring.y) - ring.r) < 1e-7;
  });
  if (id === undefined) return { x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress };
  const ring = layout.rings[id];
  const start = Math.atan2(a.y - ring.y, a.x - ring.x);
  let delta = Math.atan2(b.y - ring.y, b.x - ring.x) - start;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  return { x: ring.x + ring.r * Math.cos(start + delta * progress), y: ring.y + ring.r * Math.sin(start + delta * progress) };
}

export function sectorCell(face: number, row: number, col: number, order: number) {
  const angle = Math.PI / (3 * order), gap = 0.048 / order;
  const a = -Math.PI / 2 + face * Math.PI / 3 + col * angle + gap;
  const inner = 38 + row * 129 / order;
  return { a, b: a + angle - 2 * gap, inner, outer: inner + 120 / order };
}

/** A bijective face/row/column drawing, not an additional cube model. */
export function sectorPath(face: number, row: number, col: number, order = 3): string {
  const { a, b, inner, outer } = sectorCell(face, row, col, order);
  const p = (r: number, angle: number) => `${(220 + r * Math.cos(angle)).toFixed(3)},${(220 + r * Math.sin(angle)).toFixed(3)}`;
  return `M ${p(inner, a)} L ${p(outer, a)} A ${outer},${outer} 0 0 1 ${p(outer, b)} L ${p(inner, b)} A ${inner},${inner} 0 0 0 ${p(inner, a)} Z`;
}
