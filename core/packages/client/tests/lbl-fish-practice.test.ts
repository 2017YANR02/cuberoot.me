import { expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { isFishWithSolvedLowerLayers } from '../app/[lang]/tutorial/lbl/practice-state';
import { LBL_STEPS, LEFT_SUNE, RIGHT_SUNE } from '../app/[lang]/tutorial/lbl/content';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';

it('accepts either fish, any top alignment and whole-cube orientation', () => {
  for (const alg of [LEFT_SUNE, RIGHT_SUNE]) {
    const fish = new Alg(alg).invert().toString();
    for (const adjustment of ['', 'U', 'U2', "U'", 'y', 'x']) {
      expect(isFishWithSolvedLowerLayers(`${fish} ${adjustment}`)).toBe(true);
    }
    expect(isFishWithSolvedLowerLayers(`${fish} D`)).toBe(false);
    expect(isFishWithSolvedLowerLayers(`${fish} R`)).toBe(false);
  }
  expect(isFishWithSolvedLowerLayers('')).toBe(false);
});

it('accepts the two-gray and four-gray hints, but rejects their initial states', () => {
  const step = LBL_STEPS.find(step => step.id === 'yellow-face')!;
  for (const example of step.examples.slice(2)) {
    const setup = resolvePlayerSetup('3x3', example.alg, example.setup, false);
    expect(isFishWithSolvedLowerLayers(setup)).toBe(false);
    expect(isFishWithSolvedLowerLayers(`${setup} ${example.alg}`)).toBe(true);
  }
});
