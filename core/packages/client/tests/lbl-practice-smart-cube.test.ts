import { expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { cubeMove, SOLVED_3X3 } from '@cuberoot/puzzle-solvers/timer-333-cube';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';
import { activeChapters } from '@/app/[lang]/tutorial/lbl/curriculum';
import { daisyPracticeExample } from '@/app/[lang]/tutorial/lbl/daisy-practice';
import { practiceAlgFinished, practiceNextMove } from '@/app/[lang]/tutorial/lbl/practice-next-move';
import { practiceCenterAlignment, practiceState, practiceStickerState } from '@/app/[lang]/tutorial/lbl/practice-state';
import { observeSmartPractice, smartPracticeSetup, smartPracticeStickers, smartPracticeTurns } from '@/app/[lang]/tutorial/lbl/practice-smart-cube';

const stickers = Array.from({ length: 54 }, (_, index) => String(index));

it('maps every practice case and its lesson turns between the device and lesson frames', () => {
  for (const step of activeChapters.filter(chapter => chapter.id !== 'structure')) {
    const examples = step.examples.map((example, index) => step.id === 'daisy' ? daisyPracticeExample(example, index) : example);
    const extra = step.lessons.find(lesson => lesson.id === 'white-edge')?.example;
    if (extra) examples.push(extra);
    for (const example of examples) {
      const name = `${step.id}/${example.title.en}`;
      const setup = new Alg(resolvePlayerSetup('3x3', example.alg, example.setup, example.startSolved ?? false)).expand().toString();
      const start = smartPracticeSetup(setup);
      expect(smartCubeTargetFacelets(start.scramble, start.orientation), name).toBe(start.targetFacelets);
      const deviceScramble = normalizeWcaScramble(`z2 ${setup}`)!;
      const liveSetup = `${smartPracticeTurns(deviceScramble.split(/\s+/))} ${start.pose}`;
      expect(practiceState(stickers, liveSetup), name).toBe(practiceState(stickers, setup));

      let attempt = observeSmartPractice(null, start.targetFacelets, start);
      let history = '';
      for (let count = 0; count < 40 && !practiceAlgFinished(example.alg, history); count++) {
        const turn = practiceNextMove(example.alg, history);
        expect(turn, name).toMatch(/^[URFDLB](2|')?$/);
        const deviceTurn = normalizeWcaScramble(`${start.orientation} ${turn}`)!;
        attempt = observeSmartPractice(attempt, cubeMove(attempt.facelets, deviceTurn), start, deviceTurn);
        history = `${history} ${turn}`.trim();
        expect(attempt.history, name).toBe(history);
        const expected = `${setup} ${history}`;
        const actual = smartPracticeStickers(attempt.facelets);
        expect(actual, name).not.toBeNull();
        expect(practiceStickerState(stickers, actual!), name)
          .toBe(practiceState(stickers, `${expected} ${practiceCenterAlignment(expected)}`));
      }
      expect(practiceAlgFinished(example.alg, history), name).toBe(true);
    }
  }
});

it('arms only at the full start position and accepts a state resync without inventing turns', () => {
  const setup = smartPracticeSetup("R U2 y'");
  const beforeStart = observeSmartPractice(null, SOLVED_3X3, setup);
  expect(beforeStart.started).toBe(false);
  const started = observeSmartPractice(beforeStart, setup.targetFacelets, setup);
  expect(started).toMatchObject({ started: true, history: '' });
  expect(observeSmartPractice(started, started.facelets, setup)).toBe(started);
  const sync = observeSmartPractice(started, cubeMove(cubeMove(started.facelets, 'R'), 'F'), setup, 'R');
  expect(sync).toMatchObject({ started: true, history: null });
  expect(smartPracticeStickers(sync.facelets)).not.toBeNull();
});
