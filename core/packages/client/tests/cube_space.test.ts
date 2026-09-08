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
import { droneMovement, SpaceScene, surfaceHit, visibleBounds } from '@/app/[lang]/space/space-scene';
import { sceneDaylight, weatherRoof } from '@/app/[lang]/space/space-weather';
import { createUniforms } from '@/app/[lang]/space/abyssal/core/SharedUniforms.js';
import { OceanMesh } from '@/app/[lang]/space/abyssal/ocean/OceanMesh.js';
import { Lightning } from '@/app/[lang]/space/abyssal/weather/Lightning.js';
import { Weather as AbyssalWeather } from '@/app/[lang]/space/abyssal/weather/Weather.js';
import { ISLAND, islandHeight } from '@/app/[lang]/space/space-island';
import { RIVER_COLORS, WEATHER, VILLA_ROOMS, layoutTime, validSceneTime, type Weather } from '@/app/[lang]/space/space-state';
import { commitLayout, ENVIRONMENTS, type Environment, INITIAL_LAYOUT, MAX_OBJECTS, movePosition, parseLayout, ROOMS, travelHistory, validSpaceMove, walkFloor, walkStep, type Vec3, type History, type PuzzleKind, type RoomStyle } from '@/app/[lang]/space/space-state';

describe('space drone controls', () => {
  it('moves horizontally in camera heading, with independent rise and fall', () => {
    const facing = new THREE.Vector3(0, -.8, -.6);
    const delta = (...keys: string[]) => droneMovement(facing, new Set(keys), 10, .05).toArray().map(n => n + 0);
    expect(delta('forward')).toEqual([0, 0, -.5]);
    expect(delta('back')).toEqual([0, 0, .5]);
    expect(delta('left')).toEqual([-.5, 0, 0]);
    expect(delta('right')).toEqual([.5, 0, 0]);
    expect(delta('up')).toEqual([0, .5, 0]);
    expect(delta('down')).toEqual([0, -.5, 0]);
    expect(droneMovement(new THREE.Vector3(1, 0, 0), new Set(['forward']), 10, .05).toArray()).toEqual([.5, 0, 0]);
    expect(droneMovement(facing, new Set(['forward', 'left', 'up']), 10, .05).length()).toBeCloseTo(.5, 12);
    expect(delta('forward', 'back', 'up', 'down')).toEqual([0, 0, 0]);
  });

  it('rejects non-finite input and caps speed and elapsed time after long frames', () => {
    const facing = new THREE.Vector3(0, 0, -1), keys = new Set(['forward']);
    for (const [speed, dt] of [[NaN, .05], [10, Infinity], [-1, .05], [10, -1], [10, 0]]) expect(droneMovement(facing, keys, speed, dt).length()).toBe(0);
    expect(droneMovement(new THREE.Vector3(NaN, 0, 0), keys, 10, .05).length()).toBe(0);
    expect(droneMovement(facing, keys, 1000, 30).length()).toBe(50);
    expect(droneMovement(facing, keys, 10000, 30).length()).toBe(100);
    expect(droneMovement(facing, keys, 37.5, .05).length()).toBe(1.875);
    expect(droneMovement(facing, new Set(), 10, .05).length()).toBe(0);
  });

  it('clamps explicit altitude without changing framing and tracks independent input sources', () => {
    const scene = Object.create(SpaceScene.prototype) as SpaceScene;
    const camera = new THREE.PerspectiveCamera(); camera.position.set(100, 70, 200);
    const target = new THREE.Vector3(20, 30, 50), offset = target.clone().sub(camera.position);
    const keys = new Map<string, string>();
    Object.assign(scene, { camera, orbit: { target }, navigation: 'drone', walkKeys: keys, render: () => {}, callbacks: { altitude: () => {} } });
    scene.setDroneHeight(350); expect(camera.position.y).toBe(350);
    expect(target.clone().sub(camera.position).toArray()).toEqual(offset.toArray());
    scene.setDroneHeight(Infinity); expect(camera.position.y).toBe(350);
    scene.setDroneHeight(-100); expect(camera.position.y).toBe(1);
    scene.setDroneHeight(10000); expect(camera.position.y).toBe(6000);
    Object.assign(scene, { room: { environment: 'island' } });
    scene.setDroneHeight(-100); expect(camera.position.y).toBe(-5);
    scene.navigationInput('forward', true, 'KeyW'); scene.navigationInput('forward', true, 'ArrowUp');
    scene.navigationInput('forward', false, 'KeyW'); expect([...keys]).toEqual([['ArrowUp', 'forward']]);
    scene.navigationInput('up', true, 'pointer:2'); expect([...keys.values()]).toEqual(['forward', 'up']);
    scene.navigationInput('forward', false, 'ArrowUp'); scene.navigationInput('up', false, 'pointer:2'); expect(keys.size).toBe(0);
    scene.navigation = 'walk'; scene.navigationInput('up', true); expect(keys.size).toBe(0);
    scene.navigation = 'orbit'; scene.setDroneHeight(100); scene.navigationInput('forward', true);
    expect(camera.position.y).toBe(-5); expect(keys.size).toBe(0);
  });
});

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
  it('round-trips every river color and rejects invalid imported selections', () => {
    for (const riverColor of Object.keys(RIVER_COLORS)) {
      const layout = { ...INITIAL_LAYOUT, environment: 'shanghai', weather: 'rainbow', riverColor };
      expect(parseLayout(JSON.stringify(layout))).toEqual(layout);
    }
    expect(parseLayout(JSON.stringify(INITIAL_LAYOUT)).riverColor).toBeUndefined();
    for (const riverColor of ['', 'toString', 'unknown', null, 3, {}]) {
      expect(() => parseLayout(JSON.stringify({ ...INITIAL_LAYOUT, riverColor }))).toThrow('riverColor');
    }
  });
  it('round-trips all 1440 minutes with undo and preserves legacy layouts and cube states', () => {
    const original = { ...INITIAL_LAYOUT, room: 'modern' as const, weather: 'typhoon' as const };
    expect(layoutTime(original)).toBe('09:00');
    expect(layoutTime({ ...original, room: 'cyberpunk' })).toBe('21:00');
    expect(parseLayout(JSON.stringify(original)).timeOfDay).toBeUndefined();
    for (let minute = 0; minute < 1440; minute++) {
      const timeOfDay = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
      expect(validSceneTime(timeOfDay)).toBe(true);
      const next = { ...original, timeOfDay };
      expect(parseLayout(JSON.stringify(next))).toEqual(next);
      expect(layoutTime({ ...next, room: 'cyberpunk' })).toBe(timeOfDay);
      const history = commitLayout({ past: [], current: original, future: [] }, next);
      const undo = travelHistory(history, 'undo');
      expect(undo.current).toEqual(original);
      expect(travelHistory(undo, 'redo').current).toEqual(next);
    }
    for (const timeOfDay of ['', '9:00', '00:0', '24:00', '12:60', '12:00:01', ' 09:00', '09:00\n', null, 0, {}, [], ['09:00']]) {
      expect(validSceneTime(timeOfDay)).toBe(false);
      expect(() => parseLayout(JSON.stringify({ ...original, timeOfDay }))).toThrow('timeOfDay');
    }
  });

  it('keeps sun direction finite and continuous through sunrise, sunset and midnight', () => {
    const frames = Array.from({ length: 1440 }, (_, minute) => sceneDaylight(`${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`));
    for (let minute = 0; minute < frames.length; minute++) {
      const frame = frames[minute], next = frames[(minute + 1) % frames.length];
      expect(frame.direction.length()).toBeCloseTo(1, 12);
      expect(frame.direction.distanceTo(next.direction)).toBeCloseTo(2 * Math.sin(Math.PI / 1440), 12);
      expect(frame.day >= 0 && frame.day <= 1 && frame.sun >= 0 && frame.sun <= 1).toBe(true);
    }
    expect(frames[0].day).toBe(0); expect(frames[0].sun).toBe(0);
    expect(frames[720].day).toBe(1); expect(frames[720].sun).toBe(1);
    expect(frames[720].elevation * 180 / Math.PI).toBeCloseTo(58.7466, 8);
    expect(frames[360].direction.x).toBe(1); expect(frames[1080].direction.x).toBe(-1);
    expect(frames[360].day).toBeCloseTo(.5); expect(frames[1080].day).toBeCloseTo(.5);
    expect(() => sceneDaylight('24:00')).toThrow('timeOfDay');
  });

  it('preserves cubes and environment across every style/weather combination, including undo and legacy imports', () => {
    expect(parseLayout(JSON.stringify(INITIAL_LAYOUT)).environment).toBeUndefined();
    let history: History = { past: [], current: INITIAL_LAYOUT, future: [] };
    for (const environment of Object.keys(ENVIRONMENTS) as Environment[])
      for (const room of Object.keys(ROOMS) as RoomStyle[])
        for (const weather of Object.keys(WEATHER) as Weather[]) {
          const before = history.current, next = { ...before, environment, room, weather };
          history = commitLayout(history, next);
          expect(parseLayout(JSON.stringify(next))).toEqual(next);
          expect(next.objects).toEqual(INITIAL_LAYOUT.objects);
          expect(travelHistory(history, 'undo').current).toEqual(before);
          expect(travelHistory(travelHistory(history, 'undo'), 'redo').current).toEqual(next);
        }
    for (const environment of ['unknown', '__proto__', 'constructor', null, 0, {}, []])
      expect(() => parseLayout(JSON.stringify({ ...INITIAL_LAYOUT, environment }))).toThrow('environment');
  });

  it('keeps the complete villa and office footprint dry with a continuous submerged coast', () => {
    for (let x = -33; x <= 33; x += 3) for (let z = -18; z <= 25; z += 3)
      expect(islandHeight(x, z)).toBe(-.65);
    for (const room of Object.values(VILLA_ROOMS)) expect(islandHeight(room.x, room.z)).toBe(-.65);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
      const at = (r: number) => islandHeight(ISLAND.x + Math.cos(a) * ISLAND.rx * r, ISLAND.z + Math.sin(a) * ISLAND.rz * r);
      expect(at(0)).toBe(-.65);
      expect(at(1.7)).toBe(-26.5);
      let previous = at(0), crosses = 0;
      for (let i = 1; i <= 170; i++) {
        const h = at(i / 100);
        expect(Number.isFinite(h)).toBe(true);
        expect(h <= previous).toBe(true);
        expect(previous - h < 1).toBe(true);
        if (previous > ISLAND.sea && h <= ISLAND.sea) crosses++;
        previous = h;
      }
      expect(crosses).toBe(1);
    }
  });

  it('feeds wind, swell, sea level and persistent foam into the upstream ocean without shared state', () => {
    const uniforms = createUniforms(), other = createUniforms();
    const app = { time: 0, atmosphere: { sunDir: new THREE.Vector3() }, sky: {}, ocean: { params: {} as Record<string, number> } };
    const weather = new AbyssalWeather(app, uniforms);
    weather.set({ windSpeed: 5, gustiness: 0, swellHs: .55, swellPeriod: 8, choppiness: .9, seaLevel: ISLAND.sea }, true);
    weather.update(0);
    expect(app.ocean.params.windSpeed).toBe(5);
    expect(app.ocean.params.swellHs).toBe(.55);
    expect(app.ocean.params.swellPeriod).toBe(8);
    expect(uniforms.uWhitecapCoverage.value).toBeCloseTo(3.84e-6 * 5 ** 3.41);
    expect(uniforms.uSeaLevel.value).toBe(ISLAND.sea);
    expect(other.uSeaLevel.value).toBe(0);
    weather.set({ windSpeed: 30, swellHs: 3.6, swellPeriod: 11.52, choppiness: 1.164 }, true);
    weather.update(0);
    expect(app.ocean.params.windSpeed).toBe(30);
    expect(app.ocean.params.swellHs).toBe(3.6);
    expect(app.ocean.params.choppiness).toBe(1.164);
    expect(uniforms.uWhitecapCoverage.value).toBe(.16);
    expect(app.ocean.params.foamDecay).toBe(.28);
    expect(app.ocean.params.bubbleDecay).toBe(.11);
    const before = { ...app.ocean.params };
    weather.update(0);
    expect(app.ocean.params).toEqual(before);
  });

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

  it('keeps the projected sea front-facing so shaded ripples cannot be classified as submerged', () => {
    const bindings = { bind: () => {} };
    const sea = new OceanMesh(bindings, bindings, { oceanGridX: 16, oceanGridY: 12 }, null, createUniforms());
    for (const [nx, ny] of [[16, 12], [32, 24]]) {
      sea.setResolution(nx, ny);
      const grid = sea.mesh.geometry.getAttribute('aGrid'), index = sea.mesh.geometry.getIndex()!;
      expect(index.count).toBe(nx * ny * 6);
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
        const area = (grid.getX(b) - grid.getX(a)) * (grid.getY(c) - grid.getY(a))
          - (grid.getY(b) - grid.getY(a)) * (grid.getX(c) - grid.getX(a));
        expect(area).toBeCloseTo(1 / (nx * ny), 7);
      }
    }
    sea.dispose();
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
