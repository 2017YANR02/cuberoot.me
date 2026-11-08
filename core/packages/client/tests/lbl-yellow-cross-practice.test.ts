import { expect, it } from 'vitest';
import { stickeringMaskFn, mergeStickeringMaskFns } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { resolveStageMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/vcStageMask';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { practiceState, practiceTargetStates } from '../app/[lang]/tutorial/lbl/practice-state';
import { LBL_STEPS } from '../app/[lang]/tutorial/lbl/content';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';

it('requires intact lower layers for all three top-cross exercises', () => {
  const mask = mergeStickeringMaskFns([resolveStageMaskFn(3, 'oell'), stickeringMaskFn(3, 'F2L')]);
  const colors = stageStickerColors(3, mask, orientedCubeFaceColors('z2'));
  for (const example of LBL_STEPS.find(step => step.id === 'yellow-cross')!.examples) {
    const setup = resolvePlayerSetup('3x3', example.alg, example.setup, false);
    const target = `${setup} ${example.alg}`;
    const states = practiceTargetStates(colors, target);
    expect(states.has(practiceState(colors, target))).toBe(true);
    expect(states.has(practiceState(colors, `${target} D`))).toBe(false);
    expect(states.has(practiceState(colors, `${target} R2`))).toBe(false);
  }
});
