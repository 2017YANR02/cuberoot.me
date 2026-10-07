import { describe, expect, it } from 'vitest';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { generateTimerScramble, generateTimerTrainingStateScramble, TIMER_TRAINING_STATE_KEYS,
  timerSmartCubeTrainingComplete, type TimerTrainingStateEvent } from '@cuberoot/shared/timer';
import { stepSolvedInFrame } from '@cuberoot/shared/timer/reconstruct/steps';
import { exportTimerCstimerJson } from '@cuberoot/shared/timer';
import { parseCstimerExport } from '@cuberoot/shared/timer/import-cstimer';
import { CUBE_ORIENTATIONS } from '@cuberoot/shared/timer';
import { generateSeededTimerScramble } from '@cuberoot/shared/timer/seeded/generate';
import { applyMoves, solved, toFaceletString } from '@cuberoot/shared/timer/reconstruct/state';
import { parseScramble } from '@cuberoot/puzzle-solvers/cube-moves';

const displayed = (scramble: string) => toFaceletString(applyMoves(solved(3), 3, parseScramble(scramble)));

describe('shared training state generators', () => {
  it('F2L starts with the selected cross solved in random and seeded modes', async () => {
    const crossMask = '----U--------R--R-----F--F--D-DDD-D-----L--L-----B--B-';
    for (let index = 0; index < 16; index++) {
      const request = { event: 'f2l' as const, cnMode: 'six' as const };
      const result = await generateTimerScramble(request);
      if (!result.ok) throw new Error(JSON.stringify(result));
      const seeded = generateSeededTimerScramble({ ...request, ticket: { seed: 'f2l-cross', index, revision: 0 } });
      for (const scramble of [result.scramble, seeded.scramble]) {
        expect(scramble).toMatch(/^[URFDLB](?:2|')?(?: [URFDLB](?:2|')?)*$/);
        expect(stepSolvedInFrame('f2l', displayed(scramble))).toBe(false);
        for (const { value: grip } of CUBE_ORIENTATIONS) {
          const actual = displayed(`${grip} ${scramble}`);
          const expected = displayed(grip);
          const cross = (state: string) => [...crossMask].map((mark, i) => mark === '-' ? '-' : state[i]).join('');
          expect(cross(actual), `${grip}: ${scramble}`).toBe(cross(expected));
        }
      }
    }
  }, 60_000);
  it.each(['lse', 'l10p'] as const)('%s needs no regrip and keeps block colors in all 24 training grips', async (event) => {
    const blockMask = '------------RRRRRR---F-FF-FD-DD-DD-D---LLLLLL---B-BB-B';
    for (let index = 0; index < 32; index++) {
      const result = await generateTimerScramble({ event });
      if (!result.ok) throw new Error(JSON.stringify(result));
      const raw = result.scramble;
      const seeded = generateSeededTimerScramble({ event, ticket: { seed: 'grip', index, revision: 0 } }).scramble;
      for (const scramble of [raw, seeded]) {
        expect(scramble).toMatch(/^[URFDLB](?:2|')?(?: [URFDLB](?:2|')?)*$/);
        for (const { value: grip } of CUBE_ORIENTATIONS) {
          const expected = displayed(grip);
          const actual = displayed(`${grip} ${scramble}`);
          const blocks = (state: string) => [...blockMask].map((mark, i) => mark === '-' ? '-' : state[i]).join('');
          expect(blocks(actual), `${event}: ${grip} / ${scramble}`).toBe(blocks(expected));
          for (const i of [4, 13, 22, 31, 40, 49]) expect(actual[i]).toBe(expected[i]);
          if (event === 'lse') {
            for (const face of [0, 9, 18, 27, 36, 45]) {
              for (const corner of [0, 2, 6, 8]) expect(actual[face + corner]).toBe(expected[face + corner]);
            }
          }
        }
      }
    }
  }, 60_000);
  it.each([['eocp', 'll'], ['ollcp', 'll'], ['l10p', 'cmll']] as const)('exports %s through a supported csTimer type and restores its original identity', (event, key) => {
    const exported = exportTimerCstimerJson({ [event]: [{ id: 'test', event, ts: 1000, timeMs: 500, scramble: 'R U', penalty: 'ok' }] });
    const outer = JSON.parse(exported.json);
    const meta = JSON.parse(outer.properties.sessionData);
    expect(meta['1']).toMatchObject({ opt: { scrType: key }, cuberootEvent: event });
    expect(parseCstimerExport(exported.json)[0].solves[0].event).toBe(event);
  });
  for (const event of Object.keys(TIMER_TRAINING_STATE_KEYS) as TimerTrainingStateEvent[]) {
    it(`${event}: real random and seeded outputs preserve the training domain`, async () => {
      const random = await generateTimerScramble({ event });
      expect(random).toMatchObject({ ok: true, event, provider: 'training-state' });
      const scrambles: string[] = [];
      if (random.ok) scrambles.push(random.scramble);
      for (let seed = 0; seed < 8; seed++) scrambles.push(generateSeededTimerScramble({ event,
        ticket: { seed: event, index: seed, revision: 0 } }).scramble);
      for (const scramble of scrambles) {
        const facelets = smartCubeTargetFacelets(scramble)!;
        expect(facelets).toHaveLength(54);
        expect(stepSolvedInFrame('solved', facelets)).toBe(false);
        expect(timerSmartCubeTrainingComplete(event, facelets, '')).toBe(false);
        if (event === 'lse' || event === 'l10p') {
          expect(stepSolvedInFrame('sb', displayed(scramble)), scramble).toBe(true);
          if (event === 'lse') expect(stepSolvedInFrame('cmll', displayed(scramble)), scramble).toBe(true);
        } else if (event === 'zbls' || event === 'f2l') {
          expect(stepSolvedInFrame('cross', facelets)).toBe(true);
        } else {
          expect(stepSolvedInFrame('f2l', facelets), scramble).toBe(true);
          if (event === 'ell') expect(stepSolvedInFrame('cll', facelets)).toBe(true);
          if (event === 'zzll' || event === '2gll') expect(stepSolvedInFrame('eoll', facelets)).toBe(true);
        }
      }
    }, 60_000);
  }
  it('fails boundedly when a generator only returns a finished state', () => {
    expect(() => generateTimerTrainingStateScramble('cll', () => 'U')).toThrow('unfinished case');
  });
});
