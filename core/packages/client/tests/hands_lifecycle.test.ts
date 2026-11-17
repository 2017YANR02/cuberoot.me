import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import * as THREE from 'three';
import HandsRig, { gripQuat, type HandsCubeLike, type HandDiagnosticFrame } from '@/app/[lang]/sim/engine/hands/handsRig';
import { loadManoHand } from '@/app/[lang]/sim/engine/hands/handModelMano';
import { bakeHandTextures } from '@/app/[lang]/sim/engine/hands/bakeHandTexture';
import type { FingerJoints, FingerName, HandModel } from '@/app/[lang]/sim/engine/hands/handModel';
import World from '@/app/[lang]/sim/engine/world';
import { SIZE } from '@/app/[lang]/sim/engine/define';
import { homeLeft, homeRight } from '@/app/[lang]/sim/engine/hands/handPoses';
import { findGripMarks } from '@cuberoot/shared/alg-notation';
import { UContactRecorder } from '@/app/[lang]/sim/engine/hands/uContactRecorder';

// Keep the real animation lifecycle; substitute only asset IO / browser texture creation.
vi.mock('@/app/[lang]/sim/engine/hands/handModelMano', () => ({ loadManoHand: vi.fn() }));
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

describe('hand playback and loading lifecycle', () => {
  it.runIf(['right', 'left'].every(name => existsSync(new URL(`../public/sim/hands/mano/${name}.mano.json`, import.meta.url))))(
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
        for (const R of ['home', 'up', 'down', 'half'] as const) {
          for (const L of ['home', 'up', 'down', 'half'] as const) {
            cube.reset(); rig.setGrips(gripQuat(R), gripQuat(L)); rig.tick(16);
            expect(rig.prepareTwist('y', [2], 1)).toBe(false);
            const layer = cube.table.groups.y[2];
            layer.drag(); layer.angle = Math.PI / 4; rig.tick(16);
            layer.angle = Math.PI / 2; rig.tick(16); layer.drop(); rig.tick(16);
            for (let i = 0; i < 5; i++) rig.tick(90);
            const data = recorder.read(), run = data.records.at(-1)!;
            expect(data.error).toBeNull();
            expect(run.startGrips).toEqual({ R, L });
            expect(run.status).toBe('complete');
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
        expect(recorder.read().records).toHaveLength(16);
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
      expect(pair.rig.prepareTwist('y', [2], 1)).toBe(false);
    }
    const prepared = frames.find(frame => frame.event === 'prepare-u')!;
    expect(prepared.grips).toEqual({ R, L });
    expect(prepared.preparedGesture).toEqual({ kind: 'flick', hand: 'R', finger: 'index',
      ...(R === 'home' && L === 'home' ? { style: 'hook' } : {}) });
    const transforms = (rig: HandsRig) => {
      const values: number[] = [];
      rig.traverse(object => { values.push(...object.position.toArray(), ...object.quaternion.toArray()); });
      return values;
    };
    for (const angle of [Math.PI / 4, Math.PI / 2, 0, 0, 0, 0, 0, 0]) {
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

  it.each((['R', 'L'] as const).flatMap(side =>
    ([false, true] as const).flatMap(wide =>
      ([-1, 1] as const).flatMap(dir => [1, 2].map(quarters => ({ side, wide, dir, quarters }))),
    ),
  ))('keeps $side wrist attached through the full turn (wide=$wide, dir=$dir, quarters=$quarters)', async ({ side, wide, dir, quarters }) => {
    const { rig, cube } = createRig();
    await ready(rig);
    const models = await Promise.all(vi.mocked(loadManoHand).mock.results.slice(-2).map(result => result.value as Promise<HandModel>));
    const model = models.find(m => m.side === (side === 'R' ? -1 : 1))!;
    const home = side === 'R' ? homeRight() : homeLeft();
    const layers = side === 'R' ? (wide ? [1, 2] : [2]) : (wide ? [0, 1] : [0]);
    const axis = new THREE.Vector3(-1, 0, 0);
    for (const grip of ['home', 'up', 'down', 'half'] as const) {
      rig.setGrips(gripQuat(side === 'R' ? grip : 'home'), gripQuat(side === 'L' ? grip : 'home'));
      expect(rig.prepareTwist('x', layers, dir, quarters)).toBe(false);
      const assertAttached = (degrees: number) => {
        const rotation = new THREE.Quaternion().setFromAxisAngle(axis, dir * degrees * Math.PI / 180).multiply(gripQuat(grip));
        expect(model.group.quaternion.clone().normalize().angleTo(rotation.clone().multiply(home.quat).normalize())).toBeCloseTo(0, 6);
        expect(model.group.position.distanceTo(home.pos.clone().applyQuaternion(rotation))).toBeCloseTo(0, 6);
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
        expect(request.gripRequest).toEqual({ name: mark.grip, sides: [mark.side] });
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
