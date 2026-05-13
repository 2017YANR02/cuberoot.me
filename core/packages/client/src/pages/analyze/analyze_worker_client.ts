/**
 * @module pages/analyze/analyze_worker_client
 *
 * Thin typed wrapper around the analyze Worker. Two implementations
 * live side-by-side, switchable via URL flag `?worker=`:
 *   - 'ts' (default) — Vite-bundled TS port at worker/analyzer.worker.ts.
 *     Cube model + dictionaries still come from the legacy data files via
 *     importScripts so recognition stays byte-identical to upstream.
 *     MUST be a classic worker (importScripts is classic-only); we use
 *     `new Worker(new URL(...))` without `{type:'module'}` to ensure that.
 *   - 'legacy' — speedcubedb's original obfuscated worker, kept verbatim at
 *     /analyze-worker/ear.legacy.js for reference / fallback.
 */

export type CrossColor = 'Yellow' | 'White' | 'Blue' | 'Green' | 'Red' | 'Orange';

export const CROSS_COLORS: readonly CrossColor[] = ['White', 'Yellow', 'Red', 'Orange', 'Blue', 'Green'];

/** howfar: 4=Full Solve, 3=Cross+3, 2=Cross+2, 1=Cross+1 (matches the upstream <select>). */
export type Howfar = 1 | 2 | 3 | 4;

/**
 * stage1 = 第一阶段目标。crossSolver.wasm 在 F2L mode 跑真 IDA*+pruning。
 *   'cross'    — JS NxNCrossPlanner 启发式 (legacy)。
 *   'xcross'   — wasm: cross + 1 pair, 含最优 + 最优+1 步的多个候选。
 *   'xxcross'  — wasm: cross + 2 pair, 每个 slot 组合只取最优 (6 个 slot 组合)。
 *   'xxxcross' — wasm: cross + 3 pair, 每个 slot 组合只取最优 (4 个 slot 组合)。
 * 输出 state 含对应 pair 数,F2LPlanner 从该状态继续(满足 howfar 时直接 emit)。
 *
 * pseudo (request 上的独立 flag): 放宽底层 2 层 ↔ 中心面 AUF 对齐 (center_offset
 * {0, y, y2, y'})。worker 用 y/y2/y' 旋转把底层"归位"后再交给 F2L,对下游
 * F2L/OLL/PLL 识别透明,归位旋转计 0 HTM。仅保留真伪 (Δ≠0) 解;Δ=0 的退化为
 * 非伪模式已有结果,会被剔除。pseudo 仅对 wasm 三档 (xcross/xxcross/xxxcross)
 * 以及 cross (作为 pseudo cross 单独走 wasm) 有效。
 */
export type Stage1 = 'cross' | 'xcross' | 'xxcross' | 'xxxcross';

export interface AnalyzeRequest {
  scramble: string;
  crosscolors: Record<CrossColor, boolean>;
  howfar: Howfar;
  stage1: Stage1;
  pseudo?: boolean;
}

/** One CFOP solution: [etm, alg, state, stages] — stages contains 'OLL' / 'PLL' markers. */
export type Solution = [number, string, unknown, string[]];

export interface AnalyzeProgress {
  totalnumcross?: number;
  pairscovered?: number;
  llcovered?: number;
}

export interface AnalyzeDone {
  finalSolutions: Solution[];
  /** True when stage1=xcross requested but wasm produced 0 valid xcross seeds → fell back to cross. */
  xcrossFallback?: boolean;
}

export type AnalyzeMessage = AnalyzeProgress | AnalyzeDone;

export interface AnalyzeHandlers {
  onProgress?: (p: AnalyzeProgress) => void;
  onDone: (s: Solution[], meta?: { xcrossFallback?: boolean }) => void;
  onError?: (e: ErrorEvent | Error) => void;
}

export type WorkerVariant = 'ts' | 'legacy';

function spawnWorker(variant: WorkerVariant): Worker {
  if (variant === 'legacy') return new Worker('/analyze-worker/ear.legacy.js');
  // NOTE: classic worker (no `{type:'module'}`) — analyzer.js uses importScripts,
  // and the legacy data files (boohoo.js et al.) rely on implicit-global assignment
  // that only works in sloppy mode. The .js sits in public/ verbatim, NOT bundled
  // through Vite, to avoid module-strict-mode interference.
  return new Worker('/analyze-worker/analyzer.js');
}

export class Analyzer {
  private worker: Worker | null = null;
  // Each start() bumps the generation; stale messages from terminated workers are ignored.
  private generation = 0;

  start(req: AnalyzeRequest, handlers: AnalyzeHandlers, variant: WorkerVariant = 'ts'): void {
    this.terminate();
    const gen = ++this.generation;
    const w = spawnWorker(variant);
    this.worker = w;
    const isCurrent = () => gen === this.generation;
    w.onmessage = (e: MessageEvent<AnalyzeMessage>) => {
      if (!isCurrent()) return;
      const data = e.data;
      if ('finalSolutions' in data) {
        handlers.onDone(data.finalSolutions, { xcrossFallback: data.xcrossFallback });
        this.terminate();
      } else {
        handlers.onProgress?.(data);
      }
    };
    w.onerror = (err) => {
      if (!isCurrent()) return;
      handlers.onError?.(err);
      this.terminate();
    };
    w.postMessage(req);
  }

  terminate(): void {
    this.generation++;
    this.worker?.terminate();
    this.worker = null;
  }
}

export type Category = 'full-step' | 'oll-skip' | 'pll-skip' | 'll-skip';

/**
 * Match upstream speedcubedb counting: oll-skip / pll-skip are INCLUSIVE — a
 * solution missing both stages counts toward all three of oll-skip, pll-skip,
 * and ll-skip. So full + oll-skip-only + pll-skip-only + ll-skip = total, but
 * the UI filter chips show oll-skip = oll-only + ll-skip and likewise for pll.
 */
export function matchesCategory(stages: string[], cat: Category | 'all'): boolean {
  if (cat === 'all') return true;
  const hasOll = stages.includes('OLL');
  const hasPll = stages.includes('PLL');
  if (cat === 'full-step') return hasOll && hasPll;
  if (cat === 'oll-skip') return !hasOll;
  if (cat === 'pll-skip') return !hasPll;
  return !hasOll && !hasPll;
}
