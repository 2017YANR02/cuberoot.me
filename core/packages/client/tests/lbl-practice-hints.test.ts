import { expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { stickeringMaskFn, mergeStickeringMaskFns } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { resolveStageMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/vcStageMask';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';
import { pickStickering } from '@/components/AlgPlayer/stickering';
import { chapters } from '../app/[lang]/tutorial/lbl/curriculum';
import { LESSON_STICKERING } from '../app/[lang]/tutorial/lbl/content';
import { getLblAlgGroups } from '../app/[lang]/tutorial/lbl/alg-cues';
import { crossMask } from '../app/[lang]/tutorial/lbl/cross-display';
import { daisyPracticeExample, DAISY_PRACTICE_TARGET } from '../app/[lang]/tutorial/lbl/daisy-practice';
import { bottomCornerGoal, middleEdgeGoal, practiceState, practiceTargetStates } from '../app/[lang]/tutorial/lbl/practice-state';
import { practiceNextMove, practiceAlgFinished, practiceCompletedMoves, practiceRecoveryMoves } from '../app/[lang]/tutorial/lbl/practice-next-move';

for (const step of chapters) {
  const examples = step.examples.map((example, index) => step.id === 'daisy' ? daisyPracticeExample(example, index) : example);
  const extra = step.lessons.find(lesson => lesson.id === 'white-edge')?.example;
  if (extra) examples.push(extra);
  for (const [index, example] of examples.entries()) {
    it(`${step.id}/${index}: ${example.title.zh} hint reaches the practice goal`, () => {
      const setup = new Alg(resolvePlayerSetup('3x3', example.alg, example.setup, example.startSolved ?? false)).expand().toString();
      const target = step.id === 'daisy' ? DAISY_PRACTICE_TARGET : `${setup} ${example.alg}`;
      const name = pickStickering('3x3', LESSON_STICKERING[step.id], 'sim')!;
      const mask = step.id === 'cross' ? crossMask : stickeringMaskFn(3, name) ?? resolveStageMaskFn(3, name);
      const colors = stageStickerColors(3, step.id === 'yellow-cross' ? mergeStickeringMaskFns([mask, stickeringMaskFn(3, 'F2L')]) : mask, orientedCubeFaceColors('z2'));
      const moves = getLblAlgGroups(step.id, example.alg).flat().map(move => move.notation).join(' ');
      const result = `${setup} ${moves}`;
      const goal = step.id === 'corners' && example === step.examples[1] ? bottomCornerGoal(setup, target, colors)
        : step.id === 'middle' && (example === step.examples[2] || example === step.examples[3]) ? middleEdgeGoal(setup, target, colors) : null;
      expect(goal ? goal.matches(result) : practiceTargetStates(colors, target).has(practiceState(colors, result))).toBe(true);
      if (step.id === 'structure') return; // This chapter has no practice route.

      // Follow the same camera-independent layer hints used by every exercise.
      const guided: string[] = [];
      for (let turn = 0; turn < getLblAlgGroups(step.id, example.alg).flat().length + 20; turn++) {
        if (practiceAlgFinished(example.alg, guided.join(' '))) break;
        const next = practiceNextMove(example.alg, guided.join(' '));
        expect(next).toBeDefined();
        expect(next).not.toMatch(/^[xyz]/);
        guided.push(next!);
        expect(practiceRecoveryMoves(example.alg, guided.join(' '))).toEqual([]);
      }
      expect(practiceAlgFinished(example.alg, guided.join(' '))).toBe(true);
      expect(practiceCompletedMoves(example.alg, guided.join(' '))).toBe(getLblAlgGroups(step.id, example.alg).flat().length);
      const guidedResult = `${setup} ${guided.join(' ')}`;
      expect(goal ? goal.matches(guidedResult) : practiceTargetStates(colors, target).has(practiceState(colors, guidedResult))).toBe(true);

      const wrong = `${guided.join(' ')} F D`;
      // An erroneous turn can itself coincide with another taught prefix.
      expect(practiceRecoveryMoves(example.alg, wrong).length).toBeGreaterThan(0);
      expect(practiceAlgFinished(example.alg, `${wrong} D' F'`)).toBe(true);
    });
  }
}
