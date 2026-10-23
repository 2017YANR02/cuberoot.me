/**
 * lib/mcc.ts(trangium MCC 移植)回归锁。
 * fixture 由上游 algSpeed.js 原文生成(见 fixtures/mcc_golden.json 的 note;
 * 生成时另做过 5000 例种子随机模糊对拍,全部一致)。
 * 若有意改动算法行为,必须同步说明并重生成 fixture —— toBe 锁值即 review 信号。
 */
import { describe, expect, it } from 'vitest';
import {
  algSpeed, analyzeMccGrip, getESQ, getSTM, normalizeLine, replaceDouble,
  MCC_DEFAULTS, ESQ_DEFAULTS, type EsqParams, type MccParams,
} from '@/lib/mcc';
import golden from './fixtures/mcc_golden.json';

interface MccCase {
  alg: string; ignoreErrors: boolean; ignoreAuf: boolean; params: string; mcc: number | string;
}
interface EsqCase {
  alg: string; ignoreAuf: boolean; esqParams: string; esq: number; stm: number;
}

const paramSets = golden.paramSets as Record<string, MccParams>;
const esqSets = golden.esqSets as Record<string, EsqParams>;
const mccCases = (golden.cases as Record<string, unknown>[]).filter((c) => 'mcc' in c) as unknown as MccCase[];
const esqCases = (golden.cases as Record<string, unknown>[]).filter((c) => 'esq' in c) as unknown as EsqCase[];

describe('mcc golden regression', () => {
  it('locks algSpeed on every golden case', () => {
    expect(mccCases.length).toBe(528);
    for (const c of mccCases) {
      const actual = algSpeed(normalizeLine(c.alg), c.ignoreErrors, c.ignoreAuf, paramSets[c.params]);
      expect(actual, `${JSON.stringify(c.alg)} ie=${c.ignoreErrors} ia=${c.ignoreAuf} ${c.params}`).toBe(c.mcc);
    }
  });

  it('locks getSTM/getESQ on every golden case', () => {
    expect(esqCases.length).toBe(352);
    for (const c of esqCases) {
      expect(getSTM(c.alg, c.ignoreAuf), `STM ${JSON.stringify(c.alg)} ia=${c.ignoreAuf}`).toBe(c.stm);
      const actual = getESQ(normalizeLine(c.alg), c.ignoreAuf, esqSets[c.esqParams]);
      expect(actual, `ESQ ${JSON.stringify(c.alg)} ia=${c.ignoreAuf} ${c.esqParams}`).toBe(c.esq);
    }
  });

  it('spot-checks well-known values (defaults, ignore AUF on)', () => {
    // 与线上 trangium.github.io/MovecountCoefficient 默认设置一致的定值
    const mcc = (alg: string) => algSpeed(normalizeLine(alg), false, true, MCC_DEFAULTS);
    expect(mcc("R U R' U' R' F R2 U' R' U' R U R' F'")).toBe(14.4);  // T perm
    expect(mcc("R U R' U R U2 R'")).toBe(7.6);                        // Sune
    expect(mcc('M2 U M2 U2 M2 U M2')).toBe(14.6);                     // H perm
    expect(mcc('R U R2 U2 X9')).toBe('Unknown move: X9');
  });

  it('normalizeLine merges doubles and strips 2-prime', () => {
    expect(replaceDouble('R R U')).toBe('R2 U');
    expect(normalizeLine("U' U' R2'")).toBe('U2 R2');
    expect(getESQ('R U2', false, ESQ_DEFAULTS)).toBe(1 + 3);
  });

  it('diagnostic tracing preserves every full-algorithm golden score', () => {
    for (const c of mccCases.filter(c => !c.ignoreErrors && !c.ignoreAuf)) {
      const read = () => analyzeMccGrip(normalizeLine(c.alg), paramSets[c.params]);
      if (typeof c.mcc === 'string') expect(read).toThrow(c.mcc);
      else expect(read().mcc, c.alg).toBe(c.mcc);
    }
  });

  it('keeps pregrip separate and accumulates indices across repeated resets', () => {
    // Deliberately unsimplified wrist turns isolate the state/index bookkeeping.
    const trace = analyzeMccGrip('R R R R R R R R');
    expect(trace.start).toEqual({ left: 0, right: -1 });
    expect(trace.regrips).toBe(2);
    expect(trace.events.map(e => [e.kind, e.beforeMove, e.hand])).toEqual([
      ['regrip', 4, 'right'], ['regrip', 7, 'right'],
    ]);
    expect(analyzeMccGrip('U R R R R R R R R U2').events.map(e => e.beforeMove)).toEqual([5, 8]);
  });

  it('does not count support changes or rotations as wrist regrips', () => {
    expect(analyzeMccGrip("R U R' U'").events).toEqual([]);
    const wide = analyzeMccGrip("r U R' U'");
    expect(wide.regrips).toBe(0);
    expect(wide.events.map(e => [e.kind, e.beforeMove])).toEqual([
      ['support-switch', 1], ['support-switch', 3],
    ]);
    expect(analyzeMccGrip("R y R'").events.filter(e => e.kind === 'rotation-reset').length).toBe(1);
    expect(analyzeMccGrip("R y R'").regrips).toBe(0);
  });
});
