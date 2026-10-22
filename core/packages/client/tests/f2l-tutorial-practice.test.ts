import { describe, expect, it } from 'vitest';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import {
  buildFreePracticeCases, freePlacementKey, readFreePlacement,
} from '@/app/[lang]/tutorial/f2l/lib/free-practice';

describe('F2L tutorial frozen practice catalog', () => {
  it('covers all 150 placements with matching scrambles and independently replayable solutions', () => {
    const cases = buildFreePracticeCases();
    expect(cases.size).toBe(150);
    const cube = new Cube(3);
    try {
      for (const [key, entry] of cases) {
        cube.twister.setup(entry.setup);
        expect(freePlacementKey(readFreePlacement(cube)), key).toBe(key);
        cube.twister.setup(`${entry.setup} ${entry.alg}`);
        const state = cube.serialize();
        for (let face = 0; face < 6; face++) {
          expect(new Set(state.slice(face * 9, face * 9 + 9)).size, `${key}, face ${face}`).toBe(1);
        }
      }
    } finally {
      cube.dispose();
    }
  });
});
