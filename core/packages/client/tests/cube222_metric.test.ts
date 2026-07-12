// Verifies lib/cube222-metric against the home-grown essential-case oracle (stats/scramble/2x2_essential_cases.json).
// HTM/QTM full-solve distances and the color-neutral bottom-face distance are all symmetry-class invariants, so the
// state of every essential case (reconstructed from the inverse of its stored HTM-optimal solution) must reproduce
// that case's stored H, Q and F exactly.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { _test, generate222ByMetric, create222MetricEvaluator, type Cube222Metric } from '@/lib/cube222-metric';

const casesPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../stats/scramble/2x2_essential_cases.json');
const cases: [number, string, number, number, number, number, string | null, number[] | null, number][] =
  JSON.parse(readFileSync(casesPath, 'utf8')).rows;

function invert(alg: string): string {
  return alg.trim().split(/\s+/).filter(Boolean).reverse()
    .map((m) => (m.endsWith('2') ? m : m.endsWith("'") ? m.slice(0, -1) : `${m}'`)).join(' ');
}
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe('cube222-metric vs essential-case oracle', () => {
  it('reproduces H and F for a spread of essential cases', () => {
    const N = cases.length;
    expect(N).toBe(77801);
    const STEP = Math.floor(N / 400) || 1;
    let hFail = 0, fFail = 0, checked = 0;
    for (let i = 0; i < N; i += STEP) {
      const [, hAlg, F, H] = cases[i];
      const s = _test.applyScramble(invert(hAlg));      // reconstruct the case state
      if (_test.solveHTMLen(s) !== H) hFail++;
      if (_test.bottomFaceDist(s) !== F) fFail++;
      checked++;
    }
    expect(checked).toBeGreaterThan(300);
    expect(hFail).toBe(0);
    expect(fFail).toBe(0);
  });

  it('reproduces Q for moderate-depth cases (QTM IDA* kept ≤ 11)', () => {
    // Full-solve HTM/QTM distances (U/R/F-restricted) are NOT symmetry-invariant, so stored Q is the orbit MINIMUM,
    // reached by the min-QTM member that qAlg solves (qAlg=null ⇒ QH==Q ⇒ hAlg's member is already min-QTM).
    const N = cases.length;
    const STEP = Math.floor(N / 200) || 1;
    let qFail = 0, checked = 0;
    for (let i = 0; i < N; i += STEP) {
      const [, hAlg, , , , Q, qAlg] = cases[i];
      if (Q > 11) continue; // skip the deepest QTM cases to keep the test fast
      const s = _test.applyScramble(invert((qAlg as string | null) ?? hAlg));
      if (_test.distQTM(s) !== Q) qFail++;
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
    expect(qFail).toBe(0);
  });

  it('create222MetricEvaluator (full-space BFS tables) matches the per-scramble IDA*/subgoal path', () => {
    const evaluate = create222MetricEvaluator();
    // solved state: all four metrics 0
    expect(evaluate('')).toEqual({ face: 0, layer: 0, htm: 0, qtm: 0 });
    // non-U/R/F tokens are unmeasurable in the fixed-DBL model — must match cube222MetricOfScramble
    expect(evaluate('R L')).toBeNull();
    // face/htm vs the stored essential-case oracle (both symmetry-class invariants), qtm/layer vs the
    // live IDA*/subgoal path — the evaluator must agree on every sampled case.
    const N = cases.length;
    const STEP = Math.floor(N / 150) || 1;
    let checked = 0;
    for (let i = 0; i < N; i += STEP) {
      const [, hAlg, F, H] = cases[i];
      const scr = invert(hAlg);
      const v = evaluate(scr);
      expect(v, `unmeasurable: "${scr}"`).not.toBeNull();
      expect(v!.face, `face of "${scr}"`).toBe(F);
      expect(v!.htm, `htm of "${scr}"`).toBe(H);
      const s = _test.applyScramble(scr);
      expect(v!.layer, `layer of "${scr}"`).toBe(_test.metricOf(s, 'layer'));
      expect(v!.qtm, `qtm of "${scr}"`).toBe(_test.distQTM(s));
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('generate222ByMetric yields scrambles with the requested metric value', () => {
    const r = rng(12345);
    const checks: Array<{ metric: Cube222Metric; lo: number; hi: number }> = [
      { metric: 'face', lo: 0, hi: 0 },
      { metric: 'face', lo: 3, hi: 3 },
      { metric: 'face', lo: 5, hi: 5 },   // rare (0.05%) — exercises rejection depth
      { metric: 'layer', lo: 4, hi: 4 },
      { metric: 'htm', lo: 9, hi: 9 },
      { metric: 'htm', lo: 6, hi: 7 },
    ];
    for (const { metric, lo, hi } of checks) {
      for (let k = 0; k < 6; k++) {
        const scr = generate222ByMetric(metric, lo, hi, r, 40000);
        const s = _test.applyScramble(scr);
        const d = _test.metricOf(s, metric);
        expect(d, `${metric} [${lo},${hi}] got ${d} for "${scr}"`).toBeGreaterThanOrEqual(lo);
        expect(d, `${metric} [${lo},${hi}] got ${d} for "${scr}"`).toBeLessThanOrEqual(hi);
        // scramble must only use U/R/F tokens
        expect(/^[URF2' ]*$/.test(scr)).toBe(true);
      }
    }
  });
});
