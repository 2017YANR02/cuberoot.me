import { Alg } from 'cubing/alg';
import { AllFaces, CubeData, Face, parseAlgorithm } from '@cuberoot/visualcube';
import { describe, expect, it } from 'vitest';
import { buildWalkthroughRun, completeDemoPool, demoGoalReached } from '@/app/[lang]/tutorial/lbl/complete-demo-state';
import { LBL_LESSON_RUNS, LBL_LESSON_STAGE_IDS, lessonFrame } from '@/app/[lang]/tutorial/lbl/lesson-runs';
import { CORNER_ALIGNMENT_COPY, CORNER_POSITION_COPY, J_ALG, LBL_STEPS, RIGHT } from '@/app/[lang]/tutorial/lbl/content';

const demos = completeDemoPool('corners');
const state = (alg: string) => {
  const cube = new CubeData(3, Object.fromEntries(AllFaces.map(face =>
    [face, Array.from({ length: 9 }, (_, index) => `${Face[face]}${index}`)])));
  for (const move of parseAlgorithm(new Alg(alg).expand().toString())) cube.turn(move);
  return cube.faces;
};

describe('LBL bottom-corner complete demos', () => {
  it('starts with one of each taught case and completes the first layer', () => {
    expect(demos.map(demo => demo.phases.find(phase => phase.act.alg)?.act.caseIndex)).toEqual([0, 2, 3, 1]);
    for (const demo of demos) {
      expect(demoGoalReached('cross', demo.setup)).toBe(true);
      expect(demoGoalReached('corners', `${demo.setup} ${demo.alg}`)).toBe(true);
      for (const phase of demo.phases.filter(phase => phase.act.alg)) {
        const alg = demo.alg.split(' ').slice(0, phase.end).join(' ');
        expect(demoGoalReached('cross', `${demo.setup} ${alg}`)).toBe(true);
      }
    }
  });

  it('outlines the actual matching stickers for same-face and cross alignment', () => {
    for (const demo of demos) for (const phase of demo.phases) {
      const recognition = phase.recognize;
      if (!recognition?.outlines || recognition.outlines.length < 2 || recognition.caseIndex === 1) continue;
      const prefix = demo.alg.split(' ').slice(0, phase.start).join(' ');
      const faces = state(`${demo.setup} ${prefix}`);
      if (recognition.caseIndex === 3) {
        const frontPair = [faces[Face.F][2], faces[Face.R][4]];
        const rightPair = [faces[Face.R][0], faces[Face.F][4]];
        expect(recognition.outlines).toEqual(
          recognition.text === CORNER_ALIGNMENT_COPY.crossAligned ? [...frontPair, ...rightPair]
            : recognition.outlines[0] === frontPair[0] ? frontPair : rightPair,
        );
      } else {
        expect(recognition.outlines).toEqual([faces[Face.F][recognition.caseIndex === 2 ? 0 : 2], faces[Face.F][4]]);
      }
      for (let index = 0; index < recognition.outlines.length; index += 2) {
        expect(recognition.outlines[index][0]).toBe(recognition.outlines[index + 1][0]);
      }
    }
  });

  it('ejects both wrong-slot and twisted corners and tracks the same white sticker', () => {
    const bottom = demos[3];
    const ejections = bottom.phases.filter(phase => phase.act.caseIndex === 1 && phase.act.alg);
    expect(ejections).toHaveLength(2);
    const moves = bottom.alg.split(' ');
    const wrongSlots = new Set<boolean>();
    for (const ejection of ejections) {
      const atEjection = state(`${bottom.setup} ${moves.slice(0, ejection.start).join(' ')}`);
      const corner = [atEjection[Face.D][2], atEjection[Face.F][8], atEjection[Face.R][6]];
      const slotColors = [Face.D, Face.F, Face.R].map(face => atEjection[face][4][0]);
      const wrongSlot = corner.some(sticker => !slotColors.includes(sticker[0]));
      wrongSlots.add(wrongSlot);
      expect(ejection.act.alg).toBe(RIGHT);
      const nextRecognition = bottom.phases.slice(bottom.phases.indexOf(ejection) + 1).find(phase => phase.recognize);
      expect(nextRecognition?.recognize?.outlines).toEqual([corner.find(sticker => sticker.startsWith('D'))]);
    }
    expect(wrongSlots).toEqual(new Set([true, false]));
  });

  it('keeps the shared full-solve traces valid', () => {
    for (const { scramble } of LBL_LESSON_RUNS) {
      const run = buildWalkthroughRun(scramble);
      for (const stage of LBL_LESSON_STAGE_IDS) {
        const { setup, alg } = lessonFrame(run, stage);
        expect(demoGoalReached(stage, `${setup} ${alg}`)).toBe(true);
      }
    }
  });
});

describe('LBL top-corner placement', () => {
  const stage = 'corner-position';
  const sides = [Face.F, Face.R, Face.B, Face.L];
  const eyeCount = (alg: string) => {
    const faces = state(alg);
    return sides.filter(face => faces[face][0][0] === faces[face][2][0]).length;
  };

  it('uses one J for the no-headlights case and a separate top turn for the headlights case', () => {
    const [withEyes, withoutEyes] = LBL_STEPS.find(step => step.id === stage)!.examples;
    expect(eyeCount(withoutEyes.setup!)).toBe(0);
    expect(withoutEyes.alg).toBe(J_ALG);
    expect(eyeCount(`${withoutEyes.setup} ${withoutEyes.alg}`)).toBe(1);
    const beforeAlignment = `${withEyes.setup} y ${J_ALG}`;
    expect(eyeCount(beforeAlignment)).toBe(4);
    expect(demoGoalReached(stage, beforeAlignment)).toBe(false);
    expect(demoGoalReached(stage, `${withEyes.setup} ${withEyes.alg}`)).toBe(true);
  });

  it('stops each J at the final R prime and shows a distinct top turn only when necessary', () => {
    for (const demo of completeDemoPool(stage)) {
      const moves = demo.alg.split(' ');
      const phases = demo.phases.filter(phase => phase.end > phase.start);
      const jPhases = phases.filter(phase => phase.act.alg === J_ALG);
      expect(jPhases).toHaveLength(eyeCount(demo.setup) === 0 ? 2 : 1);
      for (const phase of jPhases) {
        expect(moves.slice(phase.start, phase.end).join(' ')).toBe(J_ALG);
        if (phase.act.caseIndex === 1) {
          expect(eyeCount(`${demo.setup} ${moves.slice(0, phase.end).join(' ')}`)).toBe(1);
        }
      }
      const afterJ = jPhases.at(-1)!.end;
      const prefix = `${demo.setup} ${moves.slice(0, afterJ).join(' ')}`;
      const alignments = phases.filter(phase => phase.act.text === CORNER_POSITION_COPY.align);
      expect(alignments).toHaveLength(demoGoalReached(stage, prefix) ? 0 : 1);
      for (const phase of alignments) {
        expect(phase.start).toBe(afterJ);
        expect(phase.act.alg).toMatch(/^U(?:2|')?$/);
      }
      expect(demoGoalReached(stage, `${demo.setup} ${demo.alg}`)).toBe(true);
    }
  });
});
