/**
 * @module pages/analyze/analyze_worker_client
 *
 * Thin typed wrapper around the analyze Worker.
 * The Worker source lives at /analyze-worker/{ear,boohoo,hs,zbh}.js — bundled
 * verbatim from speedcubedb.com's `/earphones/*.js` pipeline (host-gate stripped
 * in ear.js so it runs off-cubedb). All CFOP enumeration logic happens there;
 * this file only handles the message protocol.
 */

export type CrossColor = 'Yellow' | 'White' | 'Blue' | 'Green' | 'Red' | 'Orange';

export const CROSS_COLORS: readonly CrossColor[] = ['White', 'Yellow', 'Red', 'Orange', 'Blue', 'Green'];

/** howfar: 4=Full Solve, 3=Cross+3, 2=Cross+2, 1=Cross+1 (matches the upstream <select>). */
export type Howfar = 1 | 2 | 3 | 4;

export interface AnalyzeRequest {
  scramble: string;
  crosscolors: Record<CrossColor, boolean>;
  howfar: Howfar;
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
}

export type AnalyzeMessage = AnalyzeProgress | AnalyzeDone;

export interface AnalyzeHandlers {
  onProgress?: (p: AnalyzeProgress) => void;
  onDone: (s: Solution[]) => void;
  onError?: (e: ErrorEvent | Error) => void;
}

export class Analyzer {
  private worker: Worker | null = null;
  // Each start() bumps the generation; stale messages from terminated workers are ignored.
  private generation = 0;

  start(req: AnalyzeRequest, handlers: AnalyzeHandlers): void {
    this.terminate();
    const gen = ++this.generation;
    const w = new Worker('/analyze-worker/ear.js');
    this.worker = w;
    const isCurrent = () => gen === this.generation;
    w.onmessage = (e: MessageEvent<AnalyzeMessage>) => {
      if (!isCurrent()) return;
      const data = e.data;
      if ('finalSolutions' in data) {
        handlers.onDone(data.finalSolutions);
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
