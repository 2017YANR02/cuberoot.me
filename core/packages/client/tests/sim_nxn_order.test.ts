import { describe, expect, it } from 'vitest';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
import World from '@/app/[lang]/sim/engine/world';
import { attachInteraction } from '@/app/[lang]/sim/worldInteraction';
import { applySettings, DEFAULT_SETTINGS } from '@/app/[lang]/sim/SettingDrawer';

describe('sim NxN order', () => {
  it('constructs a 12x12 cube without falling back', () => {
    const cube = new Cube(12);
    expect(cube.order).toBe(12);
    expect(cube.cubelets.size).toBe(12 ** 3 - 10 ** 3);
  });

  it('switches the interactive world and reapplies settings at order 12', () => {
    const world = attachInteraction(new World());
    world.setPuzzle(12);
    applySettings(world, DEFAULT_SETTINGS);
    expect(world.puzzleKind).toBe(12);
    expect(world.cube.order).toBe(12);
  });
});

describe('sim square-family settings', () => {
  it.each(['sq2', 'sq4'] as const)('applies default settings to %s', (kind) => {
    const world = attachInteraction(new World());
    try {
      world.setPuzzle(kind);
      expect(() => applySettings(world, DEFAULT_SETTINGS)).not.toThrow();
      expect(world.puzzleKind).toBe(kind);
    } finally {
      world.controller.stop();
      world.cube.dispose();
    }
  });
});
