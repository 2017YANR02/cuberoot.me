import { Alg } from 'cubing/alg';
import { AllFaces, CubeData, Face, parseAlgorithm } from '@cuberoot/visualcube';
import { describe, expect, it } from 'vitest';
import { buildWalkthroughDemo, completeDemoPool, demoGoalReached } from '@/app/[lang]/tutorial/lbl/complete-demo-state';
import { LBL_LESSON_RUNS, LBL_LESSON_STAGE_IDS } from '@/app/[lang]/tutorial/lbl/lesson-runs';
import { CORNER_ALIGNMENT_COPY, J_ALG, LBL_STEPS, RIGHT } from '@/app/[lang]/tutorial/lbl/content';

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

  it('plays one continuous trace with markers only between the major stages', () => {
    for (const { scramble } of LBL_LESSON_RUNS) {
      const demo = buildWalkthroughDemo(scramble);
      const moves = demo.alg.split(' ');
      const starts = demo.phases.filter(phase => phase.holdMs === 2000);
      expect(demo.setup).toBe(scramble);
      expect(starts.map(phase => phase.stage)).toEqual(LBL_LESSON_STAGE_IDS);
      const markers = starts.map(phase => phase.start).filter(step => step > 0 && step < moves.length);
      expect(demo.stageMarkers).toEqual([...new Set(markers)]);
      for (const [index, stage] of LBL_LESSON_STAGE_IDS.entries()) {
        const end = starts[index + 1]?.start ?? moves.length;
        expect(demoGoalReached(stage, `${scramble} ${moves.slice(0, end).join(' ')}`)).toBe(true);
      }
      const playedMoves = demo.phases.flatMap(({ start, end }) => Array.from({ length: end - start }, (_, index) => start + index));
      expect(playedMoves).toEqual(moves.map((_, index) => index));
      const cornerTurns = demo.phases.filter(phase => phase.stage === 'corner-position' && phase.end > phase.start);
      const lastCornerTurn = cornerTurns.at(-1);
      if (lastCornerTurn) {
        expect(moves.slice(lastCornerTurn.start, lastCornerTurn.end).join(' ')).toBe(J_ALG);
      }
      expect(demo.phases.some(phase => phase.act.text.zh === '转顶层，让顶角先对齐侧面中心')).toBe(false);
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

  it('ends both individual headlights examples at the final turn of J', () => {
    const [withEyes, withoutEyes] = LBL_STEPS.find(step => step.id === stage)!.examples;
    expect(eyeCount(withoutEyes.setup!)).toBe(0);
    expect(withoutEyes.alg).toBe(J_ALG);
    expect(eyeCount(`${withoutEyes.setup} ${withoutEyes.alg}`)).toBe(1);
    expect(withEyes.alg).toBe(`U ${J_ALG}`);
    const leftCorners = (alg: string) => [0, 2].map(index => state(alg)[Face.L][index][0]);
    const [initialLeft, initialRight] = leftCorners(withEyes.setup!);
    expect(initialLeft).not.toBe(initialRight);
    const [adjustedLeft, adjustedRight] = leftCorners(`${withEyes.setup} U`);
    expect(adjustedLeft).toBe(adjustedRight);
    const beforeAlignment = `${withEyes.setup} ${withEyes.alg}`;
    expect(eyeCount(beforeAlignment)).toBe(4);
    expect(demoGoalReached(stage, beforeAlignment)).toBe(true);
  });

  it('ends the corner-position demonstrations as soon as all four sides have matching corners', () => {
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
      expect(jPhases.at(-1)!.end).toBe(moves.length);
      expect(demoGoalReached(stage, `${demo.setup} ${demo.alg}`)).toBe(true);
    }
  });
});
