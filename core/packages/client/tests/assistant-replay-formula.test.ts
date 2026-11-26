import { describe, expect, it } from 'vitest';
import type { AlgFile } from '@cuberoot/shared/alg';
import { cfopFormulaTarget } from '@cuberoot/timer-ui/reconstruct/cfop-diagnosis';
import { preferredAlgRef, preferredAlgSlot } from '@/lib/alg-preferred-algs';
import { replayFormulaCard, replayFormulaTrainingHref, summarizeReplayRetest } from '@/lib/replay-formula-training';
import { retiredAlgTrainerHref } from '@/lib/timer-training-catalog';
import { trainingSearchParams } from '@/lib/timer-training-location';
import { caseKeysFromIds } from '@/lib/trainer-case-key';
import libraries from './fixtures/recon-workbook/libraries.json';

const oll = libraries.oll as AlgFile;
const pll = libraries.pll as AlgFile;

describe('replay formula training', () => {
  it('resolves exact OLL numbers and normalizes recognized PLL aliases using the existing library', () => {
    const ollTarget = cfopFormulaTarget('oll', 'OLL 22 (Pi-Shape)')!;
    const aPerm = cfopFormulaTarget('pll', 'PLL Aa')!;
    const ua = cfopFormulaTarget('pll', 'PLL Ua')!;
    expect(replayFormulaCard(oll, ollTarget, {})).toMatchObject({ set: 'oll', caseId: 3927 });
    expect(replayFormulaCard(pll, aPerm, {})).toMatchObject({ caseId: 4305, href: '/alg/3x3/pll/a+' });
    expect(replayFormulaCard(pll, ua, {})?.href).toBe('/alg/3x3/pll/u-');
  });

  it('uses the case on the final replay line for the single-case trainer', () => {
    expect(cfopFormulaTarget('pll', 'PLL Gb', null)).toBeUndefined();
    const target = cfopFormulaTarget('pll', 'PLL Gb', 'PLL-Ga')!;
    expect(replayFormulaCard(pll, target, {})).toMatchObject({ caseId: 4309, name: 'Ga' });
    expect(cfopFormulaTarget('pll', 'PLL Ua', 'EPLL-U-')).toEqual({ set: 'pll', caseName: 'U-' });
    expect(cfopFormulaTarget('oll', 'OLL 8', 'OLL-N+')).toEqual({ set: 'oll', caseName: 'OLL 7' });
    expect(cfopFormulaTarget('pll', 'PLL Ga', 'PLL Skip')).toBeUndefined();
  });

  it('uses a saved formula when present without substituting a different case or layout', () => {
    const target = cfopFormulaTarget('pll', 'PLL Ga')!;
    const ga = pll.cases.find(c => c.id === 4309)!;
    const alternative = ga.algs[0][1];
    const card = replayFormulaCard(pll, target, { [preferredAlgSlot(ga)]: preferredAlgRef(alternative) });
    expect(card).toMatchObject({ caseId: 4309, alg: alternative.alg, sticker: ga.sticker });
    expect(replayFormulaCard(pll, target, { [preferredAlgSlot(ga)]: 'id:removed' })?.alg).toBe(ga.algs[0][0].alg);
  });

  it('keeps ambiguous, unrecognized or skipped stages at stage-level', () => {
    expect(cfopFormulaTarget('oll', 'OLL skip')).toBeUndefined();
    expect(cfopFormulaTarget('pll', 'PLL skip')).toBeUndefined();
    expect(cfopFormulaTarget('oll', 'OLL 58')).toBeUndefined();
    expect(cfopFormulaTarget('pll', null)).toBeUndefined();
    expect(replayFormulaCard(pll, { set: 'pll', caseName: 'ZZ' }, {})).toBeUndefined();
    const ga = pll.cases.find(c => c.id === 4309)!;
    expect(replayFormulaCard({ ...pll, cases: [...pll.cases, { ...ga, id: 10001 }] },
      { set: 'pll', caseName: 'Ga' }, {})).toBeUndefined();
    expect(replayFormulaCard(oll, { set: 'pll', caseName: 'Ga' }, {})).toBeUndefined();
  });

  it('routes both modes into the timer with an exact one-case trainer pool', () => {
    for (const [focus, mode] of [['recognition', 'memo'], ['execution', 'train']] as const) {
      const href = retiredAlgTrainerHref(replayFormulaTrainingHref('pll', 4309, focus));
      const url = new URL(href, 'http://localhost');
      const training = trainingSearchParams(url.search);
      expect(url.pathname).toBe('/timer');
      expect(training.get('mode')).toBe(mode);
      expect(caseKeysFromIds(pll.cases, training.get('cases'))).toEqual([`${pll.cases.find(c => c.id === 4309)!.subgroup}|Ga`]);
    }
  });

  it('keeps failed attempts in the accuracy count and uses successful times for the median', () => {
    expect(summarizeReplayRetest('1.9, 1.2\nDNF，1.4 1.5')).toEqual({ invalid: false, completed: true, correct: 4, medianMs: 1450 });
    expect(summarizeReplayRetest('DNF DNF 1.2 DNF 1.4')).toEqual({ invalid: false, completed: true, correct: 2, medianMs: null });
    expect(summarizeReplayRetest('1 1 1 1')).toMatchObject({ completed: false, medianMs: null });
    for (const value of ['1 2 3 4 5 6', '1 2 3 4 -5', '1 2 3 4 1e2']) {
      expect(summarizeReplayRetest(value)).toMatchObject({ invalid: true, completed: false, medianMs: null });
    }
  });
});
