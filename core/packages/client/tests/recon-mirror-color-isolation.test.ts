import { describe, expect, it, vi } from 'vitest';
import CuberReconPlayer from '@/components/CuberReconPlayer';
import type { ReconPlayerAdapter } from '@/components/recon/ReconPlayerBase';
import type World from '@/app/[lang]/sim/engine/world';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
import { COLORS } from '@/app/[lang]/sim/engine/define';
import { mirrorFaces } from '@/components/puzzle-models/mirror/mirrorGeometry';

vi.mock('@/components/recon/ReconPlayerBase', () => ({ default: vi.fn() }));

function adapter(mirror: boolean): ReconPlayerAdapter<string> {
  return CuberReconPlayer({ scramble: '', alg: '', order: 3, mirror }).props.adapter;
}

function stickerColors(cube: Cube) {
  return cube.instancedRenderer.staticSticker.instanceColor!.array.slice();
}

describe('recon mirror renderer color isolation', () => {
  it('sets up a real mirror renderer without recoloring an existing or newly created ordinary cube', () => {
    const globalColors = { ...COLORS };
    const regular = new Cube(3);
    const mirror = new Cube(3, true);
    const before = stickerColors(regular);
    const globalSetter = vi.spyOn(mirror.instancedRenderer, 'setFaceColors');
    const localSetter = vi.spyOn(mirror.instancedRenderer, 'setFaceColorOverride');
    const world = { puzzleKind: 'mirror', cube: mirror, dirty: false } as unknown as World;
    let later: Cube | undefined;
    try {
      const preview = adapter(true);
      preview.setupPuzzle(world);
      expect(localSetter).toHaveBeenCalledWith(mirrorFaces());
      expect(globalSetter).not.toHaveBeenCalled();
      expect(COLORS).toEqual(globalColors);
      expect(stickerColors(regular)).toEqual(before);
      expect(stickerColors(mirror)).not.toEqual(before);
      later = new Cube(3);
      expect(stickerColors(later)).toEqual(before);
      preview.cleanupPuzzle?.(world);
      expect(localSetter).toHaveBeenLastCalledWith(null);
      expect(stickerColors(mirror)).toEqual(before);
    } finally {
      // Restore the test environment even when run against the broken global setter.
      Object.assign(COLORS, globalColors);
      regular.dispose();
      mirror.dispose();
      later?.dispose();
    }
  });

  it('clears local color overrides when the adapter switches back to ordinary geometry', () => {
    const regular = new Cube(3);
    const mirror = new Cube(3, true);
    const before = stickerColors(regular);
    const localSetter = vi.spyOn(regular.instancedRenderer, 'setFaceColorOverride');
    const world = {
      puzzleKind: 'mirror' as number | string,
      cube: mirror,
      dirty: false,
      setPuzzle(kind: number | string) {
        this.puzzleKind = kind;
        this.cube = kind === 'mirror' ? mirror : regular;
      },
    };
    try {
      adapter(true).setupPuzzle(world as unknown as World);
      regular.instancedRenderer.setFaceColorOverride(mirrorFaces());
      adapter(false).setupPuzzle(world as unknown as World);
      expect(world.puzzleKind).toBe(3);
      expect(world.cube).toBe(regular);
      expect(localSetter).toHaveBeenLastCalledWith(null);
      expect(stickerColors(regular)).toEqual(before);
    } finally {
      regular.dispose();
      mirror.dispose();
    }
  });
});
