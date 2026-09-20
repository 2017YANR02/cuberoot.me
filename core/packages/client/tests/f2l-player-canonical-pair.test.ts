import { describe, expect, it } from 'vitest';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
import { FM_REGULAR, stickeringMaskFn } from '@/app/[lang]/sim/engine/nxn/stickering';
import { canonicalF2lPlayerSequence } from '@/lib/alg_display';

// 线上 A+ 的 FR / FL / BL / BR 主公式；后三条自带恢复持方的结尾转体。
const A_PLUS_PRIMARY_ALGS = [
  "U R U' R'",
  "F' L F L' y'",
  "U L U' L' y2",
  "U f R' f' y",
];

const TOP_LAYER_STICKERS = [
  ...Array.from({ length: 9 }, (_, index) => index),
  ...[1, 2, 4, 5].flatMap(face => [face * 9, face * 9 + 1, face * 9 + 2]),
];

describe('F2L detail player canonical pair', () => {
  it('keeps canonical centers and the same red-green pair in every slot', () => {
    const f2lMask = stickeringMaskFn(3, 'F2L');
    expect(f2lMask).not.toBeNull();

    const solved = new Cube(3);
    const solvedState = solved.serialize();
    const solvedCenters = [4, 13, 22, 31, 40, 49].map(index => solvedState[index]);
    solved.dispose();

    for (const alg of A_PLUS_PRIMARY_ALGS) {
      const sequence = canonicalF2lPlayerSequence(alg);
      const cube = new Cube(3);
      cube.twister.setup(sequence.setup);

      const state = cube.serialize();
      const mask = cube.serializeStickering(f2lMask!);
      const centers = [4, 13, 22, 31, 40, 49].map(index => state[index]);
      const pairColors = TOP_LAYER_STICKERS
        .filter(index => mask[index] === FM_REGULAR)
        .map(index => state[index])
        .filter(color => color === 'D' || color === 'F' || color === 'R')
        .sort();

      expect(centers, `${alg} should retain the canonical color scheme`).toEqual(solvedCenters);
      expect(pairColors, `${alg} should expose the same red-green pair`).toEqual(['D', 'F', 'F', 'R', 'R']);
      cube.dispose();

      const restored = new Cube(3);
      restored.twister.setup(`${sequence.setup} ${sequence.alg}`);
      expect(restored.serialize(), `${alg} should solve its canonical setup`).toBe(solvedState);
      restored.dispose();
    }
  });
});
