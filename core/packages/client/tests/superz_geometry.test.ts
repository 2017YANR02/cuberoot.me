import { beforeAll, describe, expect, it } from 'vitest';
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import type { KPatternData, KPuzzle } from 'cubing/kpuzzle';
import { NATIVE_PUZZLES } from '@cuberoot/puzzle-solvers/native-puzzles';
import { nativePuzzleKPuzzle, parseNativePuzzleAlg } from '@cuberoot/puzzle-solvers/native-puzzle-model';

const SUPERZ_DESCRIPTION = NATIVE_PUZZLES.superz.description;
const superzKPuzzle = (): KPuzzle => nativePuzzleKPuzzle('superz');
const parseSuperzAlg = (input: string) => parseNativePuzzleAlg('superz', input);

type Vec3 = readonly [number, number, number];
interface Sticker {
  vertices: Vec3[];
  center: Vec3;
  orbit: string;
  ord: number;
  ori: number;
  face: number;
}
interface MoveSpec { move: string; normal: Vec3; order: number }

// Independently specified physical axes, not copied from PG's move transformations.
// Single letters name outside faces; the three-letter names name outside corners.
const MOVES: readonly MoveSpec[] = [
  { move: 'F', normal: [0, 0, 1], order: 4 },
  { move: 'B', normal: [0, 0, -1], order: 4 },
  { move: 'D', normal: [0, -1, 0], order: 4 },
  { move: 'U', normal: [0, 1, 0], order: 4 },
  { move: 'L', normal: [-1, 0, 0], order: 4 },
  { move: 'R', normal: [1, 0, 0], order: 4 },
  { move: 'DRF', normal: [1, -1, 1], order: 3 },
  { move: 'UBL', normal: [-1, 1, -1], order: 3 },
  { move: 'DFL', normal: [-1, -1, 1], order: 3 },
  { move: 'URB', normal: [1, 1, -1], order: 3 },
  { move: 'DBR', normal: [1, -1, -1], order: 3 },
  { move: 'ULF', normal: [-1, 1, 1], order: 3 },
  { move: 'DLB', normal: [-1, -1, -1], order: 3 },
  { move: 'UFR', normal: [1, 1, 1], order: 3 },
];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vec3): Vec3 => scale(a, 1 / Math.sqrt(dot(a, a)));
const mean = (points: readonly Vec3[]): Vec3 => [
  points.reduce((sum, p) => sum + p[0], 0) / points.length,
  points.reduce((sum, p) => sum + p[1], 0) / points.length,
  points.reduce((sum, p) => sum + p[2], 0) / points.length,
];

/** Rodrigues' formula is independent of the KPuzzle permutation/orientation tables. */
function rotate(point: Vec3, axis: Vec3, angle: number): Vec3 {
  const n = unit(axis), c = Math.cos(angle), s = Math.sin(angle);
  const tangent = cross(n, point), axial = dot(n, point) * (1 - c);
  return [
    c * point[0] + s * tangent[0] + axial * n[0],
    c * point[1] + s * tangent[1] + axial * n[1],
    c * point[2] + s * tangent[2] + axial * n[2],
  ];
}

interface Plane { normal: Vec3; offset: number }
const CUT_AXES: readonly Vec3[] = [
  [1, 0, 0], [0, 1, 0], [0, 0, 1],
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [-1, 1, 1],
];
const CUBE_PLANES: readonly Plane[] = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
].map((normal) => ({ normal: normal as unknown as Vec3, offset: 1 }));

/** Reconstruct one closed physical cell by intersecting the seven origin cuts
 * with the unit cube. PG supplies only its visible stickers to this oracle. */
function cutCell(interior: Vec3): { vertices: Vec3[]; faces: number[][]; volume: number } {
  const planes: Plane[] = [...CUBE_PLANES, ...CUT_AXES.map((normal) => ({
    normal: scale(normal, dot(normal, interior) > 0 ? -1 : 1), offset: 0,
  }))];
  const vertices: Vec3[] = [];
  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      for (let k = j + 1; k < planes.length; k++) {
        const a = planes[i], b = planes[j], c = planes[k];
        const bc = cross(b.normal, c.normal), ca = cross(c.normal, a.normal), ab = cross(a.normal, b.normal);
        const determinant = dot(a.normal, bc);
        if (Math.abs(determinant) < 1e-9) continue;
        const p: Vec3 = [0, 1, 2].map((component) => (
          a.offset * bc[component] + b.offset * ca[component] + c.offset * ab[component]
        ) / determinant) as unknown as Vec3;
        if (planes.some((plane) => dot(plane.normal, p) > plane.offset + 1e-9)) continue;
        if (!vertices.some((v) => dot(sub(v, p), sub(v, p)) < 1e-16)) vertices.push(p);
      }
    }
  }
  const faces: number[][] = [];
  let volume = 0;
  for (const plane of planes) {
    const indices = vertices.flatMap((p, i) => Math.abs(dot(plane.normal, p) - plane.offset) < 1e-9 ? [i] : []);
    if (indices.length < 3) continue;
    const center = mean(indices.map((i) => vertices[i]));
    const u = unit(sub(vertices[indices[0]], center)), v = cross(unit(plane.normal), u);
    indices.sort((a, b) => {
      const pa = sub(vertices[a], center), pb = sub(vertices[b], center);
      return Math.atan2(dot(pa, v), dot(pa, u)) - Math.atan2(dot(pb, v), dot(pb, u));
    });
    faces.push(indices);
    for (let i = 1; i < indices.length - 1; i++) {
      volume += dot(vertices[indices[0]], cross(vertices[indices[i]], vertices[indices[i + 1]])) / 6;
    }
  }
  return { vertices, faces, volume };
}

describe('SuperZ native geometry, mixed cuts, and clockwise notation', () => {
  let puzzle: KPuzzle;
  let stickers: Sticker[];

  beforeAll(async () => {
    puzzle = await superzKPuzzle();
    const pg = getPuzzleGeometryByDesc(SUPERZ_DESCRIPTION, {
      allMoves: true, orientCenters: true, addRotations: true,
    });
    stickers = pg.get3d().stickers.map((s) => {
      const vertices: Vec3[] = [];
      for (let i = 0; i < s.coords.length; i += 3) vertices.push([s.coords[i], s.coords[i + 1], s.coords[i + 2]]);
      return { vertices, center: mean(vertices), orbit: s.orbit, ord: s.ord, ori: s.ori, face: s.face };
    });
  });

  function nearest(point: Vec3): Sticker {
    const result = stickers.reduce((best, candidate) => (
      dot(sub(candidate.center, point), sub(candidate.center, point))
        < dot(sub(best.center, point), sub(best.center, point)) ? candidate : best
    ));
    expect(dot(sub(result.center, point), sub(result.center, point))).toBeLessThan(1e-18);
    return result;
  }

  function matchesSource(source: Sticker, destination: Sticker, pattern: KPatternData): boolean {
    const orbit = pattern[destination.orbit];
    const orientations = destination.orbit === 'CORNERS' ? 3 : 1;
    const orientation = (destination.ori - orbit.orientation[destination.ord] + orientations) % orientations;
    return source.orbit === destination.orbit && orbit.pieces[destination.ord] === source.ord && orientation === source.ori;
  }

  it('has six faces with eight equal triangular stickers, eight corners, and twenty-four face pieces', () => {
    expect(SUPERZ_DESCRIPTION).toBe('c f 0 v 0');
    expect(puzzle.definition.orbits).toEqual([
      { orbitName: 'CORNERS', numPieces: 8, numOrientations: 3 },
      { orbitName: 'CENTERS', numPieces: 24, numOrientations: 1 },
    ]);
    expect(stickers.length).toBe(48);
    expect([...new Set(stickers.map((s) => s.face))].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    const half = Math.max(...stickers.flatMap((s) => s.vertices.flatMap((p) => p.map(Math.abs))));
    for (let face = 0; face < 6; face++) expect(stickers.filter((s) => s.face === face).length).toBe(8);
    for (const sticker of stickers) {
      expect(sticker.vertices.length).toBe(3);
      const [a, b, c] = sticker.vertices;
      const twiceArea = cross(sub(b, a), sub(c, a));
      expect(Math.sqrt(dot(twiceArea, twiceArea)) / (2 * half * half)).toBeCloseTo(0.5, 12);
    }
    expect(stickers.filter((s) => s.orbit === 'CORNERS').length).toBe(24);
    expect(stickers.filter((s) => s.orbit === 'CENTERS').length).toBe(24);
  });

  it('partitions the cube into thirty-two closed plane-cut cells with invariant turn boundaries', () => {
    const half = Math.max(...stickers.flatMap((s) => s.vertices.flatMap((p) => p.map(Math.abs))));
    const pieces = new Map<string, Sticker[]>();
    for (const sticker of stickers) {
      const key = `${sticker.orbit}:${sticker.ord}`;
      pieces.set(key, [...pieces.get(key) ?? [], sticker]);
    }
    expect(pieces.size).toBe(32);
    const signatures = new Set<string>();
    let totalVolume = 0;
    for (const visible of pieces.values()) {
      const interior = scale(mean(visible.map((s) => s.center)), 1 / half);
      const signs = CUT_AXES.map((normal) => Math.sign(dot(normal, interior)));
      expect(signs.includes(0)).toBe(false);
      signatures.add(signs.join(','));
      const cell = cutCell(interior);
      const edges = new Map<string, number>();
      for (const face of cell.faces) {
        for (let i = 0; i < face.length; i++) {
          const a = face[i], b = face[(i + 1) % face.length];
          const edge = a < b ? `${a},${b}` : `${b},${a}`;
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
      expect([...edges.values()].every((count) => count === 2)).toBe(true);
      expect(cell.vertices.length - edges.size + cell.faces.length).toBe(2);
      expect(cell.volume).toBeCloseTo(visible[0].orbit === 'CORNERS' ? 0.5 : 1 / 6, 12);
      totalVolume += cell.volume;
      for (const sticker of visible) {
        for (const vertex of sticker.vertices) {
          const normalized = scale(vertex, 1 / half);
          expect(cell.vertices.some((p) => dot(sub(p, normalized), sub(p, normalized)) < 1e-16)).toBe(true);
        }
      }
      for (const { normal, order } of MOVES) {
        const side = Math.sign(dot(normal, interior));
        for (const vertex of cell.vertices) {
          // A whole rigid cell stays on its own side of this move's plane at
          // intermediate angles, not merely at the next legal endpoint.
          for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
            const moved = side > 0 ? rotate(vertex, normal, -2 * Math.PI * progress / order) : vertex;
            expect(side * dot(normal, moved)).toBeGreaterThanOrEqual(-1e-9);
            expect(dot(normal, moved)).toBeCloseTo(dot(normal, vertex), 12);
          }
        }
      }
    }
    expect(signatures.size).toBe(32);
    expect(totalVolume).toBeCloseTo(8, 12);
  });

  it.each(MOVES)('$move rotates its outward half clockwise, with a wrong-sign negative control', ({ move, normal, order }) => {
    const pattern = puzzle.defaultPattern().applyMove(move).patternData;
    const moving = stickers.filter((s) => dot(s.center, normal) > 1e-9);
    expect(moving.length).toBe(24);
    let clockwiseFailures = 0, wrongSignFailures = 0;
    for (const sticker of moving) {
      if (!matchesSource(sticker, nearest(rotate(sticker.center, normal, -2 * Math.PI / order)), pattern)) clockwiseFailures++;
      if (!matchesSource(sticker, nearest(rotate(sticker.center, normal, 2 * Math.PI / order)), pattern)) wrongSignFailures++;
    }
    expect(clockwiseFailures).toBe(0);
    expect(wrongSignFailures).toBe(24);
    expect(puzzle.moveToTransformation(move).repetitionOrder()).toBe(order);
    expect(puzzle.algToTransformation(`${move}${order}`).isIdentityTransformation()).toBe(true);
    expect(puzzle.algToTransformation(`${move}${order - 1}`).isIdentityTransformation()).toBe(false);
  });

  it('matches the geometric sticker permutation after mixed mechanisms and its inverse', () => {
    const sequence = [
      ['F', 1], ['DRF', 1], ['R', -1], ['UBL', 1], ['D', 2],
      ['UFR', -1], ['L', 1], ['DFL', -1], ['B', 2], ['URB', 1],
    ] as const;
    const text = "F DRF R' UBL D2 UFR' L DFL' B2 URB";
    const alg = parseSuperzAlg(text);
    const pattern = puzzle.defaultPattern().applyAlg(alg);
    const positions = stickers.map((s) => s.center);
    for (const [name, amount] of sequence) {
      const spec = MOVES.find(({ move }) => move === name)!;
      for (let i = 0; i < positions.length; i++) {
        if (dot(positions[i], spec.normal) > 1e-9) positions[i] = rotate(positions[i], spec.normal, -amount * 2 * Math.PI / spec.order);
      }
    }
    expect(stickers.filter((s, i) => !matchesSource(s, nearest(positions[i]), pattern.patternData)).length).toBe(0);
    expect(pattern.isIdentical(puzzle.defaultPattern())).toBe(false);
    expect(pattern.applyAlg(alg.invert()).isIdentical(puzzle.defaultPattern())).toBe(true);
    expect(puzzle.algToTransformation('F DRF').isIdentical(puzzle.algToTransformation('DRF F'))).toBe(false);
  });

  it.each([
    ['F', 'B', 'Fv'], ['D', 'U', 'Dv'], ['L', 'R', 'Lv'],
    ['DRF', 'UBL', 'DRFv'], ['DFL', 'URB', 'DFLv'], ['DBR', 'ULF', 'DBRv'], ['DLB', 'UFR', 'DLBv'],
  ])('opposite halves %s and %s commute and combine into %s', (a, b, rotation) => {
    expect(puzzle.algToTransformation(`${a} ${b}`).isIdentical(puzzle.algToTransformation(`${b} ${a}`))).toBe(true);
    expect(puzzle.algToTransformation(`${a} ${b}'`).isIdentical(puzzle.moveToTransformation(rotation))).toBe(true);
  });

  it('keeps native rotations and second layers without inventing NxN aliases', () => {
    for (const [native, equivalent] of [['Rv', "R L'"], ['DRFv', "DRF UBL'"], ['2R', "L'"], ['2DRF', "UBL'"]]) {
      expect(puzzle.algToTransformation(parseSuperzAlg(native)).isIdentical(puzzle.algToTransformation(equivalent))).toBe(true);
    }
    const grouped = parseSuperzAlg("(F DRF)2 [R, UFR] // native notation\nRv 2R");
    expect(puzzle.algToTransformation(grouped).isIdentical(
      puzzle.algToTransformation("F DRF F DRF R UFR R' UFR' Rv 2R"),
    )).toBe(true);
    for (const invalid of ['x', 'y', 'z', 'Rw', 'notAMove', '3R']) expect(() => parseSuperzAlg(invalid)).toThrow();
  });
});
