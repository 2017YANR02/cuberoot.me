import { describe, expect, it } from 'vitest';
import { applyColorNeutral, generateTimerScramble, isCnEligible, timerColorNeutralOrientations,
  timerSmartCubeTrainingFrames, timerSmartCubeTrainingComplete, CUBE_ORIENTATIONS, type CnMode,
  timerTrainerCases,
} from '@cuberoot/shared/timer';
import { invertAlg } from '@cuberoot/shared/alg-transform';
import { generateSeededTimerScramble } from '@cuberoot/shared/timer/seeded/generate';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { stepSolvedInFrame } from '@cuberoot/shared/timer/reconstruct/steps';
import { orientCubeFacelets } from '@cuberoot/shared/timer';

describe('training color neutrality', () => {
  it.each([['none', 1, 1], ['single', 4, 1], ['dual', 8, 2], ['six', 24, 6]] as const)(
    '%s covers exactly %i orientations and %i bottom colors', (mode, count, bottoms) => {
      const outputs = Array.from({ length: count }, (_, i) => applyColorNeutral('U R F', mode, () => i / count));
      expect(new Set(outputs).size).toBe(count);
      expect(new Set(outputs.map(alg => alg[0])).size).toBe(bottoms);
      expect(outputs.every(alg => /^[URFDLB2' ]+$/.test(alg))).toBe(true);
      if (mode === 'single') expect(outputs.every(alg => alg[0] === 'U')).toBe(true);
      if (mode === 'dual') expect([...new Set(outputs.map(alg => alg[0]))]).toEqual(['U', 'D']);
    },
  );

  it('does not alter ordinary, blindfolded, compound, manual or unsupported Roux scrambles', async () => {
    for (const event of ['333', '333oh', '333fm', '333bld', '222', 'r3', 'custom', 'lse', 'l10p'] as const) {
      expect(isCnEligible(event), event).toBe(false);
      const result = await generateTimerScramble({ event, cnMode: 'six' }, {
        generateCubingScramble: async () => 'R U', generateSharedScramble: () => 'R U',
        random: () => { throw new Error('Must not select a color-neutral frame'); },
      });
      expect(result).toMatchObject({ ok: true, scramble: event === 'custom' ? '' : event === 'r3' ? '2x2: R U\n3x3: R U' : 'R U' });
    }
  });

  it('keeps seeded ordinary scrambles unchanged and training reproducible', () => {
    const ticket = { seed: 'color-neutral', index: 2, revision: 0 };
    for (const event of ['333', '333oh', '333fm'] as const) {
      expect(generateSeededTimerScramble({ event, ticket, cnMode: 'six' }))
        .toEqual(generateSeededTimerScramble({ event, ticket, cnMode: 'none' }));
    }
    for (const cnMode of ['none', 'single', 'dual', 'six'] as const) {
      const request = { event: 'oll' as const, ticket, cnMode };
      expect(generateSeededTimerScramble(request)).toEqual(generateSeededTimerScramble(request));
    }
  });

  it('preserves F2L training prerequisites after random and seeded color changes', async () => {
    for (const cnMode of ['single', 'dual', 'six'] as const) {
      const random = await generateTimerScramble({ event: 'f2l', cnMode });
      if (!random.ok) throw new Error(JSON.stringify(random));
      const seeded = generateSeededTimerScramble({ event: 'f2l', cnMode,
        ticket: { seed: 'cn-f2l', index: 0, revision: 0 } });
      for (const { scramble } of [random, seeded]) {
        const target = smartCubeTargetFacelets(scramble)!;
        const frames = timerSmartCubeTrainingFrames('f2l', target, '', cnMode);
        expect(frames.length).not.toBe(0);
        expect(frames.every(frame => stepSolvedInFrame('cross', orientCubeFacelets(target, frame)))).toBe(true);
        expect(frames.some(frame => timerSmartCubeTrainingComplete('f2l', target, frame))).toBe(false);
      }
    }
  });

  it('recognizes the rotated OLL finish in every training grip and color mode', () => {
    const sune = "R U R' U R U2 R'";
    const pll = "R U' R U R U R U' R' U' R2";
    for (const cnMode of ['single', 'dual', 'six'] as CnMode[]) {
      const rotations = timerColorNeutralOrientations(cnMode);
      for (let i = 0; i < rotations.length; i++) {
        const scramble = applyColorNeutral(`${pll} ${sune}`, cnMode, () => i / rotations.length);
        const finished = applyColorNeutral(pll, cnMode, () => i / rotations.length);
        for (const { value: grip } of CUBE_ORIENTATIONS) {
          const target = smartCubeTargetFacelets(scramble, grip)!;
          const frames = timerSmartCubeTrainingFrames('oll', target, grip, cnMode);
          expect(frames.length).not.toBe(0);
          expect(frames.some(frame => timerSmartCubeTrainingComplete('oll', target, frame))).toBe(false);
          expect(frames.some(frame => timerSmartCubeTrainingComplete('oll', smartCubeTargetFacelets(finished, grip)!, frame))).toBe(true);
        }
      }
    }
  });

  it('keeps every COLL/CMLL case finishable, including legacy prerequisite exceptions', () => {
    for (const event of ['coll', 'cmll'] as const) {
      for (const item of timerTrainerCases(event)) {
        for (const mode of ['single', 'dual', 'six'] as const) {
          const count = timerColorNeutralOrientations(mode).length;
          for (let i = 0; i < count; i++) {
            const scramble = applyColorNeutral(invertAlg(item.solutionAlg), mode, () => i / count);
            const frames = timerSmartCubeTrainingFrames(event, smartCubeTargetFacelets(scramble, 'z2'), 'z2', mode);
            expect(frames.length, `${event}/${item.id}/${mode}/${i}`).not.toBe(0);
            expect(frames.some(frame => timerSmartCubeTrainingComplete(event, smartCubeTargetFacelets('')!, frame))).toBe(true);
          }
        }
      }
    }
  });
});
