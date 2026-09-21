import { describe, expect, it } from 'vitest';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
import { FM_REGULAR, stickeringMaskFn } from '@/app/[lang]/sim/engine/nxn/stickering';
import { f2lPlayerSequence } from '@/lib/alg_display';

// 线上 A+ 的 FR / FL / BR / BL 主公式；后三条自带恢复持方的结尾转体。
const A_PLUS_PRIMARY_ALGS = [
  "U R U' R'",
  "F' L F L' y'",
  "U f R' f' y",
  "U L U' L' y2",
];

const TOP_LAYER_STICKERS = [
  ...Array.from({ length: 9 }, (_, index) => index),
  ...[1, 2, 4, 5].flatMap(face => [face * 9, face * 9 + 1, face * 9 + 2]),
];

describe('F2L detail player canonical pair', () => {
  it('keeps the red-green pair in every slot and lets each formula solve its setup', () => {
    const f2lMask = stickeringMaskFn(3, 'F2L');
    expect(f2lMask).not.toBeNull();

    const solved = new Cube(3);
    const solvedState = solved.serialize();
    solved.dispose();
    const setupStates = new Set<string>();

    for (const alg of A_PLUS_PRIMARY_ALGS) {
      const sequence = f2lPlayerSequence(alg);
      expect(sequence.setup, `${alg} setup should use canonical half-turn notation`).not.toContain("y2'");
      expect(sequence.alg, `${alg} playback should use canonical half-turn notation`).not.toContain("y2'");
      const cube = new Cube(3);
      cube.twister.setup(sequence.setup);

      const state = cube.serialize();
      setupStates.add(state);
      const mask = cube.serializeStickering(f2lMask!);
      const pairColors = TOP_LAYER_STICKERS
        .filter(index => mask[index] === FM_REGULAR)
        .map(index => state[index])
        .sort();

      expect(pairColors, `${alg} should expose only the red-green pair`)
        .toEqual(['D', 'F', 'F', 'R', 'R']);
      cube.dispose();

      const restored = new Cube(3);
      restored.twister.setup(`${sequence.setup} ${sequence.alg}`);
      expect(restored.serialize(), `${alg} should solve its own setup`).toBe(solvedState);
      restored.dispose();
    }

    expect(setupStates.size, 'FR / FL / BR / BL must remain four distinct slot states').toBe(4);
  });

  it('moves the FL holding rotation to the beginning of the scramble', () => {
    expect(f2lPlayerSequence("F' L F L' y'")).toEqual({
      setup: "y L F' L' F",
      alg: "F' L F L' y'",
    });
  });

  it('writes the BL half-turn setup as y2 without a redundant prime', () => {
    expect(f2lPlayerSequence("U L U' L' y2")).toEqual({
      setup: "y2 L U L' U'",
      alg: "U L U' L' y2",
    });
  });
});
