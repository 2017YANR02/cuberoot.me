import { describe, expect, it, vi } from 'vitest';
import type { RustCrossPool } from '@/lib/rust-cross-client';
import { solveStageQuestion } from '@/app/[lang]/timer/_lib/stage-training-engine';
import type { StageTrainingConfig } from '@/app/[lang]/timer/_lib/stage-training';

const config = (patch: Partial<StageTrainingConfig> = {}): StageTrainingConfig => ({
  stage: 'cross',
  colors: 'Y',
  slot: 'best',
  ...patch,
});

describe('solveStageQuestion', () => {
  it('chooses the best selected colour and removes the solver view rotation', async () => {
    const solveFace = vi.fn(async (_scramble: string, _stage: number, face: number) => ({
      value: face === 1 ? 2 : 5,
      ms: 1,
    }));
    const solveMoves = vi.fn(async (_scramble: string, _stage: number, face: number) => ({
      len: 2,
      sols: [{ m: face === 1 ? 'z2 R U' : 'R U', c: '' }],
      ms: 1,
    }));
    const pool = { solveFace, solveMoves } as unknown as RustCrossPool;

    const question = await solveStageQuestion(pool, "F R U'", config({ colors: 'YW' }));
    expect(question).toMatchObject({ optimal: 2, face: 1, solution: 'L D', scrambleLength: 3 });
    expect(solveFace).toHaveBeenCalledTimes(2);
    expect(solveMoves).toHaveBeenCalledTimes(1);
  });

  it('collapses a meaningless multi-colour fixed slot to best-slot semantics', async () => {
    const solveFace = vi.fn(async (_scramble: string, _stage: number, face: number) => ({ value: face === 0 ? 5 : 6, ms: 1 }));
    const solveMoves = vi.fn(async (_scramble: string, _stage: number, face: number, opts: { combo?: string }) => ({
      len: 5,
      sols: [{ m: face === 0 ? "R U R' U R2" : "z2 R U R' U R2", c: 'BL FR' }],
      ms: 1,
      opts,
    }));
    const pool = { solveFace, solveMoves } as unknown as RustCrossPool;

    const question = await solveStageQuestion(pool, 'R U F2 D L2 B', config({
      stage: 'xxcross',
      colors: 'YW',
      // Multiple colours intentionally collapse to best-slot semantics.
      slot: 1,
    }));
    expect(question?.face).toBe(0);
    expect(solveFace).toHaveBeenCalledTimes(2);
    expect(solveMoves).toHaveBeenCalledWith('R U F2 D L2 B', 2, 0, { extra: 0, cap: 1 });
  });

  it('uses the requested fixed slot for a single colour', async () => {
    const solveMoves = vi.fn(async (_scramble: string, _stage: number, _face: number, opts: { combo?: string }) => ({
      len: 4,
      sols: [{ m: "R U R' U'", c: 'BL FR' }],
      ms: 1,
      opts,
    }));
    const pool = { solveMoves } as unknown as RustCrossPool;
    const question = await solveStageQuestion(pool, 'F R U B', config({ stage: 'xxcross', slot: 1 }));

    expect(question?.optimal).toBe(4);
    expect(solveMoves).toHaveBeenCalledWith('F R U B', 2, 0, { extra: 0, cap: 1, combo: '0,2' });
  });
});
