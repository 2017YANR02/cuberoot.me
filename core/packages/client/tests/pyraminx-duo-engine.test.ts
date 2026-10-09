import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import DuoCube from '@cuberoot/puzzle-render-core/engine/duo/DuoCube';
import { DUO_A } from '@cuberoot/puzzle-render-core/engine/duo/duoGeometry';
import { DUO_FACE_COLORS } from '@cuberoot/puzzle-render-core/duo-face';
import { applyAnimFrame } from '@cuberoot/puzzle-render-core/engine/pieceAnim';
import tweener from '@cuberoot/puzzle-render-core/engine/tweener';
import { timing } from '@cuberoot/puzzle-render-core/engine/tweenTiming';
import { exportSimSvgSchematic } from '@cuberoot/puzzle-render-core/schematic';
import {
  duoApply, duoStickerColor, parseDuoMoves, solvedDuo,
} from '@cuberoot/puzzle-solvers/pyraminx-duo';
import {
  duoPickHit, duoResolveLive, duoResolveMove,
} from '@/components/puzzle-models/gestures/duoDrag';

// The solver has a separate Rodrigues oracle. Here, literal tetrahedron normals
// identify the faces reached by actual mesh matrices, independently of state.
const VERTICES = [
  new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, -1, -1),
  new THREE.Vector3(-1, 1, -1), new THREE.Vector3(-1, -1, 1),
];
const NORMALS = VERTICES.map(vertex => vertex.clone().negate().normalize());
const TOKENS = ['U', "U'", 'L', "L'", 'R', "R'", 'B', "B'"];
const cubes = new Set<DuoCube>();

function makeCube(): DuoCube {
  const cube = new DuoCube();
  cubes.add(cube);
  return cube;
}

afterEach(() => {
  for (const cube of cubes) cube.dispose();
  cubes.clear();
  // Keep a failed orphan-tween assertion from contaminating subsequent tests.
  for (const tween of [...tweener.tweens]) tweener.cancel(tween);
  vi.restoreAllMocks();
});

function stickers(object: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  object.traverse(child => {
    if (child instanceof THREE.Mesh && child.userData.simRole === 'sticker') meshes.push(child);
  });
  return meshes;
}

function faceOfNormal(normal: THREE.Vector3): number {
  const faces = NORMALS.flatMap((candidate, face) => candidate.dot(normal) > 1 - 1e-9 ? [face] : []);
  expect(faces, `normal ${normal.toArray()}`).toHaveLength(1);
  return faces[0];
}

function expectModelGeometry(cube: DuoCube, sequence: string): void {
  const model = duoApply(sequence);
  expect(cube.state, sequence).toEqual(model);
  cube.updateWorldMatrix(true, true);
  const inverseCube = cube.matrixWorld.clone().invert();
  const occupied = new Set<string>();
  const meshes = stickers(cube);
  expect(meshes).toHaveLength(16);
  for (const mesh of meshes) {
    const localNormal = mesh.userData.simStickerNormal as THREE.Vector3;
    const normal = localNormal.clone().transformDirection(mesh.matrixWorld).transformDirection(inverseCube);
    const face = faceOfNormal(normal);
    const corner = mesh.userData.duoVertex as number | null;
    const homeFace = mesh.userData.duoFace as number;
    expect(duoStickerColor(model, face, corner), `${sequence}: ${mesh.userData.stickerKey}`).toBe(homeFace);
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshPhongMaterial;
    expect(material.color.getHexString()).toBe(new THREE.Color(DUO_FACE_COLORS[homeFace]).getHexString());
    occupied.add(`${face}:${corner ?? 'centre'}`);
  }
  expect(occupied.size).toBe(16);
}

function pivots(cube: DuoCube): THREE.Object3D[] {
  return [...cube.corners, ...cube.centres].map(piece => piece.pivot);
}

function snapshot(cube: DuoCube) {
  return {
    state: { corners: [...cube.state.corners], centers: [...cube.state.centers] },
    pose: pivots(cube).map(pivot => ({ position: pivot.position.toArray(), quaternion: pivot.quaternion.toArray() })),
    history: { init: cube.history.init, moves: [...cube.history.moves], redo: [...cube.history.redoStack] },
    queue: cube.twister.queue.map(move => ({ ...move })),
  };
}

function expectSettled(cube: DuoCube): void {
  expect(cube.twister.busy).toBe(false);
  expect(cube.twister.length).toBe(0);
  expect(tweener.length).toBe(0);
  const settled = snapshot(cube);
  tweener.update(10000);
  expect(snapshot(cube)).toEqual(settled);
}

function rotatedWorld(cube: DuoCube) {
  const scene = new THREE.Scene();
  scene.rotation.set(0.31, -0.47, 0.22);
  scene.position.set(13, -19, 31);
  cube.position.set(-7, 23, -11);
  scene.add(cube);
  scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(40, 600 / 480, 1, 3000);
  const origin = cube.getWorldPosition(new THREE.Vector3());
  camera.position.copy(origin).add(new THREE.Vector3(450, 300, 750));
  camera.lookAt(origin);
  camera.updateMatrixWorld(true);
  return { scene, camera, width: 600, height: 480 };
}

function polygonPoints(mesh: THREE.Mesh): THREE.Vector3[] {
  const poly = mesh.userData.schematicPoly as number[];
  return Array.from({ length: poly.length / 3 }, (_, index) => new THREE.Vector3().fromArray(poly, index * 3));
}

function aimAtSticker(mesh: THREE.Mesh, camera: THREE.PerspectiveCamera): THREE.Vector3 {
  mesh.updateWorldMatrix(true, false);
  const polygon = polygonPoints(mesh);
  const point = polygon.reduce((sum, vertex) => sum.add(vertex), new THREE.Vector3())
    .multiplyScalar(1 / polygon.length).applyMatrix4(mesh.matrixWorld);
  const normal = (mesh.userData.simStickerNormal as THREE.Vector3).clone().transformDirection(mesh.matrixWorld);
  camera.up.set(0, 1, 0);
  if (Math.abs(normal.dot(camera.up)) > 0.95) camera.up.set(1, 0, 0);
  camera.position.copy(point).addScaledVector(normal, DUO_A * 6);
  camera.lookAt(point);
  camera.updateMatrixWorld(true);
  return point;
}

function screen(point: THREE.Vector3, camera: THREE.Camera, width: number, height: number): THREE.Vector2 {
  const projected = point.clone().project(camera);
  return new THREE.Vector2((projected.x + 1) * width / 2, (1 - projected.y) * height / 2);
}

describe('Pyraminx Duo engine endpoints', () => {
  it('matches model colors through all eight single turns and every prefix of mixed sequences', () => {
    const cube = makeCube();
    for (const token of TOKENS) {
      cube.twister.setup(token);
      expectModelGeometry(cube, token);
    }
    for (const sequence of ["U L R B U' R' L B' R U L' B", "B' R U L U' L' R' B B B"]) {
      cube.twister.setup('');
      const prefix: string[] = [];
      for (const token of sequence.split(' ')) {
        prefix.push(token);
        cube.applyMoveInstant(parseDuoMoves(token)[0]);
        expectModelGeometry(cube, prefix.join(' '));
      }
    }
  });

  it('selects exactly four unique pivots using live centers for all four axes and both directions', () => {
    const cube = makeCube();
    const initial = 'U L R';
    const model = duoApply(initial);
    expect(model.centers.every((piece, face) => piece !== face)).toBe(true);
    for (const token of TOKENS) {
      cube.twister.setup(initial);
      const move = parseDuoMoves(token)[0];
      const anims = cube.beginMove(move);
      const selected = anims.map(anim => anim.pivot);
      const expected = [cube.corners[move.corner].pivot, ...model.centers.flatMap((piece, face) =>
        face === move.corner ? [] : [cube.centres[piece].pivot])];
      expect(selected).toHaveLength(4);
      expect(new Set(selected).size).toBe(4);
      expect(new Set(selected)).toEqual(new Set(expected));
      for (const anim of anims) {
        expect(anim.axis.distanceTo(VERTICES[move.corner].clone().normalize())).toBeLessThan(1e-12);
        expect(anim.angle).toBeCloseTo(move.dir * 2 * Math.PI / 3, 12);
        expect(anim.pivot.position.toArray()).toEqual([0, 0, 0]);
      }
      applyAnimFrame(anims, 1);
      cube.finishMove(anims, move);
      expectModelGeometry(cube, `${initial} ${token}`);
    }
  });
});

describe('Pyraminx Duo twister lifecycle', () => {
  it('invalid setup preserves the current mid-tween pose, state, history and pending queue', () => {
    const cube = makeCube();
    cube.twister.setup('U L');
    cube.twister.twist(parseDuoMoves('B')[0], true, false);
    cube.twister.push("R B' U");
    tweener.update(timing.frames / 3);
    const before = snapshot(cube);
    const active = [...tweener.tweens];
    expect(cube.twister.busy).toBe(true);
    expect(() => cube.twister.setup('L U2 R')).toThrow('Invalid Pyraminx Duo move: U2');
    expect(snapshot(cube)).toEqual(before);
    expect(tweener.tweens).toEqual(active);
    expect(cube.twister.busy).toBe(true);
    cube.twister.finish();
    expectModelGeometry(cube, "U L B R B' U");
    expectSettled(cube);
  });

  it('undo and redo replay the setup and preserve the committed move history', () => {
    const cube = makeCube();
    cube.twister.setup('U L');
    for (const move of parseDuoMoves("R B'")) cube.twister.twist(move, true, false);
    cube.twister.undo();
    expectModelGeometry(cube, 'U L R');
    expect(cube.history.moves).toEqual(['R']);
    expect(cube.history.redoStack).toEqual(["B'"]);
    cube.twister.redo();
    expectModelGeometry(cube, "U L R B'");
    expect(cube.history.moves).toEqual(['R', "B'"]);
    cube.twister.undo();
    cube.twister.undo();
    expectModelGeometry(cube, 'U L');
    expect(cube.history.init).toBe('U L');
    expect(cube.history.moves).toEqual([]);
    cube.twister.redo();
    expectModelGeometry(cube, 'U L R');
    cube.twister.twist(parseDuoMoves('U')[0], true, false);
    expect(cube.history.redoStack).toEqual([]);
    expectSettled(cube);
  });

  it.each([
    { name: 'the first active turn', setup: '', previous: '', pending: 'U', expected: '', history: [], redo: ['U'] },
    { name: 'an active turn after a committed turn', setup: '', previous: 'U', pending: 'L', expected: 'U', history: ['U'], redo: ['L'] },
    { name: 'an active turn with another queued turn', setup: 'B', previous: 'R', pending: 'U L', expected: 'B R U', history: ['R', 'U'], redo: ['L'] },
  ])('settles $name before undoing the newest move', fixture => {
    const cube = makeCube();
    cube.twister.setup(fixture.setup);
    for (const move of parseDuoMoves(fixture.previous)) cube.twister.twist(move, true, false);
    cube.twister.push(fixture.pending);
    tweener.update(timing.frames / 3);
    cube.twister.undo();
    expectModelGeometry(cube, fixture.expected);
    expect(cube.history.moves).toEqual(fixture.history);
    expect(cube.history.redoStack).toEqual(fixture.redo);
    expectSettled(cube);
  });

  it('does not replay an abandoned redo branch when a new queued move is pending', () => {
    const cube = makeCube();
    cube.twister.setup('B');
    cube.twister.twist(parseDuoMoves('R')[0], true, false);
    cube.twister.undo();
    cube.twister.push('U');
    tweener.update(timing.frames / 3);
    cube.twister.redo();
    expectModelGeometry(cube, 'B U');
    expect(cube.history.moves).toEqual(['U']);
    expect(cube.history.redoStack).toEqual([]);
    expectSettled(cube);
  });

  it('finish flushes the current tween and the entire queue without orphaning the next turn', () => {
    const cube = makeCube();
    cube.twister.push("U L R'");
    tweener.update(timing.frames / 3);
    expect(cube.state).toEqual(solvedDuo());
    expect(tweener.length).toBe(1);
    cube.twister.finish();
    expectModelGeometry(cube, "U L R'");
    expect(cube.history.moves).toEqual(['U', 'L', "R'"]);
    expectSettled(cube);
  });

  it.each(['direct reset', 'setup reset'])('%s during playback cannot mutate again on later animation ticks', reset => {
    const cube = makeCube();
    cube.twister.setup('R');
    cube.twister.push("U L B'");
    tweener.update(timing.frames / 3);
    if (reset === 'direct reset') cube.reset();
    else cube.twister.setup('');
    expectModelGeometry(cube, '');
    expect(cube.complete).toBe(true);
    expectSettled(cube);
  });

  it('dispose finishes active playback and releases meshes without leaving a live callback', () => {
    const cube = makeCube();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    cube.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    const disposals = [...geometries, ...materials].map(resource => vi.spyOn(resource, 'dispose'));
    const callback = vi.fn();
    cube.callbacks.push(callback);
    const pieces = pivots(cube);
    cube.twister.push('U L R');
    tweener.update(timing.frames / 3);
    cube.dispose();
    cubes.delete(cube);
    expect(cube.twister.busy).toBe(false);
    expect(tweener.length).toBe(0);
    expect(cube.callbacks).toEqual([]);
    expect(cube.corners).toEqual([]);
    expect(cube.centres).toEqual([]);
    for (const disposal of disposals) expect(disposal).toHaveBeenCalled();
    const pose = pieces.map(piece => piece.quaternion.toArray());
    const calls = callback.mock.calls.length;
    tweener.update(10000);
    expect(pieces.map(piece => piece.quaternion.toArray())).toEqual(pose);
    expect(callback).toHaveBeenCalledTimes(calls);
  });
});

describe('Pyraminx Duo live gestures and schematic', () => {
  it('picks every scrambled center by its current face in a rotated and translated scene', () => {
    const cube = makeCube();
    cube.twister.setup('U L R');
    const world = rotatedWorld(cube);
    for (let piece = 0; piece < 4; piece++) {
      const mesh = stickers(cube.centres[piece].pivot)[0];
      const expectedPoint = aimAtSticker(mesh, world.camera);
      const hit = duoPickHit(cube, world.scene, world.camera, world.width / 2, world.height / 2, world.width, world.height);
      expect(hit, `center ${piece}`).not.toBeNull();
      const face = duoApply('U L R').centers.indexOf(piece);
      expect(face).not.toBe(piece);
      expect(hit!.candidates).toEqual([0, 1, 2, 3].filter(corner => corner !== face));
      expect(hit!.point.distanceTo(expectedPoint)).toBeLessThan(1e-4);
    }
    expectModelGeometry(cube, 'U L R');
  });

  it('resolves both drag directions around each available center axis through the full scene transform', () => {
    const cube = makeCube();
    cube.twister.setup('U L R');
    const world = rotatedWorld(cube);
    for (let piece = 0; piece < 4; piece++) {
      aimAtSticker(stickers(cube.centres[piece].pivot)[0], world.camera);
      const hit = duoPickHit(cube, world.scene, world.camera, world.width / 2, world.height / 2, world.width, world.height)!;
      expect(hit).not.toBeNull();
      for (const corner of hit.candidates) for (const dir of [-1, 1] as const) {
        // Generate the input drag by projecting a small actual local rotation,
        // independent of the gesture's analytic cross-product scoring helper.
        const local = cube.worldToLocal(hit.point.clone());
        const moved = local.applyAxisAngle(VERTICES[corner].clone().normalize(), dir * 1e-5).applyMatrix4(cube.matrixWorld);
        const drag = screen(moved, world.camera, world.width, world.height)
          .sub(screen(hit.point, world.camera, world.width, world.height)).normalize().multiplyScalar(60);
        const result = duoResolveLive(cube, hit, world.scene, world.camera, drag.x, drag.y, world.width, world.height);
        expect(result?.move, `center ${piece}, axis ${corner}, direction ${dir}`).toEqual({ corner, dir });
        expect(Math.hypot(result!.tangentX, result!.tangentY)).toBeCloseTo(1, 12);
        expect((result!.tangentX * drag.x + result!.tangentY * drag.y) / 60).toBeCloseTo(1, 8);
        expect(duoResolveMove(cube, hit, world.scene, world.camera, drag.x, drag.y, world.width, world.height))
          .toEqual({ corner, dir });
      }
    }
  });

  it('keeps the six-sided corner notches and outward winding in schematic polygons', () => {
    const cube = makeCube();
    for (const mesh of stickers(cube)) {
      const points = polygonPoints(mesh);
      const normal = mesh.userData.simStickerNormal as THREE.Vector3;
      const isCenter = mesh.userData.duoVertex === null;
      expect(points).toHaveLength(isCenter ? 3 : 6);
      const turns = points.map((point, index) => {
        const incoming = point.clone().sub(points[(index + points.length - 1) % points.length]);
        const outgoing = points[(index + 1) % points.length].clone().sub(point);
        return incoming.cross(outgoing).dot(normal);
      });
      expect(turns.filter(turn => turn < -1e-6)).toHaveLength(isCenter ? 0 : 1);
      expect(turns.filter(turn => turn > 1e-6)).toHaveLength(isCenter ? 3 : 5);
      expect(points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).dot(normal)).toBeGreaterThan(0);
      for (const point of points) expect(point.dot(normal)).toBeCloseTo(points[0].dot(normal), 9);
    }
    const world = rotatedWorld(cube);
    for (const sequence of ['', "U L R B'"]) {
      cube.twister.setup(sequence);
      const svg = exportSimSvgSchematic({ world, showHidden: true, inset: 0 });
      expect(svg).not.toMatch(/NaN|Infinity/);
      const paths = [...svg.matchAll(/<path d="([^"]+)" fill="[^"]+"\/>/g)].map(match => match[1]);
      expect(paths).toHaveLength(16);
      expect(paths.filter(path => (path.match(/L/g) ?? []).length === 5)).toHaveLength(12);
      expect(paths.filter(path => (path.match(/L/g) ?? []).length === 2)).toHaveLength(4);
    }
  });
});
