import { describe, expect, it } from 'vitest';
import type { AlgFile } from '@cuberoot/shared/alg';
import { applyScramble } from '@cuberoot/shared/timer/reconstruct/state';
import { isSlotSolved } from '@cuberoot/shared/timer/reconstruct/f2l-slots';
import { reviewAlg, recordingRotation } from '@cuberoot/timer-ui/reconstruct/replay-view';
import { inPracticeSlot, inViewerGrip, whiteBottomScramble } from '@/lib/replay-practice-view';
import { verifiedPracticeFormula } from '@/lib/replay-formula-training';
import workbook from './fixtures/recon-workbook/4a6aW4XJ_5E.json';
import libraries from './fixtures/recon-workbook/libraries.json';

describe('training from the 9.569 s review', () => {
  const solve = workbook.recording;
  const rotation = recordingRotation(solve);
  const at = (index: number) => [solve.scramble, ...solve.moves.slice(0,index).map(m => m.m)].join(' ');

  it.each([['oll', 47, 'OLL 7'], ['pll', 55, 'Ga']] as const)('resolves the actual %s stage in the training library', async (set, index, name) => {
    const {setup} = reviewAlg(at(index), '', rotation, true);
    expect(await verifiedPracticeFormula(set, setup, libraries[set] as AlgFile)).toEqual({set, caseName:name});
    expect(await verifiedPracticeFormula(set, 'z2', libraries[set] as AlgFile)).toBeUndefined();
    expect(applyScramble(3, 'z2 ' + whiteBottomScramble(setup))).toEqual(applyScramble(3,setup));
  });

  it.each([
    ["B B' U U U' U' B U B' U U B U' B'", "R R' U U U' U' R U R' U U R U' R'"],
    ["B U B' U B' R B R'", "R U R' U R' F R F'"],
  ])('keeps each right-back execution turn in the front-facing grip', (recorded, expected) => {
    const shown = inViewerGrip(recorded, 'BR');
    expect(shown).toBe(expected);
    const turns = recorded.split(' ');
    const visible = expected.split(' ');
    for (let step = 0; step <= turns.length; step++) {
      expect(applyScramble(3, ['z2 y', ...visible.slice(0, step)].join(' ')))
        .toEqual(applyScramble(3, ['z2', ...turns.slice(0, step), 'y'].join(' ')));
    }
  });

  it.each(['W-','W+'])('keeps %s in the requested slot with the teaching centres', name => {
    const item = libraries.f2l.cases.find(item => item.name === name)!;
    const slots = ['FR','FL','BR','BL'] as const;
    for (const slot of slots) {
      const line = inPracticeSlot(item.setup!, slot);
      const state = applyScramble(3, 'z2 ' + line);
      expect(slots.filter(id => !isSlotSolved(state,id))).toEqual([slot]);
      expect([state.D[4],state.U[4],state.F[4]]).toEqual(['U','D','F']);
    }
  });
});
