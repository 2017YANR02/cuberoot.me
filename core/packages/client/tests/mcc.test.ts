/**
 * lib/mcc.ts(trangium MCC 移植)回归锁。
 * fixture 由上游 algSpeed.js 原文生成(见 fixtures/mcc_golden.json 的 note;
 * 生成时另做过 5000 例种子随机模糊对拍,全部一致)。
 * 若有意改动算法行为,必须同步说明并重生成 fixture —— toBe 锁值即 review 信号。
 */
import { describe, expect, it } from 'vitest';
import {
  algSpeed, getESQ, getSTM, normalizeLine, replaceDouble,
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
});
