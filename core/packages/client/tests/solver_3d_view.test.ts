import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { orbitSceneFree } from '@/app/[lang]/sim/engine/viewControls';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('scramble solver 3D painter view controls', () => {
  it('uses the same unbounded view orbit as /sim view mode', () => {
    const painter = readFileSync(
      join(ROOT, 'app', '[lang]', 'scramble', 'solver', '_Interactive3DCube.tsx'),
      'utf8',
    );

    expect(painter).toContain("world.controller.dragEmpty = 'view'");
    expect(painter).toContain('orbitSceneFree(world, dx, dy, orbitK)');
    expect(painter).not.toContain('orbitSceneAutoRotate');
  });

  it('keeps accumulating pitch beyond a complete vertical turn', () => {
    const world = {
      scene: {
        rotation: { x: 0, y: 0 },
        updateMatrix: () => {},
      },
      dirty: false,
    } as unknown as Parameters<typeof orbitSceneFree>[0];

    orbitSceneFree(world, 0, 800, 0.01);

    expect(world.scene.rotation.x).toBe(8);
    expect(world.scene.rotation.x).toBeGreaterThan(Math.PI * 2);
    expect(world.dirty).toBe(true);
  });
});
