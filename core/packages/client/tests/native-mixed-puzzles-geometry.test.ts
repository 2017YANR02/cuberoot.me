// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Move } from 'cubing/alg';
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { TwistyPlayer } from 'cubing/twisty';
import { Vector3 } from 'three';
import { NATIVE_PUZZLES, nativePuzzleMoves, type NativePuzzleId } from '@cuberoot/puzzle-solvers/native-puzzles';
import { nativePuzzleKPuzzle, parseNativePuzzleAlg } from '@cuberoot/puzzle-solvers/native-puzzle-model';

// Reconstruct the physical faces and cuts from regular-polyhedron halfspaces.
// These normals, cut depths and move orders are independent of PG's polygons,
// axis list and selected-piece sets. Scale is the uncut body's inradius = 1.
// 3x3 + Skewb combines x/y/z = +/-1/3 with the four through-center corner planes.
// Helicopter Skewb adds the usual helicopter edge planes, at sqrt(2)/2.
// 3x3 + Helicopter independently combines the uniform third-depth face planes
// with those standard edge planes, without claiming a particular retail shape.
// The two icosahedral models use face cuts sqrt(5)/3 and vertex cuts r/sqrt(5),
// respectively. The latter planes pass through all five neighboring vertices.
// Sources, checked separately from PG's generated data:
// Standard 3x3 and Helicopter cut families (combined independently below):
// https://github.com/cubing/cubing.js/blob/main/src/cubing/puzzle-geometry/pgPuzzles.ts
// Helicopter Skewb: https://www.tomvanderzanden.nl/puzzle.php?puz=Helicopter+Skewb
// Comboctahedron: https://github.com/HactarCE/Hyperspeedcube/blob/main/lua/puzzles/fcto.lua
// Its CTO layers: https://github.com/HactarCE/Hyperspeedcube/blob/main/lua/puzzles/cto.lua
// Circo-Radiolarian: https://www.puzzleforge.com/wp/2010/01/11/radiolarian-2-12010/
// Its radio02 cut, 1 - (1 - 1/phi)*2/3 = sqrt(5)/3:
// https://github.com/HactarCE/Hyperspeedcube/blob/main/lua/puzzles/ft_icosahedra.lua
// Radio Jewel's radio07 cut is 5 - 2 sqrt(5); original shape and mechanism:
// https://www.puzzleforge.com/wp/2012/11/06/radiolarian-7-radio-jewel-112012/
// Cat's Cradle's radio05 cut is phi^2/(2+phi^2) = (4+sqrt(5))/11:
// https://www.puzzleforge.com/wp/2012/10/06/radiolarian-5-cats-cradle-102012/
// Radio Canon's radio01_5 uses planar cuts at 0.77 and retains fixed centers:
// https://www.puzzleforge.com/wp/2014/05/08/radiolarian-1-5-the-radio-cannon-52014/
// Baby Face preset: https://github.com/cubing/cubing.js/issues/127
// 3x3 + Skewb is the independent superposition of the standard 3x3 and Skewb
// cut families, not a measured reproduction of an inaccessible original post.
// Only complete shape-preserving moves are tested here, without jumbling.
const EPS = 1e-9;
const PHI = (1 + Math.sqrt(5)) / 2;
const ICO_RADIUS = Math.sqrt(15 - 6 * Math.sqrt(5));
const BABY_CUT = ICO_RADIUS / Math.sqrt(5);
type Normals = Record<string, Vector3>;
type Pairs = readonly (readonly [string, string])[];
type AxisSpec = {
  pairs: Pairs;
  normals: Normals;
  cuts: readonly number[];
  order: number;
  rangeWide?: boolean;
};
type Spec = {
  id: NativePuzzleId;
  faceNormals: Normals;
  axes: readonly AxisSpec[];
  faces: number;
  perFace: number;
  raw: number;
  visible: number;
  pieces: number;
  shapes: Record<number, number>;
  orbits: readonly (readonly [string, number, number])[];
  unmarkedOrbit?: string;
};

const cubeNormals: Normals = {
  U: new Vector3(0, 1, 0), D: new Vector3(0, -1, 0),
  F: new Vector3(0, 0, 1), B: new Vector3(0, 0, -1),
  R: new Vector3(1, 0, 0), L: new Vector3(-1, 0, 0),
};
const cubeFacePairs = [['F', 'B'], ['D', 'U'], ['L', 'R']] as const;
const cubeCornerPairs = [['DRF', 'UBL'], ['DFL', 'URB'], ['DBR', 'ULF'], ['DLB', 'UFR']] as const;
const cubeEdgePairs = [['DF', 'UB'], ['FL', 'BR'], ['DB', 'UF'], ['DL', 'UR'], ['BL', 'FR'], ['UL', 'DR']] as const;
const incidentNormal = (faces: readonly string[], normals: Normals) => faces
  .reduce((sum, face) => sum.add(normals[face]), new Vector3()).normalize();
const cubeAxisNormals = (pairs: Pairs): Normals => Object.fromEntries(pairs.flat()
  .map((family) => [family, incidentNormal([...family], cubeNormals)]));

// The eight octahedral face normals are the vertices of a dual cube, rotated
// into the documented U-up/F-forward display convention.
const octaNormals: Normals = {
  U: new Vector3(0, 1, 0), F: new Vector3(0, -1 / 3, 2 * Math.sqrt(2) / 3),
  L: new Vector3(-Math.sqrt(2 / 3), 1 / 3, Math.sqrt(2) / 3),
  R: new Vector3(Math.sqrt(2 / 3), 1 / 3, Math.sqrt(2) / 3),
};
for (const [a, b] of [['U', 'D'], ['F', 'B'], ['L', 'BR'], ['R', 'BL']]) octaNormals[b] = octaNormals[a].clone().negate();
const octaFacePairs = [['F', 'B'], ['D', 'U'], ['L', 'BR'], ['BL', 'R']] as const;
const octaVertexPairs = [['D_BR_R_F', 'U_B_BL_L'], ['D_F_L_BL', 'U_R_BR_B'], ['D_BL_B_BR', 'U_L_F_R']] as const;
const octaVertexFaces = {
  D_BR_R_F: ['D', 'BR', 'R', 'F'], U_B_BL_L: ['U', 'B', 'BL', 'L'],
  D_F_L_BL: ['D', 'F', 'L', 'BL'], U_R_BR_B: ['U', 'R', 'BR', 'B'],
  D_BL_B_BR: ['D', 'BL', 'B', 'BR'], U_L_F_R: ['U', 'L', 'F', 'R'],
};
const octaVertexNormals: Normals = Object.fromEntries(Object.entries(octaVertexFaces)
  .map(([family, faces]) => [family, incidentNormal(faces, octaNormals)]));

// Icosahedral face normals are dual-dodecahedron vertices: (+/-1,+/-1,+/-1)
// and cyclic (0,+/-1/phi,+/-phi), normalized by sqrt(3). A fixed x rotation
// puts a fivefold vertex upright without using an observed PG coordinate.
const icoNormal = (x: number, y: number, z: number) => new Vector3(x, y, z)
  .divideScalar(Math.sqrt(3)).applyAxisAngle(new Vector3(1, 0, 0), -Math.atan(1 / PHI));
const icoNormals: Normals = {
  R: icoNormal(1, -1, 1), L: icoNormal(-1, -1, 1), G: icoNormal(1, 1, 1),
  U: icoNormal(0, 1 / PHI, PHI), H: icoNormal(1, -1, -1), C: icoNormal(1 / PHI, -PHI, 0),
  I: icoNormal(PHI, 0, -1 / PHI), O: icoNormal(-PHI, 0, -1 / PHI),
  F: icoNormal(0, -1 / PHI, PHI), A: icoNormal(-1 / PHI, -PHI, 0),
};
const icoFacePairs = [['R', 'K'], ['L', 'S'], ['G', 'N'], ['U', 'D'], ['H', 'Q'], ['C', 'M'], ['I', 'P'], ['O', 'E'], ['F', 'B'], ['A', 'J']] as const;
for (const [a, b] of icoFacePairs) icoNormals[b] = icoNormals[a].clone().negate();
const icoVertexPairs = [['FREGU', 'OKBDN'], ['HIERC', 'MKOPQ'], ['FLACR', 'BKMJS'], ['NALPO', 'JGEIS'], ['FUQPL', 'IHDBS'], ['UGJMQ', 'DHCAN']] as const;
const icoVertexNormals: Normals = Object.fromEntries(icoVertexPairs.flat()
  .map((family) => [family, incidentNormal([...family], icoNormals)]));

const CASES: readonly Spec[] = [
  {
    id: 'cube3skewb', faceNormals: cubeNormals,
    axes: [
      { pairs: cubeFacePairs, normals: cubeNormals, cuts: [1 / 3], order: 4 },
      { pairs: cubeCornerPairs, normals: cubeAxisNormals(cubeCornerPairs), cuts: [0], order: 3 },
    ],
    faces: 6, perFace: 21, raw: 144, visible: 126, pieces: 86,
    shapes: { 3: 12, 4: 1, 5: 8 }, unmarkedOrbit: 'CENTERS3',
    orbits: [['CENTERS', 24, 1], ['CENTERS2', 24, 1], ['EDGES', 24, 2], ['CORNERS', 8, 3], ['CENTERS3', 6, 4]],
  },
  {
    id: 'heliskewb', faceNormals: cubeNormals,
    axes: [
      { pairs: cubeCornerPairs, normals: cubeAxisNormals(cubeCornerPairs), cuts: [0], order: 3 },
      { pairs: cubeEdgePairs, normals: cubeAxisNormals(cubeEdgePairs), cuts: [Math.SQRT1_2], order: 2 },
    ],
    faces: 6, perFace: 8, raw: 48, visible: 48, pieces: 32,
    shapes: { 3: 8 }, orbits: [['CORNERS', 8, 3], ['CENTERS', 24, 1]],
  },
  {
    id: 'cube2heli', faceNormals: cubeNormals,
    axes: [
      { pairs: cubeFacePairs, normals: cubeNormals, cuts: [0], order: 4 },
      { pairs: cubeEdgePairs, normals: cubeAxisNormals(cubeEdgePairs), cuts: [Math.SQRT1_2], order: 2 },
    ],
    faces: 6, perFace: 8, raw: 48, visible: 48, pieces: 32,
    shapes: { 3: 8 }, orbits: [['CENTERS', 24, 1], ['CORNERS', 8, 3]],
  },
  {
    id: 'cube3heli', faceNormals: cubeNormals,
    axes: [
      { pairs: cubeFacePairs, normals: cubeNormals, cuts: [1 / 3], order: 4 },
      { pairs: cubeEdgePairs, normals: cubeAxisNormals(cubeEdgePairs), cuts: [Math.SQRT1_2], order: 2 },
    ],
    faces: 6, perFace: 28, raw: 168, visible: 168, pieces: 128,
    shapes: { 3: 12, 4: 12, 5: 4 },
    orbits: [['CORNERS', 8, 3], ['EDGES', 24, 2], ['CENTERS', 24, 1], ['CENTERS2', 24, 1], ['CENTERS3', 24, 1], ['CENTERS4', 24, 1]],
  },
  {
    id: 'comboctahedron', faceNormals: octaNormals,
    axes: [
      { pairs: octaFacePairs, normals: octaNormals, cuts: [1 / 3], order: 3, rangeWide: true },
      // Both cuts occur in the original CTO mechanism. Omitting 2/sqrt(3)
      // leaves the same 72 surface stickers but removes the independent tip.
      { pairs: octaVertexPairs, normals: octaVertexNormals, cuts: [1 / Math.sqrt(3), 2 / Math.sqrt(3)], order: 4, rangeWide: true },
    ],
    faces: 8, perFace: 9, raw: 72, visible: 72, pieces: 42,
    shapes: { 3: 9 }, orbits: [['C4RNER', 6, 4], ['EDGES', 12, 2], ['CENTERS', 24, 1]],
  },
  {
    id: 'circoradiolarian', faceNormals: icoNormals,
    axes: [{ pairs: icoFacePairs, normals: icoNormals, cuts: [Math.sqrt(5) / 3], order: 3 }],
    faces: 20, perFace: 15, raw: 300, visible: 300, pieces: 162,
    shapes: { 3: 9, 4: 6 },
    orbits: [['C5RNER', 12, 5], ['EDGES', 60, 2], ['CENTERS', 60, 1], ['EDGES2', 30, 2]],
  },
  {
    id: 'icosababyface', faceNormals: icoNormals,
    axes: [{ pairs: icoVertexPairs, normals: icoVertexNormals, cuts: [BABY_CUT], order: 5 }],
    faces: 20, perFace: 1, raw: 60, visible: 20, pieces: 20,
    shapes: { 3: 1 }, unmarkedOrbit: 'CENTERS', orbits: [['CENTERS', 20, 3]],
  },
  {
    id: 'radiojewel', faceNormals: icoNormals,
    axes: [{ pairs: icoFacePairs, normals: icoNormals, cuts: [5 - 2 * Math.sqrt(5)], order: 3 }],
    faces: 20, perFace: 16, raw: 360, visible: 320, pieces: 242,
    shapes: { 3: 15, 6: 1 }, unmarkedOrbit: 'CENTERS4',
    orbits: [['CENTERS', 60, 1], ['C5RNER', 12, 5], ['CENTERS2', 60, 1], ['EDGES', 30, 2], ['CENTERS3', 60, 1], ['CENTERS4', 20, 3]],
  },
  {
    // Independent source: Hyperspeedcube radio06, not a rounded Radio Jewel.
    id: 'radioweb', faceNormals: icoNormals,
    axes: [{ pairs: icoFacePairs, normals: icoNormals, cuts: [5 - 2 * Math.sqrt(5) + 0.02], order: 3 }],
    faces: 20, perFace: 22, raw: 480, visible: 440, pieces: 302,
    shapes: { 3: 12, 4: 6, 5: 3, 6: 1 }, unmarkedOrbit: 'CENTERS4',
    orbits: [['CENTERS', 60, 1], ['C5RNER', 12, 5], ['CENTERS2', 60, 1], ['EDGES', 60, 2], ['EDGES2', 30, 2], ['CENTERS3', 60, 1], ['CENTERS4', 20, 3]],
  },
  {
    id: 'catscradle', faceNormals: icoNormals,
    axes: [{ pairs: icoFacePairs, normals: icoNormals, cuts: [(4 + Math.sqrt(5)) / 11], order: 3 }],
    faces: 20, perFace: 19, raw: 420, visible: 380, pieces: 242,
    shapes: { 3: 15, 4: 3, 6: 1 }, unmarkedOrbit: 'CENTERS3',
    orbits: [['C5RNER', 12, 5], ['CENTERS', 60, 1], ['EDGES', 60, 2], ['EDGES2', 30, 2], ['CENTERS2', 60, 1], ['CENTERS3', 20, 3]],
  },
  {
    id: 'radiocanon', faceNormals: icoNormals,
    axes: [{ pairs: icoFacePairs, normals: icoNormals, cuts: [0.77], order: 3 }],
    faces: 20, perFace: 16, raw: 360, visible: 320, pieces: 182,
    shapes: { 3: 7, 4: 9 }, unmarkedOrbit: 'CENTERS2',
    orbits: [['C5RNER', 12, 5], ['EDGES', 60, 2], ['CENTERS', 60, 1], ['EDGES2', 30, 2], ['CENTERS2', 20, 3]],
  },
  {
    // Read radio08's axes:add expression, not the unused radio8 constant.
    id: 'radiojam', faceNormals: icoNormals,
    axes: [{ pairs: icoFacePairs, normals: icoNormals, cuts: [5 - 2 * Math.sqrt(5) - 0.06], order: 3 }],
    faces: 20, perFace: 22, raw: 480, visible: 440, pieces: 302,
    shapes: { 3: 15, 5: 6, 6: 1 }, unmarkedOrbit: 'CENTERS4',
    orbits: [['EDGES', 60, 2], ['C5RNER', 12, 5], ['CENTERS', 60, 1], ['CENTERS2', 60, 1], ['EDGES2', 30, 2], ['CENTERS3', 60, 1], ['CENTERS4', 20, 3]],
  },
];

const center = (points: Vector3[]) => points.reduce((sum, point) => sum.add(point), new Vector3()).divideScalar(points.length);
const verticesOf = (coords: number[]) => Array.from({ length: coords.length / 3 }, (_, i) => new Vector3().fromArray(coords, i * 3));
const polygonKey = (points: Vector3[]) => points.map((p) => p.toArray().map((v) => Math.round(v * 1e8)).join(',')).sort().join(';');
const shapeCounts = (polygons: Vector3[][]) => polygons.reduce<Record<number, number>>((counts, polygon) => {
  counts[polygon.length] = (counts[polygon.length] ?? 0) + 1;
  return counts;
}, {});
const boundaries = (axis: AxisSpec) => [...new Set(axis.cuts.flatMap((cut) => [cut, -cut]))].sort((a, b) => b - a);

function uncutFace(normal: Vector3, normals: Vector3[]): Vector3[] {
  const vertices: Vector3[] = [];
  for (let i = 0; i < normals.length; i++) for (let j = i + 1; j < normals.length; j++) {
    const b = normals[i], c = normals[j], bc = b.clone().cross(c), determinant = normal.dot(bc);
    if (Math.abs(determinant) < EPS) continue;
    const p = bc.add(c.clone().cross(normal)).add(normal.clone().cross(b)).divideScalar(determinant);
    if (normals.every((n) => n.dot(p) <= 1 + EPS) && !vertices.some((v) => v.distanceTo(p) < EPS)) vertices.push(p);
  }
  const u = normal.clone().cross(Math.abs(normal.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)).normalize();
  const v = normal.clone().cross(u);
  return vertices.sort((a, b) => Math.atan2(a.dot(v), a.dot(u)) - Math.atan2(b.dot(v), b.dot(u)));
}

function clip(polygon: Vector3[], normal: Vector3, offset: number): Vector3[] {
  const result: Vector3[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const da = normal.dot(a) - offset, db = normal.dot(b) - offset;
    if (da >= -EPS) result.push(a);
    if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) result.push(a.clone().lerp(b, da / (da - db)));
  }
  return result.filter((p, i) => {
    const before = result[(i + result.length - 1) % result.length], after = result[(i + 1) % result.length];
    return p.distanceTo(before) > EPS && p.clone().sub(before).cross(after.clone().sub(p)).length() > EPS;
  });
}

function cutPlanes(spec: Spec) {
  return spec.axes.flatMap((axis) => Object.values(axis.normals)
    .flatMap((normal) => axis.cuts.map((offset) => ({ normal, offset }))));
}

function expectedFace(spec: Spec, normal: Vector3): Vector3[][] {
  let parts = [uncutFace(normal, Object.values(spec.faceNormals))];
  for (const plane of cutPlanes(spec)) parts = parts.flatMap((polygon) => {
    const distances = polygon.map((p) => plane.normal.dot(p) - plane.offset);
    if (Math.min(...distances) >= -EPS || Math.max(...distances) <= EPS) return [polygon];
    return [clip(polygon, plane.normal, plane.offset), clip(polygon, plane.normal.clone().negate(), -plane.offset)];
  });
  return parts;
}

function fixture(spec: Spec) {
  const pg = getPuzzleGeometryByDesc(NATIVE_PUZZLES[spec.id].description, { allMoves: true, orientCenters: true, addRotations: true });
  const geometry = pg.get3d();
  const inradius = center(verticesOf(geometry.faces[0].coords)).length();
  const stickers = geometry.stickers.filter((s) => !s.isDup).map((s) => {
    const vertices = verticesOf(s.coords).map((v) => v.divideScalar(inradius));
    return { ...s, vertices, center: center(vertices) };
  });
  const pieces = new Map<string, Vector3[]>();
  for (const sticker of stickers) {
    const key = `${sticker.orbit}:${sticker.ord}`;
    pieces.set(key, [...(pieces.get(key) ?? []), ...sticker.vertices]);
  }
  return { pg, geometry, stickers, pieces, byPolygon: new Map(stickers.map((s) => [polygonKey(s.vertices), s])), puzzle: nativePuzzleKPuzzle(spec.id) };
}

function manualChoices(spec: Spec) {
  return spec.axes.flatMap((axis) => Object.keys(axis.normals).flatMap((family) => {
    const layers = Math.ceil((boundaries(axis).length + 1) / 2);
    return [
      { move: family, family, order: axis.order, depth: 'outer', first: 1, last: 1, axis },
      ...Array.from({ length: layers - 1 }, (_, index) => {
        const layer = index + 2;
        return [
          { move: `${layer}${family}`, family, order: axis.order, depth: layer === 2 ? 'inner' : 'inner3', first: layer, last: layer, axis },
          { move: axis.rangeWide ? `1-${layer}${family}` : `${layer === 2 ? '' : layer}${family}w`, family, order: axis.order, depth: layer === 2 ? 'wide' : 'wide3', first: 1, last: layer, axis },
        ];
      }).flat(),
    ];
  }));
}

it('keeps Radio Jewel at the exact cut where the neighboring designs lose their extra face regions', () => {
  const spec = CASES.find(({ id }) => id === 'radiojewel')!;
  const depth = 5 - 2 * Math.sqrt(5);
  expect(Number(NATIVE_PUZZLES.radiojewel.description.split(' ')[2])).toBeCloseTo(depth, 14);
  // The intended critical-depth model is not interchangeable with a nearby
  // decimal approximation. Reconstruct both negative controls without PG.
  for (const delta of [-0.0001, 0.0001]) {
    const nearby: Spec = { ...spec, axes: [{ ...spec.axes[0], cuts: [depth + delta] }] };
    for (const normal of Object.values(icoNormals)) {
      expect(expectedFace(nearby, normal).length).toBe(22);
      expect(expectedFace(spec, normal).length).toBe(16);
    }
  }
  const puzzle = nativePuzzleKPuzzle(spec.id);
  for (const family of Object.keys(icoNormals)) {
    const move = puzzle.moveToTransformation(family).transformationData;
    // Three neighboring face centers are inside this cap and travel around
    // its face axis; the turning face's own monochrome center only spins.
    const adjacentCenters = Object.entries(icoNormals).filter(([other, normal]) =>
      other !== family && normal.dot(icoNormals[family]) > depth);
    expect(adjacentCenters).toHaveLength(3);
    expect(move.CENTERS4.permutation.filter((piece, slot) => piece !== slot)).toHaveLength(adjacentCenters.length);
  }
});

it('keeps Cat’s Cradle at its critical depth and preserves all nineteen regions on every face', () => {
  const spec = CASES.find(({ id }) => id === 'catscradle')!;
  const depth = PHI ** 2 / (2 + PHI ** 2);
  expect(Number(NATIVE_PUZZLES.catscradle.description.split(' ')[2])).toBeCloseTo(depth, 14);
  const area = (polygon: Vector3[]) => polygon.reduce((sum, point, i) =>
    sum.add(point.clone().cross(polygon[(i + 1) % polygon.length])), new Vector3()).length() / 2;
  for (const normal of Object.values(icoNormals)) {
    const regions = expectedFace(spec, normal);
    expect(shapeCounts(regions)).toEqual({ 3: 15, 4: 3, 6: 1 });
    const areas = regions.map(area);
    expect(Math.min(...areas)).toBeGreaterThan(0);
    expect(areas.reduce((sum, value) => sum + value, 0))
      .toBeCloseTo(area(uncutFace(normal, Object.values(icoNormals))), 10);
    // Both sides of the critical intersection reintroduce an entire sixty-piece
    // orbit. Neither is the intended Cat's Cradle, even though they look close.
    for (const [delta, shapes] of [
      [-0.0001, { 3: 12, 4: 6, 5: 3, 6: 1 }],
      [0.0001, { 3: 12, 4: 9, 9: 1 }],
    ] as const) {
      const nearby: Spec = { ...spec, axes: [{ ...spec.axes[0], cuts: [depth + delta] }] };
      expect(shapeCounts(expectedFace(nearby, normal))).toEqual(shapes);
    }
  }
  const { stickers } = fixture(spec);
  const counts = new Map<string, number>();
  for (const sticker of stickers) {
    const key = `${sticker.orbit}:${sticker.ord}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  expect([...counts.values()].filter((n) => n === 1)).toHaveLength(140);
  expect([...counts.values()].filter((n) => n === 2)).toHaveLength(90);
  expect([...counts.values()].filter((n) => n === 5)).toHaveLength(12);
});

it('retains Radio Web wings, closes every face without gaps and distinguishes both neighboring designs', () => {
  const web = CASES.find(({ id }) => id === 'radioweb')!;
  const jewel = CASES.find(({ id }) => id === 'radiojewel')!;
  const cradle = { ...web, axes: [{ ...web.axes[0], cuts: [PHI ** 2 / (2 + PHI ** 2)] }] };
  const area = (polygon: Vector3[]) => polygon.reduce((sum, point, i) =>
    sum.add(point.clone().cross(polygon[(i + 1) % polygon.length])), new Vector3()).length() / 2;
  expect(Number(NATIVE_PUZZLES.radioweb.description.split(' ')[2])).toBeCloseTo(5 - 2 * Math.sqrt(5) + 0.02, 14);
  for (const normal of Object.values(icoNormals)) {
    const regions = expectedFace(web, normal);
    expect(regions).toHaveLength(22);
    expect(expectedFace(jewel, normal)).toHaveLength(16);
    expect(expectedFace(cradle, normal)).toHaveLength(19);
    const areas = regions.map(area);
    expect(areas.reduce((sum, value) => sum + value, 0)).toBeCloseTo(area(uncutFace(normal, Object.values(icoNormals))), 10);
    expect(Math.min(...areas)).toBeCloseTo(0.003561495853740537, 10);
  }
  const { stickers } = fixture(web);
  const counts = new Map<string, number>();
  for (const sticker of stickers) {
    const key = sticker.orbit + ':' + sticker.ord;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  expect([...counts.values()].filter((n) => n === 1)).toHaveLength(200);
  expect([...counts.values()].filter((n) => n === 2)).toHaveLength(90);
  expect([...counts.values()].filter((n) => n === 5)).toHaveLength(12);
});

it('keeps all twenty Radio Canon face centers fixed under every outer face turn', () => {
  const spec = CASES.find(({ id }) => id === 'radiocanon')!;
  const { byPolygon, puzzle, stickers } = fixture(spec);
  const depth = 0.77;
  expect(Number(NATIVE_PUZZLES.radiocanon.description.split(' ')[2])).toBe(depth);
  const planes = cutPlanes(spec);
  const counts = new Map<string, number>();
  const centers = Object.entries(icoNormals).map(([family, normal]) => {
    // Locate the central triangle from the independent halfspace construction,
    // not an orbit name or a PG label. A face center is outside every other cap.
    const neighborDot = Math.max(...Object.entries(icoNormals)
      .filter(([other]) => other !== family).map(([, other]) => normal.dot(other)));
    expect(neighborDot, family).toBeCloseTo(Math.sqrt(5) / 3, 12);
    expect(neighborDot, family).toBeLessThan(depth);
    const regions = expectedFace(spec, normal);
    const central = regions.filter((polygon) => center(polygon).distanceTo(normal) < EPS);
    expect(central, family).toHaveLength(1);
    expect(central[0], family).toHaveLength(3);
    for (const polygon of regions) {
      const point = center(polygon);
      const key = planes.map(({ normal: cutNormal, offset }) => cutNormal.dot(point) > offset ? '+' : '-').join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const sticker = byPolygon.get(polygonKey(central[0]));
    expect(sticker, family).toBeDefined();
    return { family, sticker: sticker! };
  });
  expect(centers).toHaveLength(20);
  expect(new Set(centers.map(({ sticker }) => sticker.orbit))).toEqual(new Set([spec.unmarkedOrbit]));
  expect([...counts.values()].filter((n) => n === 1)).toHaveLength(80);
  expect([...counts.values()].filter((n) => n === 2)).toHaveLength(90);
  expect([...counts.values()].filter((n) => n === 5)).toHaveLength(12);
  expect(counts.size).toBe(182);
  expect(stickers.filter((sticker) => sticker.orbit === spec.unmarkedOrbit)).toHaveLength(20);
  for (const family of Object.keys(icoNormals)) for (const amount of [1, -1]) {
    const move = `${family}${amount === -1 ? "'" : ''}`;
    const transformation = puzzle.moveToTransformation(move);
    expect(transformation.repetitionOrder(), move).toBe(3);
    for (const { family: centerFamily, sticker } of centers) {
      const orbit = transformation.transformationData[sticker.orbit];
      expect(orbit.permutation[sticker.ord], `${move} fixed ${centerFamily} center`).toBe(sticker.ord);
      // Its own monochrome triangle may spin, but this invisible orientation
      // must not be confused with a displaced center or extra visible pieces.
      expect(orbit.orientationDelta[sticker.ord] !== 0, `${move} center rotation ${centerFamily}`)
        .toBe(centerFamily === family);
    }
  }
});

describe.each(CASES)('$id independent physical model', (spec) => {
  it('matches every physical face polygon, visible piece and independent outward axis', () => {
    const { pg, geometry, stickers, pieces, puzzle } = fixture(spec);
    expect(geometry.faces.length).toBe(spec.faces);
    expect(pg.stickersPerFace).toBe(spec.perFace);
    expect(geometry.stickers.length).toBe(spec.raw);
    expect(stickers.length).toBe(spec.visible);
    expect(pieces.size).toBe(spec.pieces);
    expect(new Set(stickers.map((s) => s.color)).size).toBe(spec.faces);
    expect(puzzle.definition.orbits.map((o) => [o.orbitName, o.numPieces, o.numOrientations])).toEqual(spec.orbits);
    const planes = cutPlanes(spec);
    const pieceKey = (point: Vector3) => planes.map(({ normal, offset }) => normal.dot(point) > offset ? '+' : '-').join('');
    const independentPieces = new Set<string>();
    for (const [family, normal] of Object.entries(spec.faceNormals)) {
      const expected = expectedFace(spec, normal);
      const actual = stickers.filter((s) => s.vertices.every((p) => Math.abs(p.dot(normal) - 1) < EPS));
      expect(expected.length, family).toBe(spec.perFace);
      expect(actual.length, family).toBe(spec.perFace);
      expect(new Set(actual.map((s) => s.face)).size, family).toBe(1);
      expect(new Set(actual.map((s) => s.color)).size, family).toBe(1);
      expect(shapeCounts(expected), family).toEqual(spec.shapes);
      expect(actual.map((s) => polygonKey(s.vertices)).sort(), family).toEqual(expected.map(polygonKey).sort());
      for (const polygon of expected) independentPieces.add(pieceKey(center(polygon)));
    }
    expect(independentPieces.size, 'surface cells grouped by independent cut halfspaces').toBe(spec.pieces);
    for (const [key, points] of pieces) {
      const actualPiece = stickers.filter((s) => `${s.orbit}:${s.ord}` === key);
      expect(new Set(actualPiece.map((s) => pieceKey(s.center))).size, key).toBe(1);
      expect(points.length, key).toBeGreaterThanOrEqual(3);
    }
    for (const axis of spec.axes) for (const [family, normal] of Object.entries(axis.normals)) {
      const grip = geometry.axis.find((a) => geometry.notationMapper.notationToExternal(new Move(a.quantumMove.toString()))?.family === family);
      expect(grip, family).toBeDefined();
      expect(new Vector3().fromArray(grip!.coordinates).normalize().distanceTo(normal), family).toBeLessThan(EPS);
      expect(grip!.order, family).toBe(axis.order);
    }
  });

  it('matches every layer and whole turn in both directions to independent slab selection and rigid rotation', () => {
    const { stickers, pieces, byPolygon, puzzle } = fixture(spec);
    const choices = manualChoices(spec);
    const metadata = ({ move, family, order, depth }: { move: string; family: string; order: number; depth: string }) => ({ move, family, order, depth });
    const sort = (a: { move: string }, b: { move: string }) => a.move.localeCompare(b.move);
    expect(nativePuzzleMoves(spec.id).map(metadata).sort(sort)).toEqual(choices.map(metadata).sort(sort));
    const rotations = spec.axes.flatMap((axis) => Object.keys(axis.normals)
      .map((family) => ({ move: `${family}v`, family, first: 1, last: boundaries(axis).length + 1, axis })));
    for (const choice of [...choices, ...rotations]) for (const amount of [1, -1]) {
      const move = `${choice.move}${amount === -1 ? "'" : ''}`;
      const axis = choice.axis.normals[choice.family], angle = -amount * 2 * Math.PI / choice.axis.order;
      const bounds = [Infinity, ...boundaries(choice.axis), -Infinity];
      const upper = bounds[choice.first - 1], lower = bounds[choice.last];
      const pattern = puzzle.defaultPattern().applyAlg(parseNativePuzzleAlg(spec.id, move)).patternData;
      expect(puzzle.moveToTransformation(move).repetitionOrder(), move).toBe(choice.axis.order);
      const selected = new Set<string>();
      let isolationError = 0, distanceError = 0, wrongDirectionError = 0;
      for (const [key, points] of pieces) {
        const q = center(points).dot(axis), moving = q > lower + EPS && q < upper - EPS;
        if (moving) selected.add(key);
        const distances = points.map((p) => p.dot(axis));
        const below = Math.max(...distances) <= lower + EPS, above = Math.min(...distances) >= upper - EPS;
        expect(moving || below || above, `${move} unsplit piece ${key}`).toBe(true);
        for (const progress of [0, 0.2, 0.5, 0.8, 1]) for (const point of points) {
          const rotated = moving ? point.clone().applyAxisAngle(axis, angle * progress) : point;
          const after = rotated.dot(axis);
          distanceError = Math.max(distanceError, Math.abs(after - point.dot(axis)));
          isolationError = Math.max(isolationError, moving ? lower - after : below ? after - lower : upper - after);
          if (moving) isolationError = Math.max(isolationError, after - upper);
        }
      }
      expect(selected.size, move).toBeGreaterThan(0);
      expect(distanceError, `${move} signed cut distance throughout turn`).toBeLessThan(EPS);
      expect(isolationError, `${move} continuous cut-plane separation`).toBeLessThan(EPS);
      for (const source of stickers) {
        const moving = selected.has(`${source.orbit}:${source.ord}`);
        const target = byPolygon.get(polygonKey(moving ? source.vertices.map((p) => p.clone().applyAxisAngle(axis, angle)) : source.vertices));
        expect(target, `${move} rigid polygon endpoint`).toBeDefined();
        expect(target!.orbit, move).toBe(source.orbit);
        expect(pattern[target!.orbit].pieces[target!.ord], `${move} destination piece`).toBe(source.ord);
        const orientations = spec.orbits.find(([name]) => name === source.orbit)![2];
        if (source.orbit !== spec.unmarkedOrbit) {
          expect((target!.ori - pattern[target!.orbit].orientation[target!.ord] + orientations) % orientations, `${move} orientation`).toBe(source.ori);
        }
        if (moving) wrongDirectionError = Math.max(wrongDirectionError,
          source.center.clone().applyAxisAngle(axis, -angle).distanceTo(target!.center));
      }
      // +/-180 degrees share an endpoint; the renderer's middle frame below
      // verifies their direction. Other orders also have a reversed-sign control.
      if (choice.axis.order !== 2) expect(wrongDirectionError, `${move} reversed-sign negative control`).toBeGreaterThan(0.1);
    }
  });

  it('preserves opposite depths, legal wide ranges and whole rotations while rejecting nonexistent layers', () => {
    const puzzle = nativePuzzleKPuzzle(spec.id);
    const single = (family: string, layer: number) => `${layer === 1 ? '' : layer}${family}`;
    const equivalent = (actual: string, expected: string) => expect(
      puzzle.algToTransformation(parseNativePuzzleAlg(spec.id, actual)).isIdentical(puzzle.algToTransformation(expected)), actual,
    ).toBe(true);
    for (const axis of spec.axes) {
      const physicalLayers = boundaries(axis).length + 1;
      for (const [a, b] of axis.pairs) for (const [family, opposite] of [[a, b], [b, a]]) {
        for (let depth = 1; depth <= physicalLayers; depth++) equivalent(single(family, depth), `${single(opposite, physicalLayers + 1 - depth)}'`);
        for (let width = 2; width < physicalLayers; width++) {
          const slices = Array.from({ length: width }, (_, i) => single(family, i + 1)).join(' ');
          equivalent(`1-${width}${family}`, slices);
          if (!axis.rangeWide) equivalent(`${width === 2 ? '' : width}${family}w`, slices);
        }
        equivalent(`${family}v`, Array.from({ length: physicalLayers }, (_, i) => single(family, i + 1)).join(' '));
        const invalid = [`${physicalLayers + 1}${family}`, `${physicalLayers}${family}w`, `2${family}v`];
        if (axis.rangeWide || physicalLayers === 2) invalid.push(`${family}w`);
        for (const token of invalid) expect(() => parseNativePuzzleAlg(spec.id, token), token).toThrow();
      }
    }
  });
});

it.each(['cube2heli', 'cube3heli'] as const)('keeps %s pieces rigid through interleaved face, edge, slice, wide and whole turns', (id) => {
  const spec = CASES.find((candidate) => candidate.id === id)!;
  const twoHalves = id === 'cube2heli';
  const { stickers, byPolygon, puzzle } = fixture(spec);
  // Track physical source stickers geometrically; PG only supplies the state
  // being checked, never the next moving set or expected destination.
  const live = stickers.map((sticker) => ({ ...sticker, vertices: sticker.vertices.map((p) => p.clone()) }));
  const sequence = [
    { move: 'F', family: 'F', axis: 0, first: 1, last: 1, amount: 1 },
    { move: "UF'", family: 'UF', axis: 1, first: 1, last: 1, amount: -1 },
    { move: twoHalves ? "R'" : "2R'", family: 'R', axis: 0, first: twoHalves ? 1 : 2, last: twoHalves ? 1 : 2, amount: -1 },
    { move: 'DFw', family: 'DF', axis: 1, first: 1, last: 2, amount: 1 },
    { move: 'Fv', family: 'F', axis: 0, first: 1, last: twoHalves ? 2 : 3, amount: 1 },
    { move: "2BL'", family: 'BL', axis: 1, first: 2, last: 2, amount: -1 },
    { move: twoHalves ? "B'" : "Bw'", family: 'B', axis: 0, first: 1, last: twoHalves ? 1 : 2, amount: -1 },
  ];
  let pattern = puzzle.defaultPattern();
  for (const step of sequence) {
    const axisSpec = spec.axes[step.axis], axis = axisSpec.normals[step.family];
    const bounds = [Infinity, ...boundaries(axisSpec), -Infinity];
    const high = bounds[step.first - 1], low = bounds[step.last];
    const angle = -step.amount * 2 * Math.PI / axisSpec.order;
    const pieces = new Map<string, typeof live>();
    for (const sticker of live) {
      const key = `${sticker.orbit}:${sticker.ord}`;
      pieces.set(key, [...(pieces.get(key) ?? []), sticker]);
    }
    for (const [key, piece] of pieces) {
      const points = piece.flatMap((sticker) => sticker.vertices);
      const q = center(points).dot(axis), moving = q > low + EPS && q < high - EPS;
      const distances = points.map((p) => p.dot(axis));
      const below = Math.max(...distances) <= low + EPS, above = Math.min(...distances) >= high - EPS;
      expect(moving || below || above, `${step.move} live unsplit piece ${key}`).toBe(true);
      if (!moving) continue;
      for (const point of points) {
        for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
          const rotated = point.clone().applyAxisAngle(axis, angle * progress);
          expect(rotated.dot(axis), `${step.move} live slab at ${progress}`).toBeCloseTo(point.dot(axis), 10);
          expect(rotated.dot(axis), `${step.move} lower separation`).toBeGreaterThanOrEqual(low - EPS);
          expect(rotated.dot(axis), `${step.move} upper separation`).toBeLessThanOrEqual(high + EPS);
        }
        point.applyAxisAngle(axis, angle);
      }
    }
    pattern = pattern.applyAlg(parseNativePuzzleAlg(spec.id, step.move));
    for (const source of live) {
      const target = byPolygon.get(polygonKey(source.vertices));
      expect(target, `${step.move} live destination`).toBeDefined();
      expect(target!.orbit, `${step.move} orbit`).toBe(source.orbit);
      expect(pattern.patternData[target!.orbit].pieces[target!.ord], `${step.move} live piece`).toBe(source.ord);
      const orientations = spec.orbits.find(([name]) => name === source.orbit)![2];
      expect((target!.ori - pattern.patternData[target!.orbit].orientation[target!.ord] + orientations) % orientations,
        `${step.move} live sticker orientation`).toBe(source.ori);
    }
  }
  expect(puzzle.algToTransformation('F UF').isIdentical(puzzle.algToTransformation('UF F')),
    'face and edge turns genuinely interact').toBe(false);
  const alg = parseNativePuzzleAlg(spec.id, sequence.map(({ move }) => move).join(' '));
  expect(pattern.applyAlg(alg.invert()).isIdentical(puzzle.defaultPattern())).toBe(true);
});

it('keeps the central 2x2 cut even though it adds no visible Helicopter seams', () => {
  const spec = CASES.find(({ id }) => id === 'cube2heli')!;
  const helicopter: Spec = { ...spec, axes: [spec.axes[1]] };
  for (const normal of Object.values(cubeNormals)) {
    expect(expectedFace(spec, normal).map(polygonKey).sort())
      .toEqual(expectedFace(helicopter, normal).map(polygonKey).sort());
  }
  const puzzle = nativePuzzleKPuzzle(spec.id);
  expect(puzzle.moveToTransformation('F').repetitionOrder()).toBe(4);
  expect(puzzle.moveToTransformation('DF').repetitionOrder()).toBe(2);
  expect(puzzle.algToTransformation('F DF').isIdentical(puzzle.algToTransformation('DF F'))).toBe(false);
  expect(() => parseNativePuzzleAlg(spec.id, 'Fw')).toThrow();
});

it('derives Baby Face cuts through five neighboring vertices and preserves exactly twenty whole triangular faces', () => {
  const vertices = Object.values(icoVertexNormals).map((normal) => normal.clone().multiplyScalar(ICO_RADIUS));
  for (const axis of Object.values(icoVertexNormals)) {
    expect(vertices.filter((v) => Math.abs(v.dot(axis) - BABY_CUT) < EPS)).toHaveLength(5);
  }
  const spec = CASES.find(({ id }) => id === 'icosababyface')!;
  for (const normal of Object.values(icoNormals)) {
    expect(expectedFace(spec, normal).map(polygonKey)).toEqual([polygonKey(uncutFace(normal, Object.values(icoNormals)))]);
  }
  expect(NATIVE_PUZZLES.icosababyface.description).not.toBe(NATIVE_PUZZLES.dogic.description);
});

it('keeps Comboctahedron independent tip turns even though their added plane changes no visible face outline', () => {
  const spec = CASES.find(({ id }) => id === 'comboctahedron')!;
  const shallowOmitted: Spec = { ...spec, axes: [spec.axes[0], { ...spec.axes[1], cuts: [1 / Math.sqrt(3)] }] };
  for (const normal of Object.values(octaNormals)) {
    expect(expectedFace(spec, normal).map(polygonKey).sort())
      .toEqual(expectedFace(shallowOmitted, normal).map(polygonKey).sort());
  }
  const puzzle = nativePuzzleKPuzzle(spec.id);
  for (const family of Object.keys(octaVertexNormals)) {
    const transform = puzzle.moveToTransformation(family).transformationData;
    expect(transform.C4RNER.permutation).toEqual(Array.from({ length: 6 }, (_, index) => index));
    expect(transform.C4RNER.orientationDelta.filter((amount) => amount !== 0)).toHaveLength(1);
    for (const name of ['EDGES', 'CENTERS']) {
      expect(transform[name].permutation).toEqual(Array.from({ length: transform[name].permutation.length }, (_, index) => index));
      expect(transform[name].orientationDelta.every((amount) => amount === 0)).toBe(true);
    }
    expect(puzzle.moveToTransformation(family).isIdentical(puzzle.moveToTransformation(`1-2${family}`))).toBe(false);
  }
});

type Position = Awaited<ReturnType<TwistyPlayer['experimentalModel']['legacyPosition']['get']>>;
type PlayerObject = Awaited<ReturnType<TwistyPlayer['experimentalCurrentThreeJSPuzzleObject']>>;
type PlayerVantage = Awaited<ReturnType<TwistyPlayer['experimentalCurrentVantages']>> extends Iterable<infer Vantage> ? Vantage : never;
type AnimatedPG = PlayerObject & {
  movingObj: Pick<PlayerObject, 'quaternion'>;
  onPositionChange(position: Position): void;
  stickers: Record<string, Array<Array<{ twistVal: number }>>>;
  dispose(): void;
};
const players: TwistyPlayer[] = [];
const animations: AnimatedPG[] = [];
const detachedVantages: PlayerVantage[] = [];
const originalAdoptedStyleSheets = Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'adoptedStyleSheets');

afterEach(async () => {
  const retiredPlayers = players.splice(0);
  for (const player of retiredPlayers) { player.pause(); player.remove(); }
  const scenes = new Set<NonNullable<PlayerVantage['scene']>>();
  for (const vantage of detachedVantages.splice(0)) {
    const scene = vantage.scene;
    expect(scene).not.toBeNull();
    if (!scene) continue;
    scene.removeVantage(vantage);
    scenes.add(scene);
  }
  for (const scene of scenes) {
    scene.disconnect();
    expect([...scene.experimentalVantages()]).toHaveLength(0);
  }
  for (const animation of animations.splice(0)) animation.dispose();
  if (originalAdoptedStyleSheets) Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', originalAdoptedStyleSheets);
  else delete (ShadowRoot.prototype as Partial<ShadowRoot>).adoptedStyleSheets;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (retiredPlayers.length) {
    // Keep the production scene cleanup check: pending model notifications
    // must not let an orphaned camera initialize WebGL after this test ends.
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    try {
      for (const player of retiredPlayers) {
        player.hintFacelets = 'none';
        player.backView = 'top-right';
        await Promise.all([
          player.experimentalModel.twistySceneModel.hintFacelet.get(),
          player.experimentalModel.backView.get(),
        ]);
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      for (const scene of scenes) expect([...scene.experimentalVantages()]).toHaveLength(0);
      expect(getContext).not.toHaveBeenCalled();
    } finally {
      getContext.mockRestore();
    }
  }
});

it.each(['heliskewb', 'cube2heli', 'cube3heli', 'radiojewel', 'radioweb', 'radiojam', 'catscradle', 'radiocanon'] as const)('animates %s moves in both directions with the real PG3D matrices and selected pieces', async (id) => {
  // This is a local renderer fixture, not browser interaction evidence. The
  // real TwistyPlayer creates its real PG3D; only DOM camera attachment and
  // scheduling are suppressed because jsdom has no display or GPU.
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  const sheets = new WeakMap<ShadowRoot, CSSStyleSheet[]>();
  Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', { configurable: true, get(this: ShadowRoot) {
    if (!sheets.has(this)) sheets.set(this, []);
    return sheets.get(this)!;
  } });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('IntersectionObserver', class {
    constructor(private callback: (entries: Array<{ target: Element; isIntersecting: boolean; intersectionRect: { height: number } }>, observer: unknown) => void) {}
    observe(target: Element) { this.callback([{ target, isIntersecting: true, intersectionRect: { height: 600 } }], this); }
    unobserve() {}
    disconnect() {}
  });
  const appendChild = Node.prototype.appendChild;
  vi.spyOn(Node.prototype, 'appendChild').mockImplementation(function<T extends Node>(this: Node, child: T): T {
    if (child instanceof Element && child.localName === 'twisty-3d-vantage') {
      detachedVantages.push(child as unknown as PlayerVantage);
      return child;
    }
    return appendChild.call(this, child) as T;
  });
  const spec = CASES.find((candidate) => candidate.id === id)!;
  const player = new TwistyPlayer({ experimentalPuzzleDescription: NATIVE_PUZZLES[spec.id].description, controlPanel: 'none' });
  player.experimentalSetFlashLevel('none');
  players.push(player);
  document.body.appendChild(player);
  const object = await player.experimentalCurrentThreeJSPuzzleObject() as AnimatedPG;
  animations.push(object);
  expect(object.movingObj).toBeDefined();
  const { pieces } = fixture(spec);
  const puzzle = await (await player.experimentalModel.puzzleLoader.get()).kpuzzle();
  // Fixed samples of the renderer's quintic easing, independently applied to
  // physical vertices. Keep existing cases at their established middle frame;
  // the new fixed-center model checks start, end and three intermediate frames.
  const samples = id === 'radiocanon' || id === 'radiojam'
    ? [[0, 0], [0.2, 0.05792], [0.5, 0.5], [0.8, 0.94208], [1, 1]]
    : [[0.5, 0.5]];
  for (const choice of manualChoices(spec)) {
    const axis = choice.axis.normals[choice.family];
    const bounds = [Infinity, ...boundaries(choice.axis), -Infinity];
    const low = bounds[choice.last], high = bounds[choice.first - 1];
    let signWitness = 0;
    for (const amount of [1, -1]) for (const direction of [1, -1] as const) for (const [fraction, eased] of samples) {
      const move = new Move(choice.move).modified({ amount });
      object.onPositionChange({ pattern: puzzle.defaultPattern(), movesInProgress: [{ move, direction, fraction }] });
      for (const [key, points] of pieces) {
        const [orbit, ord] = key.split(':'), q = center(points).dot(axis);
        const moving = q > low + EPS && q < high - EPS;
        expect(object.stickers[orbit][0][Number(ord)].twistVal, `${move} renderer selection ${key}`).toBe(Number(moving));
        if (!moving) continue;
        for (const point of points) {
          const expected = point.clone().applyAxisAngle(axis, -direction * amount * 2 * Math.PI * eased / choice.order);
          const actual = point.clone().applyQuaternion(object.movingObj.quaternion);
          const wrong = point.clone().applyAxisAngle(axis, direction * amount * 2 * Math.PI * eased / choice.order);
          expect(actual.distanceTo(expected), `${move} frame ${fraction} direction ${direction}`).toBeLessThan(EPS);
          expect(actual.dot(axis), `${move} frame ${fraction} slab`).toBeCloseTo(point.dot(axis), 10);
          signWitness = Math.max(signWitness, wrong.distanceTo(actual));
        }
      }
    }
    expect(signWitness, `${choice.move} opposite signs have different intermediate frames`).toBeGreaterThan(0.1);
    expect(puzzle.moveToTransformation(choice.move).isIdentical(puzzle.moveToTransformation(`${choice.move}'`))).toBe(choice.order === 2);
  }
});


it('distinguishes Radio Jam from same-count Radio Web and preserves all of its small triangles', () => {
  const jam = CASES.find(({ id }) => id === 'radiojam')!;
  const web = CASES.find(({ id }) => id === 'radioweb')!;
  // Hyperspeedcube declares radio8 = 1/phi^2 but does NOT use it for radio08.
  // That alternative has the same number of pieces and a different silhouette.
  const unusedConstant = { ...jam, axes: [{ ...jam.axes[0], cuts: [1 / PHI ** 2] }] };
  const area = (polygon: Vector3[]) => polygon.reduce((sum, point, i) =>
    sum.add(point.clone().cross(polygon[(i + 1) % polygon.length])), new Vector3()).length() / 2;
  expect(Number(NATIVE_PUZZLES.radiojam.description.split(' ')[2])).toBeCloseTo(5 - 2 * Math.sqrt(5) - 0.06, 14);
  for (const normal of Object.values(icoNormals)) {
    const regions = expectedFace(jam, normal);
    expect(shapeCounts(regions)).toEqual({ 3: 15, 5: 6, 6: 1 });
    expect(shapeCounts(expectedFace(web, normal))).toEqual({ 3: 12, 4: 6, 5: 3, 6: 1 });
    expect(shapeCounts(expectedFace(unusedConstant, normal))).toEqual({ 3: 15, 4: 3, 5: 3, 6: 1 });
    expect(regions.map(area).reduce((sum, a) => sum + a, 0))
      .toBeCloseTo(area(uncutFace(normal, Object.values(icoNormals))), 10);
  }
  const { stickers } = fixture(jam);
  const counts = new Map<string, number>();
  for (const sticker of stickers) {
    const key = sticker.orbit + ':' + sticker.ord;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  expect([...counts.values()].filter((n) => n === 1)).toHaveLength(200);
  expect([...counts.values()].filter((n) => n === 2)).toHaveLength(90);
  expect([...counts.values()].filter((n) => n === 5)).toHaveLength(12);
});
