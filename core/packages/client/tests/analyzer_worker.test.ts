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
  variant?: 'std' | 'eo' | 'pair' | 'pseudo' | 'pseudo_pair';
  stage?: 'cross' | 'xcross' | 'xxcross' | 'xxxcross';
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

  it('xcross via wasm: white-only on WR avg seed yields valid xcross moves (cross+1pair solved)', async () => {
    const r = await runAnalyzer('fixed', {
      scramble: REFERENCE_SCRAMBLE,
      crosscolors: { Yellow: false, White: true, Red: false, Orange: false, Blue: false, Green: false },
      howfar: 1,
      variant: 'std',
      stage: 'xcross',
    });
    expect(r.solutions.length).toBeGreaterThan(0);
    const first = r.solutions[0];
    expect(first[3]).toEqual([]);
    expect(first[1]).toMatch(/White XCross \[(BL|BR|FR|FL)\]/);
    expect(first[0]).toBeGreaterThan(0);
    expect(first[0]).toBeLessThan(20);
  }, 30_000);

  it('xxcross via wasm: white-only yields valid xxcross moves (cross+2pair solved)', async () => {
    const r = await runAnalyzer('fixed', {
      scramble: REFERENCE_SCRAMBLE,
      crosscolors: { Yellow: false, White: true, Red: false, Orange: false, Blue: false, Green: false },
      howfar: 2,
      variant: 'std',
      stage: 'xxcross',
    });
    expect(r.solutions.length).toBeGreaterThan(0);
    const first = r.solutions[0];
    expect(first[3]).toEqual([]);
    expect(first[1]).toMatch(/White XXCross \[\w+ \w+\]/);
    expect(first[0]).toBeGreaterThan(0);
    expect(first[0]).toBeLessThan(25);
  }, 60_000);

  it('xxxcross via wasm: white-only yields valid xxxcross moves (cross+3pair solved)', async () => {
    const r = await runAnalyzer('fixed', {
      scramble: REFERENCE_SCRAMBLE,
      crosscolors: { Yellow: false, White: true, Red: false, Orange: false, Blue: false, Green: false },
      howfar: 3,
      variant: 'std',
      stage: 'xxxcross',
    });
    expect(r.solutions.length).toBeGreaterThan(0);
    const first = r.solutions[0];
    expect(first[3]).toEqual([]);
    expect(first[1]).toMatch(/White XXXCross \[\w+ \w+ \w+\]/);
    expect(first[0]).toBeGreaterThan(0);
    expect(first[0]).toBeLessThan(30);
  }, 120_000);

  it('pseudo cross via wasm: WR seed white-only emits at least one Δ≠0 pCross solution', async () => {
    // pseudoCrossSolver.wasm with center_offset {0, y, y2, y'}; Δ=0 results are
    // dropped (they duplicate regular cross). For each Δ≠0 result we detect which
    // D-class fix-up (D / D2 / D') re-aligns the cross to canonical and append it
    // to the alg as a (visible) 0-HTM fix-up. F2L planner sees a canonical state.
    const r = await runAnalyzer('fixed', {
      scramble: REFERENCE_SCRAMBLE,
      crosscolors: { Yellow: false, White: true, Red: false, Orange: false, Blue: false, Green: false },
      howfar: 4,
      variant: 'pseudo',
      stage: 'cross',
    });
    expect(r.solutions.length).toBeGreaterThan(0);
    const hasPseudoLabel = r.solutions.some((s) => /\bpCross\b/.test(s[1]));
    expect(hasPseudoLabel).toBe(true);
    const pseudo = r.solutions.find((s) => /\bpCross\b/.test(s[1]))!;
    // D-class fix-up must be present in the alg
    expect(/\[\+(D|D2|D')\]/.test(pseudo[1])).toBe(true);
  }, 60_000);

  it('Pseudo xcross via wasm: emits at least one pXCross solution with D-fix marker', async () => {
    const r = await runAnalyzer('fixed', {
      scramble: REFERENCE_SCRAMBLE,
      crosscolors: { Yellow: false, White: true, Red: false, Orange: false, Blue: false, Green: false },
      howfar: 1,
      variant: 'pseudo',
      stage: 'xcross',
    });
    expect(r.solutions.length).toBeGreaterThan(0);
    expect(r.solutions.some((s) => /\bpXCross\b/.test(s[1]))).toBe(true);
    const p = r.solutions.find((s) => /\bpXCross\b/.test(s[1]))!;
    expect(/\[\+(D|D2|D')\]/.test(p[1])).toBe(true);
  }, 60_000);

  it('Pseudo xxcross via wasm: emits at least one pXXCross solution', async () => {
    const r = await runAnalyzer('fixed', {
      scramble: REFERENCE_SCRAMBLE,
      crosscolors: { Yellow: false, White: true, Red: false, Orange: false, Blue: false, Green: false },
      howfar: 2,
      variant: 'pseudo',
      stage: 'xxcross',
    });
    expect(r.solutions.length).toBeGreaterThan(0);
    expect(r.solutions.some((s) => /\bpXXCross\b/.test(s[1]))).toBe(true);
  }, 120_000);

  it('Pseudo xxxcross via wasm: emits at least one pXXXCross solution', async () => {
    const r = await runAnalyzer('fixed', {
      scramble: REFERENCE_SCRAMBLE,
      crosscolors: { Yellow: false, White: true, Red: false, Orange: false, Blue: false, Green: false },
      howfar: 3,
      variant: 'pseudo',
      stage: 'xxxcross',
    });
    expect(r.solutions.length).toBeGreaterThan(0);
    expect(r.solutions.some((s) => /\bpXXXCross\b/.test(s[1]))).toBe(true);
  }, 120_000);

  it('EOCross variant: WR seed white-only emits at least one EO+Cross-labeled solution', async () => {
    const r = await runAnalyzer('fixed', {
      scramble: REFERENCE_SCRAMBLE,
      crosscolors: { Yellow: false, White: true, Red: false, Orange: false, Blue: false, Green: false },
      howfar: 4,
      variant: 'eo',
      stage: 'cross',
    });
    expect(r.solutions.length).toBeGreaterThan(0);
    expect(r.solutions.some((s) => /\bEO\+Cross\b/.test(s[1]))).toBe(true);
  }, 90_000);

  it('EOCross variant: xcross stage emits EO+XCross-labeled solution', async () => {
    const r = await runAnalyzer('fixed', {
      scramble: REFERENCE_SCRAMBLE,
      crosscolors: { Yellow: false, White: true, Red: false, Orange: false, Blue: false, Green: false },
      howfar: 1,
      variant: 'eo',
      stage: 'xcross',
    });
    expect(r.solutions.length).toBeGreaterThan(0);
    expect(r.solutions.some((s) => /\bEO\+XCross\b/.test(s[1]))).toBe(true);
  }, 120_000);

  it('Cross+Pair variant: WR seed white-only emits at least one Cross+Pair solution', async () => {
    const r = await runAnalyzer('fixed', {
      scramble: REFERENCE_SCRAMBLE,
      crosscolors: { Yellow: false, White: true, Red: false, Orange: false, Blue: false, Green: false },
      howfar: 4,
      variant: 'pair',
      stage: 'cross',
    });
    expect(r.solutions.length).toBeGreaterThan(0);
    expect(r.solutions.some((s) => /\bCross\+Pair\b/.test(s[1]))).toBe(true);
  }, 60_000);

  it('Cross+Pair variant: xcross stage emits XCross+Pair solution', async () => {
    const r = await runAnalyzer('fixed', {
      scramble: REFERENCE_SCRAMBLE,
      crosscolors: { Yellow: false, White: true, Red: false, Orange: false, Blue: false, Green: false },
      howfar: 2,
      variant: 'pair',
      stage: 'xcross',
    });
    expect(r.solutions.length).toBeGreaterThan(0);
    expect(r.solutions.some((s) => /\bXCross\+Pair\b/.test(s[1]))).toBe(true);
  }, 120_000);

  it('PseudoPair variant: cross stage emits pCross+pPair solution with D-fix marker', async () => {
    const r = await runAnalyzer('fixed', {
      scramble: REFERENCE_SCRAMBLE,
      crosscolors: { Yellow: false, White: true, Red: false, Orange: false, Blue: false, Green: false },
      howfar: 4,
      variant: 'pseudo_pair',
      stage: 'cross',
    });
    expect(r.solutions.length).toBeGreaterThan(0);
    expect(r.solutions.some((s) => /\bpCross\+pPair\b/.test(s[1]))).toBe(true);
    const pseudoPair = r.solutions.find((s) => /\bpCross\+pPair\b/.test(s[1]))!;
    expect(/\+(D|D2|D')/.test(pseudoPair[1])).toBe(true);
  }, 90_000);

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
