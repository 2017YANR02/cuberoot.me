/** Original vector ring artwork, shared by the tile meshes and SVG previews.
 * Each fragment is permanently attached to a tile's printed front/back. The
 * two complete pictures are laid out only once, in the verified endpoint poses.
 * No image downloads, canvas textures, logos, or puzzle-specific DOM are needed.
 */
import { magicPoses, magicStepCount, type MagicPose, type MagicPuzzle } from '@cuberoot/puzzle-solvers/magic';

export type MagicPoint = readonly [number, number];
export interface MagicInk { color: string; polygons: MagicPoint[][] }
export interface MagicTileArtwork { front: MagicInk[]; back: MagicInk[] }
export const MAGIC_TILE_COLOR = '#211d24';
export const MAGIC_TILE_EDGE = '#675e69';
const INK_LIMIT = 0.484;
const cache = new Map<MagicPuzzle, MagicTileArtwork[]>();
type Ring = { x: number; y: number; rx: number; ry: number; angle: number };

export function magicLayoutBounds(poses: readonly MagicPose[]) {
  const xs: number[] = [], ys: number[] = [];
  for (const pose of poses) for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) {
    xs.push(pose.position[0] + x * pose.right[0] + y * pose.up[0]);
    ys.push(pose.position[1] + x * pose.right[1] + y * pose.up[1]);
  }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function ringsFor(puzzle: MagicPuzzle, back: boolean, poses: readonly MagicPose[]): Ring[] {
  const { minX, maxX, minY, maxY } = magicLayoutBounds(poses);
  if (!back) {
    return Array.from({ length: puzzle === 'magic' ? 3 : 5 }, (_, index) => ({
      x: minX + 1 + index, y: (minY + maxY) / 2,
      rx: puzzle === 'magic' ? 0.39 : 0.67, ry: 0.77, angle: -0.2,
    }));
  }
  // An interior four-tile junction is one ring centre. The L has three, the
  // Master's W has five. Derive them from the endpoint, preserving tile IDs.
  const rings: Ring[] = [];
  for (let y = minY + 1; y < maxY - 0.5; y++) for (let x = minX + 1; x < maxX - 0.5; x++) {
    const neighbours = poses.filter(pose => Math.abs(Math.abs(pose.position[0] - x) - 0.5) < 1e-6
      && Math.abs(Math.abs(pose.position[1] - y) - 0.5) < 1e-6);
    if (neighbours.length === 4) rings.push({ x, y, rx: puzzle === 'magic' ? 0.64 : 0.42, ry: puzzle === 'magic' ? 0.64 : 0.42, angle: 0 });
  }
  return rings;
}

function point(ring: Ring, angle: number, offset: number): MagicPoint {
  const x = (ring.rx + offset) * Math.cos(angle), y = (ring.ry + offset) * Math.sin(angle);
  const c = Math.cos(ring.angle), s = Math.sin(ring.angle);
  return [ring.x + x * c - y * s, ring.y + x * s + y * c];
}

/** Sutherland-Hodgman clipping in the tile's immutable local XY coordinates. */
function clip(poly: MagicPoint[]): MagicPoint[] {
  let out = poly;
  for (const [axis, sign] of [[0, 1], [0, -1], [1, 1], [1, -1]] as const) {
    const input = out;
    out = [];
    if (input.length === 0) break;
    for (let i = 0; i < input.length; i++) {
      const a = input[i], b = input[(i + 1) % input.length];
      const da = INK_LIMIT - a[axis] * sign, db = INK_LIMIT - b[axis] * sign;
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
  }
  return out;
}

function local(pose: MagicPose, p: MagicPoint): MagicPoint {
  const x = p[0] - pose.position[0], y = p[1] - pose.position[1];
  return [x * pose.right[0] + y * pose.right[1], x * pose.up[0] + y * pose.up[1]];
}

function implicit(ring: Ring, p: MagicPoint): number {
  const dx = p[0] - ring.x, dy = p[1] - ring.y;
  const c = Math.cos(ring.angle), s = Math.sin(ring.angle);
  return ((dx * c + dy * s) / ring.rx) ** 2 + ((-dx * s + dy * c) / ring.ry) ** 2 - 1;
}

function artworkFor(puzzle: MagicPuzzle, back: boolean, poses: readonly MagicPose[]): MagicInk[][] {
  const rings = ringsFor(puzzle, back, poses);
  const bands = puzzle === 'magic'
    ? [[-0.042, 0.042, '#735111'], [-0.026, 0.026, '#efbb38'], [-0.01, 0.01, '#fff1aa']] as const
    : [[-0.042, 0.042, '#625e78'], [-0.026, 0.026, '#d7daf1'], [-0.01, 0.01, '#ffffff']] as const;
  const result: MagicInk[][] = poses.map(() => []);
  const addBand = (ring: Ring, low: number, high: number, color: string, from = 0, to = Math.PI * 2) => {
    const segments = Math.max(2, Math.ceil((to - from) / (Math.PI * 2) * 128));
    const global: MagicPoint[][] = [];
    for (let i = 0; i < segments; i++) {
      const a = from + (to - from) * i / segments, b = from + (to - from) * (i + 1) / segments;
      global.push([point(ring, a, low), point(ring, b, low), point(ring, b, high), point(ring, a, high)]);
    }
    poses.forEach((pose, tile) => {
      const polygons = global.map(poly => clip(poly.map(p => local(pose, p)))).filter(poly => poly.length >= 3);
      if (polygons.length) result[tile].push({ color, polygons });
    });
  };
  for (const ring of rings) for (const [low, high, color] of bands) addBand(ring, low, high, color);
  // Restore one crossing of the earlier ring over the later ring. The other
  // crossing remains underneath, making actual interlocked-ring diagrams.
  for (let i = 0; i < rings.length; i++) for (let j = i + 1; j < rings.length; j++) {
    const ring = rings[i], other = rings[j];
    for (let n = 0; n < 256; n++) {
      const a = n * Math.PI * 2 / 256, b = (n + 1) * Math.PI * 2 / 256;
      if (implicit(other, point(ring, a, 0)) * implicit(other, point(ring, b, 0)) < 0) {
        const t = (a + b) / 2;
        addBand(ring, -0.07, 0.07, MAGIC_TILE_COLOR, t - 0.15, t + 0.15);
        for (const [low, high, color] of bands) addBand(ring, low, high, color, t - 0.15, t + 0.15);
        break;
      }
    }
  }
  return result;
}

export function magicArtwork(puzzle: MagicPuzzle): MagicTileArtwork[] {
  const existing = cache.get(puzzle);
  if (existing) return existing;
  const front = artworkFor(puzzle, false, magicPoses(puzzle, 0));
  const back = artworkFor(puzzle, true, magicPoses(puzzle, magicStepCount(puzzle)));
  const tiles = front.map((ink, tile) => ({ front: ink, back: back[tile] }));
  cache.set(puzzle, tiles);
  return tiles;
}
