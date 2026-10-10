import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Move } from 'cubing/alg';
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { NATIVE_PUZZLES, nativePuzzleMoves } from '@cuberoot/puzzle-solvers/native-puzzles';
import { nativePuzzleKPuzzle, parseNativePuzzleAlg } from '@cuberoot/puzzle-solvers/native-puzzle-model';

// Physical references, independently of the native registry:
// https://www.tomvanderzanden.nl/puzzle.php?puz=Master+Brilic
// https://www.chewiescustompuzzles.com/puzzleshop/p/master-brilic
// https://www.chewiescustompuzzles.com/puzzleshop/p/master-fto-v2
// Brilic's photographed face has ten small edge triangles, five other triangles
// and fifteen quadrilaterals. With inradius 1, adjacent dodecahedral normals have
// dot product d = 1/sqrt(5). The cuts through the pentagon center have depth d;
// the small triangles meet exactly when h = d + (1-d)/phi = 4/sqrt(5)-1.
// FTO v2 has 19 regions per face (13 triangles, 3 quads, 3 pentagons), versus
// the original Master FTO's 16 triangles. Its 0.4 depth is an idealized member of
// that deeper-cut topology, not a claimed measurement of the manufactured toy.
const D = 1 / Math.sqrt(5);
const H = 4 / Math.sqrt(5) - 1;
const ringNormal = (turn: number) => new Vector3(
  2 * D * Math.sin(turn * 2 * Math.PI / 5), D, 2 * D * Math.cos(turn * 2 * Math.PI / 5),
);
const dodecaNormals: Record<string, Vector3> = {
  U: new Vector3(0, 1, 0), F: ringNormal(0), R: ringNormal(1),
  BR: ringNormal(2), BL: ringNormal(3), L: ringNormal(4),
};
const dodecaPairs = [['U', 'D'], ['F', 'B'], ['L', 'DR'], ['BL', 'FR'], ['BR', 'FL'], ['R', 'DL']] as const;
for (const [a, b] of dodecaPairs) dodecaNormals[b] = dodecaNormals[a].clone().negate();

// The eight normals are the vertices of a cube, rotated so U is vertical and
// F points forward. Letters name physical outside views, not PG's internal
// aliases (which include BB, BF, E, C, A and I on these two polyhedra).
const octaNormals: Record<string, Vector3> = {
  U: new Vector3(0, 1, 0), F: new Vector3(0, -1 / 3, 2 * Math.sqrt(2) / 3),
  L: new Vector3(-Math.sqrt(2 / 3), 1 / 3, Math.sqrt(2) / 3),
  R: new Vector3(Math.sqrt(2 / 3), 1 / 3, Math.sqrt(2) / 3),
};
const octaPairs = [['F', 'B'], ['U', 'D'], ['L', 'BR'], ['R', 'BL']] as const;
for (const [a, b] of octaPairs) octaNormals[b] = octaNormals[a].clone().negate();

const CASES = [
  {
    id: 'masterbrilic', normals: dodecaNormals, pairs: dodecaPairs, cuts: [D, H],
    boundaries: [H, D, -D, -H], layers: 3, order: 5,
    faces: 12, perFace: 30, raw: 360, visible: 360, pieces: 230,
    shapes: { 3: 15, 4: 15 },
    faceOrbits: [['CORNERS', 4, 5], ['EDGES', 3, 10], ['EDGES2', 4, 5], ['CENTERS', 4, 5], ['CENTERS2', 3, 5]],
    orbits: [['CORNERS', 20, 3], ['EDGES', 60, 2], ['EDGES2', 30, 2], ['CENTERS', 60, 1], ['CENTERS2', 60, 1]],
  },
  {
    id: 'masterftov2', normals: octaNormals, pairs: octaPairs, cuts: [0, 0.4],
    boundaries: [0.4, 0, -0.4], layers: 2, order: 3,
    faces: 8, perFace: 19, raw: 168, visible: 152, pieces: 110,
    shapes: { 3: 13, 4: 3, 5: 3 },
    faceOrbits: [['C4RNER', 3, 3], ['EDGES', 3, 6], ['CENTERS', 5, 3], ['CENTERS2', 4, 3], ['CENTERS3', 3, 3], ['CENTERS4', 3, 1]],
    orbits: [['C4RNER', 6, 4], ['EDGES', 24, 2], ['CENTERS', 24, 1], ['CENTERS2', 24, 1], ['CENTERS3', 24, 1], ['CENTERS4', 8, 3]],
  },
] as const;
type Spec = typeof CASES[number];

const EPS = 1e-9;
const center = (points: Vector3[]) => points.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(points.length);
const polygonKey = (points: Vector3[]) => points.map((p) => p.toArray().map((v) => Math.round(v * 1e8)).join(',')).sort().join(';');
const shapeCounts = (polygons: Vector3[][]) => polygons.reduce<Record<number, number>>((counts, p) => {
  counts[p.length] = (counts[p.length] ?? 0) + 1;
  return counts;
}, {});

// Construct each Platonic face from n.x <= 1 halfspaces. No PG coordinates,
// piece assignments, cut values or permutations enter the expected geometry.
function uncutFace(normal: Vector3, normals: Vector3[]): Vector3[] {
  const vertices: Vector3[] = [];
  for (let i = 0; i < normals.length; i++) for (let j = i + 1; j < normals.length; j++) {
    const b = normals[i], c = normals[j], bc = b.clone().cross(c);
    const determinant = normal.dot(bc);
    if (Math.abs(determinant) < EPS) continue;
    const point = bc.add(c.clone().cross(normal)).add(normal.clone().cross(b)).divideScalar(determinant);
    if (normals.every((n) => n.dot(point) <= 1 + EPS) && !vertices.some((v) => v.distanceTo(point) < EPS)) vertices.push(point);
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
  // Coincident cut intersections are single vertices, not microscopic edges.
  return result.filter((point, i) => {
    const before = result[(i + result.length - 1) % result.length];
    const after = result[(i + 1) % result.length];
    return point.distanceTo(before) > EPS && point.clone().sub(before).cross(after.clone().sub(point)).length() > EPS;
  });
}

function expectedFace(spec: Spec, normal: Vector3): Vector3[][] {
  let parts = [uncutFace(normal, Object.values(spec.normals))];
  for (const n of Object.values(spec.normals)) for (const offset of spec.cuts) {
    parts = parts.flatMap((polygon) => {
      const distances = polygon.map((p) => n.dot(p) - offset);
      if (Math.min(...distances) >= -EPS || Math.max(...distances) <= EPS) return [polygon];
      return [clip(polygon, n, offset), clip(polygon, n.clone().negate(), -offset)];
    });
  }
  return parts;
}

function fixture(id: Spec['id'], description: string = NATIVE_PUZZLES[id].description) {
  const pg = getPuzzleGeometryByDesc(description, { allMoves: true, orientCenters: true, addRotations: true });
  const geometry = pg.get3d();
  const visible = geometry.stickers.filter((s) => !s.isDup);
  // Remove only PG's common display scale. U's support plane is y = 1 in both
  // independent coordinate systems; cut depths are never measured from PG.
  const inradius = Math.max(...visible.flatMap((s) => s.coords.filter((_, i) => i % 3 === 1)));
  const stickers = visible.map((sticker) => {
    const vertices = Array.from({ length: sticker.coords.length / 3 }, (_, i) => new Vector3().fromArray(sticker.coords, i * 3).divideScalar(inradius));
    return { ...sticker, vertices, center: center(vertices) };
  });
  const pieces = new Map<string, Vector3[]>();
  for (const sticker of stickers) {
    const key = `${sticker.orbit}:${sticker.ord}`;
    pieces.set(key, [...(pieces.get(key) ?? []), ...sticker.vertices]);
  }
  return { pg, geometry, stickers, pieces, byPolygon: new Map(stickers.map((s) => [polygonKey(s.vertices), s])), puzzle: nativePuzzleKPuzzle(id) };
}

function manualChoices(spec: Spec) {
  return Object.keys(spec.normals).flatMap((family) => [
    { move: family, family, order: spec.order, depth: 'outer', first: 1, last: 1 },
    { move: `2${family}`, family, order: spec.order, depth: 'inner', first: 2, last: 2 },
    { move: `1-2${family}`, family, order: spec.order, depth: 'wide', first: 1, last: 2 },
    ...(spec.layers === 3 ? [
      { move: `3${family}`, family, order: spec.order, depth: 'inner3', first: 3, last: 3 },
      { move: `1-3${family}`, family, order: spec.order, depth: 'wide3', first: 1, last: 3 },
    ] : []),
  ]);
}

describe.each(CASES)('$id independent physical geometry', (spec) => {
  it('matches every face polygon, visible orbit and named outward axis', () => {
    const { pg, geometry, stickers, pieces, puzzle } = fixture(spec.id);
    expect(geometry.faces.length).toBe(spec.faces);
    expect(pg.stickersPerFace).toBe(spec.perFace);
    expect(geometry.stickers.length).toBe(spec.raw);
    expect(stickers.length).toBe(spec.visible);
    expect(pieces.size).toBe(spec.pieces);
    expect(new Set(stickers.map((s) => s.color)).size).toBe(spec.faces);
    expect(puzzle.definition.orbits.map((o) => [o.orbitName, o.numPieces, o.numOrientations])).toEqual(spec.orbits);
    for (const [family, normal] of Object.entries(spec.normals)) {
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
      const grip = geometry.axis.find((a) => geometry.notationMapper.notationToExternal(new Move(a.quantumMove.toString()))?.family === family);
      expect(grip, family).toBeDefined();
      expect(new Vector3().fromArray(grip!.coordinates).normalize().distanceTo(normal), family).toBeLessThan(EPS);
      expect(grip!.order, family).toBe(spec.order);
    }
  });

  it('matches every manual slice, range and inverse to independent selection and continuous rotation', () => {
    const { stickers, pieces, byPolygon, puzzle } = fixture(spec.id);
    const choices = manualChoices(spec);
    const metadata = ({ move, family, order, depth }: { move: string; family: string; order: number; depth: string }) => ({ move, family, order, depth });
    const sort = (a: { move: string }, b: { move: string }) => a.move.localeCompare(b.move);
    expect(nativePuzzleMoves(spec.id).map(metadata).sort(sort)).toEqual(choices.map(metadata).sort(sort));
    const bounds = [Infinity, ...spec.boundaries, -Infinity];
    const rotations = Object.keys(spec.normals).map((family) => ({ move: `${family}v`, family, first: 1, last: bounds.length - 1 }));
    for (const choice of [...choices, ...rotations]) for (const amount of [1, -1]) {
      const move = `${choice.move}${amount === -1 ? "'" : ''}`;
      const axis = spec.normals[choice.family];
      const upper = bounds[choice.first - 1], lower = bounds[choice.last];
      const angle = -amount * 2 * Math.PI / spec.order;
      const pattern = puzzle.defaultPattern().applyAlg(parseNativePuzzleAlg(spec.id, move)).patternData;
      expect(puzzle.moveToTransformation(move).repetitionOrder(), move).toBe(spec.order);
      const selected = new Set<string>();
      let isolationError = 0, distanceError = 0, wrongDirectionError = 0;
      for (const [key, points] of pieces) {
        const q = center(points).dot(axis);
        const moving = q > lower + EPS && q < upper - EPS;
        if (moving) selected.add(key);
        const distances = points.map((p) => p.dot(axis));
        // Each entire physical piece is in the selected slab or wholly beyond
        // one of its two boundaries. Rotations preserve those signed distances,
        // so the separating cut planes hold at intermediate angles as well.
        const below = Math.max(...distances) <= lower + EPS;
        const above = Math.min(...distances) >= upper - EPS;
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
      expect(distanceError, `${move} cut-plane distance at five progress values`).toBeLessThan(EPS);
      expect(isolationError, `${move} continuous separation`).toBeLessThan(EPS);
      for (const source of stickers) {
        const moving = selected.has(`${source.orbit}:${source.ord}`);
        const vertices = moving ? source.vertices.map((p) => p.clone().applyAxisAngle(axis, angle)) : source.vertices;
        const target = byPolygon.get(polygonKey(vertices));
        expect(target, `${move} rigid polygon endpoint`).toBeDefined();
        expect(target!.orbit, move).toBe(source.orbit);
        expect(pattern[target!.orbit].pieces[target!.ord], `${move} destination piece`).toBe(source.ord);
        const orientations = spec.orbits.find(([name]) => name === source.orbit)![2];
        // The single-color FTO face-center triangle has three PG orientation
        // copies; its spin is visually unmarked. All multi-face orientations
        // are observable and must agree with the directed geometric endpoint.
        if (!(source.orbit === 'CENTERS4' && spec.id === 'masterftov2')) {
          expect((target!.ori - pattern[target!.orbit].orientation[target!.ord] + orientations) % orientations, `${move} orientation`).toBe(source.ori);
        }
        if (moving) wrongDirectionError = Math.max(wrongDirectionError,
          source.center.clone().applyAxisAngle(axis, -angle).distanceTo(target!.center));
      }
      expect(wrongDirectionError, `${move} reversed-direction negative control`).toBeGreaterThan(0.1);
    }
  });

  it('accepts exact depth aliases, explicit ranges and v rotations while rejecting invalid grips', () => {
    const puzzle = nativePuzzleKPuzzle(spec.id);
    const physicalLayers = spec.boundaries.length + 1;
    const single = (family: string, layer: number) => `${layer === 1 ? '' : layer}${family}`;
    for (const [a, b] of spec.pairs) for (const [family, opposite] of [[a, b], [b, a]]) {
      const equivalent = (actual: string, expected: string) => {
        expect(puzzle.algToTransformation(parseNativePuzzleAlg(spec.id, actual)).isIdentical(puzzle.algToTransformation(expected)), actual).toBe(true);
      };
      for (let depth = 1; depth <= physicalLayers; depth++) equivalent(single(family, depth), `${single(opposite, physicalLayers + 1 - depth)}'`);
      for (let depth = 2; depth < physicalLayers; depth++) {
        equivalent(`1-${depth}${family}`, Array.from({ length: depth }, (_, i) => single(family, i + 1)).join(' '));
      }
      equivalent(`${family}v`, Array.from({ length: physicalLayers }, (_, i) => single(family, i + 1)).join(' '));
      equivalent(family.toLowerCase(), `1-2${family}`);
      for (const invalid of [`${family}w`, `3${family}w`, `${physicalLayers + 1}${family}`, `1-${physicalLayers}${family}`]) {
        expect(() => parseNativePuzzleAlg(spec.id, invalid), invalid).toThrow();
      }
    }
  });
});

it('rejects the superficially similar 0.8 Brilic cut, including its ten false small-edge quadrilaterals', () => {
  const spec = CASES[0];
  const { stickers } = fixture('masterbrilic', `d f ${D} f 0.8`);
  const face = stickers.filter((s) => s.vertices.every((p) => Math.abs(p.y - 1) < EPS));
  // Counts and orbit sizes alone cannot catch this wrong model.
  expect(stickers.length).toBe(360);
  expect(face.length).toBe(30);
  expect(shapeCounts(face.map((s) => s.vertices))).toEqual({ 3: 5, 4: 25 });
  expect(face.filter((s) => s.orbit === 'EDGES' && s.vertices.length === 4).length).toBe(10);
  expect(face.map((s) => polygonKey(s.vertices)).sort()).not.toEqual(expectedFace(spec, spec.normals.U).map(polygonKey).sort());
});

it('keeps Master FTO v2 distinct from the original 128-facelet, 86-piece Master FTO', () => {
  const original = getPuzzleGeometryByDesc('o f 0.5 f 0', { allMoves: true, orientCenters: true, addRotations: true });
  const visible = original.get3d().stickers.filter((s) => !s.isDup);
  expect(visible.length).toBe(128);
  expect(visible.every((s) => s.coords.length === 9)).toBe(true);
  expect(new Set(visible.map((s) => `${s.orbit}:${s.ord}`)).size).toBe(86);
  expect(original.getKPuzzleDefinition(true).orbits.map((o) => [o.orbitName, o.numPieces, o.numOrientations])).toEqual([
    ['C4RNER', 6, 4], ['EDGES', 24, 2], ['CENTERS', 24, 1], ['CENTERS2', 24, 1], ['CENTERS3', 8, 3],
  ]);
  const current = fixture('masterftov2');
  expect(current.stickers.length - visible.length).toBe(24);
  expect(current.pieces.size - 86).toBe(24);
  expect(current.puzzle.definition.orbits).toContainEqual({ orbitName: 'CENTERS4', numPieces: 8, numOrientations: 3 });
});
