import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { orbitSceneFree } from '@/app/[lang]/sim/engine/viewControls';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('unbounded 3D puzzle view controls', () => {
  it('uses the unbounded orbit in every scramble solver 3D painter', () => {
    const cubePainter = readFileSync(
      join(ROOT, 'app', '[lang]', 'scramble', 'solver', '_Interactive3DCube.tsx'),
      'utf8',
    );
    const puzzlePainter = readFileSync(
      join(ROOT, 'app', '[lang]', 'scramble', 'solver', '_Interactive3DPuzzle.tsx'),
      'utf8',
    );
    const sq1Painter = readFileSync(
      join(ROOT, 'app', '[lang]', 'scramble', 'solver', '_InteractiveSq1Board.tsx'),
      'utf8',
    );

    expect(cubePainter).toContain("world.controller.dragEmpty = 'view'");
    expect(cubePainter).toContain('orbitSceneFree(world, dx, dy, orbitK)');
    expect(cubePainter).not.toContain('orbitSceneAutoRotate');
    expect(puzzlePainter).toContain('freeOrbit: true');
    expect(puzzlePainter).not.toContain('autoRotate:');
    expect(sq1Painter).toContain('freeOrbit: true');
  });

  it('routes both /sim renderers through the same free-view behavior', () => {
    const simPage = readFileSync(
      join(ROOT, 'app', '[lang]', 'sim', 'SimPage.tsx'),
      'utf8',
    );
    const twistySection = readFileSync(
      join(ROOT, 'components', 'TwistySection.tsx'),
      'utf8',
    );

    expect(simPage).toContain("settingsRef.current.dragEmpty === 'view'");
    expect(simPage).toContain('orbitSceneFree(world, dx, dy, k)');
    expect(simPage).toContain('orbit: orbitView');
    expect(twistySection).toContain("dragEmptyRef.current === 'view'");
    expect(twistySection).toContain('applyFreeOrbitDelta(');
    expect(twistySection).toContain('request.set = wrappedSet');
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
