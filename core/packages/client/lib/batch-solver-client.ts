/**
 * 主线程侧创建 Batch Solver worker(/scramble/batch-solver 与 /scramble/sub-solver 共用)。
 */
export function createBatchSolverWorker(): Worker {
  return new Worker(new URL('./batch-solver.worker.ts', import.meta.url), { type: 'module' });
}
