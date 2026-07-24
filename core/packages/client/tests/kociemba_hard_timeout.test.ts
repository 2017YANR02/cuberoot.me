/**
 * kociemba two-phase 的硬超时(SolveOptions.hardTimeout)回归。
 *
 * 背景:`timeoutMs` 原本只在 phase-1 出解的回调里查一次时钟,IDA 节点循环里
 * 从不查。高度对称的状态(/scramble/symmetry 批量求生成公式时成批出现)可能
 * 在某个深度层里搜几十秒都不产出 phase-1 解,预算形同虚设。hardTimeout 打开
 * 后在节点循环里按节点计数查表,超时立刻层层退出。
 *
 * 这里同时锁住两件事:超时真的生效,以及超时用的模块级状态不会漏给下一次调用。
 */
import { describe, it, expect } from 'vitest';
import { applySequence, parseMoves, solvedCubie } from '@/app/[lang]/scramble/solver/_kociemba/cube';
import { buildMoveTables } from '@/app/[lang]/scramble/solver/_kociemba/movetables';
import { buildPruneTables } from '@/app/[lang]/scramble/solver/_kociemba/prune';
import { solveCube } from '@/app/[lang]/scramble/solver/_kociemba/search';

const SCRAMBLE = "D2 R' D' F2 B D R2 D2 R' F2 D' F2 U' B2 L2 U2 D R2 U";

describe('kociemba hardTimeout', () => {
  const mt = buildMoveTables();
  const pt = buildPruneTables(mt);
  const state = () => applySequence(solvedCubie(), parseMoves(SCRAMBLE));

  it('aborts promptly when the budget is exhausted', () => {
    const t0 = Date.now();
    expect(() => solveCube(state(), mt, pt, { timeoutMs: 1, hardTimeout: true }))
      .toThrow(/timed out/);
    // 只在节点循环里查表,所以不是精确的 1ms;真正要卡住的是"别跑到几十秒"。
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('leaves no deadline behind for the next solve', () => {
    // 上一条用例已经把模块级 aborted/deadline 置过位;这次不开 hardTimeout,
    // 必须照常搜到解,否则说明状态漏了。
    const sol = solveCube(state(), mt, pt);
    expect(sol.length).toBeGreaterThan(0);
    expect(sol.length).toBeLessThanOrEqual(23);
  });

  it('still solves within a generous hard budget', () => {
    const sol = solveCube(state(), mt, pt, { timeoutMs: 5000, hardTimeout: true });
    expect(sol.length).toBeLessThanOrEqual(23);
  });
});
