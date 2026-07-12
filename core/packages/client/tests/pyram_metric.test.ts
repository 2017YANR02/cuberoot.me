// Verifies the pyraminx metric (app/[lang]/timer/_lib/scramble/pyram-metric) against the home-grown
// essential-case oracle (stats/scramble/pyram_essential_cases.json). Each case stores [idx, alg, V, H]
// where alg is a body-only (no-tips) HTM-optimal SOLVE. The scramble = inverse of that solve, so:
//   cubeDist(scramble) must equal H  (full-solve HTM, tips excluded)
//   vDist(scramble)    must equal V  (V-first V step, min over the 4 face frames)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pyramMetricOf, generatePyramByMetric, PYRAM_METRIC_RANGE } from '@/app/[lang]/timer/_lib/scramble/pyram-metric';

const casesPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../stats/scramble/pyram_essential_cases.json');
const cases: [number, string, number, number][] = JSON.parse(readFileSync(casesPath, 'utf8')).rows;

// Invert a body-only pyraminx alg (R U L B, optional '; never "2").
function invert(alg: string): string {
  return alg.trim().split(/\s+/).filter(Boolean).reverse()
    .map((m) => (m.endsWith("'") ? m.slice(0, -1) : `${m}'`)).join(' ');
}
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe('pyram-metric vs essential-case oracle', () => {
  it('reproduces V and H (cube) for a spread of essential cases', () => {
    const N = cases.length;
    expect(N).toBe(39035);
    const STEP = Math.floor(N / 250) || 1;
    let vFail = 0, hFail = 0, checked = 0;
    for (let i = 0; i < N; i += STEP) {
      const [, alg, V, H] = cases[i];
      const scr = invert(alg);
      if (pyramMetricOf(scr, 'cube') !== H) hFail++;
      if (pyramMetricOf(scr, 'v') !== V) vFail++;
      checked++;
    }
    expect(checked).toBeGreaterThan(150);
    expect(hFail).toBe(0);
    expect(vFail).toBe(0);
  });

  it('generatePyramByMetric yields scrambles with the requested metric value', () => {
    const r = rng(9876);
    const checks: Array<{ metric: 'v' | 'cube'; lo: number; hi: number }> = [
      { metric: 'v', lo: 2, hi: 3 },
      { metric: 'v', lo: 5, hi: 5 },
      { metric: 'cube', lo: 8, hi: 9 },
      { metric: 'cube', lo: 6, hi: 7 },
    ];
    for (const { metric, lo, hi } of checks) {
      const [rMin, rMax] = PYRAM_METRIC_RANGE[metric];
      expect(lo).toBeGreaterThanOrEqual(rMin);
      expect(hi).toBeLessThanOrEqual(rMax);
      for (let k = 0; k < 4; k++) {
        const scr = generatePyramByMetric(metric, lo, hi, r, 6000);
        const d = pyramMetricOf(scr, metric);
        expect(d, `${metric} [${lo},${hi}] got ${d} for "${scr}"`).toBeGreaterThanOrEqual(lo);
        expect(d, `${metric} [${lo},${hi}] got ${d} for "${scr}"`).toBeLessThanOrEqual(hi);
      }
    }
  });
});
