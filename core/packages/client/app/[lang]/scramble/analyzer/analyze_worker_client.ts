'use client';

/**
 * Ported verbatim from packages/client-vite/src/pages/analyze/analyze_worker_client.ts.
 * Spawns a classic worker out of /analyze-worker/analyzer.js so importScripts
 * can pull in the legacy data files (boohoo.js / hs.js / zbh.js).
 */

export type CrossColor = 'Yellow' | 'White' | 'Blue' | 'Green' | 'Red' | 'Orange';

export const CROSS_COLORS: readonly CrossColor[] = ['White', 'Yellow', 'Red', 'Orange', 'Blue', 'Green'];

export type Howfar = 1 | 2 | 3 | 4;
export type Variant = 'std' | 'eo' | 'pair' | 'pseudo' | 'pseudo_pair';
export type Stage = 'cross' | 'xcross' | 'xxcross' | 'xxxcross';

export interface AnalyzeRequest {
  scramble: string;
  crosscolors: Record<CrossColor, boolean>;
  howfar: Howfar;
  variant: Variant;
  stage: Stage;
}

export type Solution = [number, string, unknown, string[]];

export interface AnalyzeProgress {
  totalnumcross?: number;
  pairscovered?: number;
  llcovered?: number;
}

export interface AnalyzeDone {
  finalSolutions: Solution[];
  xcrossFallback?: boolean;
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
  return new Worker('/analyze-worker/analyzer.js');
}

export class Analyzer {
  private worker: Worker | null = null;
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

export function matchesCategory(stages: string[], cat: Category | 'all'): boolean {
  if (cat === 'all') return true;
  const hasOll = stages.includes('OLL');
  const hasPll = stages.includes('PLL');
  if (cat === 'full-step') return hasOll && hasPll;
  if (cat === 'oll-skip') return !hasOll;
  if (cat === 'pll-skip') return !hasPll;
  return !hasOll && !hasPll;
}
