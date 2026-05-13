/**
 * Analyzer worker regression tests — runs the classic-worker JS inside a real
 * Node worker_threads thread (not vm sandbox) so JIT optimizes hot paths.
 *
 * Two workers under test:
 *   - 'fixed' (default) — public/analyze-worker/analyzer.js, our TS port with
 *     canonical opposite-pair ordering applied (de-duplicates the cross search).
 *   - 'legacy' — public/analyze-worker/ear.legacy.js, the upstream speedcubedb
 *     obfuscated worker, kept verbatim for byte-identical fallback.
 *
 * Worker bridging lives in tests/_analyzer_worker_runner.cjs (shims classic
 * worker globals: importScripts/postMessage/self/onmessage).
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC = path.resolve(__dirname, '..', 'public', 'analyze-worker');
const RUNNER = path.resolve(__dirname, '_analyzer_worker_runner.cjs');

interface AnalyzeResult {
  crossesCovered: number;
  pairsCovered: number;
  llCovered: number;
  solutions: Array<[number, string, unknown, string[]]>;
}

interface AnalyzeRequest {
  scramble: string;
  crosscolors: Record<string, boolean>;
  howfar: 1 | 2 | 3 | 4;
}

const ALL_COLORS = { Yellow: true, White: true, Red: true, Orange: true, Blue: true, Green: true };

async function runAnalyzer(variant: 'fixed' | 'legacy', req: AnalyzeRequest): Promise<AnalyzeResult> {
  const workerFile = variant === 'fixed' ? 'analyzer.js' : 'ear.legacy.js';
  const w = new Worker(RUNNER, {
    workerData: { publicDir: PUBLIC, workerFile },
  });

  const messages: Array<Record<string, unknown>> = [];
  return new Promise<AnalyzeResult>((resolve, reject) => {
    w.on('message', (m: Record<string, unknown>) => {
      messages.push(m);
      if (m.finalSolutions !== undefined) {
        const last = <K extends string>(key: K) =>
          messages.filter((x) => x[key] !== undefined).pop()?.[key];
        w.terminate().then(() =>
          resolve({
            crossesCovered: (last('totalnumcross') as number) ?? 0,
            pairsCovered: (last('pairscovered') as number) ?? 0,
            llCovered: (last('llcovered') as number) ?? 0,
            solutions: (last('finalSolutions') as AnalyzeResult['solutions']) ?? [],
          }),
        );
      }
    });
    w.on('error', (err) => {
      w.terminate().finally(() => reject(err));
    });
    w.postMessage(req);
  });
}

const REFERENCE_SCRAMBLE = "B2 L F' U R' D R' F2 D L R2 D R B' D' L2 D2 R' U'";

describe('analyzer worker — legacy (upstream byte-identical)', () => {
  it('reference scramble totals match speedcubedb (53/7457/42664/21380)', async () => {
    const r = await runAnalyzer('legacy', {
      scramble: REFERENCE_SCRAMBLE,
      crosscolors: ALL_COLORS,
      howfar: 4,
    });
    expect(r.crossesCovered).toBe(53);
    expect(r.pairsCovered).toBe(7457);
    expect(r.llCovered).toBe(42664);
    expect(r.solutions.length).toBe(21380);
  });
});

describe('analyzer worker — fixed (canonical opposite-pair ordering)', () => {
  it('reference scramble: totals snapshot (locked 2026-05-13 post-canonical-prune)', async () => {
    const fixed = await runAnalyzer('fixed', {
      scramble: REFERENCE_SCRAMBLE,
      crosscolors: ALL_COLORS,
      howfar: 4,
    });
    // Counts are LARGER than legacy 53/7457/42664/21380 — not because we added
    // duplicates, but because canonical pruning changes the heap pop order so
    // some colors' "first found cross" lands at a deeper depth, which then
    // raises that color's dynamic maxDepth (max(5, first_depth + 2)) and pulls
    // in more crosses overall. The dedup is genuine — see the R L U R' test
    // below for the per-path semantic check.
    expect(fixed.crossesCovered).toBe(84);
    expect(fixed.pairsCovered).toBe(8569);
    expect(fixed.llCovered).toBe(48729);
    expect(fixed.solutions.length).toBe(24420);
  });

  it('R L U R\' yellow-only: opposite-pair duplicate `R\' L\' R` no longer appears', async () => {
    const req: AnalyzeRequest = {
      scramble: "R L U R'",
      crosscolors: { Yellow: true, White: false, Red: false, Orange: false, Blue: false, Green: false },
      howfar: 1,
    };
    const [fixed, legacy] = await Promise.all([
      runAnalyzer('fixed', req),
      runAnalyzer('legacy', req),
    ]);

    const containsSubseq = (sols: AnalyzeResult['solutions'], needle: string) =>
      sols.some((s) => s[1].includes(needle));

    expect(containsSubseq(legacy.solutions, "R' L' R")).toBe(true);
    expect(containsSubseq(fixed.solutions, "R' L' R")).toBe(false);
  });
});
