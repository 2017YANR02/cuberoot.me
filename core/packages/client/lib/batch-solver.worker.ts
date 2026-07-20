/**
 * Batch Solver 引擎的 Web Worker 壳:收到输入即同步跑完整批量求解,
 * 进度/解/错误逐条 postMessage(对应上游 BatchSolver/worker.js 的消息协议)。
 * 主线程通过 terminate() 中断(与上游一致)。
 */
import { runBatchSolver, type BatchSolverInput } from './batch-solver';

self.onmessage = (e: MessageEvent<BatchSolverInput>) => {
  runBatchSolver(e.data, (m) => {
    (self as unknown as Worker).postMessage(m);
  });
};
