import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import Cube from '@/components/puzzle-models/nxn/cube';
import SimCube from '@/app/[lang]/sim/engine/nxn/cube';
import Sq1Cube from '@cuberoot/puzzle-render-core/engine/sq1/Sq1Cube';
import PyraCube from '@cuberoot/puzzle-render-core/engine/pyra/PyraCube';
import MegaminxCube from '@cuberoot/puzzle-render-core/engine/mega/MegaminxCube';
import SkewbCube from '@cuberoot/puzzle-render-core/engine/skewb/SkewbCube';
import { pickTurn, turnPuzzle, turnButtons, type SpacePuzzle } from '@/app/[lang]/space/space-turn';
import { mirrorFaces } from '@/components/puzzle-models/mirror/mirrorGeometry';
import { CUBE_FILL } from '@/lib/cube-colors';
import { COLORS } from '@cuberoot/puzzle-render-core/engine/define';
import { surfaceHit, visibleBounds } from '@/app/[lang]/space/space-scene';
import { weatherRoof } from '@/app/[lang]/space/space-weather';
import { createUniforms } from '@/app/[lang]/space/abyssal/core/SharedUniforms.js';
import { Lightning } from '@/app/[lang]/space/abyssal/weather/Lightning.js';
import { WEATHER, VILLA_ROOMS, type Weather } from '@/app/[lang]/space/space-state';
import { commitLayout, INITIAL_LAYOUT, MAX_OBJECTS, movePosition, parseLayout, ROOMS, travelHistory, validSpaceMove, walkFloor, walkStep, type Vec3, type History, type PuzzleKind, type RoomStyle } from '@/app/[lang]/space/space-state';

describe('space walking and tabletop placement', () => {
  it('blocks walls, slides along them and prevents tunneling or invalid movement', () => {
    const walls = [{ minX: 1, maxX: 1.1, minY: 0, maxY: 3, minZ: -4, maxZ: 4 }];
    const p = walkStep([0, 0, 0], 3, 4, 'modern', walls);
    expect(p[0].toFixed(2)).toBe('0.72'); expect(p[1]).toBe(0); expect(p[2]).toBeCloseTo(4);
    for (const dx of [NaN, Infinity, 100]) expect(walkStep([0, 0, 0], dx, 0, 'modern', walls)).toEqual([0, 0, 0]);
    expect(walkStep([0, 0, 0], 0, 0, 'modern', walls)).toEqual([0, 0, 0]);
    expect(walkFloor(-13, 0, 0, 'modern')).toBeNull();
    expect(walkFloor(-13, 5, 0, 'modern')).toBe(0);
    expect(walkFloor(-23, 3, 5, 'modern')).toBe(5);
    expect(walkFloor(0, 0, 5, 'modern')).toBeNull();
    expect(walkFloor(0, 20, 0, 'penthouse')).toBeNull();
    expect(walkFloor(0, 20, 0, 'modern')).toBe(0);
    expect(walkFloor(5, 0, 0, 'company')).toBeNull();
  });

  it('climbs every stair and returns to the same ground floor without jumping levels', () => {
    let p: Vec3 = [9.6, 0, -12.4];
    for (let i = 0; i < 135; i++) p = walkStep(p, -0.1, 0, 'modern', []);
    expect(p[0]).toBeCloseTo(-3.9); expect(p[1]).toBe(5);
    for (let i = 0; i < 135; i++) p = walkStep(p, 0.1, 0, 'modern', []);
    expect(p[0]).toBeCloseTo(9.6); expect(p[1]).toBe(0);
  });

  it('uses the actual tabletop footprint and rejects its sides and hidden surfaces', () => {
    const table = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.1, 64), new THREE.MeshBasicMaterial());
    table.position.set(2, 1, 3); table.updateMatrixWorld();
    const down = (x: number, z: number) => new THREE.Raycaster(new THREE.Vector3(x, 3, z), new THREE.Vector3(0, -1, 0));
    expect(surfaceHit(down(2, 3), [table])?.point.y).toBeCloseTo(1.05);
    expect(surfaceHit(down(2.9, 3.9), [table])).toBeUndefined();
    expect(surfaceHit(new THREE.Raycaster(new THREE.Vector3(0, 1, 3), new THREE.Vector3(1, 0, 0)), [table])).toBeUndefined();
    table.visible = false; expect(surfaceHit(down(2, 3), [table])).toBeUndefined();
    table.geometry.dispose(); table.material.dispose();
  });
});

describe('cube space saved layouts', () => {
  it('isolates weather scenes and clears active and scheduled lightning on weather changes', () => {
    const uniforms = createUniforms(), other = createUniforms();
    const lightning = new Lightning(uniforms);
    lightning.strike(0, -1400, 600);
    lightning.schedule(400, -1400, 600, 1);
    lightning.update(0.01, 0.01, { lightningRate: 0 });
    expect(lightning.mesh.visible).toBe(true);
    expect(uniforms.uLightning0.value.w > 0).toBe(true);
    expect(other.uLightning0.value.toArray()).toEqual([0, 0, 0, 0]);
    expect(other.uAmbientFlash.value).toBe(0);
    lightning.clear();
    lightning.update(2, 2, { lightningRate: 0 });
    expect(lightning.mesh.visible).toBe(false);
    expect(lightning.geom.instanceCount).toBe(0);
    expect(uniforms.uLightning0.value.toArray()).toEqual([0, 0, 0, 0]);
    expect(uniforms.uAmbientFlash.value).toBe(0);
    lightning.dispose();
  });

  it('persists every weather and animation choice through save, undo and redo without changing cubes', () => {
    let history: History = { past: [], current: INITIAL_LAYOUT, future: [] };
    expect(Object.keys(WEATHER).length).toBe(19);
    expect(parseLayout(JSON.stringify(INITIAL_LAYOUT)).weather).toBeUndefined();
    expect(parseLayout(JSON.stringify(INITIAL_LAYOUT)).weatherMotion).toBeUndefined();
    for (const weather of Object.keys(WEATHER) as Weather[]) for (const weatherMotion of [true, false]) {
      const before = history.current;
      history = commitLayout(history, { ...before, weather, weatherMotion });
      expect(parseLayout(JSON.stringify(history.current))).toEqual({ ...INITIAL_LAYOUT, weather, weatherMotion });
      const undo = travelHistory(history, 'undo');
      expect(undo.current).toEqual(before);
      expect(travelHistory(undo, 'redo').current).toEqual(history.current);
    }
    for (const weather of ['unknown', '__proto__', 'constructor', null, 3, {}]) expect(() => parseLayout(JSON.stringify({ ...INITIAL_LAYOUT, weather }))).toThrow('weather');
    for (const weatherMotion of [null, 'false', 0, {}]) expect(() => parseLayout(JSON.stringify({ ...INITIAL_LAYOUT, weatherMotion }))).toThrow('weatherMotion');
  });

  it('shelters every villa room and the office while exposing the exterior', () => {
    expect(Object.values(VILLA_ROOMS).map(room => weatherRoof(room.x, room.z, 'modern'))).toEqual([7.8, 9.4, 9.4, 9.4, 9.4, 9.4, 4.2, 4.2, 4.2, 4.2]);
    expect(weatherRoof(-23, 3, 'modern')).toBe(9.4);
    expect(weatherRoof(-23, -10, 'penthouse')).toBe(9.4);
    expect(weatherRoof(0, 0, 'company')).toBe(3.8);
    expect(weatherRoof(-26.2, 13.1, 'company')).toBe(3.8);
    expect(weatherRoof(-26.21, 13.1, 'company')).toBe(-120);
    expect(weatherRoof(50, 50, 'modern')).toBe(-120);
  });

  it('round-trips layouts and allows an empty scene', () => {
    expect(parseLayout(JSON.stringify(INITIAL_LAYOUT))).toEqual(INITIAL_LAYOUT);
    expect(parseLayout('{"version":1,"objects":[]}')).toEqual({ version: 1, objects: [] });
  });

  it('preserves legacy layouts and cube poses through room switches, saves, and undo', () => {
    const legacy = parseLayout(JSON.stringify(INITIAL_LAYOUT));
    expect(legacy.room).toBeUndefined();
    let history: History = { past: [], current: legacy, future: [] };
    for (const room of Object.keys(ROOMS) as RoomStyle[]) {
      history = commitLayout(history, { ...history.current, room });
      const saved = parseLayout(JSON.stringify(history.current));
      expect(saved.room).toBe(room);
      expect(saved.objects).toEqual(INITIAL_LAYOUT.objects);
    }
    expect(travelHistory(history, 'undo').current.room).toBe('japanese');
    expect(travelHistory(travelHistory(history, 'undo'), 'redo').current.room).toBe('company');
    for (const room of ['unknown', '__proto__', null, 3]) {
      expect(() => parseLayout(JSON.stringify({ ...INITIAL_LAYOUT, room }))).toThrow('room');
    }
  });

  it('rejects corrupt or unsupported data before changing the current layout', () => {
    const object = INITIAL_LAYOUT.objects[0];
    for (const data of [null, {}, { version: 2, objects: [] }, { version: 1, objects: [object, object] },
      ...[{ kind: '__proto__' }, { scale: 0 }, { scale: 2.6 }, { position: [33, 0] }, { position: [0] },
        { level: 2 }, { moves: ['R2 garbage'] }, { moves: Array(2001).fill('R') }, { kind: 'sq1', moves: ['(-1,0)', '/'] },
        { rotation: [0, null, 0] }, { rotation: [0, 7, 0] }, { id: '<script>' }, { scale: '1' }]
        .map(patch => ({ version: 1, objects: [{ ...object, ...patch }] })),
      { version: 1, objects: Array.from({ length: MAX_OBJECTS + 1 }, (_, i) => ({ ...object, id: `cube-${i}` })) },
    ]) expect(() => parseLayout(JSON.stringify(data))).toThrow();
    expect(() => parseLayout('{')).toThrow();
    expect(() => parseLayout(' '.repeat(128_001))).toThrow();
    expect(() => parseLayout('{"version":1,"objects":[{"id":"x","kind":"333","position":[1e999,0],"rotation":[0,0,0],"scale":1}]}')).toThrow();
    expect(parseLayout(JSON.stringify({ version: 1, objects: [{ ...object, unexpected: 'discard' }] })).objects[0]).toEqual(object);
  });

  it('undoes and redoes edits, drops abandoned redo history, and bounds memory', () => {
    const initial: History = { past: [], current: INITIAL_LAYOUT, future: [] };
    const empty = { version: 1 as const, objects: [] };
    expect(commitLayout(initial, INITIAL_LAYOUT)).toBe(initial);
    expect(travelHistory(initial, 'undo')).toBe(initial);
    const deleted = commitLayout(initial, empty);
    const undone = travelHistory(deleted, 'undo');
    expect(undone.current).toBe(INITIAL_LAYOUT);
    expect(travelHistory(undone, 'redo').current).toBe(empty);
    expect(commitLayout(undone, { ...empty, objects: [INITIAL_LAYOUT.objects[0]] }).future).toEqual([]);
    let many = initial;
    for (let i = 0; i < 120; i++) many = commitLayout(many, { ...empty, objects: [{ ...INITIAL_LAYOUT.objects[0], id: `step-${i}` }] });
    expect(many.past.length).toBe(100);
    expect(movePosition([-99, 99], true)).toEqual([-32, 32]);
    expect(movePosition([0.76, -0.26], true)).toEqual([1, -0.5]);
    expect(movePosition([0.76, -0.26], false)).toEqual([0.76, -0.26]);
  });
});

describe('shared simulator models in the space', () => {
  it('turns every supported puzzle and replays its inverse without moving the object', () => {
    const fixtures: [PuzzleKind, SpacePuzzle][] = [['222', new Cube(2)], ['333', new Cube(3)], ['444', new Cube(4)], ['555', new Cube(5)], ['mirror', new Cube(3, true)], ['sq1', new Sq1Cube()], ['pyram', new PyraCube()], ['minx', new MegaminxCube()], ['skewb', new SkewbCube()]];
    for (const [kind, cube] of fixtures) {
      const parent = new THREE.Group(); parent.position.set(4, 5, -3); parent.rotation.set(0.2, 0.6, -0.1); parent.scale.setScalar(0.7); parent.add(cube);
      const initial = cube instanceof Cube ? cube.serialize() : null;
      for (const move of turnButtons(kind)) {
        const inverse = move === '/' ? '/' : move.startsWith('(') ? move.replace(/-?\d+/g, n => String(-Number(n))) : move + "'";
        expect(validSpaceMove(kind, move), `${kind} ${move}`).toBe(true);
        expect(validSpaceMove(kind, inverse), `${kind} ${inverse}`).toBe(true);
        expect(turnPuzzle(cube, move, true), `${kind} ${move}`).toBe(true);
        expect(turnPuzzle(cube, inverse, true), `${kind} inverse`).toBe(true);
        if (cube instanceof Cube) expect(cube.serialize()).toBe(initial);
        else expect(cube.complete, `${kind} restored`).toBe(true);
      }
      expect(parent.position.toArray()).toEqual([4, 5, -3]);
      cube.dispose();
    }
  });

  it('resolves a drag on a translated and rotated cube and persists the actual turn', () => {
    const scene = new THREE.Scene(), cube = new Cube(3), group = new THREE.Group();
    group.position.set(-200, 50, 30); group.rotation.y = 0.6; group.add(cube); scene.add(group);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000); camera.position.set(300, 350, 600); camera.lookAt(group.position); camera.updateMatrixWorld(); scene.updateMatrixWorld(true);
    const center = group.position.clone().project(camera);
    const resolver = pickTurn(cube, scene, camera, (center.x + 1) * 400, (1 - center.y) * 400, 800, 800);
    expect(resolver).not.toBeNull(); const move = resolver!(70, 0)!; expect(validSpaceMove('333', move)).toBe(true);
    const before = cube.serialize(); expect(turnPuzzle(cube, move, true)).toBe(true); expect(cube.serialize()).not.toBe(before);
    const saved = parseLayout(JSON.stringify({ version: 1, objects: [{ ...INITIAL_LAYOUT.objects[0], level: 1, moves: [move] }] }));
    cube.twister.setup(''); for (const token of saved.objects[0].moves!) turnPuzzle(cube, token, true);
    expect(cube.serialize()).not.toBe(before); expect(saved.objects[0].level).toBe(1); cube.dispose();
  });
  it('keeps the simulator class identity and excludes hidden mirror hints from physical size', () => {
    expect(Cube).toBe(SimCube);
    const regular = new Cube(3);
    const mirror = new Cube(3, true);
    const globalColors = { ...COLORS };
    regular.instancedRenderer.setFaceColorOverride(CUBE_FILL);
    const colors = regular.instancedRenderer.staticSticker.instanceColor!.array.slice();
    mirror.instancedRenderer.setFaceColorOverride(mirrorFaces());
    expect(COLORS).toEqual(globalColors);
    expect(regular.instancedRenderer.staticSticker.instanceColor!.array).toEqual(colors);
    expect(mirror.instancedRenderer.staticSticker.instanceColor!.array).not.toEqual(colors);
    const size = visibleBounds(regular).getSize(new THREE.Vector3());
    const mirrorSize = visibleBounds(mirror).getSize(new THREE.Vector3());
    for (const axis of ['x', 'y', 'z'] as const) expect(mirrorSize[axis]).toBeCloseTo(size[axis], 1);
    const hidden = new THREE.Mesh(new THREE.BoxGeometry(2000, 2000, 2000));
    hidden.visible = false;
    mirror.add(hidden);
    expect(visibleBounds(mirror).getSize(new THREE.Vector3())).toEqual(mirrorSize);
    expect(regular.instancedRenderer).not.toBe(mirror.instancedRenderer);
    hidden.geometry.dispose(); (hidden.material as THREE.Material).dispose();
    regular.dispose(); mirror.dispose();
  });

  it('measures rotated visible vertices instead of a rotated bounding box', () => {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 2, 0),
    ]));
    mesh.rotation.z = Math.PI / 4;
    const box = visibleBounds(mesh);
    expect(box.min.y).toBeCloseTo(-Math.SQRT1_2);
    expect(box.max.y).toBeCloseTo(Math.SQRT2);
    const parent = new THREE.Group(); parent.rotation.y = 0.6; parent.position.set(5, 3, -2); parent.add(mesh);
    const local = visibleBounds(mesh, parent);
    expect(local.min.y).toBeCloseTo(box.min.y); expect(local.max.y).toBeCloseTo(box.max.y);
    const instanced = new THREE.InstancedMesh(mesh.geometry, mesh.material, 1);
    instanced.setMatrixAt(0, mesh.matrix); parent.add(instanced);
    const instanceBounds = visibleBounds(instanced, parent);
    expect(instanceBounds.min.y).toBeCloseTo(box.min.y); expect(instanceBounds.max.y).toBeCloseTo(box.max.y);
    instanced.dispose();
    mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
  });
});
