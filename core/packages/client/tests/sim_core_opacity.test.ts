import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { applyCoreOpacity } from '@/app/[lang]/sim/engine/coreOpacity';
import { resolveCaps } from '@/app/[lang]/sim/simCaps';
import { PG_PUZZLES } from '@/app/[lang]/sim/pgCatalog';
import type { SimPuzzle } from '@/app/[lang]/sim/PlayerControls';
import { applyTwistyCoreOpacity } from '@/components/twistyCoreOpacity';

afterEach(() => vi.unstubAllGlobals());

describe('sim core opacity', () => {
  it('changes only tagged body/core meshes and restores their base materials', () => {
    const root = new THREE.Group();
    const bodyBase = new THREE.MeshBasicMaterial({ opacity: 0.8 });
    const stickerBase = new THREE.MeshBasicMaterial();
    const body = new THREE.Mesh(new THREE.BoxGeometry(), bodyBase);
    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(), stickerBase);
    body.userData.simRole = 'body';
    sticker.userData.simRole = 'sticker';
    root.add(body, sticker);

    applyCoreOpacity(root, 50);
    expect(body.material).not.toBe(bodyBase);
    expect((body.material as THREE.Material).opacity).toBe(0.4);
    expect((body.material as THREE.Material).transparent).toBe(true);
    expect(sticker.material).toBe(stickerBase);

    applyCoreOpacity(root, 100);
    expect(body.material).toBe(bodyBase);
    expect(bodyBase.opacity).toBe(0.8);
    expect(sticker.material).toBe(stickerBase);
  });

  it('advertises core opacity for every puzzle and renderer in the selector', () => {
    const builtIns: SimPuzzle[] = [
      3, 'custom', 'sq1', 'ivy', 'pyraminx', 'skewb', 'megaminx', 'clock', 'fto',
      'dino', 'redi', 'rex', 'heli', 'gear', 'mirror', 'mirror2',
    ];
    const puzzles = [...builtIns, ...PG_PUZZLES.map((p) => p.id as SimPuzzle)];
    for (const puzzle of puzzles) {
      expect(resolveCaps(puzzle, 'group').supports.coreOpacity, `${puzzle}/group`).toBe(true);
      expect(resolveCaps(puzzle, 'cubing').supports.coreOpacity, `${puzzle}/cubing`).toBe(true);
    }
  });

  it('maps cubing.js foundation visibility and fractional materials', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
    const cubeBase = new THREE.MeshBasicMaterial();
    const pgBase1 = new THREE.MeshBasicMaterial();
    const pgBase2 = new THREE.MeshBasicMaterial();
    const cubeFoundation = { material: cubeBase };
    const target = {
      experimentalFoundationMeshes: [cubeFoundation],
      materialArray1: Array<THREE.Material>(8),
      materialArray2: Array<THREE.Material>(8),
      experimentalUpdateOptions: vi.fn(),
      scheduleRenderCallback: vi.fn(),
    };
    target.materialArray1[6] = pgBase1;
    target.materialArray2[7] = pgBase2;
    const foundationDisplay = { set: vi.fn() };
    const player = {
      experimentalModel: { twistySceneModel: { foundationDisplay } },
      experimentalCurrentThreeJSPuzzleObject: async () => target,
      experimentalGet: {
        vantage: async () => ({ scene: { scene: async () => ({ traverse: (cb: (o: unknown) => void) => cb(target) }) } }),
      },
    };

    await applyTwistyCoreOpacity(player, 50);
    expect(foundationDisplay.set).toHaveBeenLastCalledWith('auto');
    expect(target.experimentalUpdateOptions).toHaveBeenLastCalledWith({ showFoundation: true });
    expect(cubeFoundation.material.opacity).toBe(0.5);
    expect(target.materialArray1[6].opacity).toBe(0.5);
    expect(target.materialArray2[7].opacity).toBe(0.5);

    await applyTwistyCoreOpacity(player, 0);
    expect(foundationDisplay.set).toHaveBeenLastCalledWith('none');
    expect(target.experimentalUpdateOptions).toHaveBeenLastCalledWith({ showFoundation: false });

    await applyTwistyCoreOpacity(player, 100);
    expect(cubeFoundation.material).toBe(cubeBase);
    expect(target.materialArray1[6]).toBe(pgBase1);
    expect(target.materialArray2[7]).toBe(pgBase2);
  });

  it('treats the cubing.js slider as absolute even when the foundation base is translucent', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
    const base = new THREE.MeshBasicMaterial({ opacity: 0.3, transparent: true });
    const holder = { material: base };
    const target = {
      experimentalFoundationMeshes: [holder],
      experimentalUpdateOptions: vi.fn(),
    };
    const player = {
      experimentalModel: { twistySceneModel: { foundationDisplay: { set: vi.fn() } } },
      experimentalCurrentThreeJSPuzzleObject: async () => target,
    };

    await applyTwistyCoreOpacity(player, 100);
    expect(holder.material.opacity).toBe(1);
    expect(holder.material.transparent).toBe(false);
    await applyTwistyCoreOpacity(player, 50);
    expect(holder.material.opacity).toBe(0.5);
  });
});
