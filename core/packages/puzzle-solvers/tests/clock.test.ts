/**
 * 魔表全空间距离分布表(`CLOCK_LENGTH_DISTRIBUTION`)的护栏。
 *
 * 这张表是**别人算出来的**(Rokicki 陪集法跑穿 12^14,表见 Jaap Scherphuis 的页面),本机重算
 * 不可能 —— 所以它是一段**誊抄进来的数据**,最大的现实风险不是数学错而是打字错。实测就抓到
 * 过:从截图读的 d=4 与 d=11 各错一位,和差 7。这里的判据都是常数级的恒等式,秒过,CI 常跑。
 *
 * 更强的两层证据不在这里(要跑求解器 / 大枚举,只在本机手动跑):
 *   `scripts/clock/verify_distribution.mts`  d ≤ 4 各档用本仓库自己的招式模型精确重算 + 抽样卡方
 *   `tests/clock_solver.test.ts`             全部 39,248 个 d=12 状态(CLOCK_DIST12_FULL=1)
 */
import { describe, expect, it } from 'vitest';
import {
  CLOCK_GODS_NUMBER, CLOCK_LENGTH_DISTRIBUTION, CLOCK_MEAN_LENGTH, CLOCK_STATE_COUNT,
  SOLVED_CLOCK, applyClockMoves, clockMovesToString, clockStateFromAlg, isClockSolved,
  parseClockMoves, solveClock,
} from '@cuberoot/puzzle-solvers/clock';

describe('Clock solver fast contract', () => {
  it('solves the solved state without adding moves', () => {
    const solution = solveClock(SOLVED_CLOCK());
    expect(solution).toEqual({ moves: [], length: 0, notation: '' });
  });

  it.each([
    'UR3+ DR2- DL1+ UL4- U2+ R1- D3+ L2- ALL5+ y2 U1- R2+ D3- L4+ ALL6+',
    'UR2+ y2 DL3-',
  ])('solves a representative state within God\'s number: %s', (alg) => {
    const state = clockStateFromAlg(alg);
    const solution = solveClock(state);
    expect(solution.length).toBeLessThanOrEqual(CLOCK_GODS_NUMBER);
    expect(isClockSolved(applyClockMoves(state, solution.moves))).toBe(true);
  });

  it('round-trips normalized move notation including y2', () => {
    const alg = 'UR3+ DR2- y2 U4+ ALL1-';
    expect(clockMovesToString(parseClockMoves(alg))).toBe(alg);
  });

  it('rejects a state whose paired corner dials disagree', () => {
    const state = SOLVED_CLOCK();
    state.posit[0] = 1;
    expect(() => solveClock(state)).toThrow(/illegal clock state/);
  });
});

describe('魔表全空间距离分布', () => {
  it('逐档求和 == 12^14(誊抄错一位就炸)', () => {
    const sum = CLOCK_LENGTH_DISTRIBUTION.reduce((a, b) => a + b, 0);
    expect(sum).toBe(12 ** 14);
    expect(CLOCK_STATE_COUNT).toBe(12 ** 14);
    // 12^14 ≈ 1.28e15 < 2^53:double 逐个整数都表示得下,上面的 === 才有意义。
    expect(Number.isSafeInteger(CLOCK_STATE_COUNT)).toBe(true);
  });

  it('档位范围 0..12,每档都是正整数', () => {
    expect(CLOCK_LENGTH_DISTRIBUTION.length).toBe(CLOCK_GODS_NUMBER + 1);
    for (const [d, n] of CLOCK_LENGTH_DISTRIBUTION.entries()) {
      expect(Number.isSafeInteger(n), `d=${d}`).toBe(true);
      expect(n, `d=${d}`).toBeGreaterThan(0);
    }
  });

  it('两端锚点:还原态唯一,最难那档 39,248 个(= Rokicki 公布的 dist12.txt 行数)', () => {
    expect(CLOCK_LENGTH_DISTRIBUTION[0]).toBe(1);
    expect(CLOCK_LENGTH_DISTRIBUTION[CLOCK_GODS_NUMBER]).toBe(39_248);
  });

  it('低档锚点:d ≤ 4 是 verify_distribution.mts 用自有招式模型精确重算过的那四个数', () => {
    expect(CLOCK_LENGTH_DISTRIBUTION.slice(1, 5)).toEqual([330, 51_651, 4_947_912, 317_141_342]);
  });

  it('均值 9.4337(Jaap 页面公布值),众数在 10', () => {
    expect(CLOCK_MEAN_LENGTH).toBeCloseTo(9.4337, 4);
    const mode = CLOCK_LENGTH_DISTRIBUTION.indexOf(Math.max(...CLOCK_LENGTH_DISTRIBUTION));
    expect(mode).toBe(10);
  });

  it('单峰:到众数为止单调增,之后单调减', () => {
    const d = CLOCK_LENGTH_DISTRIBUTION;
    for (let i = 1; i <= 10; i++) expect(d[i], `d=${i}`).toBeGreaterThan(d[i - 1]);
    for (let i = 11; i < d.length; i++) expect(d[i], `d=${i}`).toBeLessThan(d[i - 1]);
  });
});
