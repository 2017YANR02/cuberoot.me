import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Move } from 'cubing/alg';
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { INTERACTIVE_PG_PUZZLES } from '@cuberoot/puzzle-solvers/native-puzzles';
import { nativePuzzleKPuzzle, parseNativePuzzleAlg } from '@cuberoot/puzzle-solvers/native-puzzle-model';
import { renderNativePuzzleSvg } from '@cuberoot/puzzle-render-core/native-puzzle-svg';
import { exportSimSvg, simSceneSignature } from '@cuberoot/puzzle-render-core/scene-svg';
import { createNativePgScene, type NativePgScene } from '@/components/puzzle-models/nativePgScene';

const PHI = (1 + Math.sqrt(5)) / 2;
// Independently construct the dodecahedral dual normal, in the documented
// fivefold-vertex-up frame. Neither PG axes nor KPuzzle permutations define it.
const R_AXIS = new THREE.Vector3(1, -1, 1).divideScalar(Math.sqrt(3))
  .applyAxisAngle(new THREE.Vector3(1, 0, 0), -Math.atan(1 / PHI));
const SCRAMBLE = "R 2L' Gw Uv [F, U] Rw'";
const CASES = [
  { id: 'radiogem', visible: 440, cut: 1 / (PHI ** 4 + PHI ** 2) },
  { id: 'radiofathom', visible: 560, cut: 0.05 },
] as const;

const vertices = (coords: number[]): THREE.Vector3[] => Array.from({ length: coords.length / 3 }, (_, i) => (
  new THREE.Vector3().fromArray(coords, i * 3).multiplyScalar(0.5)
));
const center = (points: THREE.Vector3[]): THREE.Vector3 => points.reduce((sum, point) => sum.add(point), new THREE.Vector3())
  .divideScalar(points.length);
const netColors = (id: typeof CASES[number]['id'], alg: string): Map<string, string> => new Map(
  [...renderNativePuzzleSvg(id, alg).matchAll(/data-piece="([^"]+)" points="[^"]+" fill="([^"]+)"/g)]
    .map(([, key, fill]) => [key, fill]),
);
const colorOf = (model: NativePgScene, key: string): string => {
  const mesh = model.root.getObjectByName(`sticker:${key}`) as THREE.Mesh;
  const colors = mesh.geometry.getAttribute('color');
  return `#${new THREE.Color().setRGB(colors.getX(0), colors.getY(0), colors.getZ(0)).getHexString()}`;
};
const pointsOf = (mesh: THREE.Mesh, world = false): THREE.Vector3[] => {
  const position = mesh.geometry.getAttribute('position');
  return Array.from({ length: position.count }, (_, i) => {
    const point = new THREE.Vector3().fromBufferAttribute(position, i);
    return world ? point.applyMatrix4(mesh.matrixWorld) : point;
  });
};
const pointSetError = (actual: THREE.Vector3[], expected: THREE.Vector3[]): number => Math.max(
  ...actual.map((point) => Math.min(...expected.map((other) => point.distanceTo(other)))),
);

describe.each(CASES)('$id native software 3D scene', ({ id, visible, cut }) => {
  const data = getPuzzleGeometryByDesc(INTERACTIVE_PG_PUZZLES[id].description, {
    allMoves: true, orientCenters: true, addRotations: true,
  }).get3d();
  const puzzle = nativePuzzleKPuzzle(id);
  const solved = puzzle.defaultPattern();
  const rawSurfaces = new Map(data.stickers.filter((sticker) => !sticker.isDup).map((sticker) => [
    `${sticker.orbit}-${sticker.ord}-${sticker.ori}`, vertices(sticker.coords),
  ]));
  // The raw face fixes only overall scale. Slab boundaries and turn direction
  // below come from the independently specified icosahedron and cut depth.
  const inradius = center(vertices(data.faces[0].coords)).length();
  let model: NativePgScene;
  beforeEach(() => { model = createNativePgScene(id); });
  afterEach(() => { model.dispose(); });

  it('raycasts precisely the native cut surfaces, without duplicated centers or invented radial solids', () => {
    const surfaces = model.root.experimentalGetControlTargets() as THREE.Mesh[];
    expect(surfaces).toHaveLength(visible);
    expect(new Set(surfaces.map((mesh) => mesh.name)).size).toBe(visible);
    let maxError = 0;
    for (const mesh of surfaces) {
      const native = rawSurfaces.get(mesh.name.slice('surface:'.length))!;
      expect(pointsOf(mesh)).toHaveLength(native.length);
      expect(mesh.geometry.index!.count).toBe((native.length - 2) * 3);
      maxError = Math.max(maxError, pointSetError(pointsOf(mesh), native));
    }
    expect(maxError).toBeLessThan(8e-8);
  });

  it('shows the canonical colors after mixed turns, including oriented single-color centers, then restores the inverse', () => {
    const alg = parseNativePuzzleAlg(id, SCRAMBLE);
    const pattern = solved.applyAlg(alg);
    model.applyPosition({ pattern, movesInProgress: [] });
    const expected = netColors(id, SCRAMBLE);
    expect(expected.size).toBe(visible);
    for (const [key, fill] of expected) expect(colorOf(model, key), key).toBe(fill);
    expect(pattern.patternData.CENTERS4.orientation.some((orientation) => orientation !== 0)).toBe(true);
    model.applyPosition({ pattern: pattern.applyAlg(alg.invert()), movesInProgress: [] });
    for (const [key, fill] of netColors(id, '')) expect(colorOf(model, key), key).toBe(fill);
  });

  it('projects a perspective solid using ordinary sRGB output, and changes on camera orbit and state updates', () => {
    const scene = new THREE.Scene();
    scene.add(model.root);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
    camera.position.set(0, 0, 5);
    camera.updateMatrixWorld(true);
    const world = { scene, camera, width: 640, height: 640 };
    const svg = exportSimSvg({ world });
    expect(svg).not.toMatch(/NaN|Infinity/);
    const fills = new Set([...svg.matchAll(/fill="(#[a-f0-9]{6})"/g)].map((match) => match[1]));
    const nativePalette = new Set(data.stickers.map((sticker) => sticker.color));
    expect(fills.size).toBeGreaterThan(5);
    for (const fill of fills) expect(fill === '#000000' || nativePalette.has(fill), fill).toBe(true);

    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0.08, -0.04), camera);
    const hit = ray.intersectObjects(model.root.experimentalGetControlTargets(), true)[0];
    expect(hit).toBeDefined();
    const key = hit.object.name.slice('surface:'.length);
    const sticker = model.root.getObjectByName(`sticker:${key}`) as THREE.Mesh;
    const point = pointsOf(sticker, true)[0];
    // Analytic pinhole projection; it does not call the exporter's projection.
    const focal = 320 / Math.tan(20 * Math.PI / 180);
    const x = Math.round((320 + point.x * focal / (5 - point.z)) * 100) / 100;
    const y = Math.round((320 - point.y * focal / (5 - point.z)) * 100) / 100;
    expect(svg).toContain(`${x} ${y}`);
    ray.setFromCamera(new THREE.Vector2(0.98, 0.98), camera);
    expect(ray.intersectObjects(model.root.experimentalGetControlTargets(), true)).toHaveLength(0);

    const signature = simSceneSignature(world);
    model.applyPosition({ pattern: solved.applyMove('R'), movesInProgress: [] });
    expect(simSceneSignature(world)).not.toBe(signature);
    expect(exportSimSvg({ world })).not.toBe(svg);
    camera.position.set(3, 2, 4);
    camera.lookAt(0, 0, 0);
    const orbited = exportSimSvg({ world });
    expect(orbited).not.toBe(svg);
    expect(orbited).not.toMatch(/NaN|Infinity/);
  });

  it.each(['R', '2R', 'Rw'])('%s moves exactly its geometric slab through eased forward and backward frames', (family) => {
    const surfaces = model.root.experimentalGetControlTargets() as THREE.Mesh[];
    const boundary = inradius * cut;
    const selected = (points: THREE.Vector3[]): boolean => {
      const depth = center(points).dot(R_AXIS);
      return family === 'R' ? depth > boundary : family === '2R' ? Math.abs(depth) < boundary : depth > -boundary;
    };
    const selectedCount = [...rawSurfaces.values()].filter(selected).length;
    expect(selectedCount).toBeGreaterThan(0);
    expect(selectedCount).toBeLessThan(visible);
    // The numeric eased fractions are independent of Three's smootherstep.
    for (const [fraction, eased] of [[0.2, 0.05792], [0.5, 0.5], [0.8, 0.94208]]) {
      for (const [amount, direction] of [[1, 1], [-1, 1], [1, -1], [3, 1]]) {
        const move = new Move(family).modified({ amount });
        model.applyPosition({ pattern: solved, movesInProgress: [{ move, direction, fraction }] });
        let maxError = 0;
        for (const surface of surfaces) {
          const raw = rawSurfaces.get(surface.name.slice('surface:'.length))!;
          const angle = selected(raw) ? -eased * amount * direction * 2 * Math.PI / 3 : 0;
          const expected = raw.map((point) => point.clone().applyAxisAngle(R_AXIS, angle));
          maxError = Math.max(maxError, pointSetError(pointsOf(surface, true), expected));
        }
        expect(maxError, `${move} direction=${direction} fraction=${fraction}`).toBeLessThan(2e-7);
      }
    }
  });

  it.each(['R', '2R', 'Rw'])('%s animated endpoints coincide with completed native geometry and colors', (family) => {
    const surfaces = model.root.experimentalGetControlTargets() as THREE.Mesh[];
    const destinations = [...rawSurfaces].map(([key, points]) => ({ key, points, center: center(points) }));
    const base = solved.applyAlg(parseNativePuzzleAlg(id, SCRAMBLE));
    for (const [amount, direction] of [[1, 1], [-1, 1], [1, -1]]) {
      const move = new Move(family).modified({ amount });
      const completed = move.modified({ amount: amount * direction });
      model.applyPosition({ pattern: base, movesInProgress: [{ move, direction, fraction: 1 }] });
      const expectedColors = netColors(id, `${SCRAMBLE} ${completed}`);
      for (const surface of surfaces) {
        const sourceKey = surface.name.slice('surface:'.length);
        const actual = pointsOf(surface, true);
        const actualCenter = center(actual);
        // Nearest-center matching avoids a quantization boundary turning Float32
        // position rounding into a false missing sticker at a correct endpoint.
        const destination = destinations.reduce((best, candidate) => (
          candidate.center.distanceToSquared(actualCenter) < best.center.distanceToSquared(actualCenter) ? candidate : best
        ));
        expect(pointSetError(actual, destination.points), `${move} from ${sourceKey}`).toBeLessThan(2e-7);
        expect(colorOf(model, sourceKey), `${move} to ${destination.key}`).toBe(expectedColors.get(destination.key));
      }
      model.applyPosition({ pattern: base.applyMove(completed), movesInProgress: [] });
      for (const [key, color] of expectedColors) expect(colorOf(model, key), key).toBe(color);
    }
  });

  it('chooses tap axes in world coordinates and preserves native inversion and depth conventions', () => {
    model.root.rotation.set(0.27, -0.51, 0.19);
    model.root.position.set(0.4, -0.2, 0.1);
    model.root.updateMatrixWorld(true);
    const point = model.root.localToWorld(R_AXIS.clone());
    const original = point.clone();
    for (const [depth, expected] of [['none', 'R'], ['secondSlice', '2R'], ['rotation', 'Rv']] as const) {
      for (const invert of [false, true]) {
        const result = model.root.getClosestMoveToAxis(point, { depth, invert });
        expect(result).not.toBeNull();
        const move = new Move(expected);
        expect(puzzle.moveToTransformation(result!.move).isIdentical(
          puzzle.moveToTransformation(invert ? move.invert() : move),
        )).toBe(true);
      }
    }
    expect(point.equals(original)).toBe(true);
  });

  it('exposes valid face, vertex and edge rotations with their real orders and physical directions', () => {
    expect(model.rotationAxes).toHaveLength(62);
    expect(new Set(model.rotationAxes.map(({ order }) => order))).toEqual(new Set([2, 3, 5]));
    const surfaces = model.root.experimentalGetControlTargets() as THREE.Mesh[];
    for (const order of [2, 3, 5]) {
      const { move, axis } = model.rotationAxes.find((rotation) => rotation.order === order)!;
      expect(puzzle.moveToTransformation(move).repetitionOrder()).toBe(order);
      model.applyPosition({ pattern: solved, movesInProgress: [{ move, direction: 1, fraction: 0.5 }] });
      let maxError = 0;
      for (const surface of surfaces) {
        const raw = rawSurfaces.get(surface.name.slice('surface:'.length))!;
        const expected = raw.map((point) => point.clone().applyAxisAngle(axis, -Math.PI / order));
        maxError = Math.max(maxError, pointSetError(pointsOf(surface, true), expected));
      }
      expect(maxError, `${move} order=${order}`).toBeLessThan(2e-7);
    }
  });

  it('toggles hints and plastic opacity without removing pick surfaces, and releases resources once', () => {
    const surfaces = model.root.experimentalGetControlTargets() as THREE.Mesh[];
    const firstKey = surfaces[0].name.slice('surface:'.length);
    const hint = model.root.getObjectByName(`hint:${firstKey}`) as THREE.Mesh;
    expect(hint.visible).toBe(false);
    model.setHint(true);
    expect(hint.visible).toBe(true);
    model.setCoreOpacity(0);
    expect((surfaces[0].material as THREE.Material).opacity).toBe(0);
    expect(model.root.experimentalGetControlTargets()).toHaveLength(visible);
    let released = 0;
    surfaces[0].geometry.addEventListener('dispose', () => { released++; });
    model.dispose();
    model.dispose();
    expect(released).toBe(1);
    expect(model.root.children).toHaveLength(0);
    expect(model.root.experimentalGetControlTargets()).toHaveLength(0);
  });
});
