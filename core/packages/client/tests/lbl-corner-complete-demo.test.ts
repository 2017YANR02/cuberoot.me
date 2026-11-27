import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';
import { scramble333 } from '@cuberoot/shared/timer/seeded/nxnxn';
import { AllFaces, CubeData, Face, parseAlgorithm } from '@cuberoot/visualcube';
import { describe, expect, it } from 'vitest';
import { buildWalkthroughDemo, buildWhiteUpWalkthrough, completeDemoPool, demoGoalReached } from '@/app/[lang]/tutorial/lbl/complete-demo-state';
import { LBL_LESSON_RUNS, LBL_LESSON_STAGE_IDS } from '@/app/[lang]/tutorial/lbl/lesson-runs';
import { CORNER_ALIGNMENT_COPY, J_ALG, LBL_STEPS, LEFT_SUNE, RIGHT, RIGHT_SUNE } from '@/app/[lang]/tutorial/lbl/content';

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
      const whiteUp = buildWhiteUpWalkthrough(scramble);
      expect(state(whiteUp.scramble)).toEqual(state(`z2 ${whiteUp.demo.setup}`));
      expect(whiteUp.demo.phases[0]).toMatchObject({ start: 0, end: 1 });
      expect(whiteUp.demo.alg.split(' ')[0]).toBe('z2');
      expect(state(`${whiteUp.demo.setup} z2`)).toEqual(state(demo.setup));
      expect(whiteUp.demo.stageMarkers).toEqual(demo.stageMarkers?.map(step => step + 1));
      const cornerTurns = demo.phases.filter(phase => phase.stage === 'corner-position' && phase.end > phase.start);
      const lastCornerTurn = cornerTurns.at(-1);
      if (lastCornerTurn) {
        expect(moves.slice(lastCornerTurn.start, lastCornerTurn.end).join(' ')).toBe(J_ALG);
      }
      expect(starts.every(phase => phase.start === phase.end)).toBe(true);
    }
  });

  it('plays new scrambles through the taught stage goals and explains the alignment turn', async () => {
    const model = await puzzles['3x3x3'].kpuzzle();
    const sides = [Face.F, Face.R, Face.B, Face.L];
    const aligned = (alg: string) => {
      const faces = state(alg);
      return sides.every(face => [0, 2].every(i => faces[face][i][0] === faces[face][4][0]));
    };
    let seed = 0x1b1;
    const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    let alignments = 0;
    const recognized = new Set<string>();
    for (let i = 0; i < 24; i++) {
      const { demo, scramble } = buildWhiteUpWalkthrough(scramble333(rng));
      expect(state(scramble)).toEqual(state(`z2 ${demo.setup}`));
      const moves = demo.alg.split(' ');
      const at = (end: number) => `${demo.setup} ${moves.slice(0, end).join(' ')}`;
      const intro = demo.phases.filter(phase => phase.holdMs === 2000);
      for (const [index, stage] of LBL_LESSON_STAGE_IDS.entries()) {
        expect(demoGoalReached(stage, at(intro[index + 1]?.start ?? moves.length)), stage).toBe(true);
      }
      let cursor = 0;
      for (const phase of demo.phases) {
        expect(phase.start, phase.act.text.zh).toBe(cursor);
        cursor = phase.end;
        const turns = moves.slice(phase.start, phase.end).join(' ');
        if (phase.act.alg) expect(new Alg(phase.act.alg).expand().toString()).toBe(turns);
        const recognition = phase.recognize?.text.zh;
        if (recognition && ['yellow-cross', 'yellow-face', 'corner-position', 'edge-position'].includes(phase.stage ?? '')) {
          const faces = state(at(phase.start));
          const yellow = (face: Face, index: number) => faces[face][index][0] === 'U';
          if (recognition === '两条黄棱成直线' || recognition === '两条黄棱相邻' || recognition === '没有黄棱朝上') {
            const up = [1, 3, 5, 7].filter(index => yellow(Face.U, index));
            expect(up.length).toBe(recognition === '没有黄棱朝上' ? 0 : 2);
            if (up.length) expect(up[0] + up[1] === 8).toBe(recognition === '两条黄棱成直线');
            recognized.add('cross');
          }
          if (/^[234]个非黄格/.test(recognition)) {
            expect([0, 2, 6, 8].filter(index => !yellow(Face.U, index))).toHaveLength(Number(recognition[0]));
            recognized.add('face');
          }
          if (recognition.startsWith('找到一对眼') || recognition === '四面都没有眼') {
            expect(sides.filter(face => faces[face][0][0] === faces[face][2][0])).toHaveLength(recognition.startsWith('找到') ? 1 : 0);
            recognized.add('corners');
          }
          if (recognition.startsWith('找到墙') || recognition.startsWith('四面都没有墙')) {
            expect(sides.filter(face => [0, 1, 2].every(index => faces[face][index][0] === faces[face][4][0]))).toHaveLength(recognition.startsWith('找到') ? 1 : 0);
            recognized.add('edges');
          }
        }
        if (phase.act.text.zh === '做左鱼公式') expect(turns).toBe(LEFT_SUNE);
        if (phase.act.text.zh === '做右鱼公式') expect(turns).toBe(RIGHT_SUNE);
        if (phase.stage !== 'edge-position' || phase.act.text.zh !== '对齐顶层') continue;
        alignments++;
        expect(phase.act.detail?.zh).toContain('四个顶角的侧色');
        expect(aligned(at(phase.start))).toBe(false);
        expect(aligned(at(phase.end))).toBe(true);
      }
      expect(cursor).toBe(moves.length);
      expect(model.defaultPattern().applyAlg(new Alg(at(moves.length))).experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true })).toBe(true);
    }
    expect(alignments).toBeGreaterThan(0);
    expect(recognized).toEqual(new Set(['cross', 'face', 'corners', 'edges']));
  }, 30000);
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
