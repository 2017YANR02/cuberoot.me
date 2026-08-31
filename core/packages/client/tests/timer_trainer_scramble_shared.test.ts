import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import ollMap from '@cuberoot/shared/data/oll.json';
import pllMap from '@cuberoot/shared/data/pll.json';
import zbllMap from '@cuberoot/shared/data/zbll.json';
import { invertAlg } from '@cuberoot/shared/alg-transform';
import {
  CMLL_ALGS,
  CMLL_CASES,
  COLL_ALGS,
  COLL_CASES,
  EG1_ALGS,
  EG1_CASES,
  EG2_ALGS,
  EG2_CASES,
  OLL_CASES,
  PLL_CASES,
  TIMER_TRAINER_CASE_TRACKED_EVENT_IDS,
  TIMER_TRAINER_EVENT_IDS,
  ZBLL_CASES,
  generateTimerScramble,
  generateTimerTrainerScramble,
  timerTrainerCases,
  timerTracksTrainerCase,
  type TimerTrainerEventId,
} from '@cuberoot/shared/timer';
import { scrambleLl } from '@/app/[lang]/timer/_lib/scramble/cfop_step';
import {
  getLastPickedCase,
  scrambleColl,
  scrambleOll,
} from '@/app/[lang]/timer/_lib/scramble/training';
import {
  resetSettings,
  updateSettings,
} from '@/app/[lang]/timer/_lib/settings';

const TRAINER_WITH_CASE_LIST = [
  'oll', 'pll', 'coll', 'cmll', 'zbll', 'eg1', 'eg2',
] as const;

describe('shared Timer trainer providers', () => {
  it('shares the exact Web solve case-tracking contract with native hosts', () => {
    expect(TIMER_TRAINER_CASE_TRACKED_EVENT_IDS).toEqual(TRAINER_WITH_CASE_LIST);
    for (const event of TRAINER_WITH_CASE_LIST) expect(timerTracksTrainerCase(event)).toBe(true);
    expect(timerTracksTrainerCase('ll')).toBe(false);
    expect(timerTracksTrainerCase('333')).toBe(false);
  });

  it('sources OLL, PLL and ZBLL identities from the canonical shared JSON', () => {
    expect(OLL_CASES.map(({ id, solutionAlg }) => [id, solutionAlg])).toEqual(
      Object.entries(ollMap).map(([id, item]) => [id, item.alg]),
    );
    expect(PLL_CASES.map(({ id, solutionAlg }) => [id, solutionAlg])).toEqual(
      Object.entries(pllMap).map(([id, item]) => [id, item.noAuf]),
    );
    expect(ZBLL_CASES.map(({ name, solutionAlg }) => [name, solutionAlg])).toEqual(
      Object.entries(zbllMap).map(([id, item]) => [item.key || id, item.algs[0]]),
    );
    expect(OLL_CASES).toHaveLength(57);
    expect(PLL_CASES).toHaveLength(21);
    expect(ZBLL_CASES).toHaveLength(472);
  });

  it('keeps the migrated COLL/CMLL/EG corpora exact and case-addressable', () => {
    expect(COLL_ALGS).toHaveLength(40);
    expect(CMLL_ALGS).toHaveLength(42);
    expect(EG1_ALGS).toHaveLength(40);
    expect(EG2_ALGS).toHaveLength(40);
    expect(COLL_CASES.map((item) => item.solutionAlg)).toEqual(COLL_ALGS);
    expect(CMLL_CASES.map((item) => item.solutionAlg)).toEqual(CMLL_ALGS);
    expect(EG1_CASES.map((item) => item.solutionAlg)).toEqual(EG1_ALGS);
    expect(EG2_CASES.map((item) => item.solutionAlg)).toEqual(EG2_ALGS);
    for (const cases of [COLL_CASES, CMLL_CASES, EG1_CASES, EG2_CASES]) {
      expect(cases.every((item) => item.id === item.solutionAlg)).toBe(true);
    }
  });

  it.each(TIMER_TRAINER_EVENT_IDS)(
    'keeps %s event identity and emits the exact inverse plus structured metadata',
    async (event) => {
      const direct = generateTimerTrainerScramble(event, { random: () => 0.37 });
      expect(direct.event).toBe(event);
      expect(direct.caseId).not.toBe('');
      expect(direct.solutionAlg).not.toBe('');
      expect(direct.scramble).toBe(invertAlg(direct.solutionAlg));

      const runtime = await generateTimerScramble(
        { event },
        { random: () => 0.37 },
      );
      expect(runtime).toEqual({
        ok: true,
        event,
        kind: 'generated',
        provider: 'trainer-case',
        scramble: direct.scramble,
        metadata: {
          caseId: direct.caseId,
          solutionAlg: direct.solutionAlg,
        },
      });
    },
  );

  it.each(TRAINER_WITH_CASE_LIST)(
    'honours an exact %s case subset and never substitutes another case',
    async (event) => {
      const cases = timerTrainerCases(event);
      const target = cases[cases.length - 1];
      const direct = generateTimerTrainerScramble(event, {
        caseIds: ['stale-case-id', target.id],
        random: () => 0,
      });
      expect(direct.caseId).toBe(target.id);
      expect(direct.solutionAlg).toBe(target.solutionAlg);
      expect(direct.scramble).toBe(invertAlg(target.solutionAlg));

      const runtime = await generateTimerScramble(
        { event, trainerCaseIds: [target.id] },
        { random: () => 0.9 },
      );
      expect(runtime.ok).toBe(true);
      if (runtime.ok && runtime.kind === 'generated') {
        expect(runtime.event).toBe(event);
        expect(runtime.metadata?.caseId).toBe(target.id);
        expect(runtime.metadata?.solutionAlg).toBe(target.solutionAlg);
      }
    },
  );

  it('validates every shared case, not a sample, against the canonical inverter', () => {
    for (const event of TRAINER_WITH_CASE_LIST) {
      for (const item of timerTrainerCases(event)) {
        const generated = generateTimerTrainerScramble(event, {
          caseIds: [item.id],
          random: () => 0,
        });
        expect(generated.event).toBe(event);
        expect(generated.caseId).toBe(item.id);
        expect(generated.solutionAlg).toBe(item.solutionAlg);
        expect(generated.scramble).not.toBe('');
        expect(generated.scramble).toBe(invertAlg(item.solutionAlg));
      }
    }
  });

  it('keeps LL as independent OLL + PLL cases and can constrain both identities', () => {
    const oll = OLL_CASES[11];
    const pll = PLL_CASES[7];
    const result = generateTimerTrainerScramble('ll', {
      caseIds: [oll.id, pll.id],
      random: () => 0.99,
    });
    expect(result.event).toBe('ll');
    expect(result.caseId).toBe(`${oll.id} + ${pll.id}`);
    expect(result.solutionAlg).toBe(`${oll.solutionAlg} ${pll.solutionAlg}`);
    expect(result.scramble).toBe(invertAlg(result.solutionAlg));
  });

  it('keeps Web generators as functional thin consumers, including the OLL subset', () => {
    resetSettings();
    const oll = OLL_CASES[OLL_CASES.length - 1];
    updateSettings({ ollSubset: [oll.id] });
    expect(scrambleOll(() => 0.5)).toBe(invertAlg(oll.solutionAlg));
    expect(getLastPickedCase('oll')).toBe(oll.id);

    const coll = COLL_CASES[0];
    expect(scrambleColl(() => 0)).toBe(invertAlg(coll.solutionAlg));
    expect(getLastPickedCase('coll')).toBe(coll.id);

    const ll = generateTimerTrainerScramble('ll', { random: () => 0 });
    expect(scrambleLl(() => 0)).toBe(ll.scramble);
    resetSettings();
  });

  it('falls back from an entirely stale subset to the same event corpus, never 333', async () => {
    for (const event of TIMER_TRAINER_EVENT_IDS) {
      const result = await generateTimerScramble(
        { event, trainerCaseIds: ['removed-case'] },
        { random: () => 0 },
      );
      expect(result.ok).toBe(true);
      if (result.ok && result.kind === 'generated') {
        expect(result.event).toBe(event);
        expect(result.provider).toBe('trainer-case');
        expect(result.scramble).not.toBe('');
      }
    }
  });

  it('leaves Web as thin settings/legacy adapters with no copied corpus or inverter', () => {
    const base = new URL('../app/[lang]/timer/_lib/scramble/', import.meta.url);
    const training = readFileSync(new URL('training.ts', base), 'utf8');
    const cfop = readFileSync(new URL('cfop_step.ts', base), 'utf8');
    const invert = readFileSync(new URL('invert.ts', base), 'utf8');
    const solo = readFileSync(new URL('../../_shell/SoloView.tsx', base), 'utf8');
    expect(training).toContain("from '@cuberoot/shared/timer'");
    expect(training).toContain('generateTimerTrainerScramble');
    expect(training).not.toMatch(/const\s+(?:OLL|PLL|COLL|CMLL|ZBLL|EG[12])_ALGS\s*=/);
    expect(cfop).toContain("generateTimerTrainerScramble('ll'");
    expect(invert.trim()).toBe("export { invertAlg } from '@cuberoot/shared/alg-transform';");
    expect(solo).toContain('timerTracksTrainerCase(event)');
    expect(solo).not.toContain('const TRAINER_KINDS');

    const names: readonly Exclude<TimerTrainerEventId, 'll'>[] = TRAINER_WITH_CASE_LIST;
    for (const name of names) {
      const adapter = readFileSync(new URL(`algs/${name}.ts`, base), 'utf8');
      expect(adapter).toMatch(/^export \{ [A-Z0-9]+_ALGS \} from '@cuberoot\/shared\/timer';\s*$/);
    }
  });
});
