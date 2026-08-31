import { describe, expect, it } from 'vitest';

import {
  METHOD_REGISTRY,
  scheduleTimer333StepSolve,
  solveByMethodId,
  timer333MethodLabel,
  timer333StageLabel,
  type MethodId,
  type Timer333StepSolveOutcome,
} from '../src/timer-333-step';

const SCRAMBLE = "R U R' U'";

const GOLDEN = {
  cfop: {
    stages: [
      { head: 'Cross', moves: [] },
      { head: 'F2L-1', moves: [] },
      { head: 'F2L-2', moves: [] },
      { head: 'F2L-3', moves: [] },
      { head: 'F2L-4', moves: ['U ', 'R ', "U'", "R'"] },
    ],
    totalMoves: 4,
  },
  roux: {
    stages: [
      { head: 'Step 1', moves: [] },
      { head: 'Step 2', moves: ['U ', 'R ', "U'", "R'"] },
    ],
    totalMoves: 4,
  },
  petrus: {
    stages: [
      { head: '2x2x2', moves: [] },
      { head: '2x2x3', moves: [] },
    ],
    totalMoves: 0,
  },
  zz: {
    stages: [
      { head: 'EOLine', moves: [] },
      { head: 'ZZF2L1', moves: [] },
      { head: 'ZZF2L2', moves: ['U ', 'R ', "U'", "R'"] },
    ],
    totalMoves: 4,
  },
  eodr: {
    stages: [
      { head: 'EO', moves: [] },
      { head: 'DR', moves: ['U ', 'R ', "U'", 'R '] },
    ],
    totalMoves: 4,
  },
  thistle: {
    stages: [
      { head: 'EO', moves: [] },
      { head: 'DR', moves: ['U ', 'R ', "U'", 'R '] },
      { head: 'Finish', moves: ['R2'] },
    ],
    totalMoves: 5,
  },
} as const;

describe('Timer 3x3 step solver contract', () => {
  it('locks the six Web methods and their exact stage/move output', () => {
    expect(METHOD_REGISTRY.map((method) => method.id)).toEqual([
      'cfop', 'roux', 'petrus', 'zz', 'eodr', 'thistle',
    ]);
    for (const method of METHOD_REGISTRY) {
      expect(solveByMethodId(SCRAMBLE, method.id)).toEqual(GOLDEN[method.id]);
    }
  });

  it('owns bilingual method and stage labels without changing engine IDs', () => {
    expect(timer333MethodLabel(METHOD_REGISTRY[1], 'zh-Hans')).toBe('桥式方法');
    expect(timer333MethodLabel(METHOD_REGISTRY[2], 'en')).toBe('Petrus');
    expect(timer333StageLabel('roux', 'Step 1', 'zh')).toBe('左桥');
    expect(timer333StageLabel('thistle', 'Finish', 'zh-Hans')).toBe('还原');
    expect(timer333StageLabel('cfop', 'future-stage', 'en')).toBe('future-stage');
  });

  it('never publishes a cancelled or stale scheduled solve', () => {
    let oldRun: (() => void) | null = null;
    let newRun: (() => void) | null = null;
    let oldUnscheduled = false;
    const outcomes: Array<{ request: string; outcome: Timer333StepSolveOutcome }> = [];

    const cancelOld = scheduleTimer333StepSolve(
      { methodId: 'cfop', scramble: SCRAMBLE },
      (outcome) => outcomes.push({ request: 'old', outcome }),
      (run) => {
        oldRun = run;
        return () => { oldUnscheduled = true; };
      },
    );
    scheduleTimer333StepSolve(
      { methodId: 'petrus', scramble: SCRAMBLE },
      (outcome) => outcomes.push({ request: 'new', outcome }),
      (run) => {
        newRun = run;
        return () => undefined;
      },
    );

    cancelOld();
    oldRun!();
    newRun!();
    expect(oldUnscheduled).toBe(true);
    expect(outcomes).toEqual([{ request: 'new', outcome: { status: 'ready', result: GOLDEN.petrus } }]);
  });

  it('reports execution errors instead of forging an empty solved result', () => {
    let run: (() => void) | null = null;
    const outcomes: Timer333StepSolveOutcome[] = [];
    scheduleTimer333StepSolve(
      { methodId: 'invalid' as MethodId, scramble: SCRAMBLE },
      (outcome) => outcomes.push(outcome),
      (next) => {
        run = next;
        return () => undefined;
      },
    );
    run!();
    expect(outcomes).toEqual([{ status: 'error', error: 'unknown method: invalid' }]);
  });
});
