import { describe, expect, it } from 'vitest';
import { generateCstimerScramble, generateSeededCstimerScramble } from '@cuberoot/puzzle-solvers/cstimer-nonwca';
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
  it.each(['lse', 'l10p'] as const)('%s keeps block colors in all 24 training grips, including seeded output', (event) => {
    const blockMask = '------------RRRRRR---F-FF-FD-DD-DD-D---LLLLLL---B-BB-B';
    const endings = new Set<string>();
    for (let index = 0; index < 32; index++) {
      const raw = generateTimerTrainingStateScramble(event, (key, attempt) =>
        generateSeededCstimerScramble(key, 0, `grip/${event}/${index}/${attempt}`));
      endings.add(raw.match(/(?:^|\s)(x(?:2|')?)\s*$/)?.[1] ?? '');
      const seeded = generateSeededTimerScramble({ event, ticket: { seed: 'grip', index, revision: 0 } }).scramble;
      for (const scramble of [raw, seeded]) {
        for (const { value: grip } of CUBE_ORIENTATIONS) {
          const expected = displayed(grip);
          const actual = displayed(`${grip} ${scramble}`);
          const blocks = (state: string) => [...blockMask].map((mark, i) => mark === '-' ? '-' : state[i]).join('');
          expect(blocks(actual), `${event}: ${grip} / ${scramble}`).toBe(blocks(expected));
        }
      }
    }
    expect([...endings].sort()).toEqual(['', 'x', "x'", 'x2'].sort());
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
      const scrambles = [generateTimerTrainingStateScramble(event, generateCstimerScramble)];
      if (random.ok) scrambles.push(random.scramble);
      for (let seed = 0; seed < 8; seed++) scrambles.push(generateTimerTrainingStateScramble(event,
        (key, attempt) => generateSeededCstimerScramble(key, 0, `${event}/${seed}/${attempt}`)));
      for (const scramble of scrambles) {
        const facelets = smartCubeTargetFacelets(scramble)!;
        expect(facelets).toHaveLength(54);
        expect(stepSolvedInFrame('solved', facelets)).toBe(false);
        expect(timerSmartCubeTrainingComplete(event, facelets, '')).toBe(false);
        if (event === 'lse' || event === 'l10p') {
          expect(stepSolvedInFrame('sb', displayed(scramble)), scramble).toBe(true);
          if (event === 'lse') expect(stepSolvedInFrame('cmll', displayed(scramble)), scramble).toBe(true);
        } else if (event === 'zbls') {
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
