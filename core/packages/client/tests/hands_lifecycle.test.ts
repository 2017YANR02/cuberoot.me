import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import HandsRig, { gripQuat, type HandsCubeLike } from '@/app/[lang]/sim/engine/hands/handsRig';
import { loadManoHand } from '@/app/[lang]/sim/engine/hands/handModelMano';
import { bakeHandTextures } from '@/app/[lang]/sim/engine/hands/bakeHandTexture';
import type { FingerJoints, FingerName, HandModel } from '@/app/[lang]/sim/engine/hands/handModel';
import World from '@/app/[lang]/sim/engine/world';
import { SIZE } from '@/app/[lang]/sim/engine/define';

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
