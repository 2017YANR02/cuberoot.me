import { describe, expect, it } from 'vitest';
import { generateCstimerScramble, generateSeededCstimerScramble } from '@cuberoot/puzzle-solvers/cstimer-nonwca';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { generateTimerScramble, generateTimerTrainingStateScramble, TIMER_TRAINING_STATE_KEYS,
  timerSmartCubeTrainingComplete, type TimerTrainingStateEvent } from '@cuberoot/shared/timer';
import { stepSolvedInFrame } from '@cuberoot/shared/timer/reconstruct/steps';
import { exportTimerCstimerJson } from '@cuberoot/shared/timer';
import { parseCstimerExport } from '@cuberoot/shared/timer/import-cstimer';

describe('shared training state generators', () => {
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
          expect(stepSolvedInFrame('sb', facelets), scramble).toBe(true);
          if (event === 'lse') expect(stepSolvedInFrame('cmll', facelets), scramble).toBe(true);
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
