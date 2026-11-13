import * as THREE from 'three';
import { Move } from 'cubing/alg';
import type { KPattern, KTransformationData } from 'cubing/kpuzzle';
import { getPuzzleGeometryByDesc, type StickerDatSticker } from 'cubing/puzzle-geometry';
import { INTERACTIVE_PG_PUZZLES, type PgInteractionPuzzleId } from '@cuberoot/puzzle-solvers/native-puzzles';
import { nativePuzzleKPuzzle } from '@cuberoot/puzzle-solvers/native-puzzle-model';

export interface NativePgScenePosition {
  pattern: KPattern;
  movesInProgress: readonly { move: Move; direction: number; fraction: number }[];
}

export interface NativePgSceneRoot extends THREE.Group {
  experimentalGetControlTargets(): THREE.Object3D[];
  getClosestMoveToAxis(worldPoint: THREE.Vector3, options: {
    invert: boolean;
    depth: 'none' | 'secondSlice' | 'rotation';
  }): { move: Move } | null;
}

export interface NativePgScene {
  root: NativePgSceneRoot;
  /** Positive native moves rotate by -2π/order about these local-space axes. */
  readonly rotationAxes: readonly { move: Move; axis: THREE.Vector3; order: number }[];
  applyPosition(position: NativePgScenePosition): void;
  setHint(enabled: boolean): void;
  setCoreOpacity(percent: number): void;
  dispose(): void;
}

interface Facelet {
  source: StickerDatSticker;
  group: THREE.Group;
  colors: THREE.BufferAttribute;
  hint: THREE.Mesh;
}

const keyOf = (orbit: string, piece: number, orientation: number): string => `${orbit}-${piece}-${orientation}`;

/** A convex PG polygon, in the same half-scale frame used by native PG picking. */
function polygonGeometry(vertices: THREE.Vector3[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flatMap((v) => v.toArray()), 3));
  const indices: number[] = [];
  for (let i = 1; i < vertices.length - 1; i++) indices.push(0, i, i + 1);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Native PG's real 3D surface, independent of a WebGL renderer. State and move
 * notation stay in the shared KPuzzle; the existing scene SVG exporter projects
 * these same meshes and the pointer controller raycasts their physical surface.
 */
export function createNativePgScene(id: PgInteractionPuzzleId): NativePgScene {
  const data = getPuzzleGeometryByDesc(INTERACTIVE_PG_PUZZLES[id].description, {
    allMoves: true, orientCenters: true, addRotations: true,
  }).get3d();
  const puzzle = nativePuzzleKPuzzle(id);
  const root = new THREE.Group() as NativePgSceneRoot;
  root.name = `native-pg:${id}`;
  const controlTargets: THREE.Object3D[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const facelets: Facelet[] = [];
  // Preserve native PG's black foundation material, independent of page theme.
  const coreMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  const stickerMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const hintMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, transparent: true, opacity: 0.5, depthWrite: false,
  });
  const orientationCounts = new Map(puzzle.definition.orbits.map((orbit) => [orbit.orbitName, orbit.numOrientations]));
  // Oriented single-color centers have duplicate entries. They are essential to
  // this lookup, but must not become coincident visible stickers or pick targets.
  const palette = new Map(data.stickers.map((sticker) => [
    keyOf(sticker.orbit, sticker.ord, sticker.ori), new THREE.Color(sticker.color),
  ]));
  const axes = data.axis.map((axis) => ({
    move: new Move(axis.quantumMove.toString()),
    vector: new THREE.Vector3().fromArray(axis.coordinates).normalize(),
    order: axis.order,
  }));
  const axesByFamily = new Map(axes.map((axis) => [axis.move.family, axis]));
  const rotationAxes: { move: Move; axis: THREE.Vector3; order: number }[] = [];
  for (const axis of axes) {
    const move = data.notationMapper.notationToExternal(axis.move.modified({ family: `${axis.move.family}v` }));
    if (!move) continue;
    try { puzzle.moveToTransformation(move); } catch { continue; }
    rotationAxes.push({ move, axis: axis.vector.clone(), order: axis.order });
  }
  const transformations = new Map<string, KTransformationData>();
  let disposed = false;
  let lastPattern: KPattern | undefined;

  for (const source of data.stickers) {
    if (source.isDup) continue;
    const vertices = Array.from({ length: source.coords.length / 3 }, (_, i) => (
      new THREE.Vector3().fromArray(source.coords, i * 3).multiplyScalar(0.5)
    ));
    const center = vertices.reduce((sum, vertex) => sum.add(vertex), new THREE.Vector3()).divideScalar(vertices.length);
    const normal = new THREE.Vector3().subVectors(vertices[1], vertices[0])
      .cross(new THREE.Vector3().subVectors(vertices[2], vertices[0])).normalize();
    if (normal.dot(center) < 0) { vertices.reverse(); normal.negate(); }
    const identity = keyOf(source.orbit, source.ord, source.ori);
    const group = new THREE.Group();
    group.name = identity;
    const surfaceGeometry = polygonGeometry(vertices);
    const surface = new THREE.Mesh(surfaceGeometry, coreMaterial);
    surface.name = `surface:${identity}`;
    // This is the actual cut polygon, not a center-extruded approximation of a
    // piece. Keep its full boundary for the native physical-surface drag checks.
    controlTargets.push(surface);
    const stickerGeometry = polygonGeometry(vertices.map((v) => v.clone().sub(center).multiplyScalar(0.94).add(center)));
    const colors = new THREE.Float32BufferAttribute(new Float32Array(vertices.length * 3), 3);
    colors.setUsage(THREE.DynamicDrawUsage);
    stickerGeometry.setAttribute('color', colors);
    const sticker = new THREE.Mesh(stickerGeometry, stickerMaterial);
    sticker.name = `sticker:${identity}`;
    // Same face plane, with an explicit order for the CPU painter's coplanar tie.
    sticker.renderOrder = 1;
    const hint = new THREE.Mesh(stickerGeometry, hintMaterial);
    hint.name = `hint:${identity}`;
    hint.position.copy(normal).multiplyScalar(0.25);
    hint.renderOrder = 2;
    hint.visible = false;
    group.add(surface, sticker, hint);
    root.add(group);
    geometries.push(surfaceGeometry, stickerGeometry);
    facelets.push({ source, group, colors, hint });
  }

  root.experimentalGetControlTargets = () => controlTargets;
  root.getClosestMoveToAxis = (worldPoint, { invert, depth }) => {
    if (disposed) return null;
    root.updateWorldMatrix(true, false);
    const point = root.worldToLocal(worldPoint.clone());
    let bestDot = 0;
    let bestMove: Move | null = null;
    for (const axis of axes) {
      const dot = point.dot(axis.vector);
      if (dot <= bestDot || (depth === 'none' && axis.move.family === 'T')) continue;
      const raw = depth === 'secondSlice' ? axis.move.modified({ innerLayer: 2 })
        : depth === 'rotation' ? axis.move.modified({ family: `${axis.move.family}v` }) : axis.move;
      const external = data.notationMapper.notationToExternal(raw);
      if (!external) continue;
      try { puzzle.moveToTransformation(external); } catch { continue; }
      bestDot = dot;
      bestMove = external;
    }
    // nativePgPointer passes invert=true for the same left-tap convention as PG3D.
    return bestMove ? { move: invert ? bestMove.invert() : bestMove } : null;
  };

  const applyPosition = ({ pattern, movesInProgress }: NativePgScenePosition): void => {
    if (disposed) return;
    const active = movesInProgress.map(({ move, direction, fraction }) => {
      if (!Number.isFinite(direction) || !Number.isFinite(fraction)) throw new Error('Invalid native PG move progress');
      const internal = data.unswizzle(move);
      const axis = internal && axesByFamily.get(internal.family);
      if (!internal || !axis) throw new Error(`Missing native PG axis for ${move}`);
      // A full-order amount is an identity at its endpoint, but still turns the
      // same pieces during animation. Membership must use a one-step move.
      const unit = move.modified({ amount: 1 });
      const key = unit.toString();
      let transform = transformations.get(key);
      if (!transform) {
        transform = puzzle.moveToTransformation(unit).transformationData;
        transformations.set(key, transform);
      }
      const angle = -THREE.MathUtils.smootherstep(fraction, 0, 1) * direction * internal.amount * 2 * Math.PI / axis.order;
      return { transform, rotation: new THREE.Quaternion().setFromAxisAngle(axis.vector, angle) };
    });
    for (const { source, group, colors } of facelets) {
      if (pattern !== lastPattern) {
        const orbit = pattern.patternData[source.orbit];
        const count = orientationCounts.get(source.orbit)!;
        const sourceOrientation = ((source.ori - orbit.orientation[source.ord]) % count + count) % count;
        const color = palette.get(keyOf(source.orbit, orbit.pieces[source.ord], sourceOrientation))!;
        for (let i = 0; i < colors.count; i++) colors.setXYZ(i, color.r, color.g, color.b);
        // The scene export signature observes this version as well as matrices.
        colors.needsUpdate = true;
      }
      group.quaternion.identity();
      for (const { transform, rotation } of active) {
        const orbit = transform[source.orbit];
        if (orbit.permutation[source.ord] !== source.ord || orbit.orientationDelta[source.ord] !== 0) {
          group.quaternion.premultiply(rotation);
        }
      }
    }
    lastPattern = pattern;
    root.updateMatrixWorld(true);
  };

  applyPosition({ pattern: puzzle.defaultPattern(), movesInProgress: [] });
  return {
    root,
    rotationAxes,
    applyPosition,
    setHint(enabled) {
      for (const facelet of facelets) facelet.hint.visible = enabled;
    },
    setCoreOpacity(percent) {
      if (!Number.isFinite(percent)) return;
      const opacity = THREE.MathUtils.clamp(percent / 100, 0, 1);
      coreMaterial.opacity = opacity;
      coreMaterial.transparent = opacity < 1;
      coreMaterial.depthWrite = opacity === 1;
      coreMaterial.needsUpdate = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const geometry of geometries) geometry.dispose();
      coreMaterial.dispose();
      stickerMaterial.dispose();
      hintMaterial.dispose();
      root.clear();
      controlTargets.length = 0;
      facelets.length = 0;
      transformations.clear();
    },
  };
}
