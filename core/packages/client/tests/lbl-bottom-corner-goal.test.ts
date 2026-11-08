import { expect, it } from 'vitest';
import { bottomCornerGoal } from '../app/[lang]/tutorial/lbl/practice-state';
import { LBL_STEPS } from '../app/[lang]/tutorial/lbl/content';
import { resolvePlayerSetup } from '../components/AlgPlayer/player-setup';

it('accepts ejection at any top position and preserves solved bottom pieces', () => {
  const example = LBL_STEPS.find(step => step.id === 'corners')!.examples[1];
  const setup = resolvePlayerSetup('3x3', example.alg, example.setup, example.startSolved ?? false);
  const goal = bottomCornerGoal(setup, `${setup} ${example.alg}`, Array(54).fill('white'));
  expect(goal.matches(setup)).toBe(false);
  for (const suffix of ['', 'U', 'U2', "U'", 'y', 'x']) {
    expect(goal.matches(`${setup} ${example.alg} ${suffix}`)).toBe(true);
  }
  expect(goal.matches(`${setup} ${example.alg} F`)).toBe(false);
  expect(goal.targetColors.filter(color => color === '#a855f7')).toHaveLength(3);
});
