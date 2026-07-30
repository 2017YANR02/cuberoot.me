/**
 * 对称搜索的 Web Worker:跑 _sym_search 的 DFS,流式回传结果。
 *
 * 两段式:DFS 很快,先把状态一个个推给主线程;等搜完再建 kociemba two-phase 表
 * 并逐个求生成公式(= 求解序列取逆),用 generator 消息回填。求解一个状态可能要
 * 几百毫秒,放在 DFS 里会把出结果这件事整个卡住。
 *
 * 停止:主线程直接 worker.terminate()(上游 Stop Search 同为硬中断)。
 */

/// <reference lib="webworker" />

import { searchSymmetric, type PermMode } from './_sym_search';
import { faceletToCubie } from '@/lib/cube-facelet';
import { formatMoves, invertSequence } from '../solver/_kociemba/cube';
import { buildMoveTables, type MoveTables } from '../solver/_kociemba/movetables';
import { buildPruneTables, type PruneTables } from '../solver/_kociemba/prune';
import { solveCube } from '../solver/_kociemba/search';

export interface StartReq {
  op: 'start';
  /** bigint 不能直接结构化克隆到 worker,用十进制字符串传。 */
  symMask: string;
  asymMask: string;
  exactSym: boolean;
  exactAsym: boolean;
  noSelfInverse: boolean;
  colorCounts: boolean[];
  permMode: PermMode;
  continuous: boolean;
  allowIsomorphics: boolean;
  isoIncludeInverse: boolean;
  findGenerators: boolean;
  maxResults: number;
}

export type WorkerRes =
  | { type: 'phase'; phase: 'tables' | 'generators' }
  | { type: 'result'; facelet: string }
  | { type: 'generator'; index: number; generator: string }
  | { type: 'progress'; nodes: number; found: number }
  | { type: 'searched'; nodes: number; found: number; truncated: boolean }
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
    const found: string[] = [];
    const stats = searchSymmetric(
      {
        symMask: BigInt(req.symMask),
        asymMask: BigInt(req.asymMask),
        exactSym: req.exactSym,
        exactAsym: req.exactAsym,
        noSelfInverse: req.noSelfInverse,
        colorCounts: req.colorCounts,
        permMode: req.permMode,
        continuous: req.continuous,
        allowIsomorphics: req.allowIsomorphics,
        isoIncludeInverse: req.isoIncludeInverse,
        maxResults: req.maxResults,
      },
      {
        onResult: (facelet) => {
          found.push(facelet);
          post({ type: 'result', facelet });
        },
        onProgress: (nodes, n) => post({ type: 'progress', nodes, found: n }),
      },
    );
    post({ type: 'searched', nodes: stats.nodes, found: stats.found, truncated: stats.truncated });

    if (req.findGenerators && found.length > 0) {
      if (!mt || !pt) {
        post({ type: 'phase', phase: 'tables' });
        mt = buildMoveTables();
        pt = buildPruneTables(mt);
      }
      post({ type: 'phase', phase: 'generators' });
      for (let i = 0; i < found.length; i++) {
        try {
          // hardTimeout:少数高度对称的状态 phase-1 出解很晚,不卡死这一层
          // 单个状态能吃掉几十秒。宁可它没公式,也不让整批停在那儿。
          const sol = solveCube(faceletToCubie(found[i]), mt, pt, { timeoutMs: 800, hardTimeout: true });
          post({ type: 'generator', index: i, generator: formatMoves(invertSequence(sol)) });
        } catch { /* 超时 / 无解都不拦结果 */ }
      }
    }
    post({ type: 'done', nodes: stats.nodes, found: stats.found, truncated: stats.truncated });
  } catch (e: unknown) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
});

export {};
