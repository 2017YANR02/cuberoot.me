// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Move } from 'cubing/alg';
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { TwistyPlayer } from 'cubing/twisty';
import { Vector3 } from 'three';
import { NATIVE_PUZZLES, nativePuzzleMoves } from '@cuberoot/puzzle-solvers/native-puzzles';
import { nativePuzzleKPuzzle, parseNativePuzzleAlg } from '@cuberoot/puzzle-solvers/native-puzzle-model';

// Physical references, separate from the implementation's PG descriptions:
// Quad-X: https://twistypuzzles.com/app/museum/museum_showitem.php?pkey=2858
// Its face topology is also visible in the modern printed example at
// https://cubein.cn/cdn/shop/files/Zhecube-Quad-x-Cube-3.jpg?v=1789282571&width=416 .
// Dino Octa: https://twistypuzzles.com/app/museum/museum_showitem.php?pkey=%3D2673
// Eitan's ETO: https://twistypuzzles.com/forum/viewtopic.php?f=15&t=19666
// Radio Crystal: https://www.puzzleforge.com/wp/2012/12/ (Jason Smith's original article).
// FTO5/FTO6 are uniform FTO extensions, not dimensional copies of particular toys.
// For FTO6, divide each edge into sixths: cuts 0, +/-1/3, +/-2/3.
// The original equal-layer FTO mechanism is documented by Jaap:
// https://www.jaapsch.net/puzzles/octaface.htm
// With body inradius 1, FTO5's equally spaced cuts are +/-1/5 and +/-3/5.
// Quad-X uses the symmetric three-slab idealization along a cube edge axis:
// the two outer edge midpoints are at +/-sqrt(2), so cuts are +/-sqrt(2)/3.
// ETO's cut is halfway to its octahedral edge midpoint: sqrt(3/2)/2 = sqrt(6)/4.
// Radio Crystal cuts pass through six other face centers; their dot product
// with the turning face's unit normal is exactly 1/3 (checked below).
// These tests cover complete shape-preserving moves, not partial-angle jumbling.
const EPS = 1e-9;
const QUAD_CUT = Math.SQRT2 / 3;
const ETO_CUT = Math.sqrt(6) / 4;
type Normals = Record<string, Vector3>;
type Pairs = readonly (readonly [string, string])[];

const cubeNormals: Normals = {
  U: new Vector3(0, 1, 0), D: new Vector3(0, -1, 0),
  F: new Vector3(0, 0, 1), B: new Vector3(0, 0, -1),
  R: new Vector3(1, 0, 0), L: new Vector3(-1, 0, 0),
};
const quadPairs = [['DF', 'UB'], ['FL', 'BR'], ['DB', 'UF'], ['DL', 'UR'], ['BL', 'FR'], ['UL', 'DR']] as const;
const quadNormals: Normals = Object.fromEntries(quadPairs.flat().map((family) => [family,
  [...family].reduce((sum, face) => sum.add(cubeNormals[face]), new Vector3()).normalize(),
]));

// The octahedron is independently the intersection of these eight halfspaces.
// They are cube vertices rotated so U is vertical and F points forward.
const octaNormals: Normals = {
  U: new Vector3(0, 1, 0), F: new Vector3(0, -1 / 3, 2 * Math.sqrt(2) / 3),
  L: new Vector3(-Math.sqrt(2 / 3), 1 / 3, Math.sqrt(2) / 3),
  R: new Vector3(Math.sqrt(2 / 3), 1 / 3, Math.sqrt(2) / 3),
};
const octaPairs = [['F', 'B'], ['D', 'U'], ['L', 'BR'], ['BL', 'R']] as const;
for (const [a, b] of [['U', 'D'], ['F', 'B'], ['L', 'BR'], ['R', 'BL']]) octaNormals[b] = octaNormals[a].clone().negate();
const etoPairs = [['FD', 'UBB'], ['FL', 'BRBB'], ['BLD', 'UR'], ['FR', 'BLBB'], ['UL', 'BRD'], ['BLL', 'BRR']] as const;
// Edge notation retains PG's BB name for the physical B face in this puzzle.
// Construct an outward edge normal from its two incident face normals.
const etoFaces = {
  FD: ['F', 'D'], UBB: ['U', 'B'], FL: ['F', 'L'], BRBB: ['BR', 'B'],
  BLD: ['BL', 'D'], UR: ['U', 'R'], FR: ['F', 'R'], BLBB: ['BL', 'B'],
  UL: ['U', 'L'], BRD: ['BR', 'D'], BLL: ['BL', 'L'], BRR: ['BR', 'R'],
};
const etoNormals: Normals = Object.fromEntries(Object.entries(etoFaces).map(([family, [a, b]]) => [family,
  octaNormals[a].clone().add(octaNormals[b]).normalize(),
]));

// Icosahedral face normals are the 20 vertices of the dual dodecahedron:
// (+/-1,+/-1,+/-1) and cyclic (0,+/-1/phi,+/-phi), divided by sqrt(3).
// A fixed rotation around x puts a fivefold body vertex at the top, matching
// the display's frame. No observed cut coordinates or permutations are used.
const PHI = (1 + Math.sqrt(5)) / 2;
const icoNormal = (x: number, y: number, z: number) => new Vector3(x, y, z)
  .divideScalar(Math.sqrt(3)).applyAxisAngle(new Vector3(1, 0, 0), -Math.atan(1 / PHI));
const icoNormals: Normals = {
  R: icoNormal(1, -1, 1), L: icoNormal(-1, -1, 1), G: icoNormal(1, 1, 1),
  U: icoNormal(0, 1 / PHI, PHI), H: icoNormal(1, -1, -1), C: icoNormal(1 / PHI, -PHI, 0),
  I: icoNormal(PHI, 0, -1 / PHI), O: icoNormal(-PHI, 0, -1 / PHI),
  F: icoNormal(0, -1 / PHI, PHI), A: icoNormal(-1 / PHI, -PHI, 0),
};
const icoPairs = [['R', 'K'], ['L', 'S'], ['G', 'N'], ['U', 'D'], ['H', 'Q'], ['C', 'M'], ['I', 'P'], ['O', 'E'], ['F', 'B'], ['A', 'J']] as const;
for (const [a, b] of icoPairs) icoNormals[b] = icoNormals[a].clone().negate();

const CASES = [
  {
    id: 'quadx', faceNormals: cubeNormals, turnNormals: quadNormals, pairs: quadPairs,
    cuts: [QUAD_CUT], boundaries: [QUAD_CUT, -QUAD_CUT], layers: 2, rangeWide: false, order: 2,
    faces: 6, perFace: 21, raw: 144, visible: 126, pieces: 98, shapes: { 3: 16, 4: 5 }, unmarkedOrbit: 'CENTERS4',
    faceOrbits: [['EDGES', 3, 4], ['CENTERS', 3, 4], ['CORNERS', 4, 4], ['CENTERS2', 3, 4], ['CENTERS3', 3, 4], ['CENTERS4', 4, 1]],
    orbits: [['EDGES', 12, 2], ['CENTERS', 24, 1], ['CORNERS', 8, 3], ['CENTERS2', 24, 1], ['CENTERS3', 24, 1], ['CENTERS4', 6, 4]],
  },
  {
    id: 'dinoocta', faceNormals: octaNormals, turnNormals: octaNormals, pairs: octaPairs,
    cuts: [1 / 2], boundaries: [1 / 2, -1 / 2], layers: 2, rangeWide: true, order: 3,
    faces: 8, perFace: 10, raw: 96, visible: 80, pieces: 50, shapes: { 3: 7, 4: 3 }, unmarkedOrbit: 'CENTERS2',
    faceOrbits: [['C4RNER', 3, 3], ['CENTERS', 3, 3], ['EDGES', 4, 3], ['CENTERS2', 3, 1]],
    orbits: [['C4RNER', 6, 4], ['CENTERS', 24, 1], ['EDGES', 12, 2], ['CENTERS2', 8, 3]],
  },
  {
    id: 'fto5', faceNormals: octaNormals, turnNormals: octaNormals, pairs: octaPairs,
    cuts: [1 / 5, 3 / 5], boundaries: [3 / 5, 1 / 5, -1 / 5, -3 / 5], layers: 3, rangeWide: true, order: 3,
    faces: 8, perFace: 25, raw: 216, visible: 200, pieces: 146, shapes: { 3: 25 }, unmarkedOrbit: 'CENTERS4',
    faceOrbits: [['EDGES', 3, 6], ['CENTERS', 3, 3], ['EDGES2', 3, 3], ['CENTERS2', 3, 3], ['CENTERS3', 3, 3], ['CENTERS4', 3, 1], ['CENTERS5', 3, 3], ['C4RNER', 3, 3]],
    orbits: [['EDGES', 24, 2], ['CENTERS', 24, 1], ['EDGES2', 12, 2], ['CENTERS2', 24, 1], ['CENTERS3', 24, 1], ['CENTERS4', 8, 3], ['CENTERS5', 24, 1], ['C4RNER', 6, 4]],
  },
  {
    id: 'eto', faceNormals: octaNormals, turnNormals: etoNormals, pairs: etoPairs,
    cuts: [ETO_CUT], boundaries: [ETO_CUT, -ETO_CUT], layers: 2, rangeWide: false, order: 2,
    faces: 8, perFace: 13, raw: 120, visible: 104, pieces: 62, shapes: { 3: 10, 4: 3 }, unmarkedOrbit: 'CENTERS2',
    faceOrbits: [['C4RNER', 4, 3], ['EDGES', 3, 6], ['CENTERS', 3, 3], ['CENTERS2', 3, 1]],
    orbits: [['C4RNER', 6, 4], ['EDGES', 24, 2], ['CENTERS', 24, 1], ['CENTERS2', 8, 3]],
  },
  {
    id: 'radiocrystal', faceNormals: icoNormals, turnNormals: icoNormals, pairs: icoPairs,
    cuts: [1 / 3], boundaries: [1 / 3, -1 / 3], layers: 2, rangeWide: false, order: 3,
    faces: 20, perFace: 15, raw: 300, visible: 300, pieces: 162, shapes: { 3: 15 }, unmarkedOrbit: '',
    faceOrbits: [['EDGES', 3, 6], ['C5RNER', 3, 3], ['CENTERS', 3, 3], ['EDGES2', 3, 3]],
    orbits: [['EDGES', 60, 2], ['C5RNER', 12, 5], ['CENTERS', 60, 1], ['EDGES2', 30, 2]],
  },
  {
    id: 'fto6', faceNormals: octaNormals, turnNormals: octaNormals, pairs: octaPairs,
    cuts: [0, 1 / 3, 2 / 3], boundaries: [2 / 3, 1 / 3, 0, -1 / 3, -2 / 3], layers: 3, rangeWide: true, order: 3,
    faces: 8, perFace: 36, raw: 288, visible: 288, pieces: 222, shapes: { 3: 36 }, unmarkedOrbit: '',
    faceOrbits: [['CENTERS', 3, 3], ['EDGES', 3, 6], ['CENTERS2', 3, 3], ['EDGES2', 3, 6], ['CENTERS3', 3, 3], ['CENTERS4', 3, 3], ['CENTERS5', 3, 3], ['CENTERS6', 3, 3], ['CENTERS7', 3, 3], ['C4RNER', 3, 3]],
    orbits: [['CENTERS', 24, 1], ['EDGES', 24, 2], ['CENTERS2', 24, 1], ['EDGES2', 24, 2], ['CENTERS3', 24, 1], ['CENTERS4', 24, 1], ['CENTERS5', 24, 1], ['CENTERS6', 24, 1], ['CENTERS7', 24, 1], ['C4RNER', 6, 4]],
  },
] as const;
type Spec = typeof CASES[number];
const center = (points: Vector3[]) => points.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(points.length);
const verticesOf = (coords: number[]) => Array.from({ length: coords.length / 3 }, (_, i) => new Vector3().fromArray(coords, i * 3));
const polygonKey = (points: Vector3[]) => points.map((p) => p.toArray().map((v) => Math.round(v * 1e8)).join(',')).sort().join(';');
const shapeCounts = (polygons: Vector3[][]) => polygons.reduce<Record<number, number>>((counts, p) => {
  counts[p.length] = (counts[p.length] ?? 0) + 1;
  return counts;
}, {});

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

function expectedFace(spec: Spec, normal: Vector3): Vector3[][] {
  let parts = [uncutFace(normal, Object.values(spec.faceNormals))];
  for (const n of Object.values(spec.turnNormals)) for (const offset of spec.cuts) {
    parts = parts.flatMap((polygon) => {
      const distances = polygon.map((p) => n.dot(p) - offset);
      if (Math.min(...distances) >= -EPS || Math.max(...distances) <= EPS) return [polygon];
      return [clip(polygon, n, offset), clip(polygon, n.clone().negate(), -offset)];
    });
  }
  return parts;
}

function fixture(spec: Spec) {
  const pg = getPuzzleGeometryByDesc(NATIVE_PUZZLES[spec.id].description, { allMoves: true, orientCenters: true, addRotations: true });
  const geometry = pg.get3d();
  // A regular uncut face's centroid lies one body inradius from the origin.
  // This removes only display scale, including the vertex-up icosahedron.
  const inradius = center(verticesOf(geometry.faces[0].coords)).length();
  const stickers = geometry.stickers.filter((s) => !s.isDup).map((s) => {
    const vertices = verticesOf(s.coords).map((v) => v.divideScalar(inradius));
    return { ...s, vertices, center: center(vertices) };
  });
  const pieces = new Map<string, Vector3[]>();
  for (const s of stickers) {
    const key = `${s.orbit}:${s.ord}`;
    pieces.set(key, [...(pieces.get(key) ?? []), ...s.vertices]);
  }
  return { pg, geometry, stickers, pieces, byPolygon: new Map(stickers.map((s) => [polygonKey(s.vertices), s])), puzzle: nativePuzzleKPuzzle(spec.id) };
}

function manualChoices(spec: Spec) {
  return Object.keys(spec.turnNormals).flatMap((family) => [
    { move: family, family, order: spec.order, depth: 'outer', first: 1, last: 1 },
    { move: `2${family}`, family, order: spec.order, depth: 'inner', first: 2, last: 2 },
    { move: spec.rangeWide ? `1-2${family}` : `${family}w`, family, order: spec.order, depth: 'wide', first: 1, last: 2 },
    ...(spec.layers === 3 ? [
      { move: `3${family}`, family, order: spec.order, depth: 'inner3', first: 3, last: 3 },
      { move: `1-3${family}`, family, order: spec.order, depth: 'wide3', first: 1, last: 3 },
    ] : []),
  ]);
}

describe.each(CASES)('$id independent physical model', (spec) => {
  it('matches every visible polygon, face orbit and independently named outward axis', () => {
    const { pg, geometry, stickers, pieces, puzzle } = fixture(spec);
    expect(geometry.faces.length).toBe(spec.faces);
    expect(pg.stickersPerFace).toBe(spec.perFace);
    expect(geometry.stickers.length).toBe(spec.raw);
    expect(stickers.length).toBe(spec.visible);
    expect(pieces.size).toBe(spec.pieces);
    expect(new Set(stickers.map((s) => s.color)).size).toBe(spec.faces);
    expect(puzzle.definition.orbits.map((o) => [o.orbitName, o.numPieces, o.numOrientations])).toEqual(spec.orbits);
    for (const [family, normal] of Object.entries(spec.faceNormals)) {
      const actual = stickers.filter((s) => s.vertices.every((p) => Math.abs(p.dot(normal) - 1) < EPS));
      const expected = expectedFace(spec, normal);
      expect(actual.length, family).toBe(spec.perFace);
      expect(new Set(actual.map((s) => s.face)).size, family).toBe(1);
      expect(new Set(actual.map((s) => s.color)).size, family).toBe(1);
      expect(shapeCounts(expected), family).toEqual(spec.shapes);
      expect(shapeCounts(actual.map((s) => s.vertices)), family).toEqual(spec.shapes);
      expect(actual.map((s) => polygonKey(s.vertices)).sort(), family).toEqual(expected.map(polygonKey).sort());
      for (const [orbit, sides, count] of spec.faceOrbits) {
        expect(actual.filter((s) => s.orbit === orbit && s.vertices.length === sides).length, `${family} ${orbit}`).toBe(count);
      }
    }
    for (const [family, normal] of Object.entries(spec.turnNormals)) {
      const grip = geometry.axis.find((a) => geometry.notationMapper.notationToExternal(new Move(a.quantumMove.toString()))?.family === family);
      expect(grip, family).toBeDefined();
      expect(new Vector3().fromArray(grip!.coordinates).normalize().distanceTo(normal), family).toBeLessThan(EPS);
      expect(grip!.order, family).toBe(spec.order);
    }
  });

  it('matches every layer and whole turn in both directions to independent slab selection and rigid rotation', () => {
    const { stickers, pieces, byPolygon, puzzle } = fixture(spec);
    const choices = manualChoices(spec);
    const metadata = ({ move, family, order, depth }: { move: string; family: string; order: number; depth: string }) => ({ move, family, order, depth });
    const sort = (a: { move: string }, b: { move: string }) => a.move.localeCompare(b.move);
    expect(nativePuzzleMoves(spec.id).map(metadata).sort(sort)).toEqual(choices.map(metadata).sort(sort));
    const bounds = [Infinity, ...spec.boundaries, -Infinity];
    const rotations = Object.keys(spec.turnNormals).map((family) => ({ move: `${family}v`, family, first: 1, last: bounds.length - 1 }));
    for (const choice of [...choices, ...rotations]) for (const amount of [1, -1]) {
      const move = `${choice.move}${amount === -1 ? "'" : ''}`;
      const axis = spec.turnNormals[choice.family], angle = -amount * 2 * Math.PI / spec.order;
      const upper = bounds[choice.first - 1], lower = bounds[choice.last];
      const pattern = puzzle.defaultPattern().applyAlg(parseNativePuzzleAlg(spec.id, move)).patternData;
      expect(puzzle.moveToTransformation(move).repetitionOrder(), move).toBe(spec.order);
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
        // Only the specifically identified, single-color face-center orbit has
        // invisible spin; every multi-face piece's orientation is observable.
        if (source.orbit !== spec.unmarkedOrbit) {
          expect((target!.ori - pattern[target!.orbit].orientation[target!.ord] + orientations) % orientations, `${move} orientation`).toBe(source.ori);
        }
        if (moving) wrongDirectionError = Math.max(wrongDirectionError,
          source.center.clone().applyAxisAngle(axis, -angle).distanceTo(target!.center));
      }
      // Involutions have identical +/-180-degree endpoints. Their sign must be
      // tested against the renderer's intermediate frame, separately below.
      if (spec.order === 3) expect(wrongDirectionError, `${move} reversed-sign negative control`).toBeGreaterThan(0.1);
    }
  });

  it('preserves opposite-depth aliases and whole rotations and rejects nonexistent layers', () => {
    const puzzle = nativePuzzleKPuzzle(spec.id), physicalLayers = spec.boundaries.length + 1;
    const single = (family: string, depth: number) => `${depth === 1 ? '' : depth}${family}`;
    const equivalent = (actual: string, expected: string) => expect(
      puzzle.algToTransformation(parseNativePuzzleAlg(spec.id, actual)).isIdentical(puzzle.algToTransformation(expected)), actual,
    ).toBe(true);
    for (const [a, b] of spec.pairs as Pairs) for (const [family, opposite] of [[a, b], [b, a]]) {
      for (let depth = 1; depth <= physicalLayers; depth++) equivalent(single(family, depth), `${single(opposite, physicalLayers + 1 - depth)}'`);
      for (let width = 2; width < physicalLayers; width++) {
        const slices = Array.from({ length: width }, (_, i) => single(family, i + 1)).join(' ');
        equivalent(`1-${width}${family}`, slices);
        if (!spec.rangeWide) equivalent(`${width === 2 ? '' : width}${family}w`, slices);
      }
      equivalent(`${family}v`, Array.from({ length: physicalLayers }, (_, i) => single(family, i + 1)).join(' '));
      const invalid = [`${physicalLayers + 1}${family}`, `${physicalLayers}${family}w`, `2${family}v`];
      if (spec.rangeWide) invalid.push(`${family}w`);
      for (const token of invalid) expect(() => parseNativePuzzleAlg(spec.id, token), token).toThrow();
    }
  });
});

it('keeps all sixth-grid stickers congruent and the opposite third layers independent', () => {
  const spec = CASES.find((entry) => entry.id === 'fto6')!;
  const { stickers, puzzle } = fixture(spec);
  // Shell edge sqrt(6), face area 3*sqrt(3)/2, divided into 36 congruent triangles.
  for (const { vertices: [a, b, c] } of stickers) {
    expect(b.clone().sub(a).cross(c.clone().sub(a)).length() / 2).toBeCloseTo(Math.sqrt(3) / 24, 10);
    expect(a.distanceTo(b)).toBeCloseTo(Math.sqrt(6) / 6, 10);
    expect(b.distanceTo(c)).toBeCloseTo(Math.sqrt(6) / 6, 10);
    expect(c.distanceTo(a)).toBeCloseTo(Math.sqrt(6) / 6, 10);
  }
  for (const [a, b] of octaPairs) {
    expect(puzzle.moveToTransformation(`3${a}`).isIdentical(puzzle.moveToTransformation(`3${b}'`))).toBe(false);
    expect(puzzle.algToTransformation(`1-3${a} 1-3${b}'`).isIdentical(puzzle.moveToTransformation(`${a}v`))).toBe(true);
  }
});

it('places Radio Crystal cuts at exactly six other face centers and removes the central facelet', () => {
  const spec = CASES[4];
  for (const normal of Object.values(icoNormals)) {
    expect(Object.values(icoNormals).filter((other) => Math.abs(normal.dot(other) - 1 / 3) < EPS).length).toBe(6);
    const face = expectedFace(spec, normal);
    // Six different cut lines through the face center create twelve sectors.
    // There is no stationary central sticker as in shallower Radiolarians.
    expect(face.filter((polygon) => polygon.some((point) => point.distanceTo(normal) < EPS)).length).toBe(12);
  }
  expect(fixture(spec).puzzle.definition.orbits.some((orbit) => orbit.orbitName === 'CENTERS2')).toBe(false);
});

it('keeps Dino Octa and uniform five-layer FTO distinct from existing FTO variants', () => {
  const fto = getPuzzleGeometryByDesc('o f 0.3333333333333333', { allMoves: true, orientCenters: true, addRotations: true });
  const old = fto.get3d().stickers.filter((s) => !s.isDup);
  expect(old.length).toBe(72);
  expect(old.every((s) => s.coords.length === 9)).toBe(true);
  expect(fixture(CASES[1]).stickers.filter((s) => s.vertices.length === 4).length).toBe(24);
  const master = getPuzzleGeometryByDesc('o f 0 f 0.5', { allMoves: true, orientCenters: true, addRotations: true });
  expect(master.get3d().stickers.filter((s) => !s.isDup).length).toBe(128);
  expect(fixture(CASES[2]).stickers.length).toBe(200);
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
    // Removing DOM nodes does not remove these views from the scene's render
    // list. removeVantage also disconnects the real puzzle wrapper's listeners.
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
    // Exercise late model notifications with the real RAF restored. The old
    // teardown reproduced the CI rejection here: an orphaned vantage attempted
    // to create WebGL after its player's test had already passed.
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

it.each([CASES[0], CASES[3]])('$id renders opposite half-turn paths at the real middle frame', async (spec) => {
  // Create the real PG3D through the same public TwistyPlayer API used by the
  // application. jsdom has no display/GPU, so keep camera vantages detached
  // while the real scene and puzzle initialize. No PG state, selected piece,
  // move direction, quaternion, material or puzzle geometry is mocked.
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
  const player = new TwistyPlayer({ experimentalPuzzleDescription: NATIVE_PUZZLES[spec.id].description, controlPanel: 'none' });
  player.experimentalSetFlashLevel('none');
  players.push(player);
  document.body.appendChild(player);
  const object = await player.experimentalCurrentThreeJSPuzzleObject() as AnimatedPG;
  animations.push(object);
  expect(object.movingObj).toBeDefined();
  const { pieces } = fixture(spec), bounds = [Infinity, ...spec.boundaries, -Infinity];
  const puzzle = await (await player.experimentalModel.puzzleLoader.get()).kpuzzle();
  for (const choice of manualChoices(spec)) {
    const axis = spec.turnNormals[choice.family], low = bounds[choice.last], high = bounds[choice.first - 1];
    let signWitness = 0;
    for (const amount of [1, -1]) for (const direction of [1, -1] as const) {
      const move = new Move(choice.move).modified({ amount });
      object.onPositionChange({ pattern: puzzle.defaultPattern(), movesInProgress: [{ move, direction, fraction: 0.5 }] });
      for (const [key, points] of pieces) {
        const [orbit, ord] = key.split(':'), q = center(points).dot(axis);
        const moving = q > low + EPS && q < high - EPS;
        expect(object.stickers[orbit][0][Number(ord)].twistVal, `${move} renderer selection ${key}`).toBe(Number(moving));
        if (!moving) continue;
        for (const point of points) {
          // At half progress, both linear and symmetric eased timelines are
          // at 90 degrees. The observer looking at the outward axis sees an
          // unprimed forward turn clockwise, hence the negative right-hand sign.
          const expected = point.clone().applyAxisAngle(axis, -direction * amount * Math.PI / 2);
          const actual = point.clone().applyQuaternion(object.movingObj.quaternion);
          const wrong = point.clone().applyAxisAngle(axis, direction * amount * Math.PI / 2);
          expect(actual.distanceTo(expected), `${move} middle frame direction ${direction}`).toBeLessThan(EPS);
          expect(actual.dot(axis), `${move} middle frame slab`).toBeCloseTo(point.dot(axis), 10);
          signWitness = Math.max(signWitness, wrong.distanceTo(actual));
        }
      }
    }
    expect(signWitness, `${choice.move} opposite signs have different 90-degree paths`).toBeGreaterThan(0.1);
    expect(puzzle.moveToTransformation(choice.move).isIdentical(puzzle.moveToTransformation(`${choice.move}'`))).toBe(true);
  }
});
