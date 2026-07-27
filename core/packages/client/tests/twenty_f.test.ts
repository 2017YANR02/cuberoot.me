/**
 * 20 步态两份语料的护栏。
 *
 * 语料是搬运的(kociemba.org 的 20moves.zip / cube20.org 的 random1000.txt),
 * 但页面上的每个数字都得是本机算的:这里把两份语料重新读一遍,对称型逐条复算、
 * 开局难度逐条求解,再与 `_data/twenty_f.ts` 的常量逐位对。
 */
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyAlgExtended } from '@/app/[lang]/scramble/symmetry/_alg';
import {
  SYM_TYPES, antisymMask, classifyMask, closure, maskToList, symMask,
} from '@/app/[lang]/scramble/symmetry/_sym_core';
import { allCrossLengths, crossLength, solveCross } from '@/lib/cross-solver';
import { computeEoCrossDist, eoCrossAltAxisIndex, eoCrossIndex } from '@/lib/eocross-dist';
import {
  TWENTY_F_BASELINE, TWENTY_F_EASY_CROSS, TWENTY_F_RANDOM_CN_CROSS, TWENTY_F_RANDOM_CROSS,
  TWENTY_F_RANDOM_EOCROSS, TWENTY_F_RANDOM_TOTAL, TWENTY_F_SUPERFLIP, TWENTY_F_SYM_CENSUS,
  TWENTY_F_SYM_SELF_INVERSE, TWENTY_F_SYM_TOTAL, twentyFMean,
} from '@/app/[lang]/scramble/hardest/_data/twenty_f';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

/** 每行 `<打乱>\t<上游对称型标签>`。 */
const SYM_ROWS = gunzipSync(readFileSync(path.join(FIXTURES, 'twenty_f_sym.txt.gz')))
  .toString('utf8').trim().split('\n')
  .map((line) => { const [s, sym] = line.split('\t'); return { s, sym }; });

const RANDOM_ROWS = readFileSync(path.join(FIXTURES, 'twenty_f_random.txt'), 'utf8')
  .trim().split('\n').map((s) => s.trim());

/** 上游标签写法:`型` 或 `型{加上反对称之后的型}`,后者与前者同型时写 `{I}`(即自身与逆同构)。 */
function labelOf(scramble: string): string {
  const cube = applyAlgExtended(scramble).cube;
  const sm = symMask(cube);
  const am = antisymMask(cube);
  const name = SYM_TYPES[classifyMask(sm)].name;
  if (am === 0n) return name;
  const ext = SYM_TYPES[classifyMask(closure([...maskToList(sm), ...maskToList(am)]))].name;
  return ext === name ? `${name}{I}` : `${name}{${ext}}`;
}

describe('20 步态:32,625 个对称态', () => {
  it('条数与上游语料一致', () => {
    expect(SYM_ROWS.length).toBe(TWENTY_F_SYM_TOTAL);
  });

  it('对称型逐条复算,32,625 条全部与上游标签相同', () => {
    let mismatch = 0;
    for (const row of SYM_ROWS) if (labelOf(row.s) !== row.sym) mismatch++;
    expect(mismatch).toBe(0);
  });

  it('每一条都真的有非平凡对称性(这份语料的定义)', () => {
    for (const row of SYM_ROWS) {
      expect(symMask(applyAlgExtended(row.s).cube), row.s).not.toBe(1n);
    }
  });

  it('普查表与复算结果逐格相同,且按站内对称型顺序排列', () => {
    const hist = new Map<string, number>();
    const first = new Map<string, string>();
    for (const row of SYM_ROWS) {
      const type = labelOf(row.s).split('{')[0];
      hist.set(type, (hist.get(type) ?? 0) + 1);
      if (!first.has(type)) first.set(type, row.s);
    }
    expect(TWENTY_F_SYM_CENSUS.map((c) => c.type)).toEqual(
      SYM_TYPES.map((t) => t.name).filter((n) => hist.has(n)),
    );
    for (const cell of TWENTY_F_SYM_CENSUS) {
      expect(hist.get(cell.type), cell.type).toBe(cell.count);
      expect(first.get(cell.type), cell.type).toBe(cell.example);
    }
    expect(TWENTY_F_SYM_CENSUS.reduce((a, c) => a + c.count, 0)).toBe(TWENTY_F_SYM_TOTAL);
    // 33 个型里 9 个一条都没有 —— 页面上写了这句话
    expect(SYM_TYPES.length - TWENTY_F_SYM_CENSUS.length).toBe(9);
  });

  it('自身与逆同构的条数', () => {
    const n = SYM_ROWS.filter((r) => (antisymMask(applyAlgExtended(r.s).cube) & 1n) === 1n).length;
    expect(n).toBe(TWENTY_F_SYM_SELF_INVERSE);
  });

  it('对称型最高的那一条是 superflip(逐位验,不靠名气)', () => {
    const oh = SYM_ROWS.filter((r) => labelOf(r.s).split('{')[0] === 'Oh');
    expect(oh.length).toBe(1);
    expect(oh[0].s).toBe(TWENTY_F_SUPERFLIP);
    const c = applyAlgExtended(TWENTY_F_SUPERFLIP).cube;
    expect(c.cp.every((v, i) => v === i)).toBe(true);
    expect(c.co.every((v) => v === 0)).toBe(true);
    expect(c.ep.every((v, i) => v === i)).toBe(true);
    expect(c.eo.every((v) => v === 1)).toBe(true);
  });
});

describe('20 步态:1000 条随机态的开局难度', () => {
  const { dist } = computeEoCrossDist('Yellow');

  it('三个口径的直方图逐格复算', () => {
    const cross: Record<number, number> = {};
    const cn: Record<number, number> = {};
    const eo: Record<number, number> = {};
    for (const s of RANDOM_ROWS) {
      const c = crossLength(s, 'Yellow')!;
      cross[c] = (cross[c] ?? 0) + 1;
      const min = Math.min(...Object.values(allCrossLengths(s)!));
      cn[min] = (cn[min] ?? 0) + 1;
      const e = Math.min(dist[eoCrossIndex(s)!], dist[eoCrossAltAxisIndex(s)!]);
      eo[e] = (eo[e] ?? 0) + 1;
    }
    expect(RANDOM_ROWS.length).toBe(TWENTY_F_RANDOM_TOTAL);
    expect(cross).toEqual(TWENTY_F_RANDOM_CROSS);
    expect(cn).toEqual(TWENTY_F_RANDOM_CN_CROSS);
    expect(eo).toEqual(TWENTY_F_RANDOM_EOCROSS);
  });

  it('三个口径都比全空间难,且差距远超采样误差', () => {
    // 1000 条的均值标准误差 ~0.02 步,下面每一条的差都在 0.6 步以上
    for (const [hist, base] of [
      [TWENTY_F_RANDOM_CROSS, TWENTY_F_BASELINE.cross],
      [TWENTY_F_RANDOM_CN_CROSS, TWENTY_F_BASELINE.cnCross],
      [TWENTY_F_RANDOM_EOCROSS, TWENTY_F_BASELINE.eoCross],
    ] as [Record<number, number>, number][]) {
      expect(twentyFMean(hist) - base).toBeGreaterThan(0.6);
    }
  });

  it('十字一步就好的那条确有其事(整解仍要 20 步)', () => {
    expect(RANDOM_ROWS).toContain(TWENTY_F_EASY_CROSS.scramble);
    const sol = solveCross(TWENTY_F_EASY_CROSS.scramble, TWENTY_F_EASY_CROSS.color)!;
    expect(sol.length).toBe(1);
    expect(sol.moves.join(' ')).toBe(TWENTY_F_EASY_CROSS.moves);
    // 唯一一条:别的都 ≥ 4 步
    const under = RANDOM_ROWS.filter((s) => Math.min(...Object.values(allCrossLengths(s)!)) <= 3);
    expect(under).toEqual([TWENTY_F_EASY_CROSS.scramble]);
  });
});
