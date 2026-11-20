import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import * as THREE from 'three';
import HandsRig, { gripQuat, simulateGrips, type HandsCubeLike, type HandDiagnosticFrame } from '@/app/[lang]/sim/engine/hands/handsRig';
import { loadManoHand } from '@/app/[lang]/sim/engine/hands/handModelMano';
import { bakeHandTextures } from '@/app/[lang]/sim/engine/hands/bakeHandTexture';
import { WRIST_LOCAL } from '@/app/[lang]/sim/engine/hands/handModel';
import type { FingerJoints, FingerName, HandModel } from '@/app/[lang]/sim/engine/hands/handModel';
import World from '@/app/[lang]/sim/engine/world';
import { SIZE } from '@/app/[lang]/sim/engine/define';
import { homeLeft, homeRight } from '@/app/[lang]/sim/engine/hands/handPoses';
import { findGripMarks } from '@cuberoot/shared/alg-notation';
import { HalfPalmPose } from '@/app/[lang]/sim/engine/hands/halfPalmPose';
import { UContactRecorder } from '@/app/[lang]/sim/engine/hands/uContactRecorder';

// Keep the real animation lifecycle; substitute only asset IO / browser texture creation.
vi.mock('@/app/[lang]/sim/engine/hands/handModelMano', async original => ({
  ...await original<typeof import('@/app/[lang]/sim/engine/hands/handModelMano')>(), loadManoHand: vi.fn(),
}));
vi.mock('@/app/[lang]/sim/engine/hands/handModel', async importOriginal => ({
  ...await importOriginal<typeof import('@/app/[lang]/sim/engine/hands/handModel')>(),
  makeSkinDetailTexture: () => new THREE.Texture(),
}));
vi.mock('@/app/[lang]/sim/engine/hands/bakeHandTexture', async importOriginal => ({
  ...await importOriginal<typeof import('@/app/[lang]/sim/engine/hands/bakeHandTexture')>(),
  bakeHandTextures: vi.fn(),
}));
vi.mock('@/app/[lang]/sim/engine/hands/handSkeleton', async importOriginal => ({
  ...await importOriginal<typeof import('@/app/[lang]/sim/engine/hands/handSkeleton')>(),
  addHandSkeleton: vi.fn(),
}));

function hand(side: 1 | -1, material: THREE.Material): HandModel {
  const group = new THREE.Group();
  const fingers = {} as Record<FingerName, FingerJoints>;
  for (const name of ['thumb', 'index', 'middle', 'ring', 'pinky'] as const) {
    const root = new THREE.Group(), mid = new THREE.Group(), tip = new THREE.Group();
    group.add(root); root.add(mid); mid.add(tip);
    mid.position.x = 40; tip.position.x = 30;
    fingers[name] = { root, mid, tip, segLens: [40, 30, 20], rootBase: new THREE.Quaternion() };
  }
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  const bone = new THREE.Bone();
  group.add(mesh, bone);
  return { group, side, unitScale: 1, fingers, meshes: [mesh],
    forearm: { bone, bindDir: new THREE.Vector3(-1, 0, 0), bindQuat: new THREE.Quaternion() } };
}
// No renderer reads pixels in these ownership tests.
const texture = () => new THREE.CanvasTexture({ width: 1, height: 1 } as HTMLCanvasElement);
const maps = () => ({ albedo: texture(), bump: texture(), rough: texture() });
const rigs: HandsRig[] = [];
function createRig() {
  const rig = new HandsRig();
  rigs.push(rig);
  const layers = () => Array.from({ length: 3 }, () => ({ angle: 0 }));
  const cube: HandsCubeLike = { order: 3, table: { groups: { x: layers(), y: layers(), z: layers() } } };
  rig.attachCube(cube);
  rig.setEnabled(true);
  return { rig, cube };
}
const ready = (rig: HandsRig) => vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
const haveManoHands = ['right', 'left'].every(name => existsSync(new URL(`../public/sim/hands/mano/${name}.mano.json`, import.meta.url)));

beforeEach(() => {
  vi.mocked(loadManoHand).mockImplementation(async (side, material) => hand(side, material));
  vi.mocked(bakeHandTextures).mockImplementation(async () => maps());
});
afterEach(() => {
  for (const rig of rigs) rig.dispose();
  rigs.length = 0;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function observeBasePalm() {
  const frames = new Map<HandModel, {position: THREE.Vector3; quaternion: THREE.Quaternion}>();
  const apply = HalfPalmPose.prototype.apply;
  vi.spyOn(HalfPalmPose.prototype, 'apply').mockImplementation(function(this: HalfPalmPose, weight, winding) {
    const model = (this as unknown as {model: HandModel}).model;
    frames.set(model, {position: model.group.position.clone(), quaternion: model.group.quaternion.clone()});
    apply.call(this, weight, winding);
  });
  return frames;
}

describe('hand playback and loading lifecycle', () => {
  it.each([
    ['x', 2], ['x', 1], ['x', 0], ['y', 2], ['y', 1], ['y', 0], ['z', 2], ['z', 1], ['z', 0],
  ] as const)('keeps the supporting wrist at its grip pose during %s layer %i clearance', async (axis, layer) => {
    const { rig, cube } = createRig();
    await ready(rig);
    let frame!: HandDiagnosticFrame;
    rig.subscribeDiagnostics(f => { frame = f; });
    for (const degrees of [8, 25, 45, 70, 89]) {
      cube.table.groups[axis][layer].angle = THREE.MathUtils.degToRad(degrees);
      rig.tick(16);
      const gesture = frame.active!.gesture!;
      for (const side of ['L', 'R'] as const) {
        if (gesture.kind === 'weld' ? gesture.hands.includes(side) : gesture.hand === side) continue;
        const home = side === 'R' ? homeRight() : homeLeft();
        expect(frame.models[side].group.position.distanceTo(home.pos)).toBeLessThan(1e-7);
        expect(frame.models[side].group.quaternion.clone().normalize().angleTo(home.quat.clone().normalize())).toBeLessThan(1e-6);
      }
    }
  });

  it('opens the fingers around the cube during a regrip on the unmodified wrist arc', async () => {
    const { rig } = createRig();
    await ready(rig);
    const frames = observeBasePalm();
    let frame!: HandDiagnosticFrame;
    rig.subscribeDiagnostics(f => { frame = f; });
    rig.regrip('up', 'R');
    const home = homeRight();
    for (let i = 0; i < 18; i++) {
      rig.tick(16);
      const pose = frames.get(frame.models.R)!;
      const rotation = pose.quaternion.clone().multiply(home.quat.clone().invert()).normalize();
      expect(pose.position.distanceTo(home.pos.clone().applyQuaternion(rotation))).toBeLessThan(.002);
    }
  });

  it.each(['x', 'y', 'z'] as const)('holds a whole %s turn continuously and restores one grip at a time', async axis => {
    const {rig, cube} = createRig();
    await ready(rig);
    let frame!: HandDiagnosticFrame;
    rig.subscribeDiagnostics(value => { frame = value; });
    const groups = cube.table.groups[axis];
    let last: THREE.Quaternion | undefined;
    for (let degree = 1; degree <= 90; degree++) {
      for (const layer of groups) layer.angle = degree * Math.PI / 180;
      rig.tick(4);
      const current = frame.models.R.group.quaternion.clone().normalize();
      if (last) expect(current.angleTo(last)).toBeLessThan(.02);
      last = current;
    }
    const support = frame.models.L.group.quaternion.clone().normalize();
    for (const layer of groups) layer.angle = 0;
    for (let i = 0; i < 10; i++) {
      rig.tick(16);
      expect(frame.models.L.group.quaternion.clone().normalize().angleTo(support)).toBeLessThan(1e-6);
    }
    // After 160 ms on a 300 ms smooth return, the right hand is past halfway.
    expect(frame.models.R.group.quaternion.clone().normalize().angleTo(last!)).toBeGreaterThan(Math.PI / 4);
    for (let i = 0; i < 32; i++) rig.tick(16);
    expect(rig.isRegripping).toBe(false);
    expect(frame.grips).toEqual({R: 'home', L: 'home'});
    expect(frame.models.L.group.quaternion.clone().normalize().angleTo(homeLeft().quat.clone().normalize())).toBeLessThan(1e-6);
  });
  it.each((['R', 'L'] as const).flatMap(side => (['up', 'down'] as const).map(direction => ({ side, direction }))))('half grip follows its specified route from either quaternion representation of home: $side $direction', async ({ side, direction }) => {
    const base = observeBasePalm();
    const normal = createRig(), equivalent = createRig();
    await Promise.all([ready(normal.rig), ready(equivalent.rig)]);
    let a!: HandDiagnosticFrame, b!: HandDiagnosticFrame;
    normal.rig.subscribeDiagnostics(f => { a = f; });
    equivalent.rig.subscribeDiagnostics(f => { b = f; });
    const identity = new THREE.Quaternion(), negativeIdentity = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-1, 0, 0), 2 * Math.PI);
    normal.rig.setGrips(identity, identity);
    equivalent.rig.setGrips(side === 'R' ? negativeIdentity : identity, side === 'L' ? negativeIdentity : identity);
    const grip = direction === 'down' ? 'halfDown' : 'half';
    normal.rig.regrip(grip, side); equivalent.rig.regrip(grip, side);
    for (let i = 0; i < 20; i++) {
      normal.rig.tick(16); equivalent.rig.tick(16);
      const elapsed = Math.min(1, (i + 1) * 16 / 300);
      const progress = elapsed * elapsed * (3 - 2 * elapsed);
      const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-1, 0, 0), (direction === 'down' ? -1 : 1) * Math.PI * progress)
        .multiply((side === 'R' ? homeRight() : homeLeft()).quat).normalize();
      expect(base.get(a.models[side])!.quaternion.normalize().angleTo(expected)).toBeLessThan(1e-6);
      expect(new THREE.Quaternion(...a.hands[side].quaternion).normalize().angleTo(new THREE.Quaternion(...b.hands[side].quaternion).normalize())).toBeLessThan(1e-6);
      expect(a.hands[side].position).toEqual(b.hands[side].position);
    }
    expect(a.grips[side]).toBe(grip);
    expect(a.hands[side].wristAngle).toBe((direction === 'down' ? -1 : 1) * Math.PI);
    expect(a.hands[side].forearmRoll).toBe(0);
  });
  it.each(['R', 'L'] as const)('keeps signed half-turn wrist state through live moves, seeking and loading: %s', async side => {
    for (const direction of [1, -1] as const) {
      const grip = direction > 0 ? 'half' : 'halfDown';
      const marked = createRig(), live = createRig(), seek = createRig();
      const step = { axis: 'x' as const, layers: [side === 'R' ? 2 : 0], quarters: direction * 2 };
      const simulated = simulateGrips([step], 3);
      const byMark = simulateGrips([{ grip, side }], 3);
      expect(simulated.wristAngles).toEqual(byMark.wristAngles);
      // Queue the seek before the model resolves, then verify it survives loading.
      seek.rig.setGrips(simulated.R, simulated.L, simulated.wristAngles);
      await Promise.all([ready(marked.rig), ready(live.rig), ready(seek.rig)]);
      let a!: HandDiagnosticFrame, b!: HandDiagnosticFrame, c!: HandDiagnosticFrame;
      marked.rig.subscribeDiagnostics(f => { a = f; });
      live.rig.subscribeDiagnostics(f => { b = f; });
      seek.rig.subscribeDiagnostics(f => { c = f; });
      marked.rig.regrip(grip, side);
      const layer = live.cube.table.groups.x[step.layers[0]];
      for (let i = 1; i <= 20; i++) { layer.angle = direction * Math.PI * i / 20; live.rig.tick(16); }
      layer.angle = 0;
      for (let i = 0; i < 25; i++) { marked.rig.tick(16); live.rig.tick(16); seek.rig.tick(16); }
      for (const f of [a, b, c]) {
        expect(f.grips[side]).toBe(grip);
        expect(f.hands[side].wristAngle).toBeCloseTo(direction * Math.PI, 8);
        expect(f.hands[side].forearmRoll).toBe(0);
      }
      expect(new THREE.Quaternion(...a.hands[side].quaternion).normalize().angleTo(new THREE.Quaternion(...b.hands[side].quaternion).normalize())).toBeLessThan(1e-6);
      // Switching the two half poses keeps contact orientation and eases the wrist roll.
      marked.rig.regrip(direction > 0 ? 'halfDown' : 'half', side);
      const start = a.hands[side].wristAngle;
      marked.rig.tick(16);
      expect(Math.abs(a.hands[side].wristAngle - start)).toBeLessThan(1);
      expect(a.hands[side].phase).toBe('regripping');
      for (let i = 0; i < 25; i++) marked.rig.tick(16);
      expect(a.hands[side].wristAngle).toBeCloseTo(-direction * Math.PI, 8);
    }
  });

  it.runIf(haveManoHands)('mirrors distinct half-turn palms with bounded wrist flexion and a continuous branch switch', async () => {
    const { buildManoHand } = await vi.importActual<typeof import('@/app/[lang]/sim/engine/hands/handModelMano')>('@/app/[lang]/sim/engine/hands/handModelMano');
    vi.mocked(loadManoHand).mockImplementation(async (side, material) => {
      const name = side === -1 ? 'right' : 'left';
      return buildManoHand(JSON.parse(readFileSync(new URL(`../public/sim/hands/mano/${name}.mano.json`, import.meta.url), 'utf8')), side, material, `${name}.mano.json`);
    });
    const up = createRig(), down = createRig();
    await Promise.all([ready(up.rig), ready(down.rig)]);
    let a!: HandDiagnosticFrame, b!: HandDiagnosticFrame;
    up.rig.subscribeDiagnostics(f => { a = f; }); down.rig.subscribeDiagnostics(f => { b = f; });
    up.rig.regrip('half'); down.rig.regrip('halfDown');
    const checkWrist = (frame: HandDiagnosticFrame, side: 'R' | 'L') => {
      const model = frame.models[side], hand = frame.hands[side];
      const wrist = WRIST_LOCAL.clone().applyQuaternion(model.group.quaternion).add(model.group.position);
      const back = new THREE.Vector3(...hand.elbowPosition!).sub(wrist).normalize();
      const radial = model.radialAxis!.clone().applyQuaternion(model.group.quaternion).normalize();
      const deviation = THREE.MathUtils.radToDeg(Math.asin(back.dot(radial)));
      expect(deviation).toBeGreaterThanOrEqual(-25.00001);
      expect(deviation).toBeLessThanOrEqual(40.00001);
      expect(hand.wristBend!).toBeLessThanOrEqual(THREE.MathUtils.degToRad(80.00001));
    };
    for (let i = 0; i < 60; i++) {
      up.rig.tick(5); down.rig.tick(5);
      for (const frame of [a,b]) for (const side of ['R','L'] as const)
        checkWrist(frame, side);
    }
    for (const side of ['R','L'] as const) {
      const normal = (frame: HandDiagnosticFrame) => new THREE.Vector3(0,0,1).applyQuaternion(frame.models[side].group.quaternion);
      // In a fixed F view the upper palm opens toward the viewer, while the
      // lower seat presents the dorsal surface. Keep the vertical distinction.
      expect(normal(a).z - normal(b).z).toBeGreaterThan(.14);
      expect(normal(a).y).toBeGreaterThan(0);
      expect(normal(b).y).toBeLessThan(0);
      expect(normal(b).z).toBeLessThan(-.32);
      for (const frame of [a, b])
        expect(normal(frame).x * (side === 'R' ? -1 : 1)).toBeGreaterThan(.85);
      for (const frame of [a,b]) {
        checkWrist(frame, side);
        expect(frame.hands[side].forearmRoll).toBe(0);
      }
      // Up may turn the distal fingers in their contact plane; exact material
      // anchors and block faces are checked with real skin in hands_half_palm.
    }
    up.rig.regrip('halfDown');
    let previous = a.hands;
    for(let i=0;i<80;i++) {
      up.rig.tick(5);
      for(const side of ['R','L'] as const) {
        checkWrist(a, side);
        for(const field of ['forearmQuaternion','quaternion'] as const)
          expect(new THREE.Quaternion(...a.hands[side][field]!).normalize().angleTo(new THREE.Quaternion(...previous[side][field]!).normalize())).toBeLessThan(.08);
      }
      previous=a.hands;
    }
    for(const side of ['R','L'] as const)
      expect(new THREE.Quaternion(...a.hands[side].quaternion).normalize().angleTo(new THREE.Quaternion(...b.hands[side].quaternion).normalize())).toBeLessThan(1e-6);
  });

  it.runIf(haveManoHands)(
    'records all four U checkpoints with real MANO skin in every grip pair', async () => {
      const { buildManoHand } = await vi.importActual<typeof import('@/app/[lang]/sim/engine/hands/handModelMano')>('@/app/[lang]/sim/engine/hands/handModelMano');
      vi.mocked(loadManoHand).mockImplementation(async (side, material) => {
        const name = side === -1 ? 'right' : 'left';
        const data = JSON.parse(readFileSync(new URL(`../public/sim/hands/mano/${name}.mano.json`, import.meta.url), 'utf8'));
        return buildManoHand(data, side, material, `${name}.mano.json`);
      });
      const { rig } = createRig();
      const cube = new Cube(3);
      rig.attachCube({ order: cube.order, table: { groups: {
        x: cube.table.groups.x, y: cube.table.groups.y, z: cube.table.groups.z,
      } } });
      await ready(rig);
      const recorder = new UContactRecorder(() => cube);
      recorder.bind(rig); recorder.start();
      try {
        let checked = 0;
        for (const R of ['home', 'up', 'down', 'half', 'halfDown'] as const) {
          for (const L of ['home', 'up', 'down', 'half', 'halfDown'] as const) {
            cube.reset(); rig.setGrips(gripQuat(R), gripQuat(L)); rig.tick(16);
            if (R === 'up') {
              expect(rig.prepareTwist('y', [2], 1)).toBe(true);
              for (let i = 0; i < 10; i++) rig.tick(40);
            }
            expect(rig.prepareTwist('y', [2], 1)).toBe(false);
            const layer = cube.table.groups.y[2];
            layer.drag(); layer.angle = Math.PI / 4; rig.tick(16);
            layer.angle = Math.PI / 2; rig.tick(16); layer.drop(); rig.tick(16);
            for (let i = 0; i < 10; i++) rig.tick(90);
            const data = recorder.read(), run = data.records.at(-1)!;
            expect(data.error).toBeNull();
            expect(run.startGrips).toEqual({ R, L });
            expect(run.status).toBe('complete');
            checked++;
            expect(run.missingCheckpoints).toEqual([]);
            for (const key of ['start', '45deg', '90deg', 'after-return'] as const) {
              const checkpoint = run.checkpoints[key]!;
              expect(checkpoint.measurement.fingerVertices).toBeGreaterThan(100);
              expect(checkpoint.measurement.padVertices).toBeGreaterThan(0);
              expect(Number.isFinite(checkpoint.measurement.nearest!.gapU)).toBe(true);
              expect(Number.isFinite(checkpoint.measurement.penetration.depthU)).toBe(true);
              expect(Number.isFinite(checkpoint.slip!.tangentialDisplacementU)).toBe(true);
            }
          }
        }
        expect(checked).toBe(25);
        expect(recorder.read().records).toHaveLength(20); // Recorder keeps its bounded rolling history.
      } finally { recorder.dispose(); cube.dispose(); }
    },
  );

  it.each((['home', 'up', 'down', 'half'] as const).flatMap(R =>
    (['home', 'up', 'down', 'half'] as const).map(L => ({ R, L })),
  ))('observes right-index U in R=$R L=$L without changing any animation frame', async ({ R, L }) => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const observed = createRig(), baseline = createRig();
    await Promise.all([ready(observed.rig), ready(baseline.rig)]);
    const frames: HandDiagnosticFrame[] = [];
    observed.rig.subscribeDiagnostics(frame => { frames.push(frame); });
    for (const pair of [observed, baseline]) {
      pair.rig.setGrips(gripQuat(R), gripQuat(L)); pair.rig.tick(16);
      if (R === 'up') {
        expect(pair.rig.prepareTwist('y', [2], 1)).toBe(true);
        for (let i = 0; i < 10; i++) pair.rig.tick(40);
      }
      expect(pair.rig.prepareTwist('y', [2], 1)).toBe(false);
    }
    const prepared = frames.find(frame => frame.event === 'prepare-u')!;
    expect(prepared.grips).toEqual({ R, L });
    expect(prepared.preparedGesture).toEqual({ kind: 'flick', hand: 'R', finger: 'index',
      ...(R === 'up' ? { style: 'topPush' } : R === 'home' ? { style: 'indexHook' } : {}) });
    const transforms = (rig: HandsRig) => {
      const values: number[] = [];
      rig.traverse(object => { values.push(...object.position.toArray(), ...object.quaternion.toArray()); });
      return values;
    };
    for (const angle of [Math.PI / 4, Math.PI / 2, ...Array(10).fill(0)]) {
      for (const pair of [observed, baseline]) {
        pair.cube.table.groups.y[2].angle = angle; pair.rig.tick(90);
      }
      expect(transforms(observed.rig)).toEqual(transforms(baseline.rig));
    }
    expect(frames.filter(frame => frame.event === 'end-u')).toHaveLength(1);
    expect(frames.at(-1)?.hands.R.phase).toBe('stable');
    frames.length = 0;
    // Widening the grip coverage must not admit U2, U', wide turns or other axes.
    observed.rig.prepareTwist('y', [2], 1, 2);
    observed.rig.prepareTwist('y', [2], -1);
    observed.rig.prepareTwist('y', [1, 2], 1);
    observed.rig.prepareTwist('x', [2], 1);
    expect(frames.filter(frame => frame.event === 'prepare-u')).toEqual([]);
  });

  it.each([
    ['R', 'home', 1], ['L', 'home', 1], ['R', 'home', 2], ['L', 'home', 2],
    ['R', 'down', 1], ['L', 'down', 1], ['R', 'down', 2], ['L', 'down', 2],
  ] as const)('%s %s F-layer %s quarters keeps the palm and unused fingers fixed', async (side, grip, quarters) => {
    const { rig, cube } = createRig();
    await ready(rig);
    // Use a non-home supporting hand to exercise independent gesture selection.
    rig.setGrips(gripQuat(side === 'R' ? grip : 'half'), gripQuat(side === 'L' ? grip : 'half'));
    let models!: Record<'R' | 'L', HandModel>;
    rig.subscribeDiagnostics(frame => { models = frame.models; });
    rig.tick(16);
    const sign = side === 'R' ? 1 : -1;
    const selected = new Set<FingerName>(grip === 'down' && quarters === 2 ? ['index', 'middle'] : ['index']);
    const transforms = (includeMoving: boolean) => {
      const values: number[] = [];
      for (const s of ['R', 'L'] as const) {
        const m = models[s];
        m.group.updateWorldMatrix(true, true);
        values.push(...m.group.matrixWorld.elements);
        for (const name of ['thumb', 'index', 'middle', 'ring', 'pinky'] as const) {
          if (!includeMoving && s === side && selected.has(name)) continue;
          for (const joint of [m.fingers[name].root, m.fingers[name].mid, m.fingers[name].tip]) values.push(...joint.matrixWorld.elements);
        }
      }
      return values;
    };
    rig.prepareTwist('z', [2], sign, quarters);
    rig.tick(0);
    const fixed = transforms(false), before = transforms(true);
    for (let i = 0; i < 6; i++) { rig.tick(50); rig.prepareTwist('z', [2], sign, quarters); }
    for (const progress of [.01, .25, .5, .75, 1]) {
      cube.table.groups.z[2].angle = sign * quarters * Math.PI / 2 * progress;
      rig.tick(16);
      expect(transforms(false)).toEqual(fixed);
    }
    expect(transforms(true)).not.toEqual(before);
  });

  it.each(([-1, 1] as const).flatMap(dir =>
    [1, 2].flatMap(quarters => [false, true].map(prepared => ({ dir, quarters, prepared }))),
  ))('keeps both D-layer thumbs fixed across grips (dir=$dir, quarters=$quarters, prepared=$prepared)', async ({ dir, quarters, prepared }) => {
    const { rig, cube } = createRig();
    await ready(rig);
    let models!: Record<'R' | 'L', HandModel>;
    rig.subscribeDiagnostics(frame => { models = frame.models; });
    const transforms = (name: FingerName) => (['R', 'L'] as const).flatMap(side => {
      const model = models[side];
      model.group.updateWorldMatrix(true, true);
      const finger = model.fingers[name];
      return [finger.tip].flatMap(joint => [...joint.matrixWorld.elements]);
    });
    for (const R of ['home', 'up', 'down', 'half'] as const) {
      for (const L of ['home', 'up', 'down', 'half'] as const) {
        rig.setGrips(gripQuat(R), gripQuat(L));
        if (prepared) rig.prepareTwist('y', [0], dir, quarters);
        else cube.table.groups.y[0].angle = dir * .001; // Direct drag has no preparation hint.
        rig.tick(0);
        const thumbs = transforms('thumb'), ringBefore = transforms('ring');
        const check = () => transforms('thumb').forEach((value,i) => expect(value, `R=${R} L=${L}`).toBeCloseTo(thumbs[i],3));
        if (prepared) for (let i = 0; i < 10; i++) { rig.tick(40); check(); }
        for (const progress of [.01, .25, .5, .75, 1]) {
          cube.table.groups.y[0].angle = dir * quarters * Math.PI / 2 * progress;
          rig.tick(16); check();
        }
        // The layer still drives the selected finger; freezing the whole rig is not a fix.
        expect(transforms('ring')).not.toEqual(ringBefore);
        cube.table.groups.y[0].angle = 0;
        // Check the recovery boundary too, before normal idle motion resumes.
        for (let i = 0; i < 6; i++) { rig.tick(40); check(); }
      }
    }
  });

  it.each((['R', 'L'] as const).flatMap(side =>
    ([false, true] as const).flatMap(wide =>
      ([-1, 1] as const).flatMap(dir => [1, 2].map(quarters => ({ side, wide, dir, quarters }))),
    ),
  ))('keeps $side wrist attached through the full turn (wide=$wide, dir=$dir, quarters=$quarters)', async ({ side, wide, dir, quarters }) => {
    const base = observeBasePalm();
    const { rig, cube } = createRig();
    await ready(rig);
    const models = await Promise.all(vi.mocked(loadManoHand).mock.results.slice(-2).map(result => result.value as Promise<HandModel>));
    const model = models.find(m => m.side === (side === 'R' ? -1 : 1))!;
    const home = side === 'R' ? homeRight() : homeLeft();
    const layers = side === 'R' ? (wide ? [1, 2] : [2]) : (wide ? [0, 1] : [0]);
    const axis = new THREE.Vector3(-1, 0, 0);
    for (const grip of ['home', 'up', 'down', 'half'] as const) {
      rig.setGrips(gripQuat(side === 'R' ? grip : 'home'), gripQuat(side === 'L' ? grip : 'home'));
      // The stationary hand may need to seat its thumb before a wide wrist turn.
      if (wide) {
        rig.prepareTwist('x', layers, dir, quarters);
        for (let i = 0; i < 30; i++) rig.tick(16);
      }
      expect(rig.prepareTwist('x', layers, dir, quarters)).toBe(false);
      const assertAttached = (degrees: number) => {
        const rotation = new THREE.Quaternion().setFromAxisAngle(axis, dir * degrees * Math.PI / 180).multiply(gripQuat(grip));
        expect(base.get(model)!.quaternion.clone().normalize().angleTo(rotation.clone().multiply(home.quat).normalize())).toBeCloseTo(0, 6);
        expect(base.get(model)!.position.distanceTo(home.pos.clone().applyQuaternion(rotation))).toBeCloseTo(0, 6);
      };
      // Include the old 93-degree clamp boundary and the entire second quadrant.
      for (const degrees of [5, 45, 90, 93, 94, 120, 150, 180].filter(d => d <= quarters * 90)) {
        for (const layer of layers) cube.table.groups.x[layer].angle = dir * degrees * Math.PI / 180;
        rig.tick(16);
        assertAttached(degrees);
      }
      // Committing must not create a compensating outward recovery arc.
      for (const layer of layers) cube.table.groups.x[layer].angle = 0;
      for (let i = 0; i < 12; i++) { rig.tick(16); assertAttached(quarters * 90); }
    }
  });

  it.each([
    ['↓↓U', [['halfDown', 'R']], { R: 'halfDown', L: 'home' }],
    ['↓↓ U', [['halfDown', 'L']], { R: 'home', L: 'halfDown' }],
    ['↓↓', [['halfDown', 'R']], { R: 'halfDown', L: 'home' }],
    ['↓↓ ', [['halfDown', 'L']], { R: 'home', L: 'halfDown' }],
    ['↑↑｜↓↓', [['half', 'R'], ['halfDown', 'L']], { R: 'half', L: 'halfDown' }],
    ['↑↑U', [['half', 'R']], { R: 'half', L: 'home' }],
    ['↑↑ U', [['half', 'L']], { R: 'home', L: 'half' }],
    ['↑↑', [['half', 'R']], { R: 'half', L: 'home' }],
    ['↑↑ ', [['half', 'L']], { R: 'home', L: 'half' }],
    ['↑｜↑U', [['up', 'R'], ['up', 'L']], { R: 'up', L: 'up' }],
    ['↑|↓ U', [['up', 'R'], ['down', 'L']], { R: 'up', L: 'down' }],
    ['↑↑｜↑↑', [['half', 'R'], ['half', 'L']], { R: 'half', L: 'half' }],
  ] as const)('records parsed grip requests and settled state without a U turn: %s', async (text, requests, finalGrips) => {
    const { rig } = createRig();
    await ready(rig);
    const recorder = new UContactRecorder(() => null);
    recorder.bind(rig); recorder.start();
    try {
      rig.tick(16);
      for (const mark of findGripMarks(text)) {
        rig.regrip(mark.grip, mark.side);
        const request = recorder.read().gripEvents.at(-1)!;
        expect(request.gripRequest).toEqual({ name: mark.grip, sides: [mark.side], ...(mark.halfDirection ? { halfDirection: mark.halfDirection } : {}) });
        expect(request.hands[mark.side].phase).toBe('regripping');
        for (let i = 0; i < 5; i++) rig.tick(90);
        const settled = recorder.read().gripEvents.at(-1)!;
        expect(settled.grips[mark.side]).toBe(mark.grip);
        expect(settled.hands[mark.side].phase).toBe('stable');
      }
      const data = recorder.read();
      expect(data.gripEvents.filter(p => p.gripRequest).map(p => [p.gripRequest!.name, p.gripRequest!.sides[0]]))
        .toEqual(requests);
      expect(data.stateFrames.at(-1)!.grips).toEqual(finalGrips);
      expect(data.records).toEqual([]); // Non-home grips are observed without claiming calibrated U contact.
      rig.setGrips(gripQuat('half'), gripQuat('down'));
      expect(recorder.read().gripEvents.at(-1)?.event).toBe('grip-set');
      expect(recorder.read().gripEvents.at(-1)?.grips).toEqual({ R: 'half', L: 'down' });
    } finally { recorder.dispose(); }
  });

  it('observes prepared U and return without changing playback, and isolates observer failures', async () => {
    const observed = createRig(), baseline = createRig();
    await Promise.all([ready(observed.rig), ready(baseline.rig)]);
    const events: string[] = [];
    const snapshots: number[][] = [];
    observed.rig.subscribeDiagnostics(frame => {
      events.push(frame.event);
      snapshots.push(frame.hands.R.position);
    });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    observed.rig.subscribeDiagnostics(() => { throw new Error('test observer failure'); });
    for (const pair of [observed, baseline]) {
      pair.rig.tick(16);
      expect(pair.rig.prepareTwist('y', [2], 1)).toBe(false);
      pair.cube.table.groups.y[2].angle = Math.PI / 4; pair.rig.tick(16);
      pair.cube.table.groups.y[2].angle = Math.PI / 2; pair.rig.tick(16);
      pair.cube.table.groups.y[2].angle = 0; pair.rig.tick(16);
      for (let i = 0; i < 5; i++) pair.rig.tick(90);
    }
    expect(events).toContain('prepare-u');
    expect(events).toContain('end-u');
    expect(warning).toHaveBeenCalledTimes(1);
    expect(snapshots.length).toBeGreaterThan(4);
    // Compare every rendered object transform; diagnostics must not alter any pose.
    const transforms = (rig: HandsRig) => {
      const result: number[][] = [];
      rig.traverse(object => { result.push([...object.position.toArray(), ...object.quaternion.toArray()]); });
      return result;
    };
    expect(transforms(observed.rig)).toEqual(transforms(baseline.rig));
  });

  it('keeps close framing until the body exists and restores cube framing when hands are off', async () => {
    const { rig } = createRig();
    await ready(rig);
    vi.spyOn(rig, 'setFullBody').mockImplementation(() => {});
    const bodyOn = vi.spyOn(rig, 'fullBodyOn', 'get').mockReturnValue(false);
    const world = new World();
    world.width = 800; world.height = 600;
    world.handsFactory = () => rig;
    try {
      world.setHandsWanted(true);
      const closeZ = world.camera.position.z;
      world.setHandsFullBody(true);
      expect(world.camera.position.z).toBe(closeZ);
      bodyOn.mockReturnValue(true);
      world.resize();
      expect(world.camera.position.z).toBeCloseTo(closeZ * (0.3 / (world.scale * 0.07)), 8);
      world.setHandsWanted(false);
      expect(world.camera.position.z).toBe(SIZE * 3 * world.perspective);
    } finally { world.cube.dispose(); }
  });

  it('waits for loading and preserves a grip selected before the models arrive', async () => {
    const { rig } = createRig();
    expect(rig.prepareTwist('y', [2], 1)).toBe(true);
    rig.setGrips(gripQuat('down'), gripQuat('home'));
    await ready(rig);
    // Right-down F uses a down-push, while home F would require a top-push reach.
    expect(rig.prepareTwist('z', [2], 1)).toBe(false);
    expect(rig.isReachPreparing).toBe(false);
  });

  it('settles a dropped turn before polling and waits for the same finger to return', async () => {
    const { rig, cube } = createRig();
    await ready(rig);
    cube.table.groups.y[2].angle = Math.PI / 2;
    rig.tick(16);
    cube.table.groups.y[2].angle = 0;
    // Playback polls before the next rendering tick; it must not reset the finger.
    expect(rig.prepareTwist('y', [2], 1)).toBe(true);
    for (let i = 0; i < 4; i++) { rig.tick(90); rig.prepareTwist('y', [2], 1); }
    expect(rig.prepareTwist('y', [2], 1)).toBe(false);
  });

  it('does not restart the other hand’s return when another turn ends', async () => {
    const { rig, cube } = createRig();
    await ready(rig);
    cube.table.groups.y[2].angle = Math.PI / 2;
    rig.tick(16);
    cube.table.groups.y[2].angle = 0;
    expect(rig.prepareTwist('y', [0], -1)).toBe(false); // left D can overlap right U recovery
    cube.table.groups.y[0].angle = -Math.PI / 2;
    rig.tick(100); rig.tick(50);
    cube.table.groups.y[0].angle = 0;
    rig.prepareTwist('y', [0], -1);
    rig.tick(90); rig.tick(90);
    expect(rig.prepareTwist('y', [0], 1)).toBe(false); // right hand has finished its original return
  });

  it('clears reach, recovery and active gestures when seeking to a static grip', async () => {
    const { rig, cube } = createRig();
    await ready(rig);
    expect(rig.prepareTwist('z', [2], 1)).toBe(true);
    rig.tick(80);
    expect(rig.isReachPreparing).toBe(true);
    rig.setGrips(gripQuat('home'), gripQuat('home'));
    expect(rig.isReachPreparing).toBe(false);
    expect(rig.isReachRetreating).toBe(false);
    cube.table.groups.x[2].angle = Math.PI / 2;
    rig.tick(16);
    cube.table.groups.x[2].angle = 0;
    rig.setGrips(gripQuat('down'), gripQuat('home'));
    rig.tick(16);
    expect(rig.prepareTwist('z', [2], 1)).toBe(false);
  });

  it('cleans up a partial load failure, allows cube playback, and retries both hands', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const partial = hand(-1, new THREE.MeshPhysicalMaterial());
    const dispose = vi.spyOn(partial.meshes[0].geometry, 'dispose');
    vi.mocked(loadManoHand).mockResolvedValueOnce(partial).mockRejectedValueOnce(new Error('offline'));
    const { rig } = createRig();
    await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('error'));
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(rig.prepareTwist('y', [2], 1)).toBe(false);
    rig.retryLoad();
    await ready(rig);
    expect(loadManoHand).toHaveBeenCalledTimes(4);
  });

  it('cancels in-flight IO and disposes models that arrive after the page has gone', async () => {
    const pending: { resolve: (model: HandModel) => void; model: HandModel; signal?: AbortSignal }[] = [];
    vi.mocked(loadManoHand).mockImplementation((side, material, signal) => new Promise(resolve => {
      pending.push({ resolve, model: hand(side, material), signal });
    }));
    const { rig } = createRig();
    const disposals = pending.map(item => vi.spyOn(item.model.meshes[0].geometry, 'dispose'));
    rig.dispose();
    for (const item of pending) {
      expect(item.signal?.aborted).toBe(true);
      item.resolve(item.model);
    }
    await vi.waitFor(() => expect(disposals[0]).toHaveBeenCalledTimes(1));
    expect(disposals[1]).toHaveBeenCalledTimes(1);
    expect(rig.children).toHaveLength(0);
    expect(bakeHandTextures).not.toHaveBeenCalled();
  });

  it('disposes textures that finish baking after unmount', async () => {
    let finish!: (value: ReturnType<typeof maps>) => void;
    vi.mocked(bakeHandTextures).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { rig } = createRig();
    await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('texturing'));
    const lateMaps = maps();
    const dispose = vi.spyOn(lateMaps.albedo, 'dispose');
    rig.dispose();
    finish(lateMaps);
    await vi.waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
    expect(rig.children).toHaveLength(0);
  });
});
