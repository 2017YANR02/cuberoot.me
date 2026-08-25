/**
 * Pattern Search 的 Web Worker:跑 _pattern_core 的 DFS,流式回传结果。
 *
 * Find Generators 勾选时,先建 kociemba two-phase 表(~3-5s,一次性),
 * 每个结果附带生成公式(从复原态拧出该图案的转动序列 = 求解序列取逆,
 * 与 Cube Explorer 主窗口对每个找到的 cube 自动跑 two-phase 一致)。
 *
 * 停止:主线程直接 worker.terminate()(上游 Stop Search 同为硬中断)。
 *
 * Protocol:
 *   Req:  { op:'start', patterns, faceAssign, continuous, findGenerators, maxResults }
 *   Res:  { type:'phase', phase:'tables' }             // 建表中提示
 *         { type:'result', facelet, generator? }       // 每个去重后的结果
 *         { type:'progress', nodes, found }
 *         { type:'done', nodes, found, truncated }
 *         { type:'error', message }
 */

/// <reference lib="webworker" />

import { searchPatterns, type FaceAssign, type PatternFace } from './_pattern_core';
import { faceletToCubie } from '@/lib/cube-facelet';
import { formatMoves, invertSequence } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { buildMoveTables, type MoveTables } from '@cuberoot/puzzle-solvers/kociemba/movetables';
import { buildPruneTables, type PruneTables } from '@cuberoot/puzzle-solvers/kociemba/prune';
import { solveCube } from '@cuberoot/puzzle-solvers/kociemba/search';

export interface StartReq {
  op: 'start';
  patterns: PatternFace[];
  faceAssign: FaceAssign;
  continuous: boolean;
  findGenerators: boolean;
  maxResults: number;
}

export type WorkerRes =
  | { type: 'phase'; phase: 'tables' }
  | { type: 'result'; facelet: string; generator?: string }
  | { type: 'progress'; nodes: number; found: number }
  | { type: 'done'; nodes: number; found: number; truncated: boolean }
  | { type: 'error'; message: string };

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
const post = (res: WorkerRes) => ctx.postMessage(res);

let mt: MoveTables | null = null;
let pt: PruneTables | null = null;

ctx.addEventListener('message', (ev: MessageEvent<StartReq>) => {
  const req = ev.data;
  if (req.op !== 'start') return;
  try {
    if (req.findGenerators && (!mt || !pt)) {
      post({ type: 'phase', phase: 'tables' });
      mt = buildMoveTables();
      pt = buildPruneTables(mt);
    }
    const stats = searchPatterns(
      {
        patterns: req.patterns,
        faceAssign: req.faceAssign,
        continuous: req.continuous,
        maxResults: req.maxResults,
      },
      {
        onResult: (facelet) => {
          let generator: string | undefined;
          if (req.findGenerators && mt && pt) {
            try {
              const sol = solveCube(faceletToCubie(facelet), mt, pt, { timeoutMs: 2000 });
              generator = formatMoves(invertSequence(sol));
            } catch { /* 求解失败不拦结果 */ }
          }
          post({ type: 'result', facelet, generator });
        },
        onProgress: (nodes, found) => post({ type: 'progress', nodes, found }),
      },
    );
    post({ type: 'done', nodes: stats.nodes, found: stats.found, truncated: stats.truncated });
  } catch (e: unknown) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
});

export {};
