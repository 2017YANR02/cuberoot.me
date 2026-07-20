/**
 * lib/batch-solver.ts 的回归锁:golden fixture 由一次性 harness 对上游
 * BatchSolver/worker.js 原文逐消息对拍生成(上游 clone 在 D:\cube\trangium.github.io)。
 * fixture 只能重新对拍上游后重生成,禁止手改;改动引擎导致本测试红 = 破坏了移植等价性。
 */
import { describe, expect, it } from 'vitest';
import {
  runBatchSolver,
  compareBufferElements,
  getMoveCount,
  moveEsq,
  moveSqtm,
  moveStm,
  parseESQ,
  removeParens,
  BATCH_RANK_ESQ_DEFAULT,
  type BatchSolverInput,
  type BatchSolverMessage,
} from '@/lib/batch-solver';
import golden from './fixtures/batch_solver_golden.json';

type NormMessage = { type: string; value: unknown };

function normalize(m: BatchSolverMessage): NormMessage {
  if (m.type === 'moveWeights') {
    return { type: m.type, value: Array.from((m.value as Map<string, number>).entries()) };
  }
  return { type: m.type, value: m.value };
}

function truncateAtStop(messages: NormMessage[]): NormMessage[] {
  const idx = messages.findIndex((m) => m.type === 'stop');
  return idx === -1 ? messages : messages.slice(0, idx + 1);
}

describe('batch-solver golden lock', () => {
  it('has the expected scenario battery', () => {
    expect(golden.scenarios.length).toBe(14);
  });

  for (const scenario of golden.scenarios) {
    it(`replays scenario: ${scenario.name}`, () => {
      const messages: NormMessage[] = [];
      runBatchSolver(scenario.input as BatchSolverInput, (m) => messages.push(normalize(m)));
      expect(truncateAtStop(messages)).toEqual(scenario.messages);
    });
  }
});

describe('batch-solver UI-side metrics', () => {
  const weights = parseESQ(BATCH_RANK_ESQ_DEFAULT);

  it('counts moves per metric, skipping adjust parens', () => {
    const alg = "(U) R U R' U' (U')";
    expect(getMoveCount(alg, moveStm)).toBe(4);
    expect(getMoveCount("R U2 R'", moveSqtm)).toBe(4);
    expect(getMoveCount("R U2 R'", (m) => moveEsq(m, weights))).toBe(1 + 3 + 1);
    expect(removeParens(alg)).toBe("R U R' U'");
  });

  it('sorts primary metric, then bracketed secondary, then alg text', () => {
    expect(compareBufferElements([10, 'B'], [11, 'A'])).toBe(-1);
    expect(compareBufferElements(['NaN', 'B'], [11, 'A'])).toBe(1);
    expect(compareBufferElements([10, 'R U [12 STM]'], [10, 'A B [11 STM]'])).toBe(1);
    expect(compareBufferElements([10, "(U) A'"], [10, "A' (U2)"])).toBe(0);
  });
});
