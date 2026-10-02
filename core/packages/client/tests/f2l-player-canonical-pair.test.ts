import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { AlgFile } from '@cuberoot/shared/alg';
import { renderFromSimpleQuery } from '@cuberoot/visualcube';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
import { FM_REGULAR, stickeringMaskFn } from '@/app/[lang]/sim/engine/nxn/stickering';
import { displayCaseScramble, oriAdjustSetup } from '@/lib/alg_display';
import { alignAlgFile } from '@/lib/alg_case_alignment';
import { algSheetFromCases } from '@/lib/alg_pdf/from_cases';

// 线上 A+ 的公共 setup 和 FR / FL / BL / BR 主公式。
const A_PLUS_SETUP = "R U R' U'";
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
  it('the displayed setup reproduces every public F2L thumbnail in all four slots', async () => {
    const files = JSON.parse(readFileSync(new URL('./fixtures/alg-case-alignment.json', import.meta.url), 'utf8')) as AlgFile[];
    const file = await alignAlgFile(files.find(file => file.puzzle === '3x3' && file.set === 'f2l')!);
    const mismatches: string[] = [];
    for (const c of file.cases) for (const [ori] of c.algs.entries()) {
      const setup = oriAdjustSetup(c.setup, ori);
      const shown = displayCaseScramble('3x3', 'f2l', setup);
      if (renderFromSimpleQuery({ setup, view: 'f2l' }) !== renderFromSimpleQuery({ setup: shown, view: 'f2l' })) {
        mismatches.push(`${c.name}:${ori}`);
      }
    }
    expect(mismatches).toEqual([]);
    const sheet = algSheetFromCases({ puzzle: '3x3', set: 'f2l', cases: file.cases,
      title: '', filename: '', allOris: true, algsFor: (c, ori) => c.algs[ori].toReversed(),
    });
    expect(sheet.cases).toHaveLength(164);
    for (const c of sheet.cases) expect(c.setup).toBe(c.thumb?.setup);
  });

  it('keeps the red-green pair in every slot and lets each formula solve its setup', () => {
    const f2lMask = stickeringMaskFn(3, 'F2L');
    expect(f2lMask).not.toBeNull();
    const visibleState = (cube: Cube) => {
      const mask = cube.serializeStickering(f2lMask!);
      return [...cube.serialize()].map((color, index) => mask[index] === FM_REGULAR ? color : '-').join('');
    };

    const solved = new Cube(3);
    const solvedState = visibleState(solved);
    solved.dispose();
    const setupStates = new Set<string>();

    for (const [ori, alg] of A_PLUS_PRIMARY_ALGS.entries()) {
      const sequence = { setup: oriAdjustSetup(A_PLUS_SETUP, ori), alg };
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
      expect(visibleState(restored), `${alg} should solve the public F2L setup`).toBe(solvedState);
      restored.dispose();
    }

    expect(setupStates.size, 'FR / FL / BR / BL must remain four distinct slot states').toBe(4);
  });

});
