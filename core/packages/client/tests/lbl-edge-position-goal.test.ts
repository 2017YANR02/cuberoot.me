import { expect, it } from 'vitest';
import { EDGE_POSITION_LEFT, EDGE_POSITION_RIGHT, LBL_STEPS } from '../app/[lang]/tutorial/lbl/content';
import { isWallWithSolvedLowerLayers, practiceState, practiceTargetStates } from '../app/[lang]/tutorial/lbl/practice-state';
import { resolvePlayerSetup } from '../components/AlgPlayer/player-setup';
import { stageStickerColors } from '../lib/sim-stage-thumbnail';
import { orientedCubeFaceColors } from '../lib/cube-orientation';
import { mergeStickeringMaskFns, stickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';

const examples = LBL_STEPS.find(step => step.id === 'edge-position')!.examples;
const colors = stageStickerColors(3, mergeStickeringMaskFns([
  stickeringMaskFn(3, 'LL'), stickeringMaskFn(3, 'F2L'),
]), orientedCubeFaceColors('z2'));

it.each([0, 1])('requires intact first two layers when solving case %i', index => {
  const example = examples[index];
  const setup = resolvePlayerSetup('3x3', example.alg, example.setup, false);
  const targets = practiceTargetStates(colors, `${setup} ${example.alg}`);
  expect(targets.has(practiceState(colors, setup))).toBe(false);
  expect(targets.has(practiceState(colors, `${setup} ${example.alg}`))).toBe(true);
  for (const move of ['D', 'R', "R U R' U'"]) {
    expect(targets.has(practiceState(colors, `${setup} ${example.alg} ${move}`))).toBe(false);
  }
});

it('accepts either way to create a wall while protecting both lower layers', () => {
  const example = examples[2];
  const setup = resolvePlayerSetup('3x3', example.alg, example.setup, false);
  expect(isWallWithSolvedLowerLayers(setup)).toBe(false);
  for (const alg of [EDGE_POSITION_LEFT, EDGE_POSITION_RIGHT]) {
    const result = `${setup} ${alg}`;
    expect(isWallWithSolvedLowerLayers(result)).toBe(true);
    expect(isWallWithSolvedLowerLayers(`${result} y`)).toBe(true);
    for (const move of ['D', 'R', "R U R' U'"]) {
      expect(isWallWithSolvedLowerLayers(`${result} ${move}`)).toBe(false);
    }
  }
});
