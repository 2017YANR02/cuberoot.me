import { expect, it } from 'vitest';
import { LBL_STEPS } from '../app/[lang]/tutorial/lbl/content';
import { middleEdgeGoal } from '../app/[lang]/tutorial/lbl/practice-state';
import { resolvePlayerSetup } from '../components/AlgPlayer/player-setup';

it.each([2, 3])('ejects only the target middle edge for case %i', index => {
  const example = LBL_STEPS.find(step => step.id === 'middle')!.examples[index];
  const setup = resolvePlayerSetup('3x3', example.alg, example.setup, false);
  const goal = middleEdgeGoal(setup, `${setup} ${example.alg}`, Array(54).fill('color'));
  expect(goal.hiddenStickers).toHaveLength(6);
  expect(new Set(goal.hiddenStickers).size).toBe(6);
  expect(goal.targetColors.filter(color => color === '#a855f7')).toHaveLength(2);
  expect(goal.matches(setup)).toBe(false);
  expect(goal.matches(`${setup} R`)).toBe(false);
  for (const suffix of ['', 'U', 'U2', "U'", 'y', 'x']) {
    expect(goal.matches(`${setup} ${example.alg} ${suffix}`)).toBe(true);
  }
  // Even after ejecting the target, turning the bottom or disturbing one of its
  // corners must invalidate completion; a bottom cross alone is insufficient.
  expect(goal.matches(`${setup} ${example.alg} D`)).toBe(false);
  expect(goal.matches(`${setup} ${example.alg} R U R' U'`)).toBe(false);
  // Reversing the ejection restores it to the middle and must not pass.
  expect(goal.matches(`${setup} ${example.alg} (${example.alg})'`)).toBe(false);
});
