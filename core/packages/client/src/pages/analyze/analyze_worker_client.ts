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
 * Variant — F2L 阶段变体:
 *   'std'         — Standard:常规 cross / XCross / XXCross / XXXCross。
 *   'eo'          — EOCross:cross/xcross/... 同时剩余棱块色向正确(EO)。所有 stage 支持。
 *   'pair'        — Cross + Pair:cross/xcross/... 加 1 个 pair-ready 槽位。所有 stage 支持。
 *   'pseudo'      — Pseudo:cross 允许 D/D'/D2 偏移,corner/edge 索引独立(目前仅 stage=cross 支持 pCross)。
 *   'pseudo_pair' — Pseudo + Pair:pseudo cross + pair-ready,a_slot==a_pslot 匹配模式。所有 stage 支持。
 *
 * Stage — 第一阶段目标深度:
 *   'cross'    — 仅 cross / pCross。
 *   'xcross'   — cross + 1 pair。
 *   'xxcross'  — cross + 2 pair。
 *   'xxxcross' — cross + 3 pair。
 */
export type Variant = 'std' | 'eo' | 'pair' | 'pseudo' | 'pseudo_pair';
export type Stage = 'cross' | 'xcross' | 'xxcross' | 'xxxcross';

export interface AnalyzeRequest {
  scramble: string;
  crosscolors: Record<CrossColor, boolean>;
  howfar: Howfar;
  variant: Variant;
  stage: Stage;
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
  /** True when variant=std + stage=xcross requested but wasm produced 0 valid seeds → fell back to JS cross. */
  xcrossFallback?: boolean;
  /** True when the requested (variant, stage) combination isn't wired yet. UI shows a notice. */
  variantUnsupported?: boolean;
}

export type AnalyzeMessage = AnalyzeProgress | AnalyzeDone;

export interface AnalyzeHandlers {
  onProgress?: (p: AnalyzeProgress) => void;
  onDone: (s: Solution[], meta?: { xcrossFallback?: boolean; variantUnsupported?: boolean }) => void;
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
        handlers.onDone(data.finalSolutions, { xcrossFallback: data.xcrossFallback, variantUnsupported: data.variantUnsupported });
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
